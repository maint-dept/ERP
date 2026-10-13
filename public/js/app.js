/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Main Single Page Application (SPA) Controller & Router
 * Enhanced with Global Scroll & Focus State Preservation Engine (Zero Jitter, Zero Scroll Loss)
 */

import { state } from './state.js';
import { storage } from './db/storage.js';
import { authService } from './services/authService.js';
import { renderNavbar, initNavbarEvents } from './components/navbar.js';
import { renderSidebar, initSidebarEvents, updateSidebarActiveState } from './components/sidebar.js?v=4.26.21';
import { renderHomepageView, initHomepageEvents } from './components/homepageView.js?v=4.26.21';
import { renderLoginView, initLoginViewEvents } from './components/loginView.js?v=4.26.21';
import { renderDashboard, initDashboardEvents } from './components/dashboard.js';
import { renderInventoryTable, initInventoryTableEvents, syncInventorySelectionDOM } from './components/inventoryTable.js?v=4.26.17';
import { renderMachineModal, initMachineModalEvents } from './components/machineModal.js';
import { renderMachineDetails, initMachineDetailsEvents } from './components/machineDetails.js';
import { renderTransferModal, initTransferModalEvents } from './components/transferModal.js?v=4.26.19';
import { renderTransferDetailsModal, initTransferDetailsModalEvents } from './components/transferDetailsModal.js';
import { renderEditTransferModal, initEditTransferModalEvents } from './components/editTransferModal.js?v=4.26.17';
import { renderTransfersView, initTransfersViewEvents } from './components/transfersView.js';
import { renderTransferWorkflowBuilder, initTransferWorkflowBuilderEvents } from './components/transferWorkflowBuilder.js';
import { renderMasterDataView, initMasterDataEvents } from './components/masterDataView.js';
import { renderCustomFieldsMgr, initCustomFieldsEvents } from './components/customFieldsMgr.js';
import { renderExcelManagerView, initExcelManagerEvents } from './components/excelManagerView.js';
import { renderUserManagement, initUserManagementEvents } from './components/userManagement.js';
import { renderHomepageManagerView, initHomepageManagerEvents } from './components/homepageManagerView.js';
import { renderEmailConfigView, initEmailConfigEvents } from './components/emailConfigView.js';
import { renderExcelImportModal, initExcelImportEvents } from './components/excelImportModal.js';
import { renderReportsView, initReportsEvents } from './components/reportsView.js';
import { renderAuditLogsView, initAuditLogsEvents } from './components/auditLogsView.js';
import { renderNotificationsDrawer, initNotificationsDrawerEvents } from './components/notificationsDrawer.js';
import { renderSettingsView, initSettingsEvents } from './components/settingsView.js';
import { renderDatabaseConfigView, initDatabaseConfigEvents } from './components/databaseConfigView.js';
import { renderResourceLibraryView, initResourceLibraryEvents } from './components/resourceLibraryView.js';
import { renderColumnVisibilityModal, initColumnVisibilityEvents } from './components/columnVisibilityModal.js';
import { renderMachineHistoryView, initMachineHistoryEvents } from './components/machineHistoryView.js';
import { renderSparePartsManagementView, initSparePartsManagementEvents } from './components/sparePartsManagementView.js';
import { renderToolsManagementView, initToolsManagementEvents } from './components/toolsManagementView.js';
import { renderManpowerView, initManpowerEvents } from './components/manpowerView.js';
import { renderEtLabManagementView, initEtLabEvents, setEntActiveTab } from './components/etLabManagementView.js';
import { renderChangePasswordModal, initChangePasswordModalEvents } from './components/changePasswordModal.js';
import { renderStorageView, initStorageEvents } from './components/storageView.js';
import { renderPreventiveMaintenanceView, initPreventiveMaintenanceEvents } from './components/preventiveMaintenanceView.js';
import { smartStorageService } from './services/smartStorageService.js';
import { renderRelocateView, initRelocateViewEvents } from './components/relocateView.js?v=4.26.18';
import { renderNeedleOperationsView, initNeedleOperationsEvents } from './components/needleOperationsView.js';
import { renderQrCodeView, initQrCodeEvents } from './components/qrCodeView.js?v=4.26.20';
import { renderPartsTraceView, initPartsTraceEvents } from './components/partsTraceView.js';
import { chatService } from './services/chatService.js';
import { historyService } from './services/historyService.js';
import { auditService } from './services/auditService.js';
import { notificationService } from './services/notificationService.js';

/**
 * Captures all active scroll, viewport, and focused input states.
 * NOTE: Always captures even when value is 0, so that restoreAppState
 * can distinguish "was at 0" from "was not captured".
 */
function captureAppState() {
  const container = document.getElementById('main-view-container');
  const sidebar = document.querySelector('.sidebar-menu');
  const pageView = document.querySelector('.page-view');
  const grid = document.querySelector('.excel-grid-container, .table-responsive, .history-content-area, .master-data-content, #reports-tab-content');
  // Inventory table's dedicated horizontal+vertical scroll viewport
  const invViewport = document.getElementById('inventory-table-scroll-viewport');
  const activeEl = document.activeElement;

  return {
    windowY: window.scrollY,
    windowX: window.scrollX,
    sidebarY: sidebar ? sidebar.scrollTop : 0,
    containerY: container ? container.scrollTop : 0,
    containerX: container ? container.scrollLeft : 0,
    pageViewY: pageView ? pageView.scrollTop : 0,
    pageViewX: pageView ? pageView.scrollLeft : 0,
    gridY: grid ? grid.scrollTop : 0,
    gridX: grid ? grid.scrollLeft : 0,
    // Always record exact positions (including 0) so restore is pixel-perfect
    invViewportY: invViewport ? invViewport.scrollTop : 0,
    invViewportX: invViewport ? invViewport.scrollLeft : 0,
    // Flag: was the inventory viewport actively rendered?
    hasInvViewport: !!invViewport,
    focusedId: activeEl && activeEl.id ? activeEl.id : null,
    selectionStart: activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null,
    selectionEnd: activeEl && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null,
    openActionMenuId: document.querySelector('.table-row-actions-menu.show')?.id?.replace('actions-menu-', '') || null
  };
}

/**
 * Restores exact scroll, viewport, and focused input states.
 * Uses a triple-rAF chain so that:
 *   Frame 1 — HTML is in the DOM
 *   Frame 2 — browser has laid out and measured new DOM
 *   Frame 3 — scrollTop/scrollLeft assignments land after layout is stable
 */
function restoreAppState(saved) {
  if (!saved) return;

  const apply = () => {
    if (window.scrollY !== saved.windowY || window.scrollX !== saved.windowX) {
      window.scrollTo(saved.windowX, saved.windowY);
      if (document.documentElement) document.documentElement.scrollTop = saved.windowY;
      if (document.body) document.body.scrollTop = saved.windowY;
    }

    const sidebar = document.querySelector('.sidebar-menu');
    if (sidebar && saved.sidebarY > 0) {
      sidebar.scrollTop = saved.sidebarY;
    }

    const container = document.getElementById('main-view-container');
    if (container) {
      container.scrollTop = saved.containerY;
      container.scrollLeft = saved.containerX;
    }

    const pageView = document.querySelector('.page-view');
    if (pageView) {
      pageView.scrollTop = saved.pageViewY;
      pageView.scrollLeft = saved.pageViewX;
    }

    const grid = document.querySelector('.excel-grid-container, .table-responsive, .history-content-area, .master-data-content, #reports-tab-content');
    if (grid) {
      grid.scrollTop = saved.gridY;
      grid.scrollLeft = saved.gridX;
    }

    // Restore inventory table dedicated scroll viewport (horizontal + vertical)
    // Apply to both top=0 and top>0 cases so position is always pixel-perfect
    const invViewport = document.getElementById('inventory-table-scroll-viewport');
    if (invViewport && saved.hasInvViewport) {
      invViewport.scrollTop = saved.invViewportY;
      invViewport.scrollLeft = saved.invViewportX;
    }

    if (saved.focusedId) {
      const el = document.getElementById(saved.focusedId);
      if (el && typeof el.focus === 'function' && document.activeElement !== el) {
        try {
          el.focus({ preventScroll: true });
          if (typeof saved.selectionStart === 'number' && typeof saved.selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
            el.setSelectionRange(saved.selectionStart, saved.selectionEnd);
          }
        } catch (e) { }
      }
    }

    if (saved.openActionMenuId) {
      const menuBtn = document.querySelector(`.btn-trigger-row-actions[data-id="${saved.openActionMenuId}"]`);
      if (menuBtn && !menuBtn.classList.contains('active')) {
        menuBtn.click();
      }
    }
  };

  // Immediate synchronous restore: guarantees zero flicker and prevents intermediate zero-state capture
  apply();

  // Next-frame confirmation: handles layout settlement & custom font/element metrics
  requestAnimationFrame(() => {
    apply();
    requestAnimationFrame(apply);
  });
}

/** Tracks whether the user is actively scrolling the inventory viewport or main container */
let _invScrollActive = false;
let _invScrollTimer = null;
let _invPendingReRender = false;

function _initInvScrollGuard() {
  const vp = document.getElementById('inventory-table-scroll-viewport');
  const mainContainer = document.getElementById('main-view-container');

  const onScroll = () => {
    _invScrollActive = true;
    if (vp) vp._isScrolling = true;
    clearTimeout(_invScrollTimer);
    _invScrollTimer = setTimeout(() => {
      _invScrollActive = false;
      if (vp) vp._isScrolling = false;
      if (_invPendingReRender) {
        if (window.__erpApp && window.__erpApp.isUserEditing()) {
          console.log('[ERP] Pending scroll re-render deferred: user is actively interacting or menu is open');
          return;
        }
        _invPendingReRender = false;
        if (window.__erpApp) {
          window.__erpApp.queueBackgroundRender();
        }
      }
    }, 1200);
  };

  if (vp && !vp._scrollGuardAttached) {
    vp._scrollGuardAttached = true;
    vp.addEventListener('scroll', onScroll, { passive: true });
  }

  if (mainContainer && !mainContainer._scrollGuardAttached) {
    mainContainer._scrollGuardAttached = true;
    mainContainer.addEventListener('scroll', onScroll, { passive: true });
  }
}

class ERPApplication {
  async init() {
    // Check saved theme
    const savedTheme = localStorage.getItem('al_muslim_theme');
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
    }

    console.log('Starting Al-Muslim Group Garments Maintenance ERP Application...');

    // Await instant IndexedDB cache hydration before first render (max 350ms safety guard)
    try {
      await Promise.race([
        storage.ensureHydrated(),
        new Promise(resolve => setTimeout(resolve, 350))
      ]);
    } catch (e) {
      console.warn('[ERP] Pre-render hydration notice:', e);
    }

    this.render();
    this.bindEvents();

    // Global State & Event Subscriptions
    state.on('change:currentView', (view) => this.switchView(view));
    state.on('change:activeModal', () => this.renderModalsOnly());
    state.on('change:masterDataActiveTab', () => this.renderMainContent());
    state.on('filters:changed', () => this.renderMainContent());
    state.on('columns:changed', () => this.renderMainContent());
    state.on('frozenColumns:changed', () => this.renderMainContent());
    state.on('inventory:updated', () => this.queueBackgroundRender());
    state.on('change:agentPanelOpen', () => this.renderAgentPanel());

    window.addEventListener('erp:inventory-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:relocate-updated', () => {
      if (state.get('currentView') === 'relocate') {
        this.queueBackgroundRender();
      }
    });

    // Selection changed handled in-place with instant DOM sync without destroying table DOM or resetting scroll
    state.on('selection:changed', (selList) => {
      try {
        syncInventorySelectionDOM(selList);
      } catch (e) {
        console.error('Error syncing inventory selection:', e);
      }
    });

    window.addEventListener('erp:notification', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:fields-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:excel-structure-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:master-data-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:et-lab-updated', () => {
      this.queueBackgroundRender();
    });

    const refreshHomeIfActive = () => {
      const cv = state.get('currentView');
      if (cv === 'home') {
        const homeContainer = document.getElementById('home-root-container');
        if (homeContainer) {
          homeContainer.innerHTML = renderHomepageView();
          initHomepageEvents();
        } else {
          this.render();
        }
      }
    };

    window.addEventListener('erp:storage-updated', () => {
      refreshHomeIfActive();
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:transfers-updated', () => {
      this.queueBackgroundRender();
    });

    // Re-render when homepage config changes from another device or database sync
    window.addEventListener('erp:homepage-updated', () => {
      refreshHomeIfActive();
    });

    window.addEventListener('erp:preventive-maintenance-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:audit-logs-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:history-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:spare-parts-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:parts-trace-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:tools-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:employees-updated', () => {
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:critical-data-ready', () => {
      refreshHomeIfActive();
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:secondary-data-ready', () => {
      refreshHomeIfActive();
      this.queueBackgroundRender();
    });

    window.addEventListener('erp:menu-closed', () => {
      if (_invPendingReRender && !this.isUserEditing()) {
        _invPendingReRender = false;
        this.queueBackgroundRender();
      }
    });

    window.__appLoaded = true;
    if (typeof window !== 'undefined' && !window.__pageUsableTime && typeof performance !== 'undefined') {
      window.__pageUsableTime = performance.now();
    }

    // Initialize Agent Chat Service (loads from localStorage + server)
    chatService.init().catch(e => console.warn('ChatService init notice:', e.message));

    // Ensure base URL reflects clean landing Home URL (/ERP/) without #home
    if (typeof window !== 'undefined' && window.location) {
      const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
      if (!hash || hash === 'home') {
        try {
          const cleanUrl = (window.location.pathname || '/') + (window.location.search || '');
          window.history.replaceState({ view: 'home' }, '', cleanUrl);
        } catch (_) { }
      }
    }

    console.log('Al-Muslim Group Garments Maintenance ERP loaded successfully.');
  }

  render() {
    try {
      const root = document.getElementById('app-root');
      if (!root) return;

      const currentUser = authService.getCurrentUser();
      let currentView = state.get('currentView') || 'home';

      // Security Gate: Protect internal ERP shell from unauthenticated access
      if (!currentUser && currentView !== 'home' && currentView !== 'login') {
        currentView = 'login';
        state.set('currentView', 'login');
        try {
          if (window.history && window.history.replaceState) {
            window.history.replaceState({ view: 'login' }, '', '#login');
          }
        } catch (_) { }
      }

      // Authorization Gate: Redirect unauthorized view requests straight to user's first allowed view
      if (currentUser && currentView !== 'home' && currentView !== 'login') {
        if (!authService.isViewAllowed(currentView, currentUser)) {
          const allowedView = authService.getFirstAllowedView(currentUser);
          currentView = allowedView;
          state.set('currentView', allowedView);
          try {
            if (window.history && window.history.replaceState) {
              window.history.replaceState({ view: allowedView }, '', `#${allowedView}`);
            }
          } catch (_) { }
        }
      }

      // 1. Standalone View: Public Homepage
      if (currentView === 'home') {
        root.innerHTML = `
          <div id="home-root-container">
            ${renderHomepageView()}
          </div>
          <div id="modal-layer">
            ${this.getActiveModalHtml()}
          </div>
          <div id="toast-root" class="toast-container"></div>
        `;
        initHomepageEvents();
        this.initModalEvents();
        return;
      }

      // 2. Standalone View: Dedicated Login & Password Recovery Page
      if (currentView === 'login') {
        root.innerHTML = `
          <div id="login-root-container">
            ${renderLoginView()}
          </div>
          <div id="modal-layer">
            ${this.getActiveModalHtml()}
          </div>
          <div id="toast-root" class="toast-container"></div>
        `;
        initLoginViewEvents();
        this.initModalEvents();
        return;
      }

      // 3. Authenticated ERP Shell Layout (Sidebar + Navbar + View)
      const savedState = captureAppState();

      root.innerHTML = `
        <div class="app-container">
          <!-- Sidebar Mobile Backdrop -->
          <div id="sidebar-backdrop" class="sidebar-backdrop"></div>

          <!-- Sidebar Navigation -->
          <div id="sidebar-container" style="display: flex;">
            ${renderSidebar()}
          </div>

          <!-- Main Content Layout -->
          <main class="app-main">
            <!-- Top Header Navigation with Role Switcher & User Guide -->
            <div id="navbar-container">
              ${renderNavbar()}
            </div>

            <!-- Active Page View Container (Always vertically scrollable with native high-contrast scrollbar) -->
            <div id="main-view-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden;">
              ${this.getActiveViewHtml()}
            </div>
          </main>

          <!-- Modals & Drawers Container -->
          <div id="modal-layer">
            ${this.getActiveModalHtml()}
          </div>

          <!-- Toast Notifications Container -->
          <div id="toast-root" class="toast-container"></div>
        </div>
      `;

      window.__appLoaded = true;
      this.initComponentEvents();

      // Restore scroll and viewport positions
      restoreAppState(savedState);

    } catch (err) {
      console.error('Fatal render error:', err);
      if (typeof window.__showStartupError === 'function') {
        window.__showStartupError('Rendering Error', err.message);
      }
    }
  }

  /**
   * Fast, ultra-smooth view transition that preserves scroll & avoids layout shifts
   */
  switchView(newView) {
    try {
      const currentUser = authService.getCurrentUser();
      // Security Gate: Redirect unauthenticated requests to login
      if (!currentUser && newView !== 'home' && newView !== 'login') {
        newView = 'login';
        state.set('currentView', 'login');
      }

      // Authorization Gate: Redirect unauthorized view requests straight to user's first allowed view
      if (currentUser && newView !== 'home' && newView !== 'login') {
        if (!authService.isViewAllowed(newView, currentUser)) {
          newView = authService.getFirstAllowedView(currentUser);
          state.set('currentView', newView);
        }
      }

      // Trigger non-blocking on-demand table loading for this view
      if (typeof storage !== 'undefined' && typeof storage.ensureTablesForView === 'function') {
        storage.ensureTablesForView(newView).catch(() => {});
      }

      // If entering or leaving standalone views (home or login), do full render
      const isStandaloneTarget = newView === 'home' || newView === 'login';
      const isCurrentlyStandalone = !document.getElementById('sidebar-container');

      const updateHistoryState = (view) => {
        try {
          if (window.history && window.history.pushState) {
            if (view === 'home') {
              const cleanUrl = (window.location.pathname || '/') + (window.location.search || '');
              if (window.location.hash) {
                window.history.pushState({ view: 'home' }, '', cleanUrl);
              } else {
                window.history.replaceState({ view: 'home' }, '', cleanUrl);
              }
            } else {
              window.history.pushState({ view }, '', `#${view}`);
            }
          }
        } catch (e) { }
      };

      if (isStandaloneTarget || isCurrentlyStandalone) {
        updateHistoryState(newView);
        this.render();
        return;
      }

      // Ensure state is updated to new view
      if (state.get('currentView') !== newView) {
        state.set('currentView', newView);
      }

      // 1. Update active sidebar item and parent accordion in-place
      updateSidebarActiveState(newView);
      // 2. Update navbar title & header
      this.renderNavbarOnly();
      // 3. Render main page content with clean scroll reset and explicit target view
      this.renderMainContent(false, false, newView);

      // Sync browser history state smoothly
      updateHistoryState(newView);

    } catch (err) {
      console.error('Error during smooth view transition:', err);
      this.render();
    }
  }

  renderNavbarOnly() {
    try {
      const navContainer = document.getElementById('navbar-container');
      if (navContainer) {
        navContainer.innerHTML = renderNavbar();
        initNavbarEvents();
      }
    } catch (err) {
      console.error('Error rendering navbar:', err);
    }
  }

  isUserEditing() {
    try {
      if (typeof window !== 'undefined' && window.__isActionMenuOpen) return true;
      const el = typeof document !== 'undefined' ? document.activeElement : null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
        return true;
      }
      if (el && el.isContentEditable) return true;
      if (typeof state !== 'undefined' && state.get('activeModal')) return true;
      if (typeof document !== 'undefined') {
        const hasOpenMenu = document.querySelector('.actions-dropdown-menu.show, .dropdown-menu.show, .btn-actions-trigger.active, .table-row-actions-menu.show');
        if (hasOpenMenu) return true;
      }
    } catch (_) {}
    return false;
  }

  queueBackgroundRender() {
    clearTimeout(this._bgRenderDebounceTimer);
    this._bgRenderDebounceTimer = setTimeout(() => {
      this.renderMainContent(true, true);
    }, 100);
  }

  renderMainContent(preserveScroll = true, isBackgroundSync = false, targetView = null) {
    try {
      const activeView = targetView || state.get('currentView') || 'dashboard';
      if (isBackgroundSync) {
        if (this.isUserEditing()) {
          console.log('[ERP] Background re-render skipped: user is actively editing or menu is open');
          _invPendingReRender = true;
          return;
        }
        // Skip background re-render while user is actively scrolling the inventory table or page
        if (_invScrollActive) {
          console.log('[ERP] Background re-render deferred: viewport is actively being scrolled');
          _invPendingReRender = true;
          return;
        }
        if (['settings', 'homepage-manager', 'email-config', 'login'].includes(activeView)) {
          return;
        }
      }

      const container = document.getElementById('main-view-container');
      if (container) {
        const savedState = preserveScroll ? captureAppState() : null;
        container.innerHTML = this.getActiveViewHtml(activeView);
        this.initViewEvents(activeView);
        // Re-attach scroll guard to newly rendered inventory viewport
        _initInvScrollGuard();
        if (preserveScroll && savedState) {
          restoreAppState(savedState);
        } else {
          container.scrollTop = 0;
          container.scrollLeft = 0;
          const pv = container.querySelector('.page-view');
          if (pv) {
            pv.scrollTop = 0;
            pv.scrollLeft = 0;
          }
        }
      }
    } catch (err) {
      console.error('Error rendering main content view:', err);
    }
  }

  renderModalsOnly() {
    try {
      const container = document.getElementById('main-view-container');
      const pageView = document.querySelector('.page-view');
      const tableWrap = document.querySelector('.table-responsive, .inventory-table-container, .excel-grid');
      const invViewport = document.getElementById('inventory-table-scroll-viewport');

      const savedContainerY = container ? container.scrollTop : 0;
      const savedContainerX = container ? container.scrollLeft : 0;
      const savedPageViewY = pageView ? pageView.scrollTop : 0;
      const savedTableY = tableWrap ? tableWrap.scrollTop : 0;
      const savedTableX = tableWrap ? tableWrap.scrollLeft : 0;
      const savedInvViewportY = invViewport ? invViewport.scrollTop : 0;
      const savedInvViewportX = invViewport ? invViewport.scrollLeft : 0;
      const savedWindowY = window.scrollY || document.documentElement.scrollTop || 0;
      const savedWindowX = window.scrollX || document.documentElement.scrollLeft || 0;

      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = this.getActiveModalHtml();
        this.initModalEvents();
      }
      const hasModal = !!(state.get('activeModal'));
      document.body.classList.toggle('modal-open', hasModal);

      const restore = () => {
        if (container) {
          container.scrollTop = savedContainerY;
          container.scrollLeft = savedContainerX;
        }
        if (pageView) {
          pageView.scrollTop = savedPageViewY;
        }
        if (tableWrap) {
          tableWrap.scrollTop = savedTableY;
          tableWrap.scrollLeft = savedTableX;
        }
        if (invViewport) {
          invViewport.scrollTop = savedInvViewportY;
          invViewport.scrollLeft = savedInvViewportX;
        }
        if (window.scrollY !== savedWindowY || window.scrollX !== savedWindowX) {
          window.scrollTo({ top: savedWindowY, left: savedWindowX, behavior: 'instant' });
        }
      };

      restore();
      requestAnimationFrame(restore);
    } catch (err) {
      console.error('Error rendering modals:', err);
    }
  }

  getActiveViewHtml(targetView = null) {
    try {
      let currentView = targetView || state.get('currentView') || 'dashboard';

      // Check module access authorization
      const viewToModuleMap = {
        'dashboard': 'dashboard',
        'inventory': 'machines',
        'relocate': 'relocate',
        'needle-operations': 'machines',
        'qr-codes': 'qr_codes',
        'transfers': 'transfers',
        'parts-trace': 'parts_trace',
        'machine-history': 'machine_history',
        'preventive-maintenance': 'preventive_maintenance',
        'reports': 'reports',
        'transfer-workflows': 'transfer_workflows',
        'excel-manager': 'excel_manager',
        'custom-fields': 'custom_fields',
        'et-lab': 'et_lab',
        'spare-parts': 'spare_parts',
        'tools-management': 'tools_management',
        'storage': 'storage',
        'manpower': 'manpower',
        'master-data': 'master_data',
        'users': 'user_management',
        'homepage-manager': 'homepage_management',
        'email-config': 'email_config',
        'audit-logs': 'audit_logs',
        'settings': 'settings',
        'database-config': 'settings',
        'resource-library': 'document_library'
      };

      const currentUser = authService.getCurrentUser();
      const requiredModule = viewToModuleMap[currentView];
      if (requiredModule && !authService.isAdmin() && !authService.isModuleAllowed(requiredModule)) {
        const allowedView = authService.getFirstAllowedView(currentUser);
        if (allowedView && allowedView !== currentView) {
          setTimeout(() => {
            state.set('currentView', allowedView);
            try {
              if (window.history && window.history.replaceState) {
                window.history.replaceState({ view: allowedView }, '', `#${allowedView}`);
              }
            } catch (_) {}
            this.render();
          }, 0);
        }
        currentView = allowedView;
      }

      switch (currentView) {
        case 'home':
          return renderHomepageView();
        case 'login':
          return renderLoginView();
        case 'dashboard':
          return renderDashboard();
        case 'inventory':
          return renderInventoryTable();
        case 'relocate':
          return renderRelocateView();
        case 'needle-operations':
          return renderNeedleOperationsView();
        case 'qr-codes':
          return renderQrCodeView();
        case 'transfers':
          return renderTransfersView();
        case 'parts-trace':
          return renderPartsTraceView();
        case 'machine-history':
          return renderMachineHistoryView();
        case 'preventive-maintenance':
          return renderPreventiveMaintenanceView();
        case 'transfer-workflows':
          return renderTransferWorkflowBuilder();
        case 'reports':
          return renderReportsView();
        case 'resource-library':
          return renderResourceLibraryView();
        case 'excel-manager':
          return renderExcelManagerView();
        case 'custom-fields':
          setTimeout(() => state.set('currentView', 'inventory'), 0);
          return renderInventoryTable();
        case 'et-lab':
          return renderEtLabManagementView();
        case 'spare-parts':
          setEntActiveTab('spare-parts');
          return renderEtLabManagementView();
        case 'tools-management':
          return renderToolsManagementView();
        case 'storage':
          return renderStorageView();
        case 'manpower':
          return renderManpowerView();
        case 'master-data':
          return renderMasterDataView();
        case 'users':
          return renderUserManagement();
        case 'homepage-manager':
          return renderHomepageManagerView();
        case 'email-config':
          return renderEmailConfigView();
        case 'audit-logs':
          return renderAuditLogsView();
        case 'settings':
          return renderSettingsView();
        case 'database-config':
          return renderDatabaseConfigView();
        default:
          return renderDashboard();
      }
    } catch (viewErr) {
      console.error('Component render error:', viewErr);
      return `
        <div style="padding: 30px; text-align: center; background: var(--bg-surface); border: 1px solid #ef4444; border-radius: var(--radius-lg); margin: 20px;">
          <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
          <h3 style="color: #f87171; font-weight: 700; margin-bottom: 8px;">View Render Notice</h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 14px;">An error occurred while loading this view: ${viewErr.message}</p>
          <button onclick="state.set('currentView', 'dashboard')" class="btn btn-primary btn-sm">Return to Dashboard</button>
        </div>
      `;
    }
  }

  getActiveModalHtml() {
    const activeModal = state.get('activeModal');
    switch (activeModal) {
      case 'change-password':
        return renderChangePasswordModal();
      case 'machine-form':
      case 'add-machine':
      case 'edit-machine':
        return renderMachineModal();
      case 'machine-details':
        return renderMachineDetails();
      case 'transfer-machine':
        return renderTransferModal();
      case 'transfer-details':
        return renderTransferDetailsModal();
      case 'edit-transfer':
        return renderEditTransferModal();
      case 'import-excel':
        return renderExcelImportModal();
      case 'column-visibility':
        return renderColumnVisibilityModal();
      case 'notifications':
        return renderNotificationsDrawer();
      default:
        return '';
    }
  }

  initComponentEvents() {
    initNavbarEvents();
    initSidebarEvents();
    this.initViewEvents();
    this.initModalEvents();
  }

  initViewEvents(targetView = null) {
    const currentView = targetView || state.get('currentView') || 'dashboard';
    switch (currentView) {
      case 'dashboard':
        initDashboardEvents();
        break;
      case 'inventory':
        initInventoryTableEvents();
        // Attach scroll guard after events are initialized — protects against background re-render during scroll
        _initInvScrollGuard();
        break;
      case 'relocate':
        initRelocateViewEvents();
        break;
      case 'needle-operations':
        initNeedleOperationsEvents();
        break;
      case 'qr-codes':
        initQrCodeEvents();
        break;
      case 'transfers':
        initTransfersViewEvents();
        break;
      case 'parts-trace':
        initPartsTraceEvents();
        break;
      case 'machine-history':
        initMachineHistoryEvents();
        break;
      case 'preventive-maintenance':
        initPreventiveMaintenanceEvents();
        break;
      case 'transfer-workflows':
        initTransferWorkflowBuilderEvents();
        break;
      case 'reports':
        initReportsEvents();
        break;
      case 'resource-library':
        initResourceLibraryEvents();
        break;
      case 'excel-manager':
        initExcelManagerEvents();
        break;
      case 'custom-fields':
        initInventoryTableEvents();
        break;
      case 'et-lab':
      case 'spare-parts':
        initEtLabEvents();
        break;
      case 'tools-management':
        initToolsManagementEvents();
        break;
      case 'storage':
        initStorageEvents();
        break;
      case 'manpower':
        initManpowerEvents();
        break;
      case 'master-data':
        initMasterDataEvents();
        break;
      case 'users':
        initUserManagementEvents();
        break;
      case 'homepage-manager':
        initHomepageManagerEvents();
        break;
      case 'email-config':
        initEmailConfigEvents();
        break;
      case 'audit-logs':
        initAuditLogsEvents();
        break;
      case 'settings':
        initSettingsEvents();
        break;
      case 'database-config':
        initDatabaseConfigEvents();
        break;
    }
  }

  initModalEvents() {
    const activeModal = state.get('activeModal');
    switch (activeModal) {
      case 'change-password':
        initChangePasswordModalEvents();
        break;
      case 'machine-form':
      case 'add-machine':
      case 'edit-machine':
        initMachineModalEvents();
        break;
      case 'machine-details':
        initMachineDetailsEvents();
        break;
      case 'transfer-machine':
        initTransferModalEvents();
        break;
      case 'transfer-details':
        initTransferDetailsModalEvents();
        break;
      case 'edit-transfer':
        initEditTransferModalEvents();
        break;
      case 'import-excel':
        initExcelImportEvents();
        break;
      case 'column-visibility':
        initColumnVisibilityEvents();
        break;
      case 'notifications':
        initNotificationsDrawerEvents();
        break;
      case 'user-perms-modal':
      case 'reset-password-modal':
        initUserManagementEvents();
        break;
    }
  }

  bindEvents() {
    // 1. Global anchor navigation safety: intercept all unhandled href="#" or empty href clicks to prevent window scroll jumping
    window.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href === 'javascript:void(0)') {
          e.preventDefault();
        }
      }
    }, { capture: true });

    // 2. Escape key closes modals safely without modifying page scroll
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        state.set('activeModal', null);
        const appContainer = document.querySelector('.app-container');
        if (appContainer && appContainer.classList.contains('sidebar-mobile-open')) {
          appContainer.classList.remove('sidebar-mobile-open');
        }
      }
    });

    // 2.1 Mobile Sidebar Drawer Toggle & Backdrop Handlers
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('#btn-mobile-sidebar-toggle');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
          appContainer.classList.toggle('sidebar-mobile-open');
        }
        return;
      }

      const closeBtn = e.target.closest('#btn-sidebar-mobile-close');
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
          appContainer.classList.remove('sidebar-mobile-open');
        }
        return;
      }

      const backdrop = e.target.closest('#sidebar-backdrop');
      if (backdrop) {
        e.preventDefault();
        e.stopPropagation();
        const appContainer = document.querySelector('.app-container');
        if (appContainer) {
          appContainer.classList.remove('sidebar-mobile-open');
        }
        return;
      }
    });

    // 2.2 Auto-close mobile drawer when window resized past mobile breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        const appContainer = document.querySelector('.app-container');
        if (appContainer && appContainer.classList.contains('sidebar-mobile-open')) {
          appContainer.classList.remove('sidebar-mobile-open');
        }
      }
    });

    // 3. Browser Back / Forward & Hash Navigation Support
    window.addEventListener('popstate', (e) => {
      const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
      let targetView = (e.state && e.state.view) ? e.state.view : hash;
      if (!targetView || targetView === 'home') {
        targetView = 'home';
      }
      const cu = authService.getCurrentUser();
      if (cu && targetView !== 'home' && targetView !== 'login' && !authService.isViewAllowed(targetView, cu)) {
        targetView = authService.getFirstAllowedView(cu);
        try {
          window.history.replaceState({ view: targetView }, '', `#${targetView}`);
        } catch (_) {}
      }
      state.set('currentView', targetView);
      this.switchView(targetView);
    });

    window.addEventListener('hashchange', () => {
      const h = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
      let viewToLoad = (!h || h === 'home') ? 'home' : h;
      const cu = authService.getCurrentUser();
      if (cu && viewToLoad !== 'home' && viewToLoad !== 'login' && !authService.isViewAllowed(viewToLoad, cu)) {
        viewToLoad = authService.getFirstAllowedView(cu);
        try {
          window.history.replaceState({ view: viewToLoad }, '', `#${viewToLoad}`);
        } catch (_) {}
      }
      state.set('currentView', viewToLoad);
      this.switchView(viewToLoad);
    });

    const resetSeedBtn = document.getElementById('btn-quick-seed');
    if (resetSeedBtn) {
      resetSeedBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all data back to the original demo dataset? All manual edits will be re-seeded.')) {
          storage.clearAll();
          window.location.reload();
        }
      });
    }

    // 4. Live Cross-Module Synchronizers
    window.addEventListener('erp:needle-updated', () => {
      const cv = state.get('currentView');
      if (cv === 'needle-operations' || cv === 'relocate') {
        this.render();
      }
    });
  }

  showToast(title, message, type = 'info') {
    const toastType = type === 'danger' ? 'error' : type;
    notificationService.toast(message || title, toastType, message ? title : '');
  }
}

// Instantiate and initialize global app singleton
export const app = new ERPApplication();
if (typeof window !== 'undefined') {
  window.app = app;
  window.__erpApp = app;
  window.storage = storage;
  window.state = state;
  window.authService = authService;
  window.historyService = historyService;
  window.auditService = auditService;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      app.init().catch(e => console.error('[ERP] Startup error:', e));
    });
  } else {
    // DOMContentLoaded already fired; initialize immediately
    app.init().catch(e => console.error('[ERP] Startup error:', e));
  }
}
