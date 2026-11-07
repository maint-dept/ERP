/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Email Configuration Component (Admin Panel)
 * High-performance, executive SMTP setup, live diagnostics, and automated delivery system.
 */

import { emailService, getEmailApiBaseUrl } from '../services/emailService.js';
import { authService } from '../services/authService.js';
import { state } from '../state.js';
import { notificationService } from '../services/notificationService.js';
import { icon } from './icons.js?v=4.47.0';

export function renderEmailConfigView() {
  const config = emailService.getConfig();
  const isConfigured = emailService.isEmailConfigured();
  const emailLogs = emailService.getEmailLogs();
  const activeUser = authService.getCurrentUser();

  const isSuccess = config.lastTestStatus === 'SUCCESS';
  const isFailed = config.lastTestStatus === 'FAILED';

  let testStatusBadge = '<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; font-size: 10px; font-weight: 700; padding: 2px 8px; border: 1px solid rgba(148, 163, 184, 0.3);">⚪ NEVER TESTED</span>';
  if (isSuccess) {
    const detail = config.lastTestMode === 'HANDSHAKE' 
      ? `Handshake Verified${config.latencyMs ? ' (' + config.latencyMs + 'ms)' : ''}`
      : `Delivered to ${config.lastTestRecipient || config.fromEmail}`;
    testStatusBadge = `<span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; font-size: 10px; font-weight: 800; padding: 2px 8px; border: 1px solid rgba(34, 197, 94, 0.4);" title="${detail}">🟢 PASSED</span>`;
  } else if (isFailed) {
    testStatusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; font-weight: 800; padding: 2px 8px; border: 1px solid rgba(239, 68, 68, 0.4);" title="${config.lastTestError || 'Failed'}">🔴 FAILED</span>`;
  }

  return `
    <div class="page-view email-config-page" style="gap: 14px; max-width: 1280px; margin: 0 auto; width: 100%; padding-bottom: 30px;">
      
      <!-- Top Header Navigation & Status Strip -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.22);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(2, 132, 199, 0.18); border: 1.5px solid rgba(56, 189, 248, 0.45); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);">
            ✉️
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h1 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px;">
                Email Configuration &amp; SMTP Gateway
              </h1>
              <span id="header-config-badge" class="badge ${isConfigured ? 'badge-active' : 'badge-maint'}" style="font-size: 10.5px; padding: 2px 8px; font-weight: 800;">
                ${isConfigured ? '🟢 CONFIGURED &amp; ACTIVE' : '🟡 NOT CONFIGURED'}
              </span>
            </div>
            <p style="font-size: 11.5px; color: var(--text-secondary); margin: 3px 0 0 0;">
              Configure outgoing SMTP mail server for automated alerts, dispatch logs, and password recovery.
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-quick-verify-connection-top" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 6px 14px; height: 32px; border-color: rgba(56, 189, 248, 0.45); color: #38bdf8; display: inline-flex; align-items: center; gap: 6px;">
            <span>⚡</span> Test Handshake
          </button>
          <button type="button" id="btn-open-test-email-modal" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 6px 14px; height: 32px; border-color: rgba(56, 189, 248, 0.5); color: #fff; background: rgba(2, 132, 199, 0.15); display: inline-flex; align-items: center; gap: 6px;">
            <span>🧪</span> Send Test Email
          </button>
          <button type="button" id="btn-save-email-config" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11.5px; padding: 6px 18px; height: 32px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35); display: inline-flex; align-items: center; gap: 6px;">
            <span>💾</span> Save Settings
          </button>
        </div>
      </div>

      <!-- Quick Guidance & Important Notice (Compact Ribbon) -->
      <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 9px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #e2e8f0;">
          <span style="font-size: 16px;">💡</span>
          <span>
            <strong style="color: #38bdf8;">Gmail / Workspace:</strong> Requires a 16-char App Password (generate at 
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 700;">
              Google App Passwords ↗
            </a>).
          </span>
        </div>
        <div style="font-size: 11px; color: #34d399; font-weight: 700; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 10px; border-radius: 5px;">
          ✅ Password Reset OTP is also displayed on-screen (Email is 100% optional)
        </div>
      </div>

      <!-- Main Form & Settings Grid -->
      <div class="email-config-grid" style="display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 14px; align-items: start;">
        
        <!-- Left: SMTP Form Card -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.18);">
          
          <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">⚙️</span>
              <h2 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0;">
                SMTP Server Parameters
              </h2>
            </div>

            <!-- Quick Preset Buttons -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700; margin-right: 2px;">PRESETS:</span>
              <button type="button" class="btn btn-secondary btn-sm btn-preset-smtp" data-host="smtp.gmail.com" data-port="587" data-enc="TLS" style="font-size: 10.5px; padding: 2px 8px; height: 26px; border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; font-weight: 700;">
                🔴 Gmail (587 TLS)
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-preset-smtp" data-host="smtp.gmail.com" data-port="465" data-enc="SSL" style="font-size: 10.5px; padding: 2px 8px; height: 26px; border-color: rgba(239, 68, 68, 0.4); color: #fca5a5; font-weight: 700;">
                🛡️ Gmail (465 SSL)
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-preset-smtp" data-host="smtp.office365.com" data-port="587" data-enc="TLS" style="font-size: 10.5px; padding: 2px 8px; height: 26px; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 700;">
                🔵 Outlook / 365
              </button>
              <button type="button" class="btn btn-secondary btn-sm btn-preset-smtp" data-host="smtp.mail.yahoo.com" data-port="587" data-enc="TLS" style="font-size: 10.5px; padding: 2px 8px; height: 26px; border-color: rgba(148, 163, 184, 0.4); color: #e2e8f0; font-weight: 700;">
                🟣 Yahoo Mail
              </button>
            </div>
          </div>

          <form id="form-email-config" style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Sender Information Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                  From Name <span class="req" style="color: #f87171;">*</span>
                </label>
                <input 
                  type="text" 
                  id="cfg-from-name" 
                  class="form-control" 
                  placeholder="e.g. Al-Muslim ERP System" 
                  value="${config.fromName || 'Al-Muslim ERP System'}" 
                  required 
                  style="font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Display name in recipient's inbox.</div>
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                  From Email Address <span class="req" style="color: #f87171;">*</span>
                </label>
                <input 
                  type="email" 
                  id="cfg-from-email" 
                  class="form-control" 
                  placeholder="e.g. maint.dept2023@gmail.com" 
                  value="${config.fromEmail || ''}" 
                  required 
                  style="font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Sender address for outgoing emails.</div>
              </div>
            </div>

            <!-- Server Connection Row -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                  SMTP Host Server <span class="req" style="color: #f87171;">*</span>
                </label>
                <input 
                  type="text" 
                  id="cfg-smtp-host" 
                  class="form-control" 
                  placeholder="smtp.gmail.com" 
                  value="${config.smtpHost || ''}" 
                  required 
                  style="font-family: var(--font-mono); font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Mail server host address.</div>
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                  SMTP Port <span class="req" style="color: #f87171;">*</span>
                </label>
                <input 
                  type="number" 
                  id="cfg-smtp-port" 
                  class="form-control" 
                  placeholder="587" 
                  value="${config.smtpPort || '587'}" 
                  required 
                  style="font-family: var(--font-mono); font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">587 (TLS), 465 (SSL).</div>
              </div>
            </div>

            <!-- Authentication Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                  SMTP Username <span class="req" style="color: #f87171;">*</span>
                </label>
                <input 
                  type="text" 
                  id="cfg-smtp-user" 
                  class="form-control" 
                  placeholder="e.g. maint.dept2023@gmail.com" 
                  value="${config.smtpUser || ''}" 
                  required 
                  style="font-family: var(--font-mono); font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Email login / account user.</div>
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                  <span>SMTP Password / App Password <span class="req" style="color: #f87171;">*</span></span>
                  <span id="pass-indicator-badge" style="font-size: 9.5px; color: #38bdf8; font-weight: 700;"></span>
                </label>
                <div style="position: relative;">
                  <input 
                    type="password" 
                    id="cfg-smtp-pass" 
                    class="form-control" 
                    placeholder="•••••••••••••••• (16-char code)" 
                    value="${config.smtpPass || ''}" 
                    style="padding-right: 36px; font-size: 12.5px; height: 34px;"
                  />
                  <span id="btn-toggle-smtp-pass" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.75; font-size: 14px; display: inline-flex; align-items: center;" title="Toggle Password Visibility">${icon('eye', 14)}</span>
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">16-character Google App Password (auto-strips spaces).</div>
              </div>
            </div>

            <!-- Encryption Method Radio Selector -->
            <div class="form-group" style="margin: 2px 0 0 0;">
              <label class="form-label" style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
                Encryption Protocol:
              </label>
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; background: var(--bg-card); border: 1.5px solid ${config.encryption === 'TLS' || !config.encryption ? '#0284c7' : 'var(--border-color)'}; padding: 7px 14px; border-radius: 6px; transition: all 0.2s;">
                  <input 
                    type="radio" 
                    name="cfg-encryption" 
                    id="enc-tls"
                    value="TLS" 
                    ${config.encryption === 'TLS' || !config.encryption ? 'checked' : ''} 
                    style="cursor: pointer; accent-color: #0284c7;"
                  />
                  <span>🔒 <strong>TLS / STARTTLS</strong> (Port 587 - Standard)</span>
                </label>

                <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; background: var(--bg-card); border: 1.5px solid ${config.encryption === 'SSL' ? '#0284c7' : 'var(--border-color)'}; padding: 7px 14px; border-radius: 6px; transition: all 0.2s;">
                  <input 
                    type="radio" 
                    name="cfg-encryption" 
                    id="enc-ssl"
                    value="SSL" 
                    ${config.encryption === 'SSL' ? 'checked' : ''} 
                    style="cursor: pointer; accent-color: #0284c7;"
                  />
                  <span>🛡️ <strong>SSL</strong> (Port 465)</span>
                </label>
              </div>
            </div>

            <!-- Live Status / Result Alert Box -->
            <div id="inline-test-status-alert" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 12px; line-height: 1.45; margin-top: 6px;"></div>

            <!-- Form Action Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-color); margin-top: 4px; flex-wrap: wrap; gap: 10px;">
              <button type="button" id="btn-clear-email-config" class="btn btn-ghost btn-sm" style="color: #f87171; font-size: 11px; padding: 4px 10px;">
                🗑️ Clear Config
              </button>
              
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" id="btn-quick-verify-connection" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 6px 12px; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
                  ⚡ Handshake
                </button>
                <button type="button" id="btn-test-email-inline" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 6px 12px;">
                  🧪 Send Test
                </button>
                <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 6px 20px;">
                  💾 Save Configuration
                </button>
              </div>
            </div>

          </form>
        </div>

        <!-- Right: Status Card & Instructions -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          
          <!-- Status Summary Card -->
          <div id="diagnostics-health-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.18);">
            <h3 style="font-size: 13px; font-weight: 800; color: #38bdf8; margin: 0 0 10px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
              <span>📊</span> Service Diagnostics &amp; Health
            </h3>

            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 11.5px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted); font-weight: 600;">Gateway Status:</span>
                <span id="diag-status-badge" class="badge ${isConfigured ? 'badge-active' : 'badge-inactive'}" style="font-size: 10px; padding: 2px 8px; font-weight: 800;">
                  ${isConfigured ? '🟢 ACTIVE' : '🟡 INCOMPLETE'}
                </span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted); font-weight: 600;">Protocol &amp; Port:</span>
                <strong id="diag-proto-port" style="color: #fff; font-family: var(--font-mono); font-size: 11px;">
                  ${config.encryption || 'TLS'} : ${config.smtpPort || '587'}
                </strong>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted); font-weight: 600;">Sender Account:</span>
                <span id="diag-sender-account" style="color: #38bdf8; font-family: var(--font-mono); font-size: 11px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${config.fromEmail || config.smtpUser || 'Not set'}">
                  ${config.fromEmail || config.smtpUser || 'Not set'}
                </span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-muted); font-weight: 600;">Last Test Status:</span>
                <div id="diag-test-badge">
                  ${testStatusBadge}
                </div>
              </div>

              <div id="diag-test-details" style="${config.lastTestedAt ? 'display: flex;' : 'display: none;'} justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 4px;">
                <span style="color: var(--text-muted); font-size: 10.5px;">Last Tested At:</span>
                <span id="diag-tested-at-val" style="font-size: 10.5px; color: var(--text-secondary); font-family: var(--font-mono);">
                  ${config.lastTestedAt ? `${new Date(config.lastTestedAt).toLocaleDateString()} ${new Date(config.lastTestedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : ''}
                </span>
              </div>
            </div>
          </div>

          <!-- Step-by-Step Google App Password Guide -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.18);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
              <h3 style="font-size: 13px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
                <span>🔑</span> Google App Password Guide
              </h3>
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="font-size: 10.5px; color: #38bdf8; padding: 2px 8px; height: 24px; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px;">
                Open Setup ↗
              </a>
            </div>
            
            <ol style="margin: 0; padding-left: 18px; font-size: 11.5px; color: var(--text-secondary); line-height: 1.6;">
              <li>Visit <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">myaccount.google.com</a>.</li>
              <li>Enable <strong>2-Step Verification</strong> under Security.</li>
              <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">App Passwords</a>.</li>
              <li>Name it <strong>ERP Mailer</strong> and copy the <strong>16-character code</strong>.</li>
            </ol>
          </div>

        </div>

      </div>

      <!-- Outgoing Email Activity History -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.18);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h3 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>📨</span> Outgoing Email Activity Log
            </h3>
            <span id="email-log-count-badge" class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border: 1px solid rgba(56, 189, 248, 0.35);">
              ${emailLogs.length} Records
            </span>
          </div>

          ${emailLogs.length > 0 ? `
            <button id="btn-clear-email-logs" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #f87171; padding: 4px 10px; height: 28px; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px;">
              🗑️ Clear Activity Logs
            </button>
          ` : ''}
        </div>

        <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow-x: auto; max-height: 400px;">
          <table class="excel-grid" id="table-email-logs" style="width: 100%; margin: 0; font-size: 11.5px; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: var(--bg-card); border-bottom: 1.5px solid var(--border-color);">
                <th style="width: 45px; text-align: center; padding: 8px;">SL</th>
                <th style="padding: 8px 12px;">SUBJECT / TYPE</th>
                <th style="padding: 8px 12px;">RECIPIENT</th>
                <th style="width: 90px; text-align: center; padding: 8px;">STATUS</th>
                <th style="width: 160px; padding: 8px 12px;">DISPATCHED AT</th>
                <th style="text-align: center; width: 80px; padding: 8px;">ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${emailLogs.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 12px;">
                    No outgoing emails logged yet. Click "Send Test Email" or "Test Handshake" to verify.
                  </td>
                </tr>
              ` : emailLogs.map((log, idx) => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-size: 11px; padding: 8px;">${idx + 1}</td>
                  <td style="padding: 8px 12px;">
                    <div style="font-weight: 700; color: #fff; font-size: 12px;">${log.subject || 'System Notification'}</div>
                    <div style="font-size: 10px; color: #38bdf8; font-family: var(--font-mono); margin-top: 1px;">${log.type || 'NOTIFICATION'}</div>
                  </td>
                  <td style="padding: 8px 12px;">
                    <div style="font-family: var(--font-mono); font-size: 11.5px; color: #e2e8f0;">${log.to}</div>
                    ${log.recipientName ? `<div style="font-size: 10px; color: var(--text-muted);">${log.recipientName}</div>` : ''}
                  </td>
                  <td style="text-align: center; padding: 8px;">
                    <span class="badge ${log.status === 'SENT' ? 'badge-active' : 'badge-breakdown'}" style="font-size: 10px; padding: 2px 7px;">
                      ${log.status || 'SENT'}
                    </span>
                  </td>
                  <td style="font-size: 11px; color: var(--text-secondary); padding: 8px 12px;">
                    ${new Date(log.timestamp).toLocaleDateString()} ${new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td style="text-align: center; padding: 8px;">
                    <button class="btn btn-secondary btn-sm btn-view-mail-content" data-id="${log.id}" style="padding: 3px 8px; font-size: 10.5px; height: 26px;">
                      👁️ View
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

/**
 * Helper to read current input values directly from the active form
 */
function readCurrentFormConfig() {
  const fromName = document.getElementById('cfg-from-name')?.value?.trim() || 'Al-Muslim ERP System';
  const fromEmail = document.getElementById('cfg-from-email')?.value?.trim().toLowerCase() || '';
  const smtpHost = document.getElementById('cfg-smtp-host')?.value?.trim() || '';
  const smtpPort = document.getElementById('cfg-smtp-port')?.value?.trim() || '587';
  const smtpUser = document.getElementById('cfg-smtp-user')?.value?.trim() || '';
  const rawPass = document.getElementById('cfg-smtp-pass')?.value || '';
  const smtpPass = rawPass.trim().replace(/\s+/g, '');
  const encryption = document.querySelector('input[name="cfg-encryption"]:checked')?.value || 'TLS';

  return {
    fromName,
    fromEmail,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    encryption
  };
}

/**
 * Dynamically refresh the Diagnostics & Health card in-place
 */
function updateDiagnosticsUI(activeConfig, testStatus, detailMsg = '') {
  const isConfigured = Boolean(activeConfig.fromEmail && activeConfig.smtpHost && activeConfig.smtpPort && activeConfig.smtpUser);
  const statusBadge = document.getElementById('diag-status-badge');
  const headerBadge = document.getElementById('header-config-badge');
  const protoPort = document.getElementById('diag-proto-port');
  const senderAccount = document.getElementById('diag-sender-account');
  const testBadge = document.getElementById('diag-test-badge');
  const testDetails = document.getElementById('diag-test-details');
  const testedAtVal = document.getElementById('diag-tested-at-val');

  if (statusBadge) {
    statusBadge.className = `badge ${isConfigured ? 'badge-active' : 'badge-inactive'}`;
    statusBadge.textContent = isConfigured ? '🟢 ACTIVE' : '🟡 INCOMPLETE';
  }
  if (headerBadge) {
    headerBadge.className = `badge ${isConfigured ? 'badge-active' : 'badge-maint'}`;
    headerBadge.textContent = isConfigured ? '🟢 CONFIGURED & ACTIVE' : '🟡 NOT CONFIGURED';
  }
  if (protoPort) {
    protoPort.textContent = `${activeConfig.encryption || 'TLS'} : ${activeConfig.smtpPort || '587'}`;
  }
  if (senderAccount) {
    const acc = activeConfig.fromEmail || activeConfig.smtpUser || 'Not set';
    senderAccount.textContent = acc;
    senderAccount.title = acc;
  }
  if (testBadge) {
    if (testStatus === 'SUCCESS') {
      testBadge.innerHTML = `<span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; font-size: 10px; font-weight: 800; padding: 2px 8px; border: 1px solid rgba(34, 197, 94, 0.4);" title="${detailMsg || 'Verified'}">🟢 PASSED</span>`;
    } else if (testStatus === 'FAILED') {
      testBadge.innerHTML = `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; font-weight: 800; padding: 2px 8px; border: 1px solid rgba(239, 68, 68, 0.4);" title="${detailMsg || 'Failed'}">🔴 FAILED</span>`;
    }
  }
  if (testDetails && testedAtVal) {
    testDetails.style.display = 'flex';
    const now = new Date();
    testedAtVal.textContent = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  }
}

export function initEmailConfigEvents() {
  const form = document.getElementById('form-email-config');

  // 1. Preset Buttons (1-click fill for Gmail, Outlook, Yahoo)
  document.querySelectorAll('.btn-preset-smtp').forEach(btn => {
    btn.addEventListener('click', () => {
      const host = btn.getAttribute('data-host');
      const port = btn.getAttribute('data-port');
      const enc = btn.getAttribute('data-enc');

      const inpHost = document.getElementById('cfg-smtp-host');
      const inpPort = document.getElementById('cfg-smtp-port');
      const radTls = document.getElementById('enc-tls');
      const radSsl = document.getElementById('enc-ssl');

      if (inpHost) inpHost.value = host;
      if (inpPort) inpPort.value = port;
      if (enc === 'SSL' && radSsl) radSsl.checked = true;
      else if (radTls) radTls.checked = true;

      // Suggest username if empty
      const inpUser = document.getElementById('cfg-smtp-user');
      const inpFrom = document.getElementById('cfg-from-email');
      if (inpFrom && inpFrom.value && (!inpUser || !inpUser.value)) {
        inpUser.value = inpFrom.value;
      }

      if (window.__erpApp?.showToast) {
        window.__erpApp.showToast('ℹ️ Preset Selected', `${host}:${port} (${enc}) configured.`, 'info');
      }
    });
  });

  // 2. Real-Time App Password Helper & Sanitizer
  const inputPass = document.getElementById('cfg-smtp-pass');
  const passIndicator = document.getElementById('pass-indicator-badge');
  if (inputPass && passIndicator) {
    const updatePassIndicator = () => {
      const val = inputPass.value || '';
      const cleanLen = val.replace(/\s+/g, '').length;
      if (cleanLen === 16) {
        passIndicator.textContent = '✓ 16-char App Password';
        passIndicator.style.color = '#34d399';
      } else if (cleanLen > 0) {
        passIndicator.textContent = `${cleanLen}/16 chars`;
        passIndicator.style.color = '#38bdf8';
      } else {
        passIndicator.textContent = '';
      }
    };
    inputPass.addEventListener('input', updatePassIndicator);
    updatePassIndicator();
  }

  // 3. Save Configuration Handler
  const submitFormConfig = () => {
    try {
      const currentConfig = readCurrentFormConfig();
      emailService.saveConfig(currentConfig);

      if (window.__erpApp?.showToast) {
        window.__erpApp.showToast('✅ Configuration Saved', 'SMTP settings saved and synced to cloud.', 'success');
      }

      updateDiagnosticsUI(currentConfig, emailService.getConfig().lastTestStatus);

      const alertBox = document.getElementById('inline-test-status-alert');
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
        alertBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        alertBox.style.color = '#34d399';
        alertBox.innerHTML = `✅ <strong>Settings Saved!</strong> SMTP configuration updated and synced to cloud.`;
        setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
      }
    } catch (err) {
      if (window.__erpApp?.showToast) {
        window.__erpApp.showToast('❌ Error Saving Email Config', err.message, 'danger');
      } else {
        alert('Error: ' + err.message);
      }
    }
  };

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitFormConfig();
    });
  }

  // Top header save button
  const btnSaveTop = document.getElementById('btn-save-email-config');
  if (btnSaveTop) {
    btnSaveTop.addEventListener('click', (e) => {
      e.preventDefault();
      submitFormConfig();
    });
  }

  // 4. Toggle Password Visibility
  const btnTogglePass = document.getElementById('btn-toggle-smtp-pass');
  if (btnTogglePass && inputPass) {
    btnTogglePass.addEventListener('click', () => {
      if (inputPass.type === 'password') {
        inputPass.type = 'text';
        btnTogglePass.innerHTML = icon('eyeOff', 14);
      } else {
        inputPass.type = 'password';
        btnTogglePass.innerHTML = icon('eye', 14);
      }
    });
  }

  // 5. Test Handshake Action (Verified directly against mail server)
  const performQuickHandshake = async (btn) => {
    const activeConfig = readCurrentFormConfig();
    const inlineStatusBox = document.getElementById('inline-test-status-alert');

    if (!activeConfig.smtpHost || !activeConfig.smtpUser) {
      if (inlineStatusBox) {
        inlineStatusBox.style.display = 'block';
        inlineStatusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        inlineStatusBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        inlineStatusBox.style.color = '#f87171';
        inlineStatusBox.innerHTML = '❌ Please enter SMTP Host and Username first.';
      }
      return;
    }

    const origText = btn ? btn.innerHTML : '';
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Connecting...';
      }

      if (inlineStatusBox) {
        inlineStatusBox.style.display = 'block';
        inlineStatusBox.style.background = 'rgba(56, 189, 248, 0.15)';
        inlineStatusBox.style.border = '1px solid rgba(56, 189, 248, 0.4)';
        inlineStatusBox.style.color = '#38bdf8';
        inlineStatusBox.innerHTML = `<span>⏳</span> Connecting to <strong>${activeConfig.smtpHost}:${activeConfig.smtpPort}</strong> (${activeConfig.encryption || 'TLS'})...`;
      }

      const res = await emailService.verifyConnection(activeConfig);

      if (inlineStatusBox) {
        inlineStatusBox.style.background = 'rgba(16, 185, 129, 0.15)';
        inlineStatusBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        inlineStatusBox.style.color = '#34d399';
        inlineStatusBox.innerHTML = `✅ <strong>Handshake Succeeded!</strong> ${res.message}`;
      }

      updateDiagnosticsUI(activeConfig, 'SUCCESS', res.message);

      if (window.__erpApp?.showToast) {
        window.__erpApp.showToast('✅ SMTP Connected', res.message, 'success');
      }
    } catch (err) {
      if (inlineStatusBox) {
        inlineStatusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        inlineStatusBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        inlineStatusBox.style.color = '#f87171';
        inlineStatusBox.innerHTML = `❌ <strong>Connection Failed:</strong> ${err.message}`;
      }

      updateDiagnosticsUI(activeConfig, 'FAILED', err.message);

      if (window.__erpApp?.showToast) {
        window.__erpApp.showToast('❌ Connection Failed', err.message, 'danger');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  };

  const btnQuickVerify = document.getElementById('btn-quick-verify-connection');
  if (btnQuickVerify) {
    btnQuickVerify.addEventListener('click', () => performQuickHandshake(btnQuickVerify));
  }

  const btnQuickVerifyTop = document.getElementById('btn-quick-verify-connection-top');
  if (btnQuickVerifyTop) {
    btnQuickVerifyTop.addEventListener('click', () => performQuickHandshake(btnQuickVerifyTop));
  }

  // Ensure any stale modal is cleanly removed
  document.getElementById('modal-test-email-overlay')?.remove();
  document.getElementById('modal-view-mail-overlay')?.remove();

  // 6. Open Dynamic Test Email Modal
  const openTestEmailModal = () => {
    document.getElementById('modal-test-email-overlay')?.remove();
    const currentConfig = readCurrentFormConfig();
    const defaultRecipient = currentConfig.fromEmail || 'maint.dept2023@gmail.com';

    const modalHtml = `
      <div class="modal-overlay" id="modal-test-email-overlay" style="z-index: 10050; display: flex; align-items: center; justify-content: center;">
        <div class="modal-card" style="width: 500px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.45); border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
          
          <!-- Modal Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🧪</span>
              <div>
                <h2 style="font-size: 14.5px; font-weight: 800; color: #fff; margin: 0;">Send Live SMTP Test Email</h2>
                <div style="font-size: 11px; color: #e0f2fe; margin-top: 1px;">Live handshake &amp; mailbox delivery verification</div>
              </div>
            </div>
            <button type="button" id="btn-close-test-email-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 16px; padding: 2px 6px;">✕</button>
          </div>

          <!-- Modal Body -->
          <form id="form-send-test-email" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; font-size: 11.5px;">
              <div style="color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase;">Outgoing Relay:</div>
              <div id="modal-gateway-sender" style="color: #38bdf8; font-family: var(--font-mono); margin-top: 2px; font-weight: 700;">
                ${currentConfig.fromName} &lt;${currentConfig.fromEmail || 'Not set'}&gt;
              </div>
              <div id="modal-gateway-server" style="color: var(--text-secondary); font-size: 11px; margin-top: 2px;">
                Server: ${currentConfig.smtpHost || 'smtp.gmail.com'}:${currentConfig.smtpPort || '587'} (${currentConfig.encryption || 'TLS'})
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 5px;">
                Recipient Email Address <span class="req" style="color: #f87171;">*</span>
              </label>
              <input 
                type="email" 
                id="inp-test-recipient-email" 
                class="form-control" 
                placeholder="e.g. maint.dept2023@gmail.com" 
                value="${defaultRecipient}" 
                required 
                style="font-size: 12.5px; height: 36px;"
              />
              <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">
                A live, verified HTML email with full diagnostic parameters will be delivered to this inbox.
              </div>
            </div>

            <div id="test-email-status-alert" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 12px; line-height: 1.45;"></div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-test-email" class="btn btn-secondary btn-sm" style="font-weight: 600; font-size: 11.5px; padding: 6px 14px;">Cancel</button>
              <button type="submit" id="btn-execute-send-test" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 6px 18px;">
                🚀 Send Test Email
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const overlay = document.getElementById('modal-test-email-overlay');
    const closeBtn = document.getElementById('btn-close-test-email-modal');
    const cancelBtn = document.getElementById('btn-cancel-test-email');

    const removeModal = () => overlay?.remove();

    closeBtn?.addEventListener('click', removeModal);
    cancelBtn?.addEventListener('click', removeModal);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) removeModal();
    });

    const formTest = document.getElementById('form-send-test-email');
    if (formTest) {
      formTest.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetEmail = document.getElementById('inp-test-recipient-email')?.value?.trim();
        const statusBox = document.getElementById('test-email-status-alert');
        const submitBtn = document.getElementById('btn-execute-send-test');
        const activeCfg = readCurrentFormConfig();

        if (!targetEmail) {
          alert('Please enter a recipient email.');
          return;
        }

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>⏳</span> Sending test email...';
          }

          if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56, 189, 248, 0.15)';
            statusBox.style.border = '1px solid rgba(56, 189, 248, 0.4)';
            statusBox.style.color = '#38bdf8';
            statusBox.innerHTML = `<span>⏳</span> Connecting to <strong>${activeCfg.smtpHost}</strong> and dispatching to <strong>${targetEmail}</strong>...`;
          }

          const res = await emailService.sendTestEmail(targetEmail, activeCfg);

          if (statusBox) {
            statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
            statusBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            statusBox.style.color = '#34d399';
            statusBox.innerHTML = `✅ <strong>Email Delivered!</strong> ${res.message}`;
          }

          updateDiagnosticsUI(activeCfg, 'SUCCESS', `Delivered to ${targetEmail}`);

          if (window.__erpApp?.showToast) {
            window.__erpApp.showToast('✅ SMTP Test Succeeded', `Test email delivered to ${res.recipient}.`, 'success');
          }

          setTimeout(() => {
            removeModal();
            if (window.__erpApp?.renderMainContent) {
              window.__erpApp.renderMainContent();
            }
          }, 1800);

        } catch (err) {
          if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
            statusBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            statusBox.style.color = '#f87171';
            statusBox.innerHTML = `❌ <strong>Dispatch Failed:</strong> ${err.message}`;
          }

          updateDiagnosticsUI(activeCfg, 'FAILED', err.message);

          if (window.__erpApp?.showToast) {
            window.__erpApp.showToast('❌ SMTP Test Failed', err.message, 'danger');
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 Send Test Email';
          }
        }
      });
    }
  };

  const btnOpenTestModal = document.getElementById('btn-open-test-email-modal');
  if (btnOpenTestModal) {
    btnOpenTestModal.addEventListener('click', openTestEmailModal);
  }

  const btnTestInline = document.getElementById('btn-test-email-inline');
  if (btnTestInline) {
    btnTestInline.addEventListener('click', openTestEmailModal);
  }

  // 7. Clear Configuration
  const btnClear = document.getElementById('btn-clear-email-config');
  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      const confirmed = await notificationService.confirmDelete({
        title: 'Clear Email Configuration',
        message: 'Are you sure you want to clear the email configuration? Automated email delivery will be disabled.',
        itemType: 'Configuration',
        count: 1,
        isDestructive: true
      });
      if (confirmed) {
        emailService.clearConfig();
        notificationService.success('Email configuration has been reset.');
        if (window.__erpApp?.renderMainContent) {
          window.__erpApp.renderMainContent();
        }
      }
    });
  }

  // 8. Clear Email Activity Logs
  const btnClearLogs = document.getElementById('btn-clear-email-logs');
  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', async () => {
      const totalLogs = emailService.getEmailLogs().length;
      const confirmed = await notificationService.confirmDelete({
        title: 'Clear Email Activity Logs',
        message: 'Are you sure you want to clear outgoing email activity history?',
        itemType: 'Email Log Entry',
        count: totalLogs,
        isDestructive: true
      });
      if (confirmed) {
        emailService.clearEmailLogs();
        notificationService.success('Email activity history has been cleared.');
        if (window.__erpApp?.renderMainContent) {
          window.__erpApp.renderMainContent();
        }
      }
    });
  }

  // 9. View Mail Content in custom glass modal
  document.querySelectorAll('.btn-view-mail-content').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const logs = emailService.getEmailLogs();
      const mail = logs.find(l => l.id === id);
      if (!mail) return;

      document.getElementById('modal-view-mail-overlay')?.remove();

      const modalHtml = `
        <div class="modal-overlay" id="modal-view-mail-overlay" style="z-index: 10060; display: flex; align-items: center; justify-content: center;">
          <div class="modal-card" style="width: 580px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.45); border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
            
            <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">📨</span>
                <h3 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0;">Dispatched Message Preview</h3>
              </div>
              <button type="button" id="btn-close-view-mail-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 16px; padding: 2px 6px;">✕</button>
            </div>

            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 12px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; font-size: 11.5px;">
                <div>
                  <span style="color: var(--text-muted); font-size: 10.5px; font-weight: 700;">Recipient:</span>
                  <div style="color: #38bdf8; font-weight: 700; font-family: var(--font-mono); margin-top: 2px;">${mail.to}</div>
                </div>
                <div>
                  <span style="color: var(--text-muted); font-size: 10.5px; font-weight: 700;">Dispatched At:</span>
                  <div style="color: #e2e8f0; font-weight: 600; margin-top: 2px;">${new Date(mail.timestamp).toLocaleString()}</div>
                </div>
                <div style="grid-column: span 2; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px; margin-top: 2px;">
                  <span style="color: var(--text-muted); font-size: 10.5px; font-weight: 700;">Subject:</span>
                  <div style="color: #fff; font-weight: 700; margin-top: 2px;">${mail.subject}</div>
                </div>
              </div>

              <div>
                <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Message Content:</label>
                <pre style="margin: 4px 0 0 0; background: rgba(15, 23, 42, 0.95); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-family: var(--font-mono); font-size: 11px; color: #cbd5e1; max-height: 240px; overflow-y: auto; white-space: pre-wrap; line-height: 1.5;">${mail.content || 'No text content'}</pre>
              </div>

              <div style="display: flex; justify-content: flex-end; padding-top: 10px; border-top: 1px solid var(--border-color);">
                <button type="button" id="btn-close-view-mail-bottom" class="btn btn-secondary btn-sm" style="font-size: 11.5px; font-weight: 600; padding: 6px 14px;">Close</button>
              </div>
            </div>

          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      const mailOverlay = document.getElementById('modal-view-mail-overlay');
      const closeTop = document.getElementById('btn-close-view-mail-modal');
      const closeBottom = document.getElementById('btn-close-view-mail-bottom');

      const removeMailModal = () => mailOverlay?.remove();
      closeTop?.addEventListener('click', removeMailModal);
      closeBottom?.addEventListener('click', removeMailModal);
      mailOverlay?.addEventListener('click', (e) => {
        if (e.target === mailOverlay) removeMailModal();
      });
    });
  });
}
