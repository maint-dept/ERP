/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Ultra-Modern Enterprise Navigation Sidebar Component
 * 
 * ORGANIZED ARCHITECTURE:
 * 1. OPERATIONS: Dashboard, Machine Operations, Technical & Maintenance
 * 2. WORKFORCE & HR: Manpower Management
 * 3. REPORTS & ANALYTICS: Reports & Diagnostics, Excel Export Center
 * 4. ADMINISTRATION: System Administration & Configuration
 */

import { authService } from '../services/authService.js';
import { state } from '../state.js';

const STORAGE_KEY_EXPANDED = 'al_muslim_sidebar_expanded_menus';

function getExpandedGroups() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {}
  // Default: start with only group-machines open so the sidebar is tidy and compact
  return new Set(['group-machines']);
}

function saveExpandedGroups(set) {
  try {
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function renderSidebar() {
  const currentView = state.get('currentView') || 'dashboard';
  const user = authService.getCurrentUser();
  const isAdmin = authService.isAdmin();
  const isSuperAdmin = authService.isSuperAdmin();
  const expandedGroups = getExpandedGroups();
  const activeReportTab = state.get('reportActiveTab') || 'machines';
  const activeManpowerTab = state.get('manpowerActiveTab') || 'active';

  // Auto expand parent group of current view
  if (['inventory', 'machine-history', 'transfers', 'preventive-maintenance', 'relocate', 'qr-codes'].includes(currentView)) {
    expandedGroups.add('group-machines');
  } else if (currentView === 'reports') {
    expandedGroups.add('group-reports');
  } else if (currentView === 'manpower') {
    expandedGroups.add('group-manpower');
  } else if (['users', 'email-config', 'master-data', 'transfer-workflows', 'excel-manager', 'audit-logs', 'settings', 'database-config', 'storage', 'homepage-manager'].includes(currentView)) {
    expandedGroups.add('group-admin');
  }

  // Helper to render an accordion group
  const renderNavGroup = (group) => {
    const isExpanded = expandedGroups.has(group.id);
    const hasActiveChild = group.items.some(sub => {
      if (currentView === 'reports') {
        return sub.targetView === 'reports' && sub.reportTab === activeReportTab;
      } else if (currentView === 'manpower') {
        return sub.targetView === 'manpower' && sub.manpowerTab === activeManpowerTab;
      }
      return sub.targetView === currentView;
    });

    return `
      <div class="nav-group" data-group-id="${group.id}">
        <!-- Group Header -->
        <div class="nav-group-header ${hasActiveChild ? 'parent-active' : ''}" data-group-toggle="${group.id}">
          <div class="nav-group-title">
            <span class="nav-icon-box">${group.icon}</span>
            <span>${group.label}</span>
          </div>
          <span class="group-chevron ${isExpanded ? 'expanded' : ''}" id="chevron-${group.id}">❯</span>
        </div>

        <!-- Submenu -->
        <div class="nav-submenu ${isExpanded ? 'expanded' : 'collapsed'}" id="submenu-${group.id}">
          ${group.items.map(sub => {
            let isSubActive = false;
            if (currentView === 'reports' && sub.targetView === 'reports') {
              isSubActive = (sub.reportTab === activeReportTab);
            } else if (currentView === 'manpower' && sub.targetView === 'manpower') {
              isSubActive = (sub.manpowerTab === activeManpowerTab);
            } else {
              isSubActive = (sub.targetView === currentView);
            }

            return `
              <div 
                class="nav-subitem ${isSubActive ? 'active' : ''}" 
                data-view="${sub.targetView}" 
                data-sub-id="${sub.id}"
                ${sub.reportTab ? `data-report-tab="${sub.reportTab}"` : ''}
                ${sub.manpowerTab ? `data-manpower-tab="${sub.manpowerTab}"` : ''}
                id="nav-subitem-${sub.id}"
                title="${sub.label}"
              >
                <span class="sub-icon-box">${sub.icon}</span>
                <span>${sub.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // Helper to render a direct item
  const renderDirectItem = (item) => {
    const isActive = currentView === item.targetView;
    return `
      <div class="nav-item ${isActive ? 'active' : ''}" data-view="${item.targetView}" id="nav-item-${item.id}" title="${item.label}">
        <div class="nav-group-title">
          <span class="nav-icon-box">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      </div>
    `;
  };

  // 1. OPERATIONS & MACHINERY SECTION
  const dashboardItem = {
    type: 'item',
    id: 'dashboard',
    targetView: 'dashboard',
    label: 'Dashboard',
    icon: '🏠',
    moduleKey: 'dashboard'
  };

  // Machine Operations Group (Each item individually permission-controlled)
  const machineItems = [
    { id: 'sub-mach-inventory', targetView: 'inventory', label: 'Machine Inventory', icon: '📦', moduleKey: 'machines' },
    { id: 'sub-mach-relocate', targetView: 'relocate', label: 'Relocate & Verify', icon: '📍', moduleKey: 'relocate' },
    { id: 'sub-mach-qr-codes', targetView: 'qr-codes', label: 'QR Codes & Labels', icon: '🏷️', moduleKey: 'qr_codes' },
    { id: 'sub-mach-transfers', targetView: 'transfers', label: 'Machine Transfers', icon: '🔄', moduleKey: 'transfers' },
    { id: 'sub-mach-history', targetView: 'machine-history', label: 'Machine Lifetime (Passport)', icon: '📜', moduleKey: 'machine_history' },
    { id: 'sub-mach-preventive', targetView: 'preventive-maintenance', label: 'Preventive Maintenance', icon: '🛡️', moduleKey: 'preventive_maintenance' }
  ].filter(it => authService.isModuleAllowed(it.moduleKey));

  // 2. SPECIALIZED TECHNICAL DEPARTMENTS (Separate Standalone Features with Discrete Access)
  const specializedFeatures = [
    {
      type: 'item',
      id: 'et-lab',
      targetView: 'et-lab',
      label: 'ENT Lab Management',
      icon: '⚡',
      moduleKey: 'et_lab'
    },
    {
      type: 'item',
      id: 'tools-equipment',
      targetView: 'tools-management',
      label: 'Tools & Equipment',
      icon: '🧰',
      moduleKey: 'tools_management'
    },
    {
      type: 'item',
      id: 'resource-library',
      targetView: 'resource-library',
      label: 'Document & Tech Library',
      icon: '📚',
      moduleKey: 'document_library'
    }
  ].filter(it => authService.isModuleAllowed(it.moduleKey));

  // 3. WORKFORCE & HR SECTION
  const workforceItems = [
    { id: 'sub-mp-active', targetView: 'manpower', manpowerTab: 'active', label: 'Active Manpower', icon: '🟢', moduleKey: 'manpower' },
    { id: 'sub-mp-inactive', targetView: 'manpower', manpowerTab: 'inactive', label: 'Inactive / Archive', icon: '🔴', moduleKey: 'manpower' },
    { id: 'sub-mp-transfers', targetView: 'manpower', manpowerTab: 'transfers', label: 'Employee Transfers', icon: '🔄', moduleKey: 'manpower' },
    { id: 'sub-mp-leaves', targetView: 'manpower', manpowerTab: 'leaves', label: 'Leave Records', icon: '🏖️', moduleKey: 'manpower' },
    { id: 'sub-mp-cf', targetView: 'manpower', manpowerTab: 'custom-fields', label: 'Custom Fields (HR)', icon: '⚙️', moduleKey: 'manpower' }
  ].filter(it => authService.isModuleAllowed(it.moduleKey));

  // 4. REPORTS & ANALYTICS SECTION (Discrete reports filtered by allowed module domains)
  const reportItems = [
    { id: 'sub-report-machine', targetView: 'reports', reportTab: 'machines', label: 'Machine Reports', icon: '🧵', moduleKey: 'machines' },
    { id: 'sub-report-transfer', targetView: 'reports', reportTab: 'transfers', label: 'Transfer Reports', icon: '🔄', moduleKey: 'transfers' },
    { id: 'sub-report-spare', targetView: 'reports', reportTab: 'spareparts', label: 'Spare Parts Reports', icon: '⚙️', moduleKey: 'spare_parts' },
    { id: 'sub-report-etlab', targetView: 'reports', reportTab: 'etlab', label: 'ENT Lab Management Report', icon: '🔬', moduleKey: 'et_lab' },
    { id: 'sub-report-export', targetView: 'reports', reportTab: 'export', label: 'Excel Export Center', icon: '📥', moduleKey: 'reports' }
  ].filter(it => authService.isAdmin() || authService.isModuleAllowed(it.moduleKey) || authService.isModuleAllowed('reports'));

  // 5. SYSTEM & ADMINISTRATION SECTION
  const adminMenuItems = [
    { id: 'adm-users', targetView: 'users', moduleKey: 'user_management', label: 'User Management', icon: '👥' },
    { id: 'adm-master-data', targetView: 'master-data', moduleKey: 'master_data', label: 'Plant Hierarchy & Master Data', icon: '🏢' },
    { id: 'adm-storage', targetView: 'storage', moduleKey: 'storage', label: 'Master Storage & Rules', icon: '📦' },
    { id: 'adm-transfer-config', targetView: 'transfer-workflows', moduleKey: 'transfer_workflows', label: 'Transfer Workflows', icon: '⛓️' },
    { id: 'adm-excel-config', targetView: 'excel-manager', moduleKey: 'excel_manager', label: 'Excel Templates & Structure', icon: '📊' },
    { id: 'adm-email-config', targetView: 'email-config', moduleKey: 'email_config', label: 'Email Configuration', icon: '✉️' },
    { id: 'adm-homepage', targetView: 'homepage-manager', moduleKey: 'homepage_management', label: 'Home Page Management', icon: '🏠' },
    { id: 'adm-activity-logs', targetView: 'audit-logs', moduleKey: 'audit_logs', label: 'Activity & Audit Logs', icon: '📝' },
    { id: 'adm-database', targetView: 'database-config', moduleKey: 'settings', label: 'Data Engine', icon: '🗄️' },
    { id: 'adm-settings', targetView: 'settings', moduleKey: 'settings', label: 'System Settings', icon: '⚙️' }
  ];

  const allowedAdminItems = adminMenuItems.filter(it => authService.isAdmin() || authService.isModuleAllowed(it.moduleKey || it.targetView));

  let html = `
    <aside class="app-sidebar" id="app-sidebar-root">
      <!-- Fixed Sidebar Brand Header -->
      <div class="sidebar-header" style="padding: 14px 16px 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.07); background: rgba(9, 14, 26, 0.95); flex-shrink: 0; box-sizing: border-box; width: 100%;">
        <div class="sidebar-brand-wrapper" style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; overflow: visible;">
          <div class="brand-logo-badge" title="Al-Muslim Group Maintenance Department ERP" style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #1e3a8a 100%); display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; box-shadow: 0 0 16px rgba(2, 132, 199, 0.4); border: 1px solid rgba(56, 189, 248, 0.4);">🔧</div>
          <div class="brand-text-container" style="min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: visible;">
            <div class="brand-title-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; width: 100%;">
              <span class="brand-text-title" style="font-weight: 800; font-size: 13.5px; letter-spacing: 0.5px; color: #ffffff; line-height: 1.2; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); white-space: nowrap;">AL-MUSLIM GROUP</span>
              <span class="brand-status-pill" title="Live System Active" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 9999px; padding: 1.5px 7px; font-size: 8.5px; font-weight: 700; color: #34d399; letter-spacing: 0.5px; flex-shrink: 0; white-space: nowrap;">
                <span class="brand-status-dot" style="width: 5px; height: 5px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; display: inline-block;"></span>Live
              </span>
            </div>
            <div class="brand-text-sub" style="font-size: 8.5px; color: #38bdf8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 3px; line-height: 1.2; white-space: nowrap;" title="Maintenance Department ERP">
              MAINTENANCE DEPARTMENT ERP
            </div>
          </div>
        </div>
        <button id="btn-sidebar-mobile-close" class="btn-sidebar-mobile-close" aria-label="Close navigation" title="Close navigation menu">✕</button>
      </div>

      <!-- Quick Search / Filter Bar -->
      <div class="sidebar-search-box">
        <div class="sidebar-search-inner">
          <span class="sidebar-search-icon">🔍</span>
          <input 
            type="text" 
            id="sidebar-menu-search" 
            class="sidebar-search-input" 
            placeholder="Quick find menu... (Ctrl+K)" 
            autocomplete="off"
            spellcheck="false"
          />
          <button id="sidebar-search-clear" class="sidebar-search-clear" title="Clear search">✕</button>
        </div>
      </div>

      <!-- Scrollable Navigation Area -->
      <nav class="sidebar-menu" id="sidebar-menu-scrollable">
        
        <!-- SECTION 1: OPERATIONS & MACHINERY -->
        <div class="menu-category-section" id="sec-operations">
          <div class="menu-category-header">
            <span class="menu-category-title">OPERATIONS & MACHINERY</span>
            <div class="menu-category-line"></div>
          </div>
          ${authService.isModuleAllowed('dashboard') ? renderDirectItem(dashboardItem) : ''}
          ${machineItems.length > 0 ? renderNavGroup({
            id: 'group-machines',
            label: 'Machine Operations',
            icon: '🏭',
            items: machineItems
          }) : ''}
        </div>

        <!-- SECTION 2: SPECIALIZED UNITS (Individual Feature Access) -->
        ${specializedFeatures.length > 0 ? `
          <div class="menu-category-section" id="sec-specialized">
            <div class="menu-category-header">
              <span class="menu-category-title">SPECIALIZED UNITS</span>
              <div class="menu-category-line"></div>
            </div>
            ${specializedFeatures.map(feat => renderDirectItem(feat)).join('')}
          </div>
        ` : ''}

        <!-- SECTION 3: WORKFORCE & HR -->
        ${authService.isModuleAllowed('manpower') ? `
          <div class="menu-category-section" id="sec-workforce">
            <div class="menu-category-header">
              <span class="menu-category-title">WORKFORCE & HR</span>
              <div class="menu-category-line"></div>
            </div>
            ${renderNavGroup({
              id: 'group-manpower',
              label: 'Manpower Management',
              icon: '👥',
              items: workforceItems
            })}
          </div>
        ` : ''}

        <!-- SECTION 4: REPORTS & ANALYTICS -->
        ${authService.isModuleAllowed('reports') ? `
          <div class="menu-category-section" id="sec-reports">
            <div class="menu-category-header">
              <span class="menu-category-title">REPORTS & ANALYTICS</span>
              <div class="menu-category-line"></div>
            </div>
            ${renderNavGroup({
              id: 'group-reports',
              label: 'Reports & Analytics',
              icon: '📊',
              items: reportItems
            })}
          </div>
        ` : ''}

        <!-- SECTION 4: SYSTEM & ADMINISTRATION -->
        ${allowedAdminItems.length > 0 ? `
          <div class="menu-category-section" id="sec-admin">
            <div class="menu-category-header">
              <span class="menu-category-title">SYSTEM & ADMINISTRATION</span>
              <div class="menu-category-line"></div>
            </div>
            ${renderNavGroup({
              id: 'group-admin',
              label: 'System Administration',
              icon: '⚙️',
              items: allowedAdminItems
            })}
          </div>
        ` : ''}

      </nav>

      <!-- User Profile Footer Card -->
      <div class="sidebar-footer" id="btn-sidebar-user-profile" style="cursor: pointer;" title="Click to view profile or change password">
        <div class="user-avatar-circle">
          ${user?.name?.charAt(0)?.toUpperCase() || 'U'}
          <span class="user-avatar-status"></span>
        </div>
        <div style="overflow: hidden; flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
            ${user?.name || 'Authorized User'}
          </div>
          <div style="margin-top: 2px;">
            ${isSuperAdmin 
              ? `<span class="user-role-badge admin">👑 Super Admin</span>`
              : isAdmin 
                ? `<span class="user-role-badge admin">🛡️ Admin</span>`
                : `<span class="user-role-badge operator">👤 Operator</span>`
            }
          </div>
        </div>
        <span style="font-size: 14px; opacity: 0.7; color: #94a3b8;" title="Security Settings">🔒</span>
      </div>
    </aside>
  `;

  return html;
}

export function initSidebarEvents() {
  const sidebar = document.getElementById('app-sidebar-root');
  if (!sidebar) return;

  // 1. Accordion Group Expand / Collapse Toggle
  sidebar.querySelectorAll('[data-group-toggle]').forEach(header => {
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const groupId = header.getAttribute('data-group-toggle');
      const submenu = document.getElementById(`submenu-${groupId}`);
      const chevron = document.getElementById(`chevron-${groupId}`);

      if (!submenu) return;

      const expandedGroups = getExpandedGroups();
      const isCurrentlyCollapsed = submenu.classList.contains('collapsed') || !submenu.classList.contains('expanded');

      if (isCurrentlyCollapsed) {
        submenu.classList.remove('collapsed');
        submenu.classList.add('expanded');
        if (chevron) chevron.classList.add('expanded');
        expandedGroups.add(groupId);
      } else {
        submenu.classList.remove('expanded');
        submenu.classList.add('collapsed');
        if (chevron) chevron.classList.remove('expanded');
        expandedGroups.delete(groupId);
      }

      saveExpandedGroups(expandedGroups);
    });
  });

  // 2. Navigation Actions & Sub-item Click Handlers
  sidebar.addEventListener('click', (e) => {
    const el = e.target.closest('.nav-item, .nav-subitem');
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();

    const view = el.getAttribute('data-view');
    const subId = el.getAttribute('data-sub-id') || el.id?.replace('nav-subitem-', '');
    const reportTab = el.getAttribute('data-report-tab');
    const mpTab = el.getAttribute('data-manpower-tab');
    const curView = state.get('currentView');

    // Close mobile sidebar drawer if open
    if (window.innerWidth <= 992) {
      const appContainer = document.querySelector('.app-container');
      if (appContainer && appContainer.classList.contains('sidebar-mobile-open')) {
        appContainer.classList.remove('sidebar-mobile-open');
      }
    }

    // Set child tabs before view transition
    if (reportTab) {
      state.set('reportActiveTab', reportTab);
    }
    if (mpTab) {
      state.set('manpowerActiveTab', mpTab);
    }

    if (view) {
      updateSidebarActiveState(view, subId);

      if (curView === view && (reportTab || mpTab)) {
        // Same view with subtab: perform fast in-place subtab transition
        if (reportTab) {
          const btn = document.querySelector(`[data-report-tab-btn="${reportTab}"]`);
          if (btn) btn.click();
        } else if (mpTab) {
          const btn = document.querySelector(`[data-manpower-tab="${mpTab}"]`);
          if (btn) btn.click();
        }
      } else {
        // Single clean view switch
        state.set('currentView', view);
        if (typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
          window.app.switchView(view);
        }
      }
    }
  });

  // 3. Quick Search / Filter Input
  const searchInput = document.getElementById('sidebar-menu-search');
  const searchClearBtn = document.getElementById('sidebar-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = (e.target.value || '').toLowerCase().trim();
      if (searchClearBtn) {
        searchClearBtn.style.display = query ? 'flex' : 'none';
      }

      const items = sidebar.querySelectorAll('.nav-item, .nav-subitem');
      const groups = sidebar.querySelectorAll('.nav-group');
      const sections = sidebar.querySelectorAll('.menu-category-section');

      if (!query) {
        // Reset filter: restore all
        items.forEach(el => el.classList.remove('nav-filtered-out'));
        groups.forEach(el => el.classList.remove('nav-filtered-out'));
        sections.forEach(el => el.classList.remove('nav-filtered-out'));

        // Restore saved expanded accordion states
        const expandedGroups = getExpandedGroups();
        groups.forEach(group => {
          const gid = group.getAttribute('data-group-id');
          const submenu = document.getElementById(`submenu-${gid}`);
          const chevron = document.getElementById(`chevron-${gid}`);
          if (expandedGroups.has(gid)) {
            submenu?.classList.add('expanded');
            submenu?.classList.remove('collapsed');
            chevron?.classList.add('expanded');
          } else {
            submenu?.classList.remove('expanded');
            submenu?.classList.add('collapsed');
            chevron?.classList.remove('expanded');
          }
        });
        return;
      }

      // Filter subitems & direct items
      items.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes(query)) {
          el.classList.remove('nav-filtered-out');
        } else {
          el.classList.add('nav-filtered-out');
        }
      });

      // Filter groups
      groups.forEach(group => {
        const gid = group.getAttribute('data-group-id');
        const submenu = document.getElementById(`submenu-${gid}`);
        const chevron = document.getElementById(`chevron-${gid}`);
        const visibleChildren = group.querySelectorAll('.nav-subitem:not(.nav-filtered-out)');
        const groupTitle = group.querySelector('.nav-group-title')?.textContent.toLowerCase() || '';

        if (visibleChildren.length > 0 || groupTitle.includes(query)) {
          group.classList.remove('nav-filtered-out');
          // Auto-expand during search
          submenu?.classList.add('expanded');
          submenu?.classList.remove('collapsed');
          chevron?.classList.add('expanded');
          if (groupTitle.includes(query)) {
            group.querySelectorAll('.nav-subitem').forEach(sub => sub.classList.remove('nav-filtered-out'));
          }
        } else {
          group.classList.add('nav-filtered-out');
        }
      });

      // Filter category sections
      sections.forEach(sec => {
        const visibleInSec = sec.querySelectorAll('.nav-item:not(.nav-filtered-out), .nav-group:not(.nav-filtered-out)');
        if (visibleInSec.length > 0) {
          sec.classList.remove('nav-filtered-out');
        } else {
          sec.classList.add('nav-filtered-out');
        }
      });
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus({ preventScroll: true });
      });
    }

    // Hotkey: Ctrl+K or Cmd+K to focus search; Escape to clear
    const handleSearchHotkeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus({ preventScroll: true });
        searchInput.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.blur();
      }
    };

    document.removeEventListener('keydown', handleSearchHotkeys);
    document.addEventListener('keydown', handleSearchHotkeys);
  }

  // 4. Mobile sidebar close button
  const mobileCloseBtn = document.getElementById('btn-sidebar-mobile-close');
  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', () => {
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.remove('sidebar-mobile-open');
      }
    });
  }

  // 5. User Profile Footer Click
  const footerProfile = document.getElementById('btn-sidebar-user-profile');
  if (footerProfile) {
    footerProfile.addEventListener('click', () => {
      state.set('activeModal', 'change-password');
    });
  }
}

/**
 * Updates sidebar active classes in-place without destroying DOM or resetting scroll position
 */
export function updateSidebarActiveState(currentView, activeSubId = null) {
  const activeReportTab = state.get('reportActiveTab') || 'machines';
  const activeManpowerTab = state.get('manpowerActiveTab') || 'active';

  // Update direct items
  document.querySelectorAll('.nav-item').forEach(el => {
    const isTarget = el.getAttribute('data-view') === currentView;
    if (isTarget) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update subitems
  document.querySelectorAll('.nav-subitem').forEach(el => {
    const subId = el.getAttribute('data-sub-id') || el.id.replace('nav-subitem-', '');
    const view = el.getAttribute('data-view');
    const reportTab = el.getAttribute('data-report-tab');
    const mpTab = el.getAttribute('data-manpower-tab');

    let isActive = false;
    if (view === currentView) {
      if (currentView === 'reports') {
        isActive = (reportTab === activeReportTab);
      } else if (currentView === 'manpower') {
        isActive = (mpTab === activeManpowerTab);
      } else if (activeSubId) {
        isActive = (subId === activeSubId || el.id === `nav-subitem-${activeSubId}`);
      } else {
        isActive = true;
      }
    }

    if (isActive) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update parent group headers and auto-expand active group
  document.querySelectorAll('.nav-group').forEach(groupEl => {
    const groupId = groupEl.getAttribute('data-group-id');
    const header = groupEl.querySelector('.nav-group-header');
    const hasActiveChild = groupEl.querySelector('.nav-subitem.active') !== null;

    if (header) {
      if (hasActiveChild) {
        header.classList.add('parent-active');
        const submenu = document.getElementById(`submenu-${groupId}`);
        const chevron = document.getElementById(`chevron-${groupId}`);
        if (submenu && submenu.classList.contains('collapsed')) {
          submenu.classList.remove('collapsed');
          submenu.classList.add('expanded');
          if (chevron) chevron.classList.add('expanded');
          const expandedGroups = getExpandedGroups();
          expandedGroups.add(groupId);
          saveExpandedGroups(expandedGroups);
        }
      } else {
        header.classList.remove('parent-active');
      }
    }
  });
}
