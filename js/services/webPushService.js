/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Enterprise Web Push Notification Service (Role & Scoped Access-Filtered)
 * 
 * Core Guarantee ("je jar access onujay notification pabe"):
 * 1. Strictly filters every notification against the active user's role, module access,
 *    action permissions, and physical location scope (Unit, Floor, Line).
 * 2. If the user does not have authorized access to a notification, the push alert is
 *    silently suppressed and never shown on their device.
 * 3. Delivers via ServiceWorker showNotification (works in background & locked screen)
 *    with instant tab focusing and deep-linking on click.
 * 4. Synthesizes a native, offline-ready dual-tone audio chime via Web Audio API.
 */

import { notificationService } from './notificationService.js';
import { authService } from './authService.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';

const STORAGE_KEY_PUSH_ENABLED = 'erp_web_push_enabled';
const STORAGE_KEY_PUSH_SOUND = 'erp_web_push_sound';

class WebPushService {
  constructor() {
    this._initialized = false;
    this._recentPushIds = new Set();
    this._recentPushTimer = null;
  }

  /**
   * Initialize Web Push listeners and event hooks
   */
  init() {
    if (this._initialized || typeof window === 'undefined') return;
    this._initialized = true;

    // Listen for new in-app notifications generated locally or remotely
    window.addEventListener('erp:notification', (e) => {
      if (e && e.detail) {
        this.sendPushNotification(e.detail);
      }
    });

    // Listen for real-time SSE notifications arriving from other factory terminals
    window.addEventListener('erp:realtime-notification-updated', (e) => {
      if (e && e.detail && e.detail.data) {
        this.sendPushNotification(e.detail.data);
      }
    });

    // Listen for urgent transfer updates arriving via SSE
    window.addEventListener('erp:realtime-transfer-updated', (e) => {
      if (e && e.detail && e.detail.data) {
        const transfer = e.detail.data;
        const transferNotif = {
          id: `transfer-push-${transfer.id || Date.now()}`,
          title: `Machine Transfer: ${transfer.systemAssetId || transfer.serialNumber || 'Machine'}`,
          message: `Transfer #${transfer.trackingNumber || transfer.id} updated to ${transfer.status || 'PENDING'}.`,
          type: transfer.status === 'PENDING' ? 'APPROVAL_REQUEST' : 'INFO',
          module: 'transfers',
          action: transfer.status === 'PENDING' ? 'APPROVE' : 'VIEW',
          targetUrl: '#transfers',
          entityType: 'TRANSFER',
          entityId: transfer.id,
          locationScope: {
            isTransfer: true,
            sourceFloorId: transfer.fromFloorId || null,
            destFloorId: transfer.toFloorId || null,
            unitId: transfer.toUnitId || transfer.fromUnitId || null
          },
          timestamp: new Date().toISOString()
        };
        this.sendPushNotification(transferNotif);
      }
    });

    console.log('[WebPushService] 🔔 Web Push Service initialized. Supported:', this.isSupported(), 'Permission:', this.getPermission(), 'Policy:', this.getSystemPolicy());

    // Evaluate mandatory policy prompt if configured by Admin
    setTimeout(() => {
      this.checkAndPromptMandatoryPolicy();
    }, 1800);
  }

  /**
   * Check if the browser supports the Notifications API
   */
  isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current browser notification permission ('granted', 'denied', or 'default')
   */
  getPermission() {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Check if Web Push is active and enabled by the user
   */
  isEnabled() {
    if (!this.isSupported()) return false;
    if (Notification.permission !== 'granted') return false;
    const pref = localStorage.getItem(STORAGE_KEY_PUSH_ENABLED);
    return pref !== '0'; // Default enabled if permission granted
  }

  /**
   * Check if sound chime is enabled
   */
  isSoundEnabled() {
    return localStorage.getItem(STORAGE_KEY_PUSH_SOUND) !== '0';
  }

  /**
   * Toggle sound chime preference
   */
  setSoundEnabled(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY_PUSH_SOUND, enabled ? '1' : '0');
    } catch (_) {}
  }

  /**
   * Get global Push Notification Policy configured by Admin:
   * - 'MANDATORY': Admin enforced ON for all staff (auto-prompts on login, mute locked)
   * - 'DEFAULT_ON': Enabled by default, users can freely toggle ON/OFF in drawer (Recommended)
   * - 'DISABLED': Globally disabled by Admin (zero push alerts delivered across entire system)
   */
  getSystemPolicy() {
    try {
      const settings = (typeof storage !== 'undefined' && storage.getTable) 
        ? (storage.getTable(TABLE_NAMES.SETTINGS) || {}) 
        : {};
      return settings.pushNotificationPolicy || 'DEFAULT_ON';
    } catch (_) {
      return 'DEFAULT_ON';
    }
  }

  /**
   * Check if push notifications are globally disabled by Admin
   */
  isGloballyDisabled() {
    return this.getSystemPolicy() === 'DISABLED';
  }

  /**
   * Check if push notifications are enforced mandatory by Admin
   */
  isMandatory() {
    return this.getSystemPolicy() === 'MANDATORY';
  }

  /**
   * Update global system push policy (Admin only)
   */
  async setSystemPolicy(policy) {
    const valid = ['MANDATORY', 'DEFAULT_ON', 'DISABLED'].includes(policy) ? policy : 'DEFAULT_ON';
    if (typeof storage !== 'undefined' && storage.getTable) {
      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      storage.data[TABLE_NAMES.SETTINGS] = {
        ...current,
        pushNotificationPolicy: valid,
        pushNotificationPolicyUpdatedAt: new Date().toISOString()
      };
      await storage.saveTable(TABLE_NAMES.SETTINGS, true);
      window.dispatchEvent(new CustomEvent('erp:web-push-policy-changed', { detail: { policy: valid } }));
    }
    return valid;
  }

  /**
   * If Admin set policy to MANDATORY, prompt user to enable push if not already granted
   */
  checkAndPromptMandatoryPolicy() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!this.isSupported() || !this.isMandatory()) return;
    if (this.getPermission() === 'granted') return;

    const user = typeof authService !== 'undefined' ? authService.getCurrentUser() : null;
    if (!user || user.status !== 'ACTIVE' || user.role === 'NO_ACCESS') return;

    if (document.getElementById('modal-mandatory-push-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-mandatory-push-overlay';
    overlay.style.cssText = 'z-index: 10090; background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px;';

    overlay.innerHTML = `
      <div class="modal-dialog" style="max-width: 480px; width: 100%; background: #0f172a; border: 1.5px solid #f59e0b; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column;">
        <div style="padding: 16px 20px; background: linear-gradient(135deg, #0f172a, #78350f); border-bottom: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 24px;">🛡️</div>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">Web Push Notification Required</h3>
            <div style="font-size: 11px; color: #fde68a; margin-top: 1px;">Factory Floor Policy Enforced by Administrator</div>
          </div>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
          <p style="font-size: 12.5px; color: #e2e8f0; line-height: 1.55; margin: 0;">
            To ensure zero machine downtime and immediate response to critical breakdowns and floor transfer gate passes, <strong>Web Push Notifications are mandatory</strong> for all active personnel.
          </p>
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: #94a3b8;">
            👤 Target User: <strong style="color: #38bdf8;">${user.name}</strong> (${user.presetName || user.role})
          </div>
          <div style="display: flex; gap: 10px; margin-top: 8px;">
            <button type="button" id="btn-allow-mandatory-push" class="btn btn-primary" style="flex: 1; min-height: 42px; font-weight: 800; font-size: 13px; background: #0284c7; border: 1.5px solid #38bdf8;">
              🔔 Allow Push Notifications
            </button>
            <button type="button" id="btn-dismiss-mandatory-push" class="btn btn-ghost" style="font-size: 12px; color: #94a3b8;">
              Later
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const allowBtn = overlay.querySelector('#btn-allow-mandatory-push');
    const dismissBtn = overlay.querySelector('#btn-dismiss-mandatory-push');

    if (allowBtn) {
      allowBtn.addEventListener('click', async () => {
        overlay.remove();
        await this.requestPermission();
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        overlay.remove();
      });
    }
  }

  /**
   * Request browser Web Push notification permission
   */
  async requestPermission() {
    if (!this.isSupported()) {
      return { success: false, error: 'Web Push Notifications are not supported in this browser.' };
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';

      if (granted) {
        localStorage.setItem(STORAGE_KEY_PUSH_ENABLED, '1');
        window.dispatchEvent(new CustomEvent('erp:web-push-status-changed', { detail: { enabled: true, permission } }));

        // Deliver personalized welcome notification
        const activeUser = authService.getCurrentUser();
        const roleName = activeUser?.presetName || activeUser?.role || 'Factory User';
        
        let scopeDetail = 'All factory units';
        if (activeUser?.assignedScope && !activeUser.assignedScope.allGroups) {
          if (Array.isArray(activeUser.assignedScope.floorIds) && activeUser.assignedScope.floorIds.length > 0) {
            const flrs = storage.getTable(TABLE_NAMES.FLOORS) || [];
            const names = activeUser.assignedScope.floorIds.map(fid => flrs.find(f => f.id === fid)?.name || fid);
            scopeDetail = names.join(', ');
          }
        }

        const welcomeNotif = {
          id: `welcome-${Date.now()}`,
          title: '🔔 Web Push Notifications Activated',
          message: `Hello ${activeUser?.name || 'User'}! You will receive real-time notifications for ${roleName} (${scopeDetail}).`,
          type: 'SUCCESS',
          module: 'dashboard',
          targetUrl: '#dashboard'
        };

        await this.deliverPush(welcomeNotif);
        return { success: true, permission };
      } else {
        localStorage.setItem(STORAGE_KEY_PUSH_ENABLED, '0');
        window.dispatchEvent(new CustomEvent('erp:web-push-status-changed', { detail: { enabled: false, permission } }));
        return { success: false, permission, error: permission === 'denied' ? 'Permission was denied in browser settings.' : 'Permission request dismissed.' };
      }
    } catch (err) {
      console.warn('[WebPushService] Permission request notice:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Enable Web Push notifications
   */
  async enable() {
    if (this.getPermission() === 'granted') {
      localStorage.setItem(STORAGE_KEY_PUSH_ENABLED, '1');
      window.dispatchEvent(new CustomEvent('erp:web-push-status-changed', { detail: { enabled: true, permission: 'granted' } }));
      return { success: true };
    }
    return this.requestPermission();
  }

  /**
   * Disable Web Push notifications
   */
  disable() {
    try {
      localStorage.setItem(STORAGE_KEY_PUSH_ENABLED, '0');
      window.dispatchEvent(new CustomEvent('erp:web-push-status-changed', { detail: { enabled: false, permission: this.getPermission() } }));
    } catch (_) {}
    return { success: true };
  }

  /**
   * Synthesize crisp, modern two-tone notification audio chime using Web Audio API (Offline & Zero-Asset)
   */
  playChime() {
    if (!this.isSoundEnabled() || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Note 1: High crisp harmonic (D5 ~ 587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Note 2: Upward affirmative tone (A5 ~ 880 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.09, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.42);
    } catch (_) {}
  }

  /**
   * Synthesize high-urgency emergency siren audio alert using Web Audio API (Offline & Zero-Asset)
   */
  playEmergencySiren() {
    if (!this.isSoundEnabled() || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      // High-low alternating siren tones for emergency warnings
      const tones = [
        { freq: 987.77, start: 0, dur: 0.18, type: 'sawtooth' },
        { freq: 659.25, start: 0.18, dur: 0.18, type: 'sawtooth' },
        { freq: 987.77, start: 0.36, dur: 0.18, type: 'sawtooth' },
        { freq: 659.25, start: 0.54, dur: 0.22, type: 'sawtooth' }
      ];

      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = t.type;
        osc.frequency.setValueAtTime(t.freq, now + t.start);
        gain.gain.setValueAtTime(0.12, now + t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t.start);
        osc.stop(now + t.start + t.dur);
      });
    } catch (_) {}
  }

  /**
   * Main Dispatcher: Evaluates user access rules and delivers Web Push Notification
   * 
   * Strict Rule ("je jar access onujay notification pabe"):
   * - If the user does not have permission for this notification, it is SILENTLY DROPPED.
   * - Only permitted users receive the native browser notification popup.
   * 
   * @param {Object} notif - Notification payload
   * @returns {Promise<boolean>} - true if push was delivered, false otherwise
   */
  async sendPushNotification(notif) {
    if (!this.isSupported() || !this.isEnabled() || !notif) {
      return false;
    }

    // 0. Global Admin Policy check: If Admin disabled push globally, drop immediately
    if (this.isGloballyDisabled()) {
      return false;
    }

    // 1. Get currently authenticated active user
    const activeUser = typeof authService !== 'undefined' ? authService.getCurrentUser() : null;
    if (!activeUser || activeUser.status !== 'ACTIVE') {
      return false;
    }

    // 2. Strict Zero-Access Block
    if (activeUser.role === 'NO_ACCESS' || activeUser.roleId === 'role-no-access') {
      return false;
    }

    // 3. MANDATORY ACCESS CONTROL CHECK:
    // Only deliver if user is strictly authorized for this notification
    const isAllowed = notificationService.isNotificationAllowedForUser(notif, activeUser);
    if (!isAllowed) {
      // 🛡️ Filtered: User does not have access to this notification's role, module, or floor scope
      return false;
    }

    // 4. Suppress automated background tasks from firing desktop push alerts
    if (notificationService.isBackgroundOrAutomatedTask(notif.message, notif.title)) {
      return false;
    }

    // 5. Deduplication check: Avoid multiple push popups for the exact same event
    const notifKey = notif.id || `${notif.title}::${notif.message}::${notif.entityId || ''}`;
    if (this._recentPushIds.has(notifKey)) {
      return false;
    }
    this._recentPushIds.add(notifKey);

    // Keep deduplication set bounded
    if (this._recentPushIds.size > 200) {
      const arr = Array.from(this._recentPushIds);
      this._recentPushIds = new Set(arr.slice(arr.length - 100));
    }

    // 6. Deliver the native Web Push notification
    return this.deliverPush(notif);
  }

  /**
   * Render and deliver the native browser notification via Service Worker or Desktop Notification API
   */
  async deliverPush(notif) {
    const title = notif.title ? `Al-Muslim ERP • ${notif.title}` : 'Al-Muslim Maintenance ERP';
    const body = notif.message || 'New operational update.';
    const targetUrl = notif.targetUrl || '#dashboard';
    const isApproval = notif.action === 'APPROVE' || notif.type === 'APPROVAL_REQUEST';
    const isGh = typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/erp');
    const basePath = isGh ? '/ERP/' : './';

    const options = {
      body: body,
      icon: basePath + 'icon-192.png',
      badge: basePath + 'favicon.ico',
      tag: notif.id || `amg-erp-${Date.now()}`,
      data: {
        url: targetUrl,
        id: notif.id,
        timestamp: notif.timestamp || new Date().toISOString()
      },
      vibrate: isApproval ? [300, 150, 300, 150, 300] : [200, 100, 200],
      requireInteraction: isApproval || notif.type === 'ALERT'
    };

    try {
      // Option A: Service Worker Registration showNotification (Works in background tabs & locked screen)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready.catch(() => null);
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, options);
          this.playChime();
          return true;
        }
      }

      // Option B: Native Desktop Notification API Fallback
      if (typeof Notification === 'function') {
        const nativeNotif = new Notification(title, options);
        nativeNotif.onclick = (event) => {
          event.preventDefault();
          window.focus();
          if (targetUrl) {
            window.location.hash = targetUrl;
          }
          nativeNotif.close();
        };
        this.playChime();
        return true;
      }
    } catch (err) {
      console.warn('[WebPushService] Notification display notice:', err.message);
    }

    return false;
  }

  /**
   * Send a test push notification customized to the active user's permissions and scope
   */
  async sendTestNotification() {
    if (!this.isSupported()) {
      return { success: false, error: 'Web Push is not supported in this browser.' };
    }

    if (this.getPermission() !== 'granted') {
      const res = await this.requestPermission();
      if (!res.success) return res;
    }

    const user = authService.getCurrentUser();
    const roleName = user?.presetName || user?.role || 'Maintenance Staff';
    let scopeDesc = 'All Factory Units';
    if (user?.assignedScope && !user.assignedScope.allGroups) {
      if (Array.isArray(user.assignedScope.floorIds) && user.assignedScope.floorIds.length > 0) {
        const flrs = storage.getTable(TABLE_NAMES.FLOORS) || [];
        const fNames = user.assignedScope.floorIds.map(fid => flrs.find(f => f.id === fid)?.name || fid);
        scopeDesc = `Floor: ${fNames.join(', ')}`;
      }
    }

    const testNotif = {
      id: `test-push-${Date.now()}`,
      title: '🔔 Test Notification Successful',
      message: `Delivered to @${user?.username || 'user'} • Role: ${roleName} • Scope: ${scopeDesc}. Web Push is fully active!`,
      type: 'SUCCESS',
      module: 'dashboard',
      targetUrl: '#dashboard',
      timestamp: new Date().toISOString()
    };

    const delivered = await this.deliverPush(testNotif);
    return { success: delivered };
  }
}

export const webPushService = new WebPushService();
