/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * User Access–Based In-App Notification Center Drawer Component
 * Features Granular Module/Action Access Filtering, Direct Deep Linking,
 * Per-User Read/Unread State & Dynamic Category Filtering
 */

import { notificationService } from '../services/notificationService.js';
import { authService } from '../services/authService.js';
import { state } from '../state.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';

let activeDrawerFilter = 'ALL'; // 'ALL', 'UNREAD', or module key

/**
 * Helper to format timestamp into human-readable factory operational time
 */
function formatNotifTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago • ${timeStr}`;
  if (diffHours < 24 && d.getDate() === now.getDate()) return `Today ${timeStr}`;
  if (diffDays === 1 || (diffHours < 48 && d.getDate() === now.getDate() - 1)) return `Yesterday ${timeStr}`;
  if (diffDays < 7) return `${diffDays}d ago • ${timeStr}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`;
}

/**
 * Module metadata resolver (Icon, Label, Color)
 */
function getModuleMeta(moduleKey) {
  const map = {
    'preventive_maintenance': { label: 'Preventive Maintenance', icon: '🔧', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    'transfers': { label: 'Machine Transfers', icon: '🔄', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
    'machines': { label: 'Machinery Inventory', icon: '📦', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)' },
    'user_management': { label: 'User & Access Mgmt', icon: '👤', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    'spare_parts': { label: 'Spare Parts', icon: '⚙️', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    'tools_management': { label: 'Tools Management', icon: '🧰', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
    'et_lab': { label: 'ENT Lab Management', icon: '🔬', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    'reports': { label: 'Reports & Analytics', icon: '📊', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
    'master_data': { label: 'Plant Master Data', icon: '🏢', color: '#84cc16', bg: 'rgba(132, 204, 22, 0.15)' },
    'audit_logs': { label: 'System Audit Logs', icon: '📝', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' }
  };
  return map[moduleKey] || { label: 'General ERP Notice', icon: '🔔', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' };
}

/**
 * Type badge resolver
 */
function getTypeBadge(type, action) {
  const t = String(type || '').toUpperCase();
  const act = String(action || '').toUpperCase();

  if (act === 'APPROVE' || t === 'APPROVAL_REQUEST') {
    return { label: 'APPROVAL REQUIRED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' };
  }
  if (t === 'DUE' || t === 'WARNING') {
    return { label: 'ACTION DUE', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.4)' };
  }
  if (t === 'SUCCESS' || t === 'TRANSFER_COMPLETED') {
    return { label: 'COMPLETED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  if (t === 'TRANSFER_PROGRESS') {
    return { label: 'IN PROGRESS', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)', border: 'rgba(56, 189, 248, 0.4)' };
  }
  if (t === 'TRANSFER_REJECTED') {
    return { label: 'REJECTED', color: '#f87171', bg: 'rgba(248, 113, 113, 0.2)', border: 'rgba(248, 113, 113, 0.4)' };
  }
  return { label: 'NOTICE', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };
}

export function renderNotificationsDrawer() {
  const user = authService.getCurrentUser();
  const allUserNotifs = notificationService.getNotifications(user);
  const unreadCount = notificationService.getUnreadCount(user);

  // Derive unique active modules present in this user's notifications for filter pills
  const availableModules = [...new Set(allUserNotifs.map(n => {
    const { module } = notificationService.resolveModuleAndAction(n);
    return module;
  }).filter(Boolean))];

  // Apply active drawer filter
  let filteredNotifs = allUserNotifs;
  if (activeDrawerFilter === 'UNREAD') {
    filteredNotifs = allUserNotifs.filter(n => !notificationService.isReadForUser(n, user?.id));
  } else if (activeDrawerFilter !== 'ALL') {
    filteredNotifs = allUserNotifs.filter(n => {
      const { module } = notificationService.resolveModuleAndAction(n);
      return module === activeDrawerFilter;
    });
  }

  const roleName = user ? (user.presetName || user.role) : 'Guest';
  let scopeDesc = 'All Factory Locations';
  if (user?.assignedScope && !user.assignedScope.allGroups) {
    if (Array.isArray(user.assignedScope.floorIds) && user.assignedScope.floorIds.length > 0) {
      const flrs = storage.getTable(TABLE_NAMES.FLOORS) || [];
      const fNames = user.assignedScope.floorIds.map(fid => flrs.find(f => f.id === fid)?.name || fid);
      scopeDesc = `📍 ${fNames.join(', ')} Scope`;
    } else if (Array.isArray(user.assignedScope.unitIds) && user.assignedScope.unitIds.length > 0) {
      scopeDesc = `🌐 ${user.assignedScope.unitIds.length} Unit(s) Scope`;
    }
  }

  return `
    <div class="drawer-backdrop" id="drawer-notifs-backdrop"></div>
    <div class="drawer-panel" style="width: 520px; max-width: 95vw; background: #0b1120; border-left: 1px solid rgba(56, 189, 248, 0.2); box-shadow: -15px 0 45px rgba(0,0,0,0.7); display: flex; flex-direction: column;">
      
      <!-- Drawer Header -->
      <div class="drawer-header" style="padding: 16px 20px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(56, 189, 248, 0.2); display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              🔔
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px; font-weight: 800; color: #fff;">Notifications</span>
                ${unreadCount > 0 ? `
                  <span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 11px; font-weight: 700;">
                    ${unreadCount} Unread
                  </span>
                ` : `
                  <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 11px; font-weight: 700;">
                    All Caught Up
                  </span>
                `}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Role-based alerts &amp; pending approvals for your account
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            ${unreadCount > 0 ? `
              <button id="btn-mark-all-read" class="btn btn-secondary btn-xs" style="font-size: 11.5px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.35); background: rgba(14, 165, 233, 0.12); padding: 5px 10px; border-radius: 6px; cursor: pointer;" title="Mark all visible notifications as read">
                ✓ Mark all read
              </button>
            ` : ''}
            <button id="btn-close-notifs-drawer" class="btn btn-ghost btn-xs" style="font-size: 16px; color: var(--text-muted); padding: 4px 8px;" title="Close Notifications (Esc)">✕</button>
          </div>
        </div>

        <!-- Active User Profile Banner -->
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 6px 12px; font-size: 11.5px; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; color: #cbd5e1;">
            <span>👤</span>
            <span><strong>${user?.name || 'User'}</strong></span>
            <span style="color: var(--text-muted);">(${roleName})</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px; color: #38bdf8; font-weight: 600; font-size: 11px;">
            <span>🌐</span>
            <span>${scopeDesc}</span>
          </div>
        </div>

        <!-- Quick Filter Pills -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
          <button 
            type="button" 
            class="btn-notif-filter btn btn-xs" 
            data-filter="ALL" 
            style="padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 20px; border: 1px solid ${activeDrawerFilter === 'ALL' ? '#38bdf8' : 'var(--border-color)'}; background: ${activeDrawerFilter === 'ALL' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)'}; color: ${activeDrawerFilter === 'ALL' ? '#fff' : 'var(--text-muted)'}; cursor: pointer;"
          >
            All (${allUserNotifs.length})
          </button>

          <button 
            type="button" 
            class="btn-notif-filter btn btn-xs" 
            data-filter="UNREAD" 
            style="padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 20px; border: 1px solid ${activeDrawerFilter === 'UNREAD' ? '#38bdf8' : 'var(--border-color)'}; background: ${activeDrawerFilter === 'UNREAD' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)'}; color: ${activeDrawerFilter === 'UNREAD' ? '#fff' : 'var(--text-muted)'}; cursor: pointer;"
          >
            Unread (${unreadCount})
          </button>

          ${availableModules.map(modKey => {
            const meta = getModuleMeta(modKey);
            const count = allUserNotifs.filter(n => {
              const { module } = notificationService.resolveModuleAndAction(n);
              return module === modKey;
            }).length;
            const isSelected = activeDrawerFilter === modKey;

            return `
              <button 
                type="button" 
                class="btn-notif-filter btn btn-xs" 
                data-filter="${modKey}" 
                style="padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 20px; border: 1px solid ${isSelected ? meta.color : 'var(--border-color)'}; background: ${isSelected ? meta.bg : 'rgba(15, 23, 42, 0.6)'}; color: ${isSelected ? '#fff' : 'var(--text-muted)'}; cursor: pointer;"
              >
                ${meta.icon} ${meta.label.split(' ')[0]} (${count})
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Drawer Content: Notification Stream -->
      <div class="drawer-content" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
        ${filteredNotifs.length === 0 ? `
          <div style="text-align: center; color: var(--text-muted); padding: 60px 20px;">
            <div style="font-size: 42px; margin-bottom: 12px; opacity: 0.7;">✨</div>
            <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px;">No Notifications Found</h3>
            <p style="font-size: 12px; color: var(--text-secondary); max-width: 320px; margin: 0 auto; line-height: 1.5;">
              ${activeDrawerFilter === 'UNREAD' 
                ? 'You have read all pending notifications for your authorized factory modules.' 
                : 'There are no active alerts matching your security role, permissions, and location scope.'}
            </p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${filteredNotifs.map(n => {
              const isRead = notificationService.isReadForUser(n, user?.id);
              const { module, action } = notificationService.resolveModuleAndAction(n);
              const meta = getModuleMeta(module);
              const badge = getTypeBadge(n.type, action);
              const formattedTime = formatNotifTime(n.timestamp);

              return `
                <div 
                  class="notif-item-card ${isRead ? 'read' : 'unread'}" 
                  data-id="${n.id}" 
                  data-url="${n.targetUrl || ''}" 
                  data-module="${module || ''}" 
                  data-action="${action || ''}" 
                  data-entity-type="${n.entityType || ''}" 
                  data-entity-id="${n.entityId || ''}"
                  style="
                    background: ${isRead ? 'rgba(15, 23, 42, 0.55)' : 'rgba(15, 23, 42, 0.95)'}; 
                    border: 1px solid ${isRead ? 'rgba(255, 255, 255, 0.07)' : 'rgba(56, 189, 248, 0.35)'}; 
                    border-left: 4px solid ${isRead ? 'rgba(148, 163, 184, 0.25)' : (badge.color || '#38bdf8')}; 
                    border-radius: 10px; 
                    padding: 13px 15px; 
                    cursor: pointer; 
                    transition: all 0.2s ease; 
                    position: relative;
                    box-shadow: ${isRead ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.3)'};
                  "
                >
                  <!-- Card Header: Module Tag + Type Badge + Time -->
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span class="badge" style="font-size: 10px; padding: 2px 7px; background: ${meta.bg}; color: ${meta.color}; border: 1px solid ${meta.color}40; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                        <span>${meta.icon}</span> ${meta.label}
                      </span>
                      <span class="badge" style="font-size: 9.5px; padding: 2px 6px; background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.border}; font-weight: 800;">
                        ${badge.label}
                      </span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px;">
                      ${!isRead ? `
                        <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 6px #38bdf8;" title="Unread"></span>
                      ` : ''}
                      <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">
                        ${formattedTime}
                      </span>
                    </div>
                  </div>

                  <!-- Card Title -->
                  <div style="font-size: 13.5px; font-weight: 800; color: ${isRead ? '#cbd5e1' : '#fff'}; margin-bottom: 4px; line-height: 1.3;">
                    ${n.title}
                  </div>

                  <!-- Card Message Body -->
                  <div style="font-size: 12px; color: ${isRead ? 'var(--text-muted)' : 'var(--text-secondary)'}; line-height: 1.45; margin-bottom: 8px;">
                    ${n.message}
                  </div>

                  <!-- Card Footer: Deep Link Prompt & Item Actions -->
                  <div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                    <span style="color: #38bdf8; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                      Open Details &rarr;
                    </span>

                    <div style="display: flex; gap: 8px; align-items: center;" class="notif-actions-stop-propagation">
                      <button 
                        type="button" 
                        class="btn-toggle-notif-read btn btn-ghost btn-xs" 
                        data-id="${n.id}" 
                        data-read="${isRead ? 'true' : 'false'}" 
                        style="font-size: 11px; color: var(--text-muted); padding: 2px 6px;" 
                        title="${isRead ? 'Mark as unread' : 'Mark as read'}"
                      >
                        ${isRead ? 'Mark unread' : 'Mark read'}
                      </button>
                      <button 
                        type="button" 
                        class="btn-delete-notif btn btn-ghost btn-xs" 
                        data-id="${n.id}" 
                        style="font-size: 12px; color: #f87171; padding: 2px 5px;" 
                        title="Dismiss notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Drawer Footer -->
      <div style="padding: 12px 20px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(56, 189, 248, 0.15); display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-muted);">
        <span>Security Scoped: <strong>${roleName}</strong></span>
        <span style="display: inline-flex; align-items: center; gap: 4px;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
          Auto-Synchronized
        </span>
      </div>

    </div>
  `;
}

export function initNotificationsDrawerEvents() {
  const closeBtn = document.getElementById('btn-close-notifs-drawer');
  const backdrop = document.getElementById('drawer-notifs-backdrop');

  const closeDrawer = () => {
    state.set('activeModal', null);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (backdrop) backdrop.addEventListener('click', closeDrawer);

  // Esc key closes drawer
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      window.removeEventListener('keydown', handleKeydown);
    }
  };
  window.addEventListener('keydown', handleKeydown);

  // Mark all as read button
  const markAllBtn = document.getElementById('btn-mark-all-read');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentUser = authService.getCurrentUser();
      notificationService.markAllAsRead(currentUser?.id);
      // Re-render modal in place
      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = renderNotificationsDrawer();
        initNotificationsDrawerEvents();
      }
    });
  }

  // Filter pills click
  document.querySelectorAll('.btn-notif-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeDrawerFilter = btn.getAttribute('data-filter') || 'ALL';
      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = renderNotificationsDrawer();
        initNotificationsDrawerEvents();
      }
    });
  });

  // Toggle Read / Unread on individual item
  document.querySelectorAll('.btn-toggle-notif-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const isRead = btn.getAttribute('data-read') === 'true';
      const currentUser = authService.getCurrentUser();

      if (isRead) {
        notificationService.markAsUnread(id, currentUser?.id);
      } else {
        notificationService.markAsRead(id, currentUser?.id);
      }

      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = renderNotificationsDrawer();
        initNotificationsDrawerEvents();
      }
    });
  });

  // Dismiss / Delete notification
  document.querySelectorAll('.btn-delete-notif').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        notificationService.deleteNotification(id);
        const modalLayer = document.getElementById('modal-layer');
        if (modalLayer) {
          modalLayer.innerHTML = renderNotificationsDrawer();
          initNotificationsDrawerEvents();
        }
      }
    });
  });

  // Interactive Deep Linking Navigation on card click
  document.querySelectorAll('.notif-item-card').forEach(item => {
    item.addEventListener('click', (e) => {
      // Prevent trigger if clicking on child action buttons
      if (e.target.closest('.notif-actions-stop-propagation')) return;

      const id = item.getAttribute('data-id');
      const url = item.getAttribute('data-url') || '';
      const module = item.getAttribute('data-module') || '';
      const action = item.getAttribute('data-action') || '';
      const entityId = item.getAttribute('data-entity-id') || '';
      const currentUser = authService.getCurrentUser();

      // Automatically mark as read
      if (id) {
        notificationService.markAsRead(id, currentUser?.id);
      }

      closeDrawer();

      // Execute Intelligent Deep Linking
      try {
        // 1. Transfer Request or Approval
        if (module === 'transfers' || url.includes('approval') || url.includes('transfer')) {
          if (entityId) {
            // Find transfer request in database
            const requests = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
            const req = requests.find(r => r.id === entityId || r.requestNumber === entityId || (r.serialNumber && r.serialNumber === entityId));
            const targetReqId = req ? req.id : entityId;
            
            state.set('activeTransferRequestId', targetReqId);
            state.set('currentView', 'transfers');
            state.set('activeModal', 'transfer-details');
            return;
          }
          state.set('currentView', 'transfers');
          return;
        }

        // 2. Preventive Maintenance Alert
        if (module === 'preventive_maintenance' || url.includes('preventive')) {
          state.set('currentView', 'preventive-maintenance');
          if (entityId) {
            setTimeout(() => {
              // Pre-fill filter or search in PM view
              const searchInput = document.getElementById('pm-search-input');
              if (searchInput) {
                searchInput.value = entityId;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }, 100);
          }
          return;
        }

        // 3. Machinery Inventory
        if (module === 'machines' || url.includes('inventory') || url.includes('machine')) {
          if (entityId) {
            const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
            const mc = machines.find(m => m.id === entityId || m.serialNumber === entityId);
            if (mc) {
              state.set('activeMachineId', mc.id);
              state.set('currentView', 'inventory');
              state.set('activeModal', 'machine-details');
              return;
            }
          }
          state.set('currentView', 'inventory');
          return;
        }

        // 4. User Management
        if (module === 'user_management' || url.includes('users') || url.includes('user')) {
          state.set('currentView', 'users');
          return;
        }

        // 5. Generic Target URL Fallback (e.g. #et-lab, #spare-parts, #reports)
        if (url && url.startsWith('#')) {
          const view = url.replace('#', '').trim();
          if (view) {
            state.set('currentView', view);
            return;
          }
        }
      } catch (err) {
        console.error('Deep link error:', err);
      }
    });
  });
}
