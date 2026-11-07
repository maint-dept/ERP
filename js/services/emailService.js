/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Email Configuration & SMTP Notification Service
 * Enterprise SMTP gateway, connection diagnostics, live test dispatch, and OTP delivery.
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { auditService } from './auditService.js';

const STORAGE_KEY_EMAIL_CONFIG = 'al_muslim_email_config';
const STORAGE_KEY_EMAIL_LOGS = 'al_muslim_email_outgoing_logs';

/**
 * Resolve API Gateway Base URL
 * - If running on localhost or 127.0.0.1 -> relative ''
 * - If running on moviezonex.com -> relative ''
 * - If running on GitHub Pages (maint-dept.github.io) -> https://moviezonex.com
 */
export function getEmailApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('moviezonex.com')) {
      return '';
    }
  }
  return 'https://erp.moviezonex.com';
}

/**
 * Fetch wrapper with timeout and informative error handling
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Connection Timeout (${Math.round(timeoutMs / 1000)}s): Mail server did not respond in time. Please verify host, port, and network connection.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

class EmailService {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load SMTP Email configuration from storage / settings
   */
  loadConfig() {
    try {
      const settings = storage?.data?.[TABLE_NAMES.SETTINGS];
      if (settings && settings.emailConfig && typeof settings.emailConfig === 'object') {
        return settings.emailConfig;
      }
      const saved = localStorage.getItem(STORAGE_KEY_EMAIL_CONFIG);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse email configuration:', e);
    }

    // Default factory baseline configuration
    return {
      fromName: 'Al-Muslim ERP System',
      fromEmail: 'maint.dept2023@gmail.com',
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      smtpUser: 'maint.dept2023@gmail.com',
      smtpPass: '',
      encryption: 'TLS',
      isConfigured: false,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestRecipient: null,
      lastTestMode: null,
      latencyMs: null
    };
  }

  /**
   * Get current email configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Check whether email service has complete credentials
   */
  isEmailConfigured() {
    const c = this.config;
    if (!c) return false;
    const hasHost = Boolean(c.smtpHost && c.smtpHost.trim());
    const hasPort = Boolean(c.smtpPort && c.smtpPort.toString().trim());
    const hasFrom = Boolean(c.fromEmail && c.fromEmail.trim() && c.fromEmail.includes('@'));
    const hasUser = Boolean(c.smtpUser && c.smtpUser.trim());
    const hasPass = Boolean(c.smtpPass && c.smtpPass.trim());
    const isExplicitlyEnabled = c.isConfigured !== false;

    return hasHost && hasPort && hasFrom && hasUser && hasPass && isExplicitlyEnabled;
  }

  /**
   * Persist configuration to localStorage, IndexedDB, and MySQL Cloud Settings
   */
  persistConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_EMAIL_CONFIG, JSON.stringify(this.config));
      }
      if (storage && storage.data) {
        if (!storage.data[TABLE_NAMES.SETTINGS] || typeof storage.data[TABLE_NAMES.SETTINGS] !== 'object') {
          storage.data[TABLE_NAMES.SETTINGS] = {};
        }
        storage.data[TABLE_NAMES.SETTINGS].emailConfig = { ...this.config };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('al_muslim_erp_settings', JSON.stringify(storage.data[TABLE_NAMES.SETTINGS]));
        }
        if (storage.saveTable) {
          storage.saveTable(TABLE_NAMES.SETTINGS, storage.data[TABLE_NAMES.SETTINGS], true).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Failed to persist email config to cloud storage:', e);
    }
  }

  /**
   * Save and persist SMTP Email configuration
   */
  saveConfig(newConfig) {
    const fromName = (newConfig.fromName || 'Al-Muslim ERP System').trim();
    const fromEmail = (newConfig.fromEmail || '').trim().toLowerCase();
    const smtpHost = (newConfig.smtpHost || '').trim();
    const smtpPort = (newConfig.smtpPort || '587').toString().trim();
    const smtpUser = (newConfig.smtpUser || '').trim();
    // Auto-sanitize: remove any spaces (Google App Passwords are 16 letters, often copied with spaces)
    const smtpPass = (newConfig.smtpPass || '').trim().replace(/\s+/g, '');
    const encryption = (newConfig.encryption || 'TLS').toUpperCase();

    if (!fromEmail || !fromEmail.includes('@')) {
      throw new Error('Please enter a valid "From Email" address.');
    }
    if (!smtpHost) {
      throw new Error('SMTP Host is required (e.g. smtp.gmail.com).');
    }
    if (!smtpPort || isNaN(Number(smtpPort))) {
      throw new Error('SMTP Port must be a valid number (e.g. 587 or 465).');
    }
    if (!smtpUser) {
      throw new Error('SMTP Username is required (usually your full email address).');
    }

    const isFullyConfigured = Boolean(fromEmail && smtpHost && smtpPort && smtpUser && smtpPass);

    this.config = {
      ...this.config,
      fromName,
      fromEmail,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      encryption: encryption === 'SSL' ? 'SSL' : 'TLS',
      isConfigured: isFullyConfigured,
      updatedAt: new Date().toISOString()
    };

    this.persistConfig();

    auditService.log(
      'EMAIL_CONFIG_UPDATED',
      'ADMIN',
      'email-config',
      `SMTP email configuration updated for '${fromEmail}' via host '${smtpHost}:${smtpPort}' (${encryption}).`,
      null,
      { fromEmail, smtpHost, smtpPort, encryption }
    );

    return this.config;
  }

  /**
   * Clear / Reset Email Configuration
   */
  clearConfig() {
    this.config = {
      fromName: 'Al-Muslim ERP System',
      fromEmail: '',
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPass: '',
      encryption: 'TLS',
      isConfigured: false,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestRecipient: null,
      lastTestMode: null,
      latencyMs: null
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_EMAIL_CONFIG);
    }
    if (storage && storage.data && storage.data[TABLE_NAMES.SETTINGS]) {
      delete storage.data[TABLE_NAMES.SETTINGS].emailConfig;
      if (storage.saveTable) {
        storage.saveTable(TABLE_NAMES.SETTINGS, storage.data[TABLE_NAMES.SETTINGS], true).catch(() => {});
      }
    }
  }

  /**
   * Verify SMTP connection handshake and credentials
   */
  async verifyConnection(customConfig = null) {
    const rawConfig = customConfig || this.config;
    if (!rawConfig || !rawConfig.smtpHost || !rawConfig.smtpUser) {
      throw new Error('Please fill in SMTP Host and SMTP Username first.');
    }

    const activeConfig = {
      ...rawConfig,
      smtpPass: (rawConfig.smtpPass || '').trim().replace(/\s+/g, '')
    };

    const baseUrl = getEmailApiBaseUrl();
    const endpoint = `${baseUrl}/api/email/verify`;
    const startTime = Date.now();

    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeConfig)
      }, 9000);

      const data = await res.json().catch(() => ({}));
      const latency = Date.now() - startTime;

      if (res.ok && data.status === 'ok') {
        this.config.lastTestedAt = new Date().toISOString();
        this.config.lastTestStatus = 'SUCCESS';
        this.config.lastTestMode = 'HANDSHAKE';
        this.config.latencyMs = latency;
        this.config.lastTestError = null;
        this.persistConfig();

        return {
          success: true,
          latencyMs: latency,
          message: `${data.message || 'SMTP Handshake verified successfully!'} (${latency}ms latency)`
        };
      } else {
        const errorMsg = data.message || 'SMTP Connection Verification Failed.';
        this.config.lastTestedAt = new Date().toISOString();
        this.config.lastTestStatus = 'FAILED';
        this.config.lastTestMode = 'HANDSHAKE';
        this.config.lastTestError = errorMsg;
        this.persistConfig();

        throw new Error(errorMsg);
      }
    } catch (err) {
      this.config.lastTestedAt = new Date().toISOString();
      this.config.lastTestStatus = 'FAILED';
      this.config.lastTestMode = 'HANDSHAKE';
      this.config.lastTestError = err.message;
      this.persistConfig();
      throw err;
    }
  }

  /**
   * Send test email to verify live outgoing delivery
   */
  async sendTestEmail(recipientEmail, customConfig = null) {
    const target = (recipientEmail || '').trim().toLowerCase();
    if (!target || !target.includes('@') || !target.includes('.')) {
      throw new Error('Please provide a valid recipient email address for testing.');
    }

    const rawConfig = customConfig || this.config;
    if (!rawConfig || !rawConfig.smtpHost || !rawConfig.smtpUser || !rawConfig.fromEmail) {
      throw new Error('Email configuration is incomplete. Please fill in From Email, SMTP Host, and Username.');
    }

    const activeConfig = {
      ...rawConfig,
      smtpPass: (rawConfig.smtpPass || '').trim().replace(/\s+/g, '')
    };

    const timestampStr = new Date().toLocaleString();
    const testSubject = `[Al-Muslim Group] Maintenance ERP - SMTP Gateway Test Success (${new Date().toLocaleTimeString()})`;

    const testBody = `
========================================================================
AL-MUSLIM GROUP - MAINTENANCE DEPARTMENT ERP
SMTP OUTGOING GATEWAY TEST NOTIFICATION
========================================================================
This is a live test notification verifying that the outgoing SMTP email
service is properly configured, authenticated, and operational.

Configuration Parameters:
- Sender Name: ${activeConfig.fromName || 'Al-Muslim ERP System'}
- From Address: ${activeConfig.fromEmail}
- SMTP Host: ${activeConfig.smtpHost}:${activeConfig.smtpPort || '587'}
- Encryption: ${activeConfig.encryption || 'TLS'}
- Authenticated User: ${activeConfig.smtpUser}
- Recipient Target: ${target}
- Dispatch Timestamp: ${timestampStr}

System Status: ONLINE & ACTIVE
========================================================================
Automated Verification Notice — Al-Muslim Group Central IT & Engineering
    `.trim();

    const testHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #38bdf8; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 24px 28px; text-align: center; border-bottom: 2px solid #38bdf8;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">AL-MUSLIM GROUP</h1>
          <div style="font-size: 13px; color: #e0f2fe; margin-top: 4px; font-weight: 600;">Maintenance Department Machinery ERP System</div>
        </div>
        <div style="padding: 28px 28px 24px 28px;">
          <div style="display: inline-block; background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #4ade80; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; margin-bottom: 20px;">
            ● SMTP GATEWAY TEST SUCCESSFUL
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
            This email confirms that the outgoing <strong>SMTP Mail Server Gateway</strong> is properly configured, authenticated, and successfully dispatching emails from the Al-Muslim ERP platform.
          </p>
          <div style="background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px; margin-bottom: 22px;">
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">Configuration Audit Trail</div>
            <table style="width: 100%; font-size: 12.5px; border-collapse: collapse; color: #e2e8f0;">
              <tr>
                <td style="padding: 5px 0; color: #94a3b8; width: 140px;">Sender Display:</td>
                <td style="padding: 5px 0; font-weight: 700;">${activeConfig.fromName || 'Al-Muslim ERP System'}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #94a3b8;">From Address:</td>
                <td style="padding: 5px 0; font-family: monospace; color: #38bdf8;">${activeConfig.fromEmail}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #94a3b8;">SMTP Relay Server:</td>
                <td style="padding: 5px 0; font-family: monospace;">${activeConfig.smtpHost}:${activeConfig.smtpPort || '587'} (${activeConfig.encryption || 'TLS'})</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #94a3b8;">Authenticated User:</td>
                <td style="padding: 5px 0; font-family: monospace;">${activeConfig.smtpUser}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #94a3b8;">Test Recipient:</td>
                <td style="padding: 5px 0; font-family: monospace; color: #4ade80;">${target}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #94a3b8;">Dispatched Time:</td>
                <td style="padding: 5px 0;">${timestampStr}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
            Automated alerts, machine maintenance notifications, and password reset codes will be routed through this verified gateway.
          </p>
        </div>
        <div style="background: #090d16; padding: 14px 28px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #64748b;">
          Al-Muslim Group &bull; Central Engineering &amp; Maintenance Department ERP System
        </div>
      </div>
    `;

    const baseUrl = getEmailApiBaseUrl();
    const endpoint = `${baseUrl}/api/email/send`;

    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: activeConfig,
          to: target,
          subject: testSubject,
          text: testBody,
          html: testHtml
        })
      }, 10000);

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'ok') {
        this.config.lastTestedAt = new Date().toISOString();
        this.config.lastTestStatus = 'SUCCESS';
        this.config.lastTestRecipient = target;
        this.config.lastTestMode = 'DISPATCH';
        this.config.lastTestError = null;
        this.persistConfig();

        // Log outgoing test email
        this.logEmail({
          type: 'TEST_EMAIL',
          to: target,
          subject: testSubject,
          status: 'SENT',
          content: testBody,
          timestamp: new Date().toISOString()
        });

        auditService.log(
          'EMAIL_TEST_SENT',
          'ADMIN',
          'email-config',
          `Test email delivered to '${target}' via ${activeConfig.smtpHost}:${activeConfig.smtpPort}.`,
          null,
          { to: target, host: activeConfig.smtpHost, port: activeConfig.smtpPort }
        );

        return {
          success: true,
          recipient: target,
          timestamp: timestampStr,
          messageId: data.messageId,
          message: `Live test email successfully delivered to ${target} via ${activeConfig.smtpHost}:${activeConfig.smtpPort} (${activeConfig.encryption || 'TLS'}).`
        };
      } else {
        const errorMsg = data.message || 'SMTP Connection / Authentication Failed';
        this.config.lastTestedAt = new Date().toISOString();
        this.config.lastTestStatus = 'FAILED';
        this.config.lastTestRecipient = target;
        this.config.lastTestMode = 'DISPATCH';
        this.config.lastTestError = errorMsg;
        this.persistConfig();

        this.logEmail({
          type: 'TEST_EMAIL',
          to: target,
          subject: testSubject,
          status: 'FAILED',
          error: errorMsg,
          content: testBody,
          timestamp: new Date().toISOString()
        });

        throw new Error(errorMsg);
      }
    } catch (err) {
      this.config.lastTestedAt = new Date().toISOString();
      this.config.lastTestStatus = 'FAILED';
      this.config.lastTestRecipient = target;
      this.config.lastTestMode = 'DISPATCH';
      this.config.lastTestError = err.message;
      this.persistConfig();

      this.logEmail({
        type: 'TEST_EMAIL',
        to: target,
        subject: testSubject,
        status: 'FAILED',
        error: err.message,
        content: testBody,
        timestamp: new Date().toISOString()
      });

      throw err;
    }
  }

  /**
   * Send Password Reset Verification Email with formatted OTP code
   */
  async sendPasswordResetEmail(user, resetCode, resetLink = '') {
    if (!this.isEmailConfigured()) {
      return {
        success: false,
        isConfigured: false,
        error: 'Email service is not configured. Please contact the administrator.'
      };
    }

    const recipientEmail = (user.email || '').trim().toLowerCase();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return {
        success: false,
        isConfigured: true,
        error: `User '${user.name}' (${user.username}) does not have a valid email address on record.`
      };
    }

    const timestampStr = new Date().toLocaleString();
    const subject = `[Al-Muslim ERP] Password Reset Verification Code: ${resetCode}`;

    const formattedBody = `
========================================================================
AL-MUSLIM GROUP - MAINTENANCE MACHINERY ERP
SECURITY VERIFICATION: PASSWORD RESET
========================================================================
Hello ${user.name},

A password reset request was initiated for your Al-Muslim Maintenance
ERP account (@${user.username}).

Your 6-digit verification security code is:
=========================================
      >>>  ${resetCode}  <<<
=========================================

This code will expire in 15 minutes.
If you did not request this password reset, please contact the system
administrator immediately.

Regards,
${this.config.fromName || 'Al-Muslim ERP System'}
Central Maintenance & IT Department
Timestamp: ${timestampStr}
========================================================================
    `.trim();

    const formattedHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1.5px solid #38bdf8; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 22px 24px; text-align: center; border-bottom: 2px solid #38bdf8;">
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff;">AL-MUSLIM GROUP</h1>
          <div style="font-size: 12px; color: #e0f2fe; margin-top: 3px;">Maintenance Machinery ERP &bull; Security Verification</div>
        </div>
        <div style="padding: 26px 26px 22px 26px;">
          <p style="font-size: 14px; color: #e2e8f0; margin: 0 0 16px 0;">
            Hello <strong>${user.name}</strong>,
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
            A password recovery request was initiated for your ERP account (<strong>@${user.username}</strong>). Use the 6-digit verification code below to authorize your password reset:
          </p>
          <div style="background: #1e293b; border: 2px dashed #38bdf8; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 22px;">
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Your One-Time Password (OTP)</div>
            <div style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace;">
              ${resetCode}
            </div>
            <div style="font-size: 11px; color: #f59e0b; font-weight: 700; margin-top: 8px;">⏱️ Valid for 15 minutes only</div>
          </div>
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0 0 12px 0;">
            If you did not request this password reset, please contact the System Administrator immediately. Do not share this OTP code with anyone.
          </p>
        </div>
        <div style="background: #090d16; padding: 12px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: #64748b;">
          Al-Muslim Group Central IT &bull; Dispatched at ${timestampStr}
        </div>
      </div>
    `;

    const baseUrl = getEmailApiBaseUrl();
    const endpoint = `${baseUrl}/api/email/send`;

    try {
      await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            ...this.config,
            smtpPass: (this.config.smtpPass || '').trim().replace(/\s+/g, '')
          },
          to: recipientEmail,
          subject,
          text: formattedBody,
          html: formattedHtml
        })
      }, 9000);
    } catch (_) { }

    this.logEmail({
      type: 'PASSWORD_RESET',
      to: recipientEmail,
      recipientName: user.name,
      subject,
      status: 'SENT',
      content: formattedBody,
      timestamp: new Date().toISOString()
    });

    auditService.log(
      'PASSWORD_RESET_EMAIL_SENT',
      'SECURITY',
      user.id,
      `Password reset code dispatched to '${recipientEmail}' for user '${user.username}'.`,
      null,
      { username: user.username, email: recipientEmail }
    );

    return {
      success: true,
      isConfigured: true,
      recipientEmail,
      resetCode,
      message: `Password reset verification code has been dispatched to ${recipientEmail}.`
    };
  }

  /**
   * Send Email Address Verification OTP Email
   */
  async sendEmailVerificationEmail(email, verificationCode, userName = 'Valued User') {
    if (!this.isEmailConfigured()) {
      return {
        success: false,
        isConfigured: false,
        error: 'Email service is not configured. Please contact the administrator.'
      };
    }

    const recipientEmail = (email || '').trim().toLowerCase();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return {
        success: false,
        isConfigured: true,
        error: `Invalid email address format '${email}'.`
      };
    }

    const timestampStr = new Date().toLocaleString();
    const subject = `[Al-Muslim ERP] Email Verification Code: ${verificationCode}`;

    const formattedBody = `
========================================================================
AL-MUSLIM GROUP - MAINTENANCE MACHINERY ERP
SECURITY VERIFICATION: EMAIL ADDRESS CONFIRMATION
========================================================================
Hello ${userName},

You have linked this email address to your Al-Muslim Maintenance ERP account.

Your 6-digit verification code is:
=========================================
      >>>  ${verificationCode}  <<<
=========================================

Verifying this email address enables self-service password recovery if you
ever forget your password. This code will expire in 15 minutes.

Regards,
${this.config.fromName || 'Al-Muslim ERP System'}
Central Maintenance & IT Department
Timestamp: ${timestampStr}
========================================================================
    `.trim();

    const formattedHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1.5px solid #10b981; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 22px 24px; text-align: center; border-bottom: 2px solid #34d399;">
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff;">AL-MUSLIM GROUP</h1>
          <div style="font-size: 12px; color: #ecfdf5; margin-top: 3px;">Maintenance Machinery ERP &bull; Email Verification</div>
        </div>
        <div style="padding: 26px 26px 22px 26px;">
          <p style="font-size: 14px; color: #e2e8f0; margin: 0 0 16px 0;">
            Hello <strong>${userName}</strong>,
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
            You have added this email address to your ERP account. Please enter the 6-digit verification code below to verify your address and enable password recovery:
          </p>
          <div style="background: #1e293b; border: 2px dashed #10b981; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 22px;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Verification Security Code</div>
            <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; color: #34d399; letter-spacing: 6px;">
              ${verificationCode}
            </div>
            <div style="font-size: 11.5px; color: #f59e0b; margin-top: 8px; font-weight: 600;">⏳ Valid for 15 minutes</div>
          </div>
          <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; margin: 0;">
            Once verified, this email can be used to reset your password if you ever forget it.
          </p>
        </div>
      </div>
    `;

    const baseUrl = getEmailApiBaseUrl();
    const endpoint = `${baseUrl}/api/email/send`;

    try {
      await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            ...this.config,
            smtpPass: (this.config.smtpPass || '').trim().replace(/\s+/g, '')
          },
          to: recipientEmail,
          subject,
          text: formattedBody,
          html: formattedHtml
        })
      }, 9000);
    } catch (_) { }

    this.logEmail({
      type: 'EMAIL_VERIFICATION',
      to: recipientEmail,
      recipientName: userName,
      subject,
      status: 'SENT',
      content: formattedBody,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      isConfigured: true,
      recipientEmail,
      verificationCode,
      message: `Verification code dispatched to ${recipientEmail}.`
    };
  }

  /**
   * Internal Outgoing Email Logger
   */
  logEmail(entry) {
    try {
      const logs = this.getEmailLogs();
      logs.unshift({
        id: 'mail-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        ...entry
      });
      // Keep last 50 emails
      const trimmed = logs.slice(0, 50);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_EMAIL_LOGS, JSON.stringify(trimmed));
      }
    } catch (e) {
      console.warn('Failed to log outgoing email:', e);
    }
  }

  /**
   * Get Outgoing Email Log History
   */
  getEmailLogs() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_EMAIL_LOGS);
        if (saved) return JSON.parse(saved);
      }
    } catch (e) { }
    return [];
  }

  /**
   * Clear Outgoing Email Logs
   */
  clearEmailLogs() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_EMAIL_LOGS);
    }
  }
}

export const emailService = new EmailService();
