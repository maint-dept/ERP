/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Searchable Admin Account Switcher & Search Popup Component
 * Fast in-memory filtering by Card Number, Name, or Username with Granular Access Enforcement
 */

import { authService } from '../services/authService.js';
import { state } from '../state.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';

let currentSearchTab = 'ALL'; // 'ALL' | 'ADMINS' | 'AUTHORIZED' | 'NO_ACCESS'
let currentSearchQuery = '';

/**
 * Escape HTML utility
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds an employee lookup map from EMPLOYEES table for fast card number & info resolution
 */
export function getEmployeeMap() {
  const map = new Map();
  try {
    const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    for (let i = 0; i < employees.length; i++) {
      const e = employees[i];
      if (e.id) map.set(e.id, e);
      if (e.cardNumber) map.set(String(e.cardNumber).trim().toLowerCase(), e);
    }
  } catch (_) {}
  return map;
}

/**
 * Resolves a clean Card Number for a user record
 */
export function getUserCardNumber(user, employeeMap = null) {
  if (!user) return '';
  if (user.cardNumber && String(user.cardNumber).trim()) {
    return String(user.cardNumber).trim();
  }
  if (user.employeeId && String(user.employeeId).trim()) {
    const empId = String(user.employeeId).trim();
    if (!empId.startsWith('AMG-HQ-')) return empId;
  }
  if (user.manpowerId && employeeMap && employeeMap.has(user.manpowerId)) {
    const emp = employeeMap.get(user.manpowerId);
    if (emp && emp.cardNumber) return String(emp.cardNumber).trim();
  }
  return user.employeeId ? String(user.employeeId).trim() : '';
}

/**
 * Robust Card Number matching supporting partials, prefix (#), hyphens, spaces, and numeric digits
 */
export function matchesCardNumber(cardStr, query) {
  if (!cardStr || !query) return false;
  const rawCard = String(cardStr).toLowerCase().trim();
  const rawQuery = String(query).toLowerCase().trim();
  if (rawCard.includes(rawQuery)) return true;

  const normCard = rawCard.replace(/[#\s\-_]/g, '');
  const normQuery = rawQuery.replace(/[#\s\-_]/g, '');

  if (normCard && normQuery) {
    if (normCard.includes(normQuery) || normQuery.includes(normCard)) return true;
    const digitsCard = normCard.replace(/\D/g, '').replace(/^0+/, '');
    const digitsQuery = normQuery.replace(/\D/g, '').replace(/^0+/, '');
    if (digitsQuery.length >= 2 && digitsCard.length >= 2 && (digitsCard.includes(digitsQuery) || digitsQuery.includes(digitsCard))) {
      return true;
    }
  }
  return false;
}

/**
 * Checks a user's access status and resolves role name and badge
 */
export function checkUserAccessStatus(u) {
  if (!u) {
    return {
      hasAccess: false,
      roleName: 'No Access',
      statusLabel: 'No Access (Pending Admin Assignment)',
      badgeClass: 'badge-no-access',
      isSuperAdmin: false,
      isAdmin: false
    };
  }

  const isSuper = authService.isSuperAdmin(u);
  const isAdmin = authService.isAdmin(u);

  if (isSuper) {
    return {
      hasAccess: true,
      roleName: 'Super Administrator',
      statusLabel: 'Super Administrator',
      badgeClass: 'badge-super-admin',
      isSuperAdmin: true,
      isAdmin: false
    };
  }

  if (isAdmin) {
    return {
      hasAccess: true,
      roleName: 'Administrator',
      statusLabel: 'Administrator',
      badgeClass: 'badge-admin',
      isSuperAdmin: false,
      isAdmin: true
    };
  }

  if (u.status !== 'ACTIVE') {
    return {
      hasAccess: false,
      roleName: 'Deactivated',
      statusLabel: 'Account Deactivated',
      badgeClass: 'badge-deactivated',
      isSuperAdmin: false,
      isAdmin: false
    };
  }

  const isExplicitNoAccess = u.role === 'NO_ACCESS' || 
    u.roleId === 'role-no-access' || 
    u.presetId === 'no_access' || 
    (u.presetName && u.presetName.toLowerCase().includes('no access'));

  const perms = u.permissions;
  const hasExplicitPerms = perms && typeof perms === 'object' && Object.keys(perms).length > 0 && 
    Object.values(perms).some(arr => Array.isArray(arr) && arr.length > 0);

  let rName = u.presetName;
  if (!rName && u.presetId) {
    const p = authService.getPresetById(u.presetId);
    if (p?.name) rName = p.name;
  }
  if (!rName) {
    const rObj = authService.getRoleById(u.roleId) || (typeof authService.getRoleByCode === 'function' ? authService.getRoleByCode(u.role) : null);
    if (rObj?.name) rName = rObj.name;
  }
  if (!rName) {
    rName = u.role === 'USER' ? 'Maintenance User' : (u.role || 'Maintenance User');
  }

  if (isExplicitNoAccess || (!hasExplicitPerms && !u.presetId && !u.roleId)) {
    return {
      hasAccess: false,
      roleName: 'No Access',
      statusLabel: 'No Access (Pending Admin Assignment)',
      badgeClass: 'badge-no-access',
      isSuperAdmin: false,
      isAdmin: false
    };
  }

  return {
    hasAccess: true,
    roleName: rName,
    statusLabel: rName,
    badgeClass: 'badge-user-authorized',
    isSuperAdmin: false,
    isAdmin: false
  };
}

/**
 * Checks if a user matches the search query (card number, name, username, department, designation)
 */
export function matchesUserQuery(user, query, employeeMap = null) {
  if (!query) return true;
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return true;

  const card = getUserCardNumber(user, employeeMap);
  if (matchesCardNumber(card, cleanQ)) return true;

  const name = (user.name || '').toLowerCase();
  if (name.includes(cleanQ)) return true;

  const username = (user.username || '').toLowerCase();
  if (username.includes(cleanQ)) return true;

  const dept = (user.department || '').toLowerCase();
  if (dept.includes(cleanQ)) return true;

  const desig = (user.designation || '').toLowerCase();
  if (desig.includes(cleanQ)) return true;

  return false;
}

/**
 * Filters all users according to query, tab, and separates Admin vs Standard Users
 */
export function filterUsers(allUsers, query = '', tab = 'ALL', employeeMap = null) {
  const cleanQuery = (query || '').trim();
  const empMap = employeeMap || getEmployeeMap();

  let filtered = allUsers.filter(u => matchesUserQuery(u, cleanQuery, empMap));

  if (tab === 'ADMINS') {
    filtered = filtered.filter(u => authService.isSuperAdmin(u) || authService.isAdmin(u));
  } else if (tab === 'AUTHORIZED') {
    filtered = filtered.filter(u => {
      const isMgmt = authService.isSuperAdmin(u) || authService.isAdmin(u);
      if (isMgmt) return true;
      const st = checkUserAccessStatus(u);
      return st.hasAccess;
    });
  } else if (tab === 'NO_ACCESS') {
    filtered = filtered.filter(u => {
      const isMgmt = authService.isSuperAdmin(u) || authService.isAdmin(u);
      if (isMgmt) return false;
      const st = checkUserAccessStatus(u);
      return !st.hasAccess;
    });
  }

  // Separate Management accounts (Super Admin & Admin) from standard Factory Users
  const adminUsers = [];
  const factoryUsers = [];

  for (let i = 0; i < filtered.length; i++) {
    const u = filtered[i];
    if (authService.isSuperAdmin(u) || authService.isAdmin(u)) {
      adminUsers.push(u);
    } else {
      factoryUsers.push(u);
    }
  }

  // Sort admin users: Super Admin first, then Admins
  adminUsers.sort((a, b) => {
    const aSuper = authService.isSuperAdmin(a) ? 1 : 0;
    const bSuper = authService.isSuperAdmin(b) ? 1 : 0;
    if (aSuper !== bSuper) return bSuper - aSuper;
    return (a.name || '').localeCompare(b.name || '');
  });

  return {
    adminUsers,
    factoryUsers,
    totalCount: filtered.length
  };
}

/**
 * Executes user switch with robust security check and friendly error alert
 */
export function switchActiveAccount(targetUserId, onBlockedNotice = null) {
  try {
    const allUsers = authService.getAllUsers();
    const target = allUsers.find(u => u.id === targetUserId);
    if (!target) {
      alert('Target user account not found.');
      return false;
    }

    const isTargetMgmt = authService.isSuperAdmin(target) || authService.isAdmin(target);
    const accessStatus = checkUserAccessStatus(target);

    // Strict Enforcement: Block entering accounts with No Access (Pending Admin Assignment)
    if (!isTargetMgmt && !accessStatus.hasAccess) {
      const msg = `Access Denied: Account '${target.name || target.username}' currently has 'No Access (Pending Admin Assignment)' with zero permissions. To login to this account, please assign an active role or permissions in User Management first.`;
      if (typeof onBlockedNotice === 'function') {
        onBlockedNotice(msg, target);
      } else {
        alert(msg);
      }
      return false;
    }

    const switched = authService.switchUser(targetUserId);
    state.resetFilters();
    const landingView = authService.getFirstAllowedView(switched);
    window.location.hash = '#' + landingView;
    window.location.reload();
    return true;
  } catch (err) {
    if (typeof onBlockedNotice === 'function') {
      onBlockedNotice(err.message, null);
    } else {
      alert(err.message);
    }
    return false;
  }
}

/**
 * Renders the modal HTML
 */
export function renderAccountSwitcherModal() {
  const currentUser = authService.getCurrentUser();
  if (!currentUser) return '';

  const isSuperAdmin = authService.isSuperAdmin(currentUser);
  const isAdmin = authService.isAdmin(currentUser);

  if (!isSuperAdmin && !isAdmin) return '';

  const allUsers = authService.getAllUsers();
  const empMap = getEmployeeMap();

  const totalAll = allUsers.length;
  const adminCount = allUsers.filter(u => authService.isSuperAdmin(u) || authService.isAdmin(u)).length;
  const authCount = allUsers.filter(u => {
    if (authService.isSuperAdmin(u) || authService.isAdmin(u)) return true;
    return checkUserAccessStatus(u).hasAccess;
  }).length;
  const noAccessCount = allUsers.filter(u => {
    if (authService.isSuperAdmin(u) || authService.isAdmin(u)) return false;
    return !checkUserAccessStatus(u).hasAccess;
  }).length;

  const { adminUsers, factoryUsers, totalCount } = filterUsers(allUsers, currentSearchQuery, currentSearchTab, empMap);

  return `
    <div class="modal-overlay" id="modal-account-switcher-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
      <div class="modal-dialog modal-account-switcher-dialog" style="width: 660px; max-width: 95vw; max-height: 90vh; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 24px 65px rgba(0, 0, 0, 0.8); display: flex; flex-direction: column; overflow: hidden;">
        
        <!-- Modal Header -->
        <div class="account-switcher-modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; font-size: 19px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
              🎭
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; line-height: 1.2;">Switch User Account</div>
              <div style="font-size: 11.5px; color: #e0f2fe; margin-top: 2px;">Search factory users by Card Number or Name to enter authorized accounts</div>
            </div>
          </div>
          <button id="btn-close-account-switcher-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 8px; border-radius: 6px;" title="Close (Esc)">✕</button>
        </div>

        <!-- Sticky Controls Bar (Search Input & Tabs) -->
        <div style="background: rgba(15, 23, 42, 0.95); padding: 14px 20px 10px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
          
          <!-- Search Input Box -->
          <div class="account-switcher-search-wrapper" style="position: relative; display: flex; align-items: center; margin-bottom: 12px;">
            <span style="position: absolute; left: 12px; font-size: 15px; color: #38bdf8; pointer-events: none;">🔍</span>
            <input 
              type="text" 
              id="inp-account-switcher-search" 
              class="form-control" 
              style="width: 100%; height: 42px; padding: 0 42px 0 38px; background: #0b1120; border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 8px; color: #f8fafc; font-size: 13.5px; font-weight: 600; outline: none; transition: all 0.2s ease;"
              placeholder="Search by Card Number (e.g. 10452), Name, or Username..." 
              value="${escapeHtml(currentSearchQuery)}"
              autocomplete="off"
              spellcheck="false"
            />
            <button 
              type="button" 
              id="btn-account-switcher-clear" 
              style="position: absolute; right: 10px; background: none; border: none; color: #94a3b8; font-size: 15px; cursor: pointer; padding: 4px; display: ${currentSearchQuery ? 'block' : 'none'};"
              title="Clear Search"
            >✕</button>
          </div>

          <!-- Filter Tabs & Stats -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div class="account-switcher-tabs" style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px;">
              <button type="button" class="btn btn-xs ${currentSearchTab === 'ALL' ? 'btn-primary' : 'btn-ghost'} tab-switcher-btn" data-tab="ALL" style="font-weight: 700; font-size: 11.5px; border-radius: 6px; ${currentSearchTab === 'ALL' ? 'background: #0284c7;' : 'color: #94a3b8;'}">
                All (${totalAll})
              </button>
              <button type="button" class="btn btn-xs ${currentSearchTab === 'ADMINS' ? 'btn-primary' : 'btn-ghost'} tab-switcher-btn" data-tab="ADMINS" style="font-weight: 700; font-size: 11.5px; border-radius: 6px; ${currentSearchTab === 'ADMINS' ? 'background: #0284c7;' : 'color: #94a3b8;'}">
                👑 Admins (${adminCount})
              </button>
              <button type="button" class="btn btn-xs ${currentSearchTab === 'AUTHORIZED' ? 'btn-primary' : 'btn-ghost'} tab-switcher-btn" data-tab="AUTHORIZED" style="font-weight: 700; font-size: 11.5px; border-radius: 6px; ${currentSearchTab === 'AUTHORIZED' ? 'background: #0284c7;' : 'color: #94a3b8;'}">
                ✅ Authorized (${authCount})
              </button>
              <button type="button" class="btn btn-xs ${currentSearchTab === 'NO_ACCESS' ? 'btn-primary' : 'btn-ghost'} tab-switcher-btn" data-tab="NO_ACCESS" style="font-weight: 700; font-size: 11.5px; border-radius: 6px; ${currentSearchTab === 'NO_ACCESS' ? 'background: #0284c7;' : 'color: #94a3b8;'}">
                🔒 Pending Access (${noAccessCount})
              </button>
            </div>

            <div id="account-switcher-count-badge" style="font-size: 11.5px; font-weight: 700; color: #38bdf8;">
              ${totalCount} matches found
            </div>
          </div>
        </div>

        <!-- Alert Notification Box (e.g. when trying to enter a No-Access account) -->
        <div id="account-switcher-alert" style="display: none; margin: 12px 20px 0 20px; padding: 10px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; color: #fca5a5; font-size: 12px; font-weight: 600; line-height: 1.4; flex-shrink: 0;">
        </div>

        <!-- Scrollable Results Container -->
        <div id="account-switcher-results-container" class="custom-scrollbar" style="flex: 1; overflow-y: auto; padding: 14px 20px;">
          ${renderModalResultsContent(adminUsers, factoryUsers, currentUser, empMap, isSuperAdmin, isAdmin)}
        </div>

        <!-- Modal Footer -->
        <div style="background: rgba(15, 23, 42, 0.95); padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <div style="font-size: 11.5px; color: #94a3b8;">
            <span style="color: #38bdf8; font-weight: 700;">💡 Tip:</span> Type an employee Card Number for instant exact match.
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-switcher-goto-users" class="btn btn-ghost btn-sm" style="font-size: 12px; font-weight: 700; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px;">
              👥 User Management
            </button>
            <button type="button" id="btn-switcher-close-footer" class="btn btn-ghost btn-sm" style="font-size: 12px; font-weight: 700; border-radius: 6px;">
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Renders the body content of the modal (Admins group + Factory Users group)
 */
function renderModalResultsContent(adminUsers, factoryUsers, currentUser, empMap, isSuperAdmin, isAdmin) {
  if (adminUsers.length === 0 && factoryUsers.length === 0) {
    return `
      <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
        <div style="font-size: 36px; margin-bottom: 10px;">🔍</div>
        <div style="font-size: 14px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px;">No matching accounts found</div>
        <div style="font-size: 12px;">Try searching by a different Card Number or employee Name.</div>
      </div>
    `;
  }

  let html = '';

  // 1. MANAGEMENT & ADMINISTRATOR ACCOUNTS (Clearly Separated)
  if (adminUsers.length > 0 && (currentSearchTab === 'ALL' || currentSearchTab === 'ADMINS' || currentSearchTab === 'AUTHORIZED')) {
    html += `
      <div style="margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          <span>👑</span> Management &amp; Administrator Accounts (${adminUsers.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${adminUsers.map(u => renderUserRow(u, currentUser, empMap, isSuperAdmin, isAdmin, true)).join('')}
        </div>
      </div>
    `;
  }

  // 2. FACTORY USER ACCOUNTS
  if (factoryUsers.length > 0 && currentSearchTab !== 'ADMINS') {
    const displayLimit = 40;
    const displayedUsers = factoryUsers.slice(0, displayLimit);
    const hasMore = factoryUsers.length > displayLimit;

    html += `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          <span style="display: flex; align-items: center; gap: 6px;">
            <span>👥</span> Factory User Accounts (${factoryUsers.length})
          </span>
          ${hasMore ? `<span style="font-size: 10.5px; color: #94a3b8; font-weight: 600;">Showing top ${displayLimit} matches</span>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${displayedUsers.map(u => renderUserRow(u, currentUser, empMap, isSuperAdmin, isAdmin, false)).join('')}
        </div>
        ${hasMore ? `
          <div style="text-align: center; padding: 12px; font-size: 11.5px; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border-radius: 8px; margin-top: 8px;">
            Showing top ${displayLimit} of ${factoryUsers.length} matching accounts. Type a specific Card Number or Name to narrow down results.
          </div>
        ` : ''}
      </div>
    `;
  }

  return html;
}

/**
 * Renders an individual user card/row for the account switcher modal
 */
function renderUserRow(u, currentUser, empMap, isSuperAdmin, isAdmin, isManagement) {
  const isCurrent = u.id === currentUser?.id;
  const isTargetSuper = authService.isSuperAdmin(u);
  const isTargetAdmin = authService.isAdmin(u);
  const status = checkUserAccessStatus(u);
  const cardNum = getUserCardNumber(u, empMap);
  const cleanInitial = (u.name || u.username || 'U').replace(/^(Engr\.|Dr\.|Mr\.|Mrs\.|Ms\.|Md\.)\s+/i, '').trim().charAt(0).toUpperCase() || 'U';

  // Can current user switch into this account?
  // - Current account: already logged in
  // - Super Admin: can switch to any authorized account (not No-Access)
  // - Admin: can switch to other Admins or authorized Factory Users, but CANNOT switch to Super Admin
  let canEnter = false;
  let blockReason = '';

  if (isCurrent) {
    canEnter = false;
  } else if (!status.hasAccess) {
    canEnter = false;
    blockReason = 'No Access (Pending Admin Assignment)';
  } else if (isAdmin && !isSuperAdmin && isTargetSuper) {
    canEnter = false;
    blockReason = 'Restricted: Admins cannot switch to Super Administrator';
  } else {
    canEnter = true;
  }

  return `
    <div class="account-switcher-row ${isCurrent ? 'is-active-session' : ''} ${!status.hasAccess ? 'is-blocked-account' : ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: ${isCurrent ? 'rgba(2, 132, 199, 0.12)' : (isManagement ? 'rgba(30, 41, 59, 0.6)' : 'rgba(15, 23, 42, 0.6)')}; border: 1px solid ${isCurrent ? '#0284c7' : (isManagement ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.07)')}; border-radius: 8px; transition: all 0.18s ease; gap: 12px;">
      
      <!-- Left: Avatar & User Identity -->
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
        <div style="width: 38px; height: 38px; border-radius: 50%; background: ${isTargetSuper ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : (isTargetAdmin ? 'linear-gradient(135deg, #d97706, #f59e0b)' : (status.hasAccess ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(100, 116, 139, 0.3)'))}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14.5px; font-weight: 800; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);">
          ${cleanInitial}
        </div>
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px;">
            <span style="font-size: 13.5px; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(u.name || u.username)}</span>
            
            ${cardNum ? `
              <span class="badge" style="font-size: 11px; font-weight: 800; font-family: var(--font-mono); background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; border-radius: 4px;" title="Employee Card Number">
                📇 #${escapeHtml(cardNum)}
              </span>
            ` : ''}

            <span style="font-size: 11.5px; color: #94a3b8; font-family: var(--font-mono);">
              @${escapeHtml(u.username)}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${status.hasAccess ? `
              <span class="badge" style="font-size: 10.5px; font-weight: 700; background: ${isTargetSuper ? 'rgba(56, 189, 248, 0.18)' : (isTargetAdmin ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)')}; color: ${isTargetSuper ? '#38bdf8' : (isTargetAdmin ? '#f59e0b' : '#34d399')}; border: 1px solid ${isTargetSuper ? 'rgba(56, 189, 248, 0.35)' : (isTargetAdmin ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)')}; padding: 1px 7px; border-radius: 4px;">
                ${isTargetSuper ? '🛡️ Super Administrator' : (isTargetAdmin ? '👑 Administrator' : `✓ ${status.roleName}`)}
              </span>
            ` : `
              <span class="badge" style="font-size: 10.5px; font-weight: 700; background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); padding: 1px 7px; border-radius: 4px;" title="This user has zero assigned permissions. Role assignment required.">
                🔒 No Access (Pending Admin Assignment)
              </span>
            `}

            ${u.department ? `
              <span style="font-size: 11px; color: #94a3b8;">
                ${escapeHtml(u.department)}${u.designation ? ` • ${escapeHtml(u.designation)}` : ''}
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Right: Action Button -->
      <div style="flex-shrink: 0;">
        ${isCurrent ? `
          <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); padding: 4px 10px; border-radius: 6px;">
            <span>●</span> Active Session
          </span>
        ` : canEnter ? `
          <button 
            type="button" 
            class="btn btn-primary btn-xs btn-trigger-user-switch" 
            data-user-id="${u.id}"
            style="font-size: 11.5px; font-weight: 800; padding: 5px 12px; border-radius: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);"
            title="Switch active session into ${escapeHtml(u.name)}'s account"
          >
            <span>Switch Account</span>
            <span>➔</span>
          </button>
        ` : `
          <button 
            type="button" 
            class="btn btn-ghost btn-xs btn-blocked-user-switch" 
            data-user-name="${escapeHtml(u.name || u.username)}"
            data-reason="${escapeHtml(blockReason)}"
            style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: rgba(148, 163, 184, 0.08); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); cursor: not-allowed; display: inline-flex; align-items: center; gap: 4px;"
            title="${escapeHtml(blockReason)}"
          >
            <span>🔒</span>
            <span>${status.hasAccess ? 'Restricted' : 'Cannot Enter'}</span>
          </button>
        `}
      </div>

    </div>
  `;
}

/**
 * Initializes all event handlers for the account switcher modal
 */
export function initAccountSwitcherModalEvents() {
  const overlay = document.getElementById('modal-account-switcher-overlay');
  const searchInput = document.getElementById('inp-account-switcher-search');
  const clearBtn = document.getElementById('btn-account-switcher-clear');
  const resultsContainer = document.getElementById('account-switcher-results-container');
  const countBadge = document.getElementById('account-switcher-count-badge');
  const alertBox = document.getElementById('account-switcher-alert');

  const closeModal = () => {
    state.set('activeModal', null);
  };

  // Close triggers
  const btnClose = document.getElementById('btn-close-account-switcher-modal');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  const btnCloseFooter = document.getElementById('btn-switcher-close-footer');
  if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeModal);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Jump to User Management
  const btnGotoUsers = document.getElementById('btn-switcher-goto-users');
  if (btnGotoUsers) {
    btnGotoUsers.addEventListener('click', () => {
      closeModal();
      state.set('currentView', 'users');
    });
  }

  // Show Alert in modal
  const showAlert = (message) => {
    if (alertBox) {
      alertBox.textContent = message;
      alertBox.style.display = 'block';
      setTimeout(() => {
        if (alertBox) alertBox.style.display = 'none';
      }, 6000);
    } else {
      alert(message);
    }
  };

  // Live re-render of results
  const updateResults = () => {
    const currentUser = authService.getCurrentUser();
    const allUsers = authService.getAllUsers();
    const empMap = getEmployeeMap();
    const isSuperAdmin = authService.isSuperAdmin(currentUser);
    const isAdmin = authService.isAdmin(currentUser);

    const { adminUsers, factoryUsers, totalCount } = filterUsers(allUsers, currentSearchQuery, currentSearchTab, empMap);

    if (resultsContainer) {
      resultsContainer.innerHTML = renderModalResultsContent(adminUsers, factoryUsers, currentUser, empMap, isSuperAdmin, isAdmin);
      attachRowEvents();
    }
    if (countBadge) {
      countBadge.textContent = `${totalCount} matches found`;
    }
    if (clearBtn) {
      clearBtn.style.display = currentSearchQuery ? 'block' : 'none';
    }
  };

  // Attach switch button click handlers
  const attachRowEvents = () => {
    if (!resultsContainer) return;

    const switchBtns = resultsContainer.querySelectorAll('.btn-trigger-user-switch');
    switchBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = btn.getAttribute('data-user-id');
        if (!userId) return;
        switchActiveAccount(userId, (msg) => {
          showAlert(msg);
        });
      });
    });

    const blockedBtns = resultsContainer.querySelectorAll('.btn-blocked-user-switch');
    blockedBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userName = btn.getAttribute('data-user-name') || 'User';
        const reason = btn.getAttribute('data-reason') || 'No Access';
        showAlert(`🔒 ${userName}: ${reason}. To allow login, assign a role preset in User Management.`);
      });
    });
  };

  // Attach tab switching handlers
  const tabBtns = document.querySelectorAll('.tab-switcher-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentSearchTab = btn.getAttribute('data-tab') || 'ALL';
      tabBtns.forEach(b => {
        const isSelected = b.getAttribute('data-tab') === currentSearchTab;
        b.className = `btn btn-xs ${isSelected ? 'btn-primary' : 'btn-ghost'} tab-switcher-btn`;
        b.style.background = isSelected ? '#0284c7' : '';
        b.style.color = isSelected ? '#fff' : '#94a3b8';
      });
      updateResults();
    });
  });

  // Search input typing handler
  if (searchInput) {
    searchInput.focus();
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      updateResults();
    });
  }

  // Clear search input
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      currentSearchQuery = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      updateResults();
    });
  }

  // Attach initial row events
  attachRowEvents();
}
