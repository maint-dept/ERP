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

    console.log('[WebPushService] 🔔 Web Push Service initialized. Supported:', this.isSupported(), 'Permission:', this.getPermission());
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
