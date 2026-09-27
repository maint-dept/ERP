/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Clean, User-Friendly Navbar with Streamlined Actions & Account Dropdown
 */

import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';
import { storage } from '../db/storage.js';

function getRoleName(user) {
  const roleObj = authService.getRoleById(user?.roleId) || authService.getRoleByCode(user?.role);
  return roleObj?.name || user?.role || 'Super Administrator';
}

function getShortRole(roleName) {
  if (!roleName) return 'User';
  if (roleName.includes('Super Administrator') || roleName.includes('SUPER_ADMIN')) return 'Super Admin';
  if (roleName.includes('Plant Maintenance Manager') || roleName.includes('MAINT_MANAGER')) return 'Manager';
  if (roleName.includes('Store & Spare Parts') || roleName.includes('STORE_INCHARGE')) return 'Store Lead';
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

  const userOptions = allUsers.map(u => {
    const isSelected = u.id === user?.id ? 'selected' : '';
    const rObj = authService.getRoleById(u.roleId) || authService.getRoleByCode(u.role);
    const rName = rObj?.name || u.role;
    return `<option value="${u.id}" ${isSelected}>${rName}: ${u.name}</option>`;
  }).join('');

  const viewTitles = {
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
        <div id="nav-db-status" class="nav-db-status-pill" title="Persistent Database Active &amp; Cloud Synchronized">
          <span class="nav-db-pulse-dot"></span>
          <span class="db-status-text">Cloud Synced</span>
        </div>

        <!-- Light / Dark Theme Switcher -->
        <button id="btn-theme-toggle" class="nav-icon-btn" type="button" title="Theme (${currentTheme === 'light' ? 'Switch to Dark' : 'Switch to Light'})" aria-label="Toggle Theme">
          <span class="theme-icon">${currentTheme === 'light' ? '🌙' : '☀️'}</span>
        </button>

        <!-- Notification Bell -->
        <button id="btn-notifications-toggle" class="nav-icon-btn" type="button" title="Notifications (${unreadNotifs} unread)" aria-label="Notifications">
          <span class="bell-icon" style="font-size: 15px;">🔔</span>
          <span id="nav-bell-badge-container">
            ${unreadNotifs > 0 ? `<span class="nav-badge danger" style="position: absolute; top: 2px; right: 2px; font-size: 10px; padding: 1px 5px; animation: pulse 2s infinite;">${unreadNotifs}</span>` : ''}
          </span>
        </button>

        <!-- Vertical Divider -->
        <div class="header-v-divider"></div>

        <!-- User Profile Capsule & Account Dropdown -->
        <div class="header-profile-wrapper">
          <button id="btn-navbar-profile-pill" class="nav-profile-capsule" type="button" aria-haspopup="true" aria-expanded="false" title="Active Account: ${displayName} (${roleName})">
            <div class="user-avatar-circle">${userInitial}</div>
            <div class="nav-profile-meta">
              <span class="nav-profile-name" id="nav-profile-username">${displayName}</span>
              <span class="nav-profile-role-badge">${shortRole}</span>
            </div>
            <svg class="nav-profile-caret" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>

          <!-- Floating User Account & Role Hub Dropdown -->
          <div id="navbar-user-dropdown" class="nav-user-dropdown" style="display: none;">
            <div class="nav-user-dropdown-header">
              <div class="nav-user-dropdown-avatar">${userInitial}</div>
              <div class="nav-user-dropdown-info">
                <div class="nav-user-dropdown-name">${displayName}</div>
                <div class="nav-user-dropdown-email">@${user?.username || 'user'}${user?.email ? ` • ${user.email}` : ''}</div>
                <div class="nav-user-dropdown-role-badge">👑 ${roleName}</div>
              </div>
            </div>

            <!-- Mobile Utility Row (Cloud Sync Status & Theme Switcher) -->
            <div class="nav-user-dropdown-section" style="padding-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); gap: 8px;">
                <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #38bdf8; font-weight: 700;">
                  <span class="nav-db-pulse-dot" style="width: 7px; height: 7px;"></span>
                  <span>Cloud Synced</span>
                </div>
                <button type="button" id="btn-dropdown-theme-toggle" class="btn btn-ghost btn-xs" style="color: #f1f5f9; font-size: 11.5px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 6px; background: rgba(56, 189, 248, 0.12); cursor: pointer;" title="Toggle Light / Dark Theme">
                  <span class="dropdown-theme-icon">${currentTheme === 'light' ? '🌙' : '☀️'}</span>
                  <span>${currentTheme === 'light' ? 'Dark' : 'Light'}</span>
                </button>
              </div>
            </div>

            <!-- Role Switcher Section -->
            <div class="nav-user-dropdown-section">
              <div class="nav-user-dropdown-section-title">
                <span>🎭</span> Switch Role / Account
              </div>
              <div class="nav-user-dropdown-select-box">
                <select id="role-switcher-select" class="dropdown-role-select" title="Switch active account to test permissions">
                  ${userOptions}
                </select>
              </div>
              <div class="nav-user-dropdown-hint">Instantly test access across all factory roles</div>
            </div>

            <div class="nav-user-dropdown-divider"></div>

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
      if (profilePill) {
        profilePill.classList.add('active');
        profilePill.setAttribute('aria-expanded', 'true');
      }
    }
  };

  if (profilePill) {
    profilePill.addEventListener('click', toggleDropdown);
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

  // Role Switcher Select
  const roleSelect = document.getElementById('role-switcher-select');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      try {
        authService.switchUser(e.target.value);
        state.resetFilters();
        window.location.reload();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Public Homepage Button
  const btnHome = document.getElementById('btn-navbar-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      closeDropdown();
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
        try {
          window.location.hash = '#login';
        } catch (_) { }
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
