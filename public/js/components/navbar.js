/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Clean, User-Friendly Navbar with Streamlined Actions & Account Dropdown
 */

import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';
import { storage } from '../db/storage.js';
import { router } from '../services/router.js?v=4.26.48';
import { 
  getEmployeeMap, 
  getUserCardNumber, 
  checkUserAccessStatus, 
  matchesUserQuery, 
  switchActiveAccount 
} from './accountSwitcherModal.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRoleName(user) {
  if (!user) return 'User';
  if (user.role === 'NO_ACCESS' || user.roleId === 'role-no-access') return 'No Access';
  if (authService.isSuperAdmin(user)) return 'Super Administrator';
  if (authService.isAdmin(user)) return 'Administrator';
  if (user.presetName) return user.presetName;
  if (user.presetId) {
    const p = authService.getPresetById(user.presetId);
    if (p?.name) return p.name;
  }
  const roleObj = authService.getRoleById(user?.roleId) || (typeof authService.getRoleByCode === 'function' ? authService.getRoleByCode(user?.role) : null);
  if (roleObj?.name) return roleObj.name;
  if (user.role === 'USER') return 'Maintenance User';
  return user.role || 'Maintenance User';
}

function getShortRole(roleName) {
  if (!roleName) return 'User';
  if (roleName.includes('No Access') || roleName.includes('NO_ACCESS')) return 'No Access';
  if (roleName.includes('Super Administrator') || roleName.includes('SUPER_ADMIN') || roleName.includes('Super Admin')) return 'Super Admin';
  if (roleName.includes('Plant Maintenance Manager') || roleName.includes('MAINT_MANAGER')) return 'Manager';
  if (roleName.includes('Administrator') || roleName.includes('ADMIN')) return 'Admin';
  if (roleName.includes('Maintenance User')) return 'Maint User';
  if (roleName.includes('Store & Spare Parts') || roleName.includes('STORE_INCHARGE') || roleName.includes('Store User')) return 'Store Lead';
  if (roleName.includes('Floor Maintenance') || roleName.includes('FLOOR_MAINT')) return 'Floor Lead';
  if (roleName.includes('Line Maintenance') || roleName.includes('LINE_TECH')) return 'Technician';
  if (roleName.includes('ENT Lab') || roleName.includes('ET_LAB_TECH')) return 'ENT Lab';
  if (roleName.includes('Operator') || roleName.includes('OPERATOR')) return 'Operator';
  if (roleName.includes('Viewer') || roleName.includes('FACTORY_VIEWER')) return 'Viewer';
  return roleName.length > 13 ? roleName.substring(0, 11) + '…' : roleName;
}

function getUserInitial(user) {
  const cleanName = (user?.name || '').replace(/^(Engr\.|Dr\.|Mr\.|Mrs\.|Ms\.|Md\.)\s+/i, '').trim();
  if (cleanName.length > 0) return cleanName.charAt(0).toUpperCase();
  if (user?.username) return user.username.charAt(0).toUpperCase();
  return 'U';
}

export function renderNavbar() {
  const user = authService.getCurrentUser();
  const allUsers = authService.getAllUsers();
  const unreadNotifs = notificationService.getUnreadCount(user);
  const currentTheme = localStorage.getItem('al_muslim_theme') || 'dark';

  const roleName = getRoleName(user);
  const shortRole = getShortRole(roleName);
  const userInitial = getUserInitial(user);
  const displayName = user?.name || user?.username || 'User';

  const isSuperAdmin = authService.isSuperAdmin(user);
  const isAdmin = authService.isAdmin(user);
  const impersonator = authService.getImpersonatorAdmin();
  const canSwitchAccounts = isSuperAdmin || isAdmin;

  // Separate Super Admin & Admin accounts from standard Factory Users
  const empMap = getEmployeeMap();
  const adminAccounts = [];
  const factoryUsers = [];

  for (let i = 0; i < allUsers.length; i++) {
    const u = allUsers[i];
    if (authService.isSuperAdmin(u) || authService.isAdmin(u)) {
      adminAccounts.push(u);
    } else {
      factoryUsers.push(u);
    }
  }

  // Sort admins: Super Admin first, then Admins
  adminAccounts.sort((a, b) => {
    const aSuper = authService.isSuperAdmin(a) ? 1 : 0;
    const bSuper = authService.isSuperAdmin(b) ? 1 : 0;
    if (aSuper !== bSuper) return bSuper - aSuper;
    return (a.name || '').localeCompare(b.name || '');
  });

  const adminCardsHtml = adminAccounts.map(u => {
    const isCurrent = u.id === user?.id;
    const isTargetSuper = authService.isSuperAdmin(u);
    const uCard = getUserCardNumber(u, empMap);
    const initial = getUserInitial(u);
    
    // Can switch check:
    // - Super Admin can switch to any admin
    // - Admin cannot switch to Super Admin
    const canSwitch = !isCurrent && (isSuperAdmin || !isTargetSuper);

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: ${isCurrent ? 'rgba(2, 132, 199, 0.15)' : 'rgba(15, 23, 42, 0.6)'}; border: 1px solid ${isCurrent ? '#0284c7' : 'rgba(255, 255, 255, 0.06)'}; border-radius: 6px; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: ${isTargetSuper ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'linear-gradient(135deg, #d97706, #f59e0b)'}; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${initial}
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="font-size: 11.5px; font-weight: 700; color: #f8fafc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(u.name || u.username)}
            </div>
            <div style="display: flex; align-items: center; gap: 5px; font-size: 10px;">
              <span style="font-weight: 700; color: ${isTargetSuper ? '#38bdf8' : '#f59e0b'};">
                ${isTargetSuper ? '🛡️ Super Admin' : '👑 Admin'}
              </span>
              ${uCard ? `<span style="color: #94a3b8; font-family: var(--font-mono);">#${escapeHtml(uCard)}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="flex-shrink: 0;">
          ${isCurrent ? `
            <span style="font-size: 10px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); padding: 1px 6px; border-radius: 4px;">
              Active
            </span>
          ` : canSwitch ? `
            <button type="button" class="btn btn-primary btn-xs btn-nav-switch-user" data-user-id="${u.id}" style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: linear-gradient(135deg, #0284c7, #0369a1); cursor: pointer;" title="Switch to ${escapeHtml(u.name)}">
              Switch
            </button>
          ` : `
            <span style="font-size: 10px; color: #94a3b8; font-weight: 600;" title="Administrators cannot switch to Super Administrator accounts">
              Restricted
            </span>
          `}
        </div>
      </div>
    `;
  }).join('');

  const viewTitles = {
    'no-access': { icon: '🔒', title: 'Zero Access Policy', shortTitle: 'No Access', sub: 'Access Pending Administrative Assignment' },
    'dashboard': { icon: '🏠', title: 'Dashboard', shortTitle: 'Dashboard', sub: 'Factory Health & Uptime Metrics' },
    'inventory': { icon: '📦', title: 'Machine Inventory', shortTitle: 'Inventory', sub: 'Machinery Registry & Asset Control' },
    'relocate': { icon: '📍', title: 'Relocate & Verify', shortTitle: 'Relocate', sub: 'Mobile QR Scan, Auto-Idle Detection & Location Reconciliation' },
    'qr-codes': { icon: '🏁', title: 'QR Code & Label Studio', shortTitle: 'QR Studio', sub: 'Enterprise Asset Tagging, A4 Sheet Printing & Location Labels' },
    'machine-history': { icon: '📜', title: 'Machine History', shortTitle: 'History', sub: 'Complete Lifetime & Spare Parts History' },
    'preventive-maintenance': { icon: '🛡️', title: 'Preventive Maintenance', shortTitle: 'PM Schedule', sub: 'Servicing Schedules, Reminders & Machine Health Profiles' },
    'transfers': { icon: '🔄', title: 'Machine Transfers', shortTitle: 'Transfers', sub: 'Machine Movement, Gate Passes & Relocation Tracking' },
    'transfer-workflows': { icon: '⛓️', title: 'Transfer Workflows', shortTitle: 'Workflows', sub: 'Approval Stage Builder & Route Logic' },
    'tools-management': { icon: '🛠️', title: 'Tools & Accessories', shortTitle: 'Tools & Equip.', sub: 'Tool Assignments, Mechanic Toolkits & Accessories' },
    'spare-parts': { icon: '⚙️', title: 'Spare Parts Catalog', shortTitle: 'Spare Parts', sub: 'Enterprise Master Catalog & Machine Usage' },
    'manpower': { icon: '👥', title: 'Manpower Management', shortTitle: 'Manpower', sub: 'Factory Workforce, Placements & Dynamic Parameters' },
    'reports': { icon: '📊', title: 'Reports & Analytics', shortTitle: 'Reports', sub: 'Summary Reports & Excel Export Hub' },
    'resource-library': { icon: '📚', title: 'Resource & SOP Library', shortTitle: 'Library', sub: 'Technical Manuals, SOPs, Web Portals & Factory Archives' },
    'et-lab': { icon: '🔧', title: 'ENT Lab Management', shortTitle: 'ENT Lab', sub: 'Board Master, Machine Connection & Lifetime History' },
    'users': { icon: '👥', title: 'User Management', shortTitle: 'Users', sub: 'User Accounts, Roles & Status Administration' },
    'homepage-manager': { icon: '🏠', title: 'Home Page Management', shortTitle: 'Home Mgr', sub: 'Admin-Controlled Dynamic Content & Section Builder' },
    'email-config': { icon: '✉️', title: 'Email Configuration', shortTitle: 'Email Config', sub: 'SMTP Mail Server & Password Recovery Settings' },
    'master-data': { icon: '🏢', title: 'Plant Hierarchy & Master Data', shortTitle: 'Master Data', sub: '7-Level Factory, Floor, Line & Machine Hierarchy' },
    'custom-fields': { icon: '📐', title: 'Custom Parameters', shortTitle: 'Parameters', sub: 'Dynamic Technical Attributes' },
    'excel-manager': { icon: '📊', title: 'Excel Structure & Templates', shortTitle: 'Excel Setup', sub: 'Import / Export Layout Designer' },
    'storage': { icon: '📦', title: 'Master Data Storage', shortTitle: 'Storage & DB', sub: 'Single Source of Truth & Quality Gate Studio' },
    'audit-logs': { icon: '📝', title: 'Activity Logs', shortTitle: 'Audit Logs', sub: 'User & Admin Activity Audit Trail' },
    'settings': { icon: '🔧', title: 'System Settings', shortTitle: 'Settings', sub: 'Policies, Serial Number Formats & Recovery' }
  };

  const curView = state.get('currentView') || 'dashboard';
  const headerInfo = viewTitles[curView] || viewTitles['dashboard'];

  return `
    <header class="app-header">
      <!-- Left: Navigation Toggle & View Title -->
      <div class="header-left">
        <button id="btn-mobile-sidebar-toggle" class="btn-mobile-sidebar-toggle" aria-label="Toggle Navigation Menu" title="Open Navigation Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div class="header-view-badge">
          <div class="header-view-icon-wrap">${headerInfo.icon}</div>
          <div class="header-title-container">
            <h1 class="header-title-text">
              <span class="header-title-full">${headerInfo.title}</span>
              <span class="header-title-short">${headerInfo.shortTitle || headerInfo.title}</span>
            </h1>
            <div class="header-sub-text">${headerInfo.sub}</div>
          </div>
        </div>
      </div>

      <!-- Right: Status, Theme, Notifications & User Dropdown Capsule -->
      <div class="header-right">
        <!-- Persistent Database Store Status -->
        <div id="nav-db-status" class="nav-db-status-pill" style="cursor: pointer;" title="Persistent MySQL Database Active &amp; Synchronized (Click to Sync Now)">
          <span style="font-size: 13px; line-height: 1;">🐬</span>
          <span class="db-status-text">MySQL Synced</span>
        </div>

        <!-- Light / Dark Theme Switcher (Hidden) -->
        <button id="btn-theme-toggle" class="nav-icon-btn" type="button" style="display: none !important;" title="Theme (${currentTheme === 'light' ? 'Switch to Dark' : 'Switch to Light'})" aria-label="Toggle Theme">
          <span class="theme-icon">${currentTheme === 'light' ? '🌙' : '☀️'}</span>
        </button>

        <!-- Notification Bell -->
        <button id="btn-notifications-toggle" class="nav-icon-btn" type="button" title="Notifications (${unreadNotifs} unread)" aria-label="Notifications">
          <span class="bell-icon" style="font-size: 15px;">🔔</span>
          <span id="nav-bell-badge-container">
            ${unreadNotifs > 0 ? `<span class="nav-badge danger" style="position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 1px 5px; animation: pulse 2s infinite;">${unreadNotifs}</span>` : ''}
          </span>
        </button>

        ${(isSuperAdmin || isAdmin) && authService.isMaintenanceModeActive() ? `
          <!-- Maintenance Mode Active Warning Badge -->
          <button id="btn-nav-maint-badge" class="btn btn-xs" style="background: rgba(245, 158, 11, 0.2); border: 1.5px solid #f59e0b; color: #fbbf24; font-weight: 800; font-size: 11.5px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; cursor: pointer; white-space: nowrap; box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);" title="System Maintenance Mode is ACTIVE. Non-admins cannot log in. Click to manage.">
            <span>🛠️</span>
            <span>Maintenance Mode ON</span>
          </button>
        ` : ''}

        ${impersonator ? `
          <!-- Impersonation Quick Return Pill in Top Header -->
          <button id="btn-nav-exit-impersonation" class="btn btn-xs" style="background: rgba(2, 132, 199, 0.2); border: 1.5px solid #38bdf8; color: #38bdf8; font-weight: 700; font-size: 11.5px; padding: 3px 9px; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; cursor: pointer; white-space: nowrap; box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);" title="Exit impersonation and return to your Admin account">
            <span>🎭</span>
            <span>Return to ${impersonator.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span>
          </button>
        ` : ''}

        <!-- Vertical Divider -->
        <div class="header-v-divider"></div>

        <!-- User Profile Capsule & Account Dropdown -->
        <div class="header-profile-wrapper">
          <button id="btn-navbar-profile-pill" class="nav-profile-capsule" type="button" aria-haspopup="true" aria-expanded="false" title="Active Account: ${displayName} (${roleName})">
            <div class="user-avatar-circle">${userInitial}</div>
            <div class="nav-profile-meta">
              <span class="nav-profile-name" id="nav-profile-username">${displayName}</span>
              <span class="nav-profile-role-badge" style="${(user?.role === 'NO_ACCESS' || user?.roleId === 'role-no-access') ? 'background: rgba(239, 68, 68, 0.25) !important; color: #f87171 !important; border-color: rgba(239, 68, 68, 0.5) !important;' : ''}">${(user?.role === 'NO_ACCESS' || user?.roleId === 'role-no-access') ? '🔒 No Access' : shortRole}</span>
            </div>
            <svg class="nav-profile-caret" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>

          <!-- Floating User Account & Role Hub Dropdown -->
          <div id="navbar-user-dropdown" class="nav-user-dropdown custom-scrollbar" style="display: none; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;">
            <div class="nav-user-dropdown-header">
              <div class="nav-user-dropdown-avatar">${userInitial}</div>
              <div class="nav-user-dropdown-info">
                <div class="nav-user-dropdown-name">${displayName}</div>
                <div class="nav-user-dropdown-email">@${user?.username || 'user'}${user?.email ? ` • ${user.email}` : ''}</div>
                <div class="nav-user-dropdown-role-badge">${(user?.role === 'NO_ACCESS' || user?.roleId === 'role-no-access') ? '🔒' : (isSuperAdmin ? '🛡️' : (isAdmin ? '👑' : '👤'))} ${roleName}</div>
              </div>
            </div>

            <!-- Mobile Utility Row (Cloud Sync Status) -->
            <div class="nav-user-dropdown-section" style="padding-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); gap: 8px;">
                <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #38bdf8; font-weight: 700;">
                  <span class="nav-db-pulse-dot" style="width: 7px; height: 7px;"></span>
                  <span>Cloud Synced</span>
                </div>
                <button type="button" id="btn-dropdown-theme-toggle" class="btn btn-ghost btn-xs" style="display: none !important;" title="Toggle Light / Dark Theme">
                  <span class="dropdown-theme-icon">${currentTheme === 'light' ? '🌙' : '☀️'}</span>
                  <span>${currentTheme === 'light' ? 'Dark' : 'Light'}</span>
                </button>
              </div>
            </div>

            ${impersonator ? `
              <!-- Active Impersonation Session Banner -->
              <div class="nav-user-dropdown-section" style="background: rgba(2, 132, 199, 0.15); border: 1.5px dashed #38bdf8; border-radius: 8px; padding: 10px; margin-bottom: 8px;">
                <div style="font-size: 11px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <span>🎭</span> Viewing as User
                </div>
                <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 8px; line-height: 1.35;">
                  Currently logged in as <strong>${displayName}</strong> from <strong>${impersonator.name}</strong> (${impersonator.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}).
                </div>
                <button type="button" id="btn-return-to-admin" class="btn btn-primary btn-xs btn-block" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 11.5px; height: 30px;">
                  🔙 Return to ${impersonator.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} (${impersonator.name})
                </button>
              </div>
              <div class="nav-user-dropdown-divider"></div>
            ` : canSwitchAccounts ? `
              <!-- Enhanced Role & Account Switcher Hub -->
              <div class="nav-user-dropdown-section nav-account-switcher-section" style="padding: 12px 14px;">
                
                <!-- Section Header with Quick Popup Trigger -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <div class="nav-user-dropdown-section-title" style="margin-bottom: 0;">
                    <span>🎭</span> ${isSuperAdmin ? 'Switch Role / Account' : 'Login to User Account'}
                  </div>
                  <button type="button" id="btn-open-switcher-popup-nav" class="btn btn-ghost btn-xs" style="color: #38bdf8; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 5px; background: rgba(56, 189, 248, 0.1); cursor: pointer;" title="Open full searchable account switcher popup">
                    <span>🔍 Search Popup</span>
                    <span style="font-size: 10px;">↗</span>
                  </button>
                </div>

                <!-- 1. Super Admin & Admin Accounts (Kept Separate) -->
                <div class="switcher-mgmt-wrapper" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
                  <div style="font-size: 10px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; display: flex; align-items: center; gap: 5px;">
                    <span>👑</span> Administrators &amp; Managers
                  </div>
                  <div class="switcher-mgmt-list" style="display: flex; flex-direction: column; gap: 6px;">
                    ${adminCardsHtml}
                  </div>
                </div>

                <!-- 2. Searchable Factory Users -->
                <div class="switcher-users-wrapper">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 10px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
                      <span>👥</span> Factory Users
                    </div>
                    <span style="font-size: 10px; font-weight: 700; color: #94a3b8;" id="nav-dropdown-users-count">${factoryUsers.length} accounts</span>
                  </div>

                  <!-- Search Input Box -->
                  <div style="position: relative; display: flex; align-items: center; margin-bottom: 6px;">
                    <span style="position: absolute; left: 8px; font-size: 12px; color: #38bdf8; pointer-events: none;">🔍</span>
                    <input 
                      type="text" 
                      id="inp-nav-dropdown-search" 
                      class="dropdown-role-select" 
                      style="width: 100%; height: 32px; padding: 0 28px 0 28px; font-size: 11.5px; font-weight: 600; border-radius: 6px; background: rgba(11, 17, 32, 0.85); border: 1px solid rgba(56, 189, 248, 0.35);" 
                      placeholder="Search Card # or Name..." 
                      autocomplete="off"
                      spellcheck="false"
                    />
                    <button 
                      type="button" 
                      id="btn-nav-dropdown-search-clear" 
                      style="position: absolute; right: 6px; background: none; border: none; color: #94a3b8; font-size: 12px; cursor: pointer; padding: 2px 4px; display: none;"
                      title="Clear"
                    >✕</button>
                  </div>

                  <!-- Live Search Matches Container -->
                  <div id="nav-dropdown-search-results" class="custom-scrollbar" style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px;">
                    <div style="padding: 10px 8px; text-align: center; font-size: 11px; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border-radius: 6px; line-height: 1.4;">
                      Type a <strong>Card #</strong> or <strong>Name</strong> above to search across ${factoryUsers.length} factory accounts, or click <button type="button" class="btn-open-switcher-popup-text" style="background: none; border: none; color: #38bdf8; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0;">Open Search Popup ↗</button>
                    </div>
                  </div>
                </div>

                <div class="nav-user-dropdown-hint" style="margin-top: 8px;">
                  ${isSuperAdmin ? 'Full Super Admin access to all factory accounts' : 'Admin access to standard authorized user accounts'}
                </div>
              </div>
              <div class="nav-user-dropdown-divider"></div>
            ` : ''}

            <!-- Quick Account Actions -->
            <div class="nav-user-dropdown-items">
              <button type="button" id="btn-navbar-change-pwd" class="nav-user-dropdown-item" title="Change your account password & profile">
                <span class="dropdown-item-icon">🔑</span>
                <div class="dropdown-item-content">
                  <span class="dropdown-item-title">Change Password</span>
                  <span class="dropdown-item-desc">Update credentials & security</span>
                </div>
              </button>

              <button type="button" id="btn-navbar-home" class="nav-user-dropdown-item" title="View Public Landing Page">
                <span class="dropdown-item-icon">🏠</span>
                <div class="dropdown-item-content">
                  <span class="dropdown-item-title">Public Homepage</span>
                  <span class="dropdown-item-desc">Open visitor portal & company overview</span>
                </div>
              </button>
            </div>

            <div class="nav-user-dropdown-divider"></div>

            <!-- Sign Out -->
            <div class="nav-user-dropdown-footer">
              <button type="button" id="btn-navbar-logout" class="nav-user-dropdown-item nav-user-dropdown-logout" title="End your active session">
                <span class="dropdown-item-icon">🚪</span>
                <div class="dropdown-item-content">
                  <span class="dropdown-item-title">Sign Out</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

export function initNavbarEvents() {
  const profilePill = document.getElementById('btn-navbar-profile-pill');
  const dropdown = document.getElementById('navbar-user-dropdown');

  const closeDropdown = () => {
    if (dropdown) dropdown.style.display = 'none';
    if (profilePill) {
      profilePill.classList.remove('active');
      profilePill.setAttribute('aria-expanded', 'false');
    }
  };

  const toggleDropdown = (e) => {
    if (e) e.stopPropagation();
    if (!dropdown) return;
    const isVisible = dropdown.style.display === 'block';
    if (isVisible) {
      closeDropdown();
    } else {
      dropdown.style.display = 'block';
      dropdown.style.maxHeight = 'calc(100vh - 80px)';
      dropdown.style.overflowY = 'auto';
      dropdown.style.overflowX = 'hidden';
      if (profilePill) {
        profilePill.classList.add('active');
        profilePill.setAttribute('aria-expanded', 'true');
      }
    }
  };

  if (profilePill) {
    profilePill.addEventListener('click', toggleDropdown);
  }

  // Click Database Status Pill to trigger manual sync with authoritative MySQL Primary
  const navDbStatus = document.getElementById('nav-db-status');
  if (navDbStatus) {
    navDbStatus.addEventListener('click', async () => {
      if (navDbStatus._isSyncing) return;
      navDbStatus._isSyncing = true;
      try {
        notificationService.info('Synchronizing with MySQL Primary Database...');
        const res = await storage.syncWithMySQLPrimary();
        notificationService.success(`MySQL Primary Synced at ${res.timestamp || new Date().toLocaleTimeString()} (PostgreSQL Backup Updated)`);
      } catch (err) {
        console.error('Manual navbar sync error:', err);
        notificationService.error(`MySQL Sync Failed: ${err.message || 'Connection error'}. Check server status.`);
      } finally {
        navDbStatus._isSyncing = false;
      }
    });
  }

  // Mobile Hamburger Toggle
  const mobileSidebarBtn = document.getElementById('btn-mobile-sidebar-toggle');
  if (mobileSidebarBtn) {
    mobileSidebarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.toggle('sidebar-mobile-open');
      }
    });
  }

  // Sidebar Backdrop Overlay Click to Close
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => {
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.remove('sidebar-mobile-open');
      }
    });
  }

  // Dropdown Theme Toggle Button
  const dropdownThemeBtn = document.getElementById('btn-dropdown-theme-toggle');
  if (dropdownThemeBtn) {
    dropdownThemeBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('theme-light');
      localStorage.setItem('al_muslim_theme', isLight ? 'light' : 'dark');
      const topThemeBtn = document.getElementById('btn-theme-toggle');
      if (topThemeBtn) {
        const topIcon = topThemeBtn.querySelector('.theme-icon') || topThemeBtn;
        topIcon.innerHTML = isLight ? '🌙' : '☀️';
      }
      const icon = dropdownThemeBtn.querySelector('.dropdown-theme-icon') || dropdownThemeBtn;
      icon.innerHTML = isLight ? '🌙' : '☀️';
      const text = dropdownThemeBtn.querySelector('span:last-child');
      if (text) text.textContent = isLight ? 'Dark' : 'Light';
    });
  }

  // Prevent dropdown inside clicks from closing itself (e.g. interacting with select)
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Global click to close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (dropdown && dropdown.style.display === 'block') {
      if (!dropdown.contains(e.target) && !profilePill?.contains(e.target)) {
        closeDropdown();
      }
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown && dropdown.style.display === 'block') {
      closeDropdown();
    }
  });

  // Handle Returning from Impersonated User Account back to Admin
  const handleExitImpersonation = () => {
    try {
      const switched = authService.exitImpersonation();
      if (switched) {
        state.set('currentUser', switched);
        state.resetFilters();
        const landingView = authService.getFirstAllowedView(switched) || 'dashboard';
        router.navigate(landingView, { replace: true });
        state.set('currentView', landingView);
        if (window.__erpApp && typeof window.__erpApp.render === 'function') {
          window.__erpApp.render();
          if (typeof window.__erpApp.showToast === 'function') {
            window.__erpApp.showToast('Returned to Admin', `Active session restored to ${switched.name} (${switched.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}).`, 'info');
          }
        } else {
          window.location.hash = '#' + landingView;
          window.location.reload();
        }
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const btnReturn = document.getElementById('btn-return-to-admin');
  if (btnReturn) {
    btnReturn.addEventListener('click', handleExitImpersonation);
  }

  const btnNavExit = document.getElementById('btn-nav-exit-impersonation');
  if (btnNavExit) {
    btnNavExit.addEventListener('click', handleExitImpersonation);
  }

  // Open Account Switcher Modal Trigger
  const openModalBtn = document.getElementById('btn-open-switcher-popup-nav');
  const openAccountSwitcherModal = () => {
    closeDropdown();
    state.set('activeModal', 'account-switcher');
  };

  if (openModalBtn) {
    openModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAccountSwitcherModal();
    });
  }

  // Handle open modal clicks inside results container
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      if (e.target.closest('.btn-open-switcher-popup-text')) {
        e.preventDefault();
        e.stopPropagation();
        openAccountSwitcherModal();
      }
    });
  }

  // Attach switch button click handlers in navbar dropdown
  const attachDropdownItemClicks = () => {
    if (!dropdown) return;
    const switchBtns = dropdown.querySelectorAll('.btn-nav-switch-user');
    switchBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-user-id');
        if (targetId) {
          closeDropdown();
          switchActiveAccount(targetId, (msg) => alert(msg));
        }
      };
    });

    const blockedBtns = dropdown.querySelectorAll('.btn-nav-blocked-user');
    blockedBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const uName = btn.getAttribute('data-user-name') || 'User';
        alert(`🔒 Access Denied: User '${uName}' currently has No Access (Pending Admin Assignment). Assign a role or permissions in User Management first.`);
      };
    });
  };

  attachDropdownItemClicks();

  // Live Dropdown Search for Factory Users
  const dropdownSearchInput = document.getElementById('inp-nav-dropdown-search');
  const dropdownSearchClear = document.getElementById('btn-nav-dropdown-search-clear');
  const dropdownResultsContainer = document.getElementById('nav-dropdown-search-results');

  if (dropdownSearchInput) {
    const renderDropdownSearchResults = (q) => {
      const cleanQ = (q || '').trim();
      if (dropdownSearchClear) {
        dropdownSearchClear.style.display = cleanQ ? 'block' : 'none';
      }
      if (!dropdownResultsContainer) return;

      if (!cleanQ) {
        const allUsers = authService.getAllUsers();
        const factoryCount = allUsers.filter(u => !authService.isSuperAdmin(u) && !authService.isAdmin(u)).length;
        dropdownResultsContainer.innerHTML = `
          <div style="padding: 10px 8px; text-align: center; font-size: 11px; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border-radius: 6px; line-height: 1.4;">
            Type a <strong>Card #</strong> or <strong>Name</strong> above to search across ${factoryCount} factory accounts, or click <button type="button" class="btn-open-switcher-popup-text" style="background: none; border: none; color: #38bdf8; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0;">Open Search Popup ↗</button>
          </div>
        `;
        return;
      }

      const allUsers = authService.getAllUsers();
      const empMap = getEmployeeMap();
      const factoryMatches = allUsers
        .filter(u => !authService.isSuperAdmin(u) && !authService.isAdmin(u))
        .filter(u => matchesUserQuery(u, cleanQ, empMap));

      if (factoryMatches.length === 0) {
        dropdownResultsContainer.innerHTML = `
          <div style="padding: 10px 8px; text-align: center; font-size: 11px; color: #f87171; background: rgba(239, 68, 68, 0.08); border-radius: 6px;">
            ⚠️ No factory accounts match "<strong>${escapeHtml(cleanQ)}</strong>"
          </div>
        `;
        return;
      }

      const topMatches = factoryMatches.slice(0, 15);
      let html = topMatches.map(u => {
        const status = checkUserAccessStatus(u);
        const cardNum = getUserCardNumber(u, empMap);
        const initial = getUserInitial(u);
        return `
          <div class="nav-switcher-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: ${status.hasAccess ? 'linear-gradient(135deg, #059669, #10b981)' : 'rgba(100, 116, 139, 0.3)'}; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${initial}
              </div>
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span style="font-size: 11.5px; font-weight: 700; color: #f8fafc;">${escapeHtml(u.name || u.username)}</span>
                  ${cardNum ? `<span style="font-size: 9.5px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 0 4px; border-radius: 3px; border: 1px solid rgba(56, 189, 248, 0.3); font-family: var(--font-mono);">#${escapeHtml(cardNum)}</span>` : ''}
                </div>
                <div style="font-size: 10px; color: ${status.hasAccess ? '#34d399' : '#f87171'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${status.hasAccess ? `✓ ${escapeHtml(status.roleName)}` : '🔒 No Access (Pending Admin Assignment)'}
                </div>
              </div>
            </div>
            <div style="flex-shrink: 0;">
              ${status.hasAccess ? `
                <button type="button" class="btn btn-primary btn-xs btn-nav-switch-user" data-user-id="${u.id}" style="font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: linear-gradient(135deg, #0284c7, #0369a1); cursor: pointer;" title="Enter ${escapeHtml(u.name)}'s account">
                  Enter ➔
                </button>
              ` : `
                <button type="button" class="btn btn-ghost btn-xs btn-nav-blocked-user" data-user-name="${escapeHtml(u.name)}" style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); cursor: not-allowed;" title="No Access (Pending Admin Assignment)">
                  🔒 Blocked
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');

      if (factoryMatches.length > 15) {
        html += `
          <div style="text-align: center; padding: 4px; font-size: 10.5px; color: #94a3b8;">
            Showing top 15 of ${factoryMatches.length}. <button type="button" class="btn-open-switcher-popup-text" style="background: none; border: none; color: #38bdf8; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0;">View all in Popup ↗</button>
          </div>
        `;
      }

      dropdownResultsContainer.innerHTML = html;
      attachDropdownItemClicks();
    };

    dropdownSearchInput.addEventListener('input', (e) => {
      renderDropdownSearchResults(e.target.value);
    });

    if (dropdownSearchClear) {
      dropdownSearchClear.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownSearchInput.value = '';
        renderDropdownSearchResults('');
        dropdownSearchInput.focus();
      });
    }
  }

  // Public Homepage Button
  const btnHome = document.getElementById('btn-navbar-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      closeDropdown();
      router.navigate('home');
      state.set('currentView', 'home');
    });
  }

  // Change Password Button
  const btnChangePwd = document.getElementById('btn-navbar-change-pwd');
  if (btnChangePwd) {
    btnChangePwd.addEventListener('click', () => {
      closeDropdown();
      state.set('activeModal', 'change-password');
    });
  }

  // Logout Button
  const btnLogout = document.getElementById('btn-navbar-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      closeDropdown();
      if (confirm('Are you sure you want to log out of your session?')) {
        try {
          storage.flushImmediate();
        } catch (_) {}
        authService.logout();
        router.navigate('login', { replace: true });
        state.set('currentView', 'login');
      }
    });
  }

  // Profile update event
  window.addEventListener('erp:user-profile-updated', (e) => {
    const updated = e.detail;
    if (updated) {
      const pillUser = document.querySelector('#nav-profile-username');
      if (pillUser) pillUser.textContent = updated.name || updated.username;
      const dropdownName = document.querySelector('.nav-user-dropdown-name');
      if (dropdownName) dropdownName.textContent = updated.name || updated.username;
      const dropdownEmail = document.querySelector('.nav-user-dropdown-email');
      if (dropdownEmail) dropdownEmail.textContent = `@${updated.username}`;
    }
  });

  // Light / Dark Theme Switcher
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('theme-light');
      localStorage.setItem('al_muslim_theme', isLight ? 'light' : 'dark');
      const icon = themeBtn.querySelector('.theme-icon') || themeBtn;
      icon.innerHTML = isLight ? '🌙' : '☀️';
      themeBtn.title = isLight ? 'Theme (Switch to Dark)' : 'Theme (Switch to Light)';
    });
  }

  // Notification Bell Toggle Handler
  const btnNotifs = document.getElementById('btn-notifications-toggle');
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      closeDropdown();
      const cur = state.get('activeModal');
      state.set('activeModal', cur === 'notifications' ? null : 'notifications');
    });
  }

  // Maintenance Mode Badge Click Handler
  const btnNavMaint = document.getElementById('btn-nav-maint-badge');
  if (btnNavMaint) {
    btnNavMaint.addEventListener('click', () => {
      router.navigate('settings');
      state.set('currentView', 'settings');
      setTimeout(() => {
        document.getElementById('card-maintenance-mode')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    });
  }

  // Live real-time bell badge sync for active user
  const updateBellBadge = () => {
    const badgeContainer = document.getElementById('nav-bell-badge-container');
    if (!badgeContainer) return;
    const currentUser = authService.getCurrentUser();
    const count = notificationService.getUnreadCount(currentUser);
    badgeContainer.innerHTML = count > 0
      ? `<span class="nav-badge danger" style="position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 1px 5px; animation: pulse 2s infinite;">${count}</span>`
      : '';
    const btn = document.getElementById('btn-notifications-toggle');
    if (btn) {
      btn.title = `Notifications (${count} unread)`;
    }
  };


  if (window.__navNotifHandler) {
    window.removeEventListener('erp:notification-updated', window.__navNotifHandler);
    window.removeEventListener('erp:notification', window.__navNotifHandler);
  }
  window.__navNotifHandler = updateBellBadge;
  window.addEventListener('erp:notification-updated', window.__navNotifHandler);
  window.addEventListener('erp:notification', window.__navNotifHandler);
}
