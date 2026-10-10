/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Comprehensive In-App Notification & Toast / Confirmation Modal Service
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from './authService.js';

class NotificationService {
  constructor() {
    this.toastContainer = null;
    this.initToastContainer();
  }

  initToastContainer() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('erp-toast-container')) {
      const container = document.createElement('div');
      container.id = 'erp-toast-container';
      container.className = 'erp-toast-container';
      document.body.appendChild(container);
      this.toastContainer = container;
    } else {
      this.toastContainer = document.getElementById('erp-toast-container');
    }
  }

  // ---------------------------------------------------------------------------
  // 1. COMPACT, NON-BLOCKING MODERN TOAST NOTIFICATIONS
  // ---------------------------------------------------------------------------
  toast(message, type = 'success', title = '', duration = 2800) {
    this.initToastContainer();
    if (!this.toastContainer) return;

    // Clean leading duplicate emojis
    const stripEmoji = (str) => {
      if (!str) return '';
      return String(str).replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}✅❌⚠️ℹ️⏳💾⚡]+\s*/u, '').trim();
    };

    let cleanMsg = stripEmoji(message);
    let cleanTitle = stripEmoji(title);

    // If title is generic or matches message, omit title for ultra-clean single-line toast
    if (cleanTitle && (cleanTitle.toLowerCase() === 'success' || cleanTitle.toLowerCase() === 'notice' || cleanTitle.toLowerCase() === 'info' || cleanTitle.toLowerCase() === cleanMsg.toLowerCase())) {
      cleanTitle = '';
    }

    const icons = {
      success: '✓',
      error: '✕',
      warning: '!',
      info: 'i',
      loading: '⋯'
    };

    const icon = icons[type] || 'i';

    // Remove oldest toast if 2 or more exist to prevent screen clutter
    while (this.toastContainer.children.length >= 2) {
      const oldest = this.toastContainer.children[0];
      if (oldest.parentNode) oldest.parentNode.removeChild(oldest);
    }

    const toastEl = document.createElement('div');
    toastEl.className = `erp-toast erp-toast-${type}`;
    
    toastEl.innerHTML = `
      <div class="toast-icon-badge">${icon}</div>
      <div class="toast-content">
        ${cleanTitle ? `<div class="toast-title">${cleanTitle}</div>` : ''}
        <div class="toast-message">${cleanMsg || message}</div>
      </div>
      <button class="toast-close" title="Dismiss">✕</button>
      <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    const closeBtn = toastEl.querySelector('.toast-close');
    const dismiss = () => {
      toastEl.classList.add('toast-hiding');
      setTimeout(() => {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      }, 200);
    };

    if (closeBtn) closeBtn.addEventListener('click', dismiss);

    this.toastContainer.appendChild(toastEl);

    // Auto dismiss
    const timer = setTimeout(dismiss, duration);
    toastEl.addEventListener('mouseenter', () => clearTimeout(timer));
    toastEl.addEventListener('mouseleave', () => setTimeout(dismiss, 1200));
  }

  success(message, title = '') {
    this.toast(message, 'success', title, 2600);
  }

  error(message, title = '') {
    this.toast(message, 'error', title, 4500);
  }

  info(message, title = '') {
    this.toast(message, 'info', title, 2800);
  }

  warning(message, title = '') {
    this.toast(message, 'warning', title, 3500);
  }

  notifySuccess(titleOrMsg, msgOrTitle) {
    const title = msgOrTitle ? titleOrMsg : '';
    const message = msgOrTitle ? msgOrTitle : titleOrMsg;
    this.toast(message, 'success', title);
  }

  notifyError(titleOrMsg, msgOrTitle) {
    const title = msgOrTitle ? titleOrMsg : '';
    const message = msgOrTitle ? msgOrTitle : titleOrMsg;
    this.toast(message, 'error', title, 4500);
  }

  notifyWarning(titleOrMsg, msgOrTitle) {
    const title = msgOrTitle ? titleOrMsg : '';
    const message = msgOrTitle ? msgOrTitle : titleOrMsg;
    this.toast(message, 'warning', title, 3500);
  }

  notifyInfo(titleOrMsg, msgOrTitle) {
    const title = msgOrTitle ? titleOrMsg : '';
    const message = msgOrTitle ? msgOrTitle : titleOrMsg;
    this.toast(message, 'info', title);
  }

  // ---------------------------------------------------------------------------
  // 2. MODERN ASYNC CONFIRMATION MODAL (Replaces crude window.confirm())
  // ---------------------------------------------------------------------------
  confirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    icon = '❓',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm = null,
    onCancel = null
  }) {
    return new Promise((resolve) => {
      // Remove any existing confirm modal
      const existing = document.getElementById('erp-custom-confirm-overlay');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'erp-custom-confirm-overlay';
      modalOverlay.className = 'modal-overlay active';
      modalOverlay.style.zIndex = '99999';

      modalOverlay.innerHTML = `
        <div class="modal-card" style="max-width: 440px; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">${icon}</span>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: ${isDestructive ? '#f87171' : '#fff'};">
                ${title}
              </h3>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-erp-confirm-x" style="font-size: 16px;">✕</button>
          </div>

          <div style="padding: 16px 0; font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
            ${message}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button type="button" class="btn btn-secondary" id="btn-erp-confirm-cancel">
              ${cancelText}
            </button>
            <button type="button" class="btn ${isDestructive ? 'btn-danger' : 'btn-primary'}" id="btn-erp-confirm-ok" style="font-weight: 700; ${isDestructive ? 'background: linear-gradient(135deg, #ef4444, #b91c1c);' : ''}">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);

      const closeConfirm = (result) => {
        if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
        if (result && typeof onConfirm === 'function') onConfirm();
        if (!result && typeof onCancel === 'function') onCancel();
        resolve(result);
      };

      modalOverlay.querySelector('#btn-erp-confirm-ok')?.addEventListener('click', () => closeConfirm(true));
      modalOverlay.querySelector('#btn-erp-confirm-cancel')?.addEventListener('click', () => closeConfirm(false));
      modalOverlay.querySelector('#btn-erp-confirm-x')?.addEventListener('click', () => closeConfirm(false));
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeConfirm(false);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 3. ACTION LOADING HELPER (Automatic Button Loading & Toast Feedback)
  // ---------------------------------------------------------------------------
  async withLoading(buttonEl, asyncFn, loadingText = 'Processing...', successMsg = 'Action completed successfully!') {
    let originalHtml = '';
    let originalDisabled = false;

    if (buttonEl) {
      originalHtml = buttonEl.innerHTML;
      originalDisabled = buttonEl.disabled;
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="btn-spinner"></span> ${loadingText}`;
    }

    try {
      const result = await asyncFn();
      if (successMsg) {
        this.success(successMsg);
      }
      return result;
    } catch (err) {
      console.error('Action error:', err);
      this.error(err.message || 'An unexpected error occurred.', 'Operation Failed');
      throw err;
    } finally {
      if (buttonEl) {
        buttonEl.disabled = originalDisabled;
        buttonEl.innerHTML = originalHtml;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. USER ACCESS–BASED IN-APP PERSISTED NOTIFICATION STORAGE
  // ---------------------------------------------------------------------------

  /**
   * Resolve and normalize module and required action from notification metadata or targetUrl
   */
  resolveModuleAndAction(notif) {
    if (!notif) return { module: null, action: 'VIEW' };
    
    let mod = notif.module || null;
    let act = notif.action || null;
    const url = String(notif.targetUrl || '').toLowerCase();
    const type = String(notif.type || '').toUpperCase();

    if (!mod) {
      if (url.includes('preventive')) mod = 'preventive_maintenance';
      else if (url.includes('approval') || url.includes('transfer')) mod = 'transfers';
      else if (url.includes('inventory') || url.includes('machine')) mod = 'machines';
      else if (url.includes('users') || url.includes('user')) mod = 'user_management';
      else if (url.includes('spare-part') || url.includes('spare_part')) mod = 'spare_parts';
      else if (url.includes('tools')) mod = 'tools_management';
      else if (url.includes('et-lab')) mod = 'et_lab';
      else if (url.includes('report')) mod = 'reports';
      else if (url.includes('master-data')) mod = 'master_data';
      else if (url.includes('audit')) mod = 'audit_logs';
    }

    if (!act) {
      if (type === 'APPROVAL_REQUEST' || url.includes('approval')) act = 'APPROVE';
      else act = 'VIEW';
    }

    return { module: mod, action: act };
  }

  /**
   * Resolve notification's physical factory location (Unit, Floor, Line, or Transfer source/dest)
   * dynamically from explicit locationScope, entity records, or content analysis.
   */
  resolveNotificationLocation(notif) {
    if (!notif) return null;

    // 1. Explicit locationScope on notification
    if (notif.locationScope) {
      const ls = notif.locationScope;
      if (ls.sourceFloorId || ls.destFloorId) {
        return {
          isTransfer: true,
          unitId: ls.destUnitId || ls.unitId || null,
          sourceFloorId: ls.sourceFloorId || null,
          destFloorId: ls.destFloorId || ls.floorId || null,
          sourceUnitId: ls.sourceUnitId || null,
          destUnitId: ls.destUnitId || ls.unitId || null,
          lineId: ls.lineId || ls.destLineId || null
        };
      }

      const isTransferType = notif.entityType === 'TRANSFER' || String(notif.type || '').toUpperCase().includes('TRANSFER');
      if (!isTransferType) {
        return {
          isTransfer: false,
          unitId: ls.unitId || null,
          floorId: ls.floorId || null,
          lineId: ls.lineId || null
        };
      }
      // If transfer type without sourceFloorId, continue below to resolve full source & dest from database
    }

    // 2. Resolve via Entity Type & ID
    const entityType = String(notif.entityType || '').toUpperCase();
    const entityId = notif.entityId;

    if (entityType === 'MACHINE' && entityId) {
      const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const machine = machines.find(m => m.id === entityId || m.serialNumber === entityId);
      if (machine) {
        return {
          isTransfer: false,
          unitId: machine.unitId || null,
          floorId: machine.floorId || null,
          lineId: machine.lineId || null
        };
      }
    }

    if (entityType === 'TRANSFER' && entityId) {
      const transfers = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
      const req = transfers.find(r => r.id === entityId || r.requestNumber === entityId);
      if (req) {
        return {
          isTransfer: true,
          sourceFloorId: req.sourceFloorId || null,
          destFloorId: req.destFloorId || null,
          sourceUnitId: req.sourceUnitId || null,
          destUnitId: req.destUnitId || null,
          unitId: req.destUnitId || req.sourceUnitId || null,
          lineId: req.destLineId || null
        };
      }
    }

    // 3. Extract Transfer Request Number from message/title: TR-2026-XXXXXX or TR-XXXX
    const text = `${notif.title || ''} ${notif.message || ''}`;
    const trMatch = text.match(/TR-(?:20\d\d-)?\d+/i);
    if (trMatch) {
      const trNum = trMatch[0].toUpperCase();
      const transfers = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
      const req = transfers.find(r => 
        (r.requestNumber && r.requestNumber.toUpperCase().includes(trNum)) || r.id === trNum
      );
      if (req) {
        return {
          isTransfer: true,
          sourceFloorId: req.sourceFloorId || null,
          destFloorId: req.destFloorId || null,
          sourceUnitId: req.sourceUnitId || null,
          destUnitId: req.destUnitId || null,
          unitId: req.destUnitId || req.sourceUnitId || null,
          lineId: req.destLineId || null
        };
      }
    }

    // 4. Extract Machine Serial Number: e.g. "Machine P/M-5368" or "Machine 5369" or "Machine #JA-015"
    const mMatch = text.match(/Machine\s+#?([A-Za-z0-9\/\-_]+)/i);
    if (mMatch) {
      const serial = mMatch[1].trim();
      const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const machine = machines.find(m => 
        m.serialNumber && m.serialNumber.toLowerCase() === serial.toLowerCase()
      );
      if (machine) {
        return {
          isTransfer: false,
          unitId: machine.unitId || null,
          floorId: machine.floorId || null,
          lineId: machine.lineId || null
        };
      }
    }

    // 5. Floor name pattern lookup from master floors table
    const allFloors = storage.getTable(TABLE_NAMES.FLOORS) || [];
    const lowerText = text.toLowerCase();
    for (const f of allFloors) {
      const fName = (f.name || '').toLowerCase();
      if (fName && fName.length > 2 && lowerText.includes(fName)) {
        return {
          isTransfer: false,
          unitId: f.unitId || null,
          floorId: f.id,
          lineId: null
        };
      }
    }

    return null;
  }

  /**
   * Check if a specific notification is allowed to be viewed by a given user
   * Rule: User -> Role -> Permission -> Module -> Location Scope -> Notification
   */
  isNotificationAllowedForUser(notif, user = null) {
    const activeUser = user || (typeof authService !== 'undefined' ? authService.getCurrentUser() : null);
    if (!activeUser || activeUser.status !== 'ACTIVE') return false;

    const role = (activeUser.role || '').toUpperCase();

    // 1. Super Admin has unrestricted oversight of all system notifications
    if (role === 'SUPER_ADMIN' || activeUser.username === 'superadmin') {
      return true;
    }

    // 2. Direct User Targeting
    if (notif.targetUserId) {
      if (notif.targetUserId !== activeUser.id && notif.targetUserId !== activeUser.username) {
        return false;
      }
    }

    // 3. Target Roles constraint
    if (Array.isArray(notif.targetRoles) && notif.targetRoles.length > 0) {
      const userRoleMatches = notif.targetRoles.some(r => r.toUpperCase() === role);
      if (!userRoleMatches) return false;
    }

    // 4. Module & Granular Action Access Check
    const { module, action } = this.resolveModuleAndAction(notif);
    if (module && typeof authService !== 'undefined') {
      // User MUST be allowed to view the module
      if (!authService.isModuleAllowed(module, activeUser)) {
        return false;
      }

      // If notification requires specific non-view action (e.g. APPROVE)
      if (action && action !== 'VIEW') {
        const canPerformAction = authService.hasAccess(module, action, activeUser) || (action === 'APPROVE' && (authService.isManager(activeUser) || authService.isAdmin(activeUser)));
        if (!canPerformAction) {
          return false;
        }
      }
    }

    // 5. System/Admin administrative notices are strictly for Admin/SuperAdmin
    if (module === 'user_management' || module === 'audit_logs' || module === 'database_config') {
      if (!authService.isAdmin(activeUser) && !authService.isSuperAdmin(activeUser)) {
        if (!notif.targetUserId || notif.targetUserId !== activeUser.id) {
          return false;
        }
      }
    }

    // 6. Factory Location Scope Check
    const userScope = activeUser.assignedScope;
    const isScopedUser = userScope && !userScope.allGroups && 
      ((Array.isArray(userScope.floorIds) && userScope.floorIds.length > 0) || 
       (Array.isArray(userScope.unitIds) && userScope.unitIds.length > 0) || 
       (Array.isArray(userScope.lineIds) && userScope.lineIds.length > 0));

    if (isScopedUser && typeof authService !== 'undefined') {
      const loc = this.resolveNotificationLocation(notif);

      if (loc) {
        // Transfer notifications (Source Floor <-> Destination Floor)
        if (loc.isTransfer) {
          // Check if active user is requester
          if (notif.targetUserId === activeUser.id || notif.targetUserId === activeUser.username) {
            return true;
          }

          // If user is scoped to specific floor(s), they only receive transfers involving their floor!
          if (Array.isArray(userScope.floorIds) && userScope.floorIds.length > 0) {
            const matchSource = loc.sourceFloorId ? userScope.floorIds.includes(loc.sourceFloorId) : false;
            const matchDest = loc.destFloorId ? userScope.floorIds.includes(loc.destFloorId) : false;
            if (!matchSource && !matchDest) {
              return false;
            }
          } else if (Array.isArray(userScope.unitIds) && userScope.unitIds.length > 0) {
            const matchSourceUnit = loc.sourceUnitId ? userScope.unitIds.includes(loc.sourceUnitId) : false;
            const matchDestUnit = loc.destUnitId ? userScope.unitIds.includes(loc.destUnitId) : (loc.unitId ? userScope.unitIds.includes(loc.unitId) : false);
            if (!matchSourceUnit && !matchDestUnit) {
              return false;
            }
          }
        } else {
          // Standard single machine / location notification
          if (!authService.isLocationAllowed(loc.unitId, loc.floorId, loc.lineId, activeUser)) {
            return false;
          }
        }
      } else {
        // If location could not be determined directly, but notification belongs to an operational machinery module
        if (['machines', 'transfers', 'preventive_maintenance', 'tools_management', 'spare_parts', 'relocate'].includes(module)) {
          const content = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
          const allFloors = storage.getTable(TABLE_NAMES.FLOORS) || [];
          const userFloorIds = new Set(userScope.floorIds || []);

          let mentionedOtherFloor = false;
          let mentionedUserFloor = false;

          for (const f of allFloors) {
            const fName = (f.name || '').toLowerCase();
            if (fName && fName.length > 2 && content.includes(fName)) {
              if (userFloorIds.has(f.id)) {
                mentionedUserFloor = true;
              } else {
                mentionedOtherFloor = true;
              }
            }
          }

          // If notification explicitly mentions another floor and not the user's floor, filter it out!
          if (mentionedOtherFloor && !mentionedUserFloor) {
            return false;
          }

          // If user is restricted to a floor and notification contains machine details without matching their floor, filter out
          if (userScope.floorIds && userScope.floorIds.length > 0 && (content.includes('machine') || content.includes('transfer'))) {
            if (!mentionedUserFloor && !notif.targetUserId) {
              return false;
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Get all raw notifications from database (sorted newest first)
   */
  getAllNotifications() {
    this.ensureShowcaseSeeds();
    const list = storage.getTable(TABLE_NAMES.NOTIFICATIONS) || [];
    return [...list].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }

  /**
   * Get filtered notifications tailored strictly to the specified or active user
   */
  getNotifications(user = null) {
    const activeUser = user || (typeof authService !== 'undefined' ? authService.getCurrentUser() : null);
    const all = this.getAllNotifications();
    if (!activeUser) return [];

    return all.filter(n => this.isNotificationAllowedForUser(n, activeUser));
  }

  /**
   * Check if notification is read by specific user
   */
  isReadForUser(notif, userId = null) {
    if (!notif) return false;
    const uid = userId || (typeof authService !== 'undefined' ? authService.getCurrentUser()?.id : null);
    if (!uid) return Boolean(notif.read);

    if (Array.isArray(notif.readBy)) {
      return notif.readBy.includes(uid);
    }
    return Boolean(notif.read);
  }

  /**
   * Get unread count specifically for active or specified user
   */
  getUnreadCount(user = null) {
    const activeUser = user || (typeof authService !== 'undefined' ? authService.getCurrentUser() : null);
    if (!activeUser) return 0;
    const userNotifs = this.getNotifications(activeUser);
    return userNotifs.filter(n => !this.isReadForUser(n, activeUser.id)).length;
  }

  /**
   * Mark notification as read for specific user
   */
  markAsRead(id, userId = null) {
    const uid = userId || (typeof authService !== 'undefined' ? authService.getCurrentUser()?.id : null);
    const notifs = storage.getTable(TABLE_NAMES.NOTIFICATIONS) || [];
    const item = notifs.find(n => n.id === id);
    if (item) {
      item.readBy = Array.isArray(item.readBy) ? item.readBy : (item.read ? ['legacy'] : []);
      if (uid && !item.readBy.includes(uid)) {
        item.readBy.push(uid);
      }
      item.read = true;
      item.readAt = new Date().toISOString();
      storage.update(TABLE_NAMES.NOTIFICATIONS, id, item);
      window.dispatchEvent(new CustomEvent('erp:notification-updated', { detail: { id, read: true, userId: uid } }));
    }
  }

  /**
   * Mark notification as unread for specific user
   */
  markAsUnread(id, userId = null) {
    const uid = userId || (typeof authService !== 'undefined' ? authService.getCurrentUser()?.id : null);
    const notifs = storage.getTable(TABLE_NAMES.NOTIFICATIONS) || [];
    const item = notifs.find(n => n.id === id);
    if (item) {
      if (Array.isArray(item.readBy) && uid) {
        item.readBy = item.readBy.filter(u => u !== uid);
      }
      if (!item.readBy || item.readBy.length === 0) {
        item.read = false;
      }
      storage.update(TABLE_NAMES.NOTIFICATIONS, id, item);
      window.dispatchEvent(new CustomEvent('erp:notification-updated', { detail: { id, read: false, userId: uid } }));
    }
  }

  /**
   * Mark all allowed notifications as read for specific user
   */
  markAllAsRead(userId = null) {
    const activeUser = typeof authService !== 'undefined' ? authService.getCurrentUser() : null;
    const uid = userId || activeUser?.id;
    if (!uid) return;

    const visible = this.getNotifications(activeUser);
    visible.forEach(n => {
      this.markAsRead(n.id, uid);
    });
    window.dispatchEvent(new CustomEvent('erp:notification-updated', { detail: { all: true, userId: uid } }));
  }

  /**
   * Delete or dismiss notification
   */
  deleteNotification(id) {
    storage.delete(TABLE_NAMES.NOTIFICATIONS, id);
    window.dispatchEvent(new CustomEvent('erp:notification-updated', { detail: { id, deleted: true } }));
  }

  /**
   * Enhanced notify method with dual signature (Object or Positional arguments)
   */
  notify(optionsOrTitle, message = '', type = 'INFO', targetUrl = '#dashboard') {
    let item;
    if (typeof optionsOrTitle === 'object' && optionsOrTitle !== null) {
      const opts = optionsOrTitle;
      const { module, action } = this.resolveModuleAndAction(opts);
      item = {
        id: opts.id || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: opts.title || 'System Notification',
        message: opts.message || '',
        type: opts.type || 'INFO',
        module: module,
        action: action,
        targetUrl: opts.targetUrl || '#dashboard',
        entityType: opts.entityType || null,
        entityId: opts.entityId || null,
        targetRoles: Array.isArray(opts.targetRoles) ? opts.targetRoles : null,
        targetUserId: opts.targetUserId || null,
        locationScope: opts.locationScope || null,
        read: false,
        readBy: [],
        timestamp: opts.timestamp || new Date().toISOString()
      };
    } else {
      const { module, action } = this.resolveModuleAndAction({ targetUrl, type });
      item = {
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: optionsOrTitle,
        message: message,
        type: type,
        module: module,
        action: action,
        targetUrl: targetUrl,
        read: false,
        readBy: [],
        timestamp: new Date().toISOString()
      };
    }

    storage.insert(TABLE_NAMES.NOTIFICATIONS, item);
    window.dispatchEvent(new CustomEvent('erp:notification', { detail: item }));
    window.dispatchEvent(new CustomEvent('erp:notification-updated', { detail: item }));

    // Only display popup toast if explicitly requested via showToast: true
    if (typeof optionsOrTitle === 'object' && optionsOrTitle !== null && optionsOrTitle.showToast === true) {
      const toastType = item.type.toLowerCase() === 'warning' ? 'warning' : 
                       (item.type.toLowerCase() === 'alert' || item.type.toLowerCase() === 'error' ? 'error' : 
                       (item.type.toLowerCase() === 'success' ? 'success' : 'info'));
      this.toast(item.message, toastType, item.title);
    }
    return item;
  }

  /**
   * Auto-seed requested concrete scenario showcase notifications if not present
   */
  ensureShowcaseSeeds() {
    try {
      const notifs = storage.getTable(TABLE_NAMES.NOTIFICATIONS) || [];
      let updated = false;

      // Retrofit existing legacy notifications to have module & readBy if missing
      notifs.forEach(n => {
        if (!Array.isArray(n.readBy)) {
          n.readBy = n.read ? ['legacy'] : [];
          updated = true;
        }
        if (!n.module) {
          const { module, action } = this.resolveModuleAndAction(n);
          n.module = module;
          n.action = action;
          updated = true;
        }
      });

      // 1. Maintenance User Showcase Example: 🔧 Machine #JA-015 Maintenance Due
      if (!notifs.some(n => n.id === 'notif-showcase-pm-1' || n.title.includes('JA-015'))) {
        notifs.unshift({
          id: 'notif-showcase-pm-1',
          title: '🔧 Machine #JA-015 Maintenance Due',
          message: 'Preventive maintenance is scheduled for today. Routine servicing and needle bar clearance check.',
          type: 'DUE',
          module: 'preventive_maintenance',
          action: 'VIEW',
          entityType: 'MACHINE',
          entityId: 'JA-015',
          targetUrl: '#preventive-maintenance',
          read: false,
          readBy: [],
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
        });
        updated = true;
      }

      // 2. Approval User Showcase Example: ⚠️ Machine Transfer Approval Required #TR-1024
      if (!notifs.some(n => n.id === 'notif-showcase-tr-1' || n.title.includes('TR-1024'))) {
        notifs.unshift({
          id: 'notif-showcase-tr-1',
          title: '⚠️ Machine Transfer Approval Required',
          message: 'Transfer Request #TR-1024 is waiting for your stage approval (Line JA-A → Line JA-A 5F).',
          type: 'APPROVAL_REQUEST',
          module: 'transfers',
          action: 'APPROVE',
          entityType: 'TRANSFER',
          entityId: 'TR-1024',
          targetUrl: '#approvals',
          read: false,
          readBy: [],
          timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString()
        });
        updated = true;
      }

      // 3. Admin Showcase Example: 👤 New User Created
      if (!notifs.some(n => n.id === 'notif-showcase-user-1' || n.title.includes('New User Created'))) {
        notifs.unshift({
          id: 'notif-showcase-user-1',
          title: '👤 New User Created',
          message: 'Murad has been added as a Maintenance User with Jamuna Unit factory access.',
          type: 'SUCCESS',
          module: 'user_management',
          action: 'VIEW',
          entityType: 'USER',
          entityId: 'usr-1789211116425-361',
          targetUrl: '#users',
          targetRoles: ['ADMIN', 'SUPER_ADMIN'],
          read: false,
          readBy: [],
          timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString()
        });
        updated = true;
      }

      if (updated) {
        storage.setTable(TABLE_NAMES.NOTIFICATIONS, notifs);
      }
    } catch (e) {
      console.warn('ensureShowcaseSeeds notice:', e.message);
    }
  }
}

export const notificationService = new NotificationService();

if (typeof window !== 'undefined') {
  window.notificationService = notificationService;
}
