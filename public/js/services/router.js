/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Centralized Single Page Application (SPA) URL Router & History Manager
 * Supports:
 * - HTML5 History API (Clean Pathnames: /inventory, /transfers, /reports/transfers, etc.)
 * - Automatic Base Path detection (/ERP on GitHub Pages vs / on root/cPanel/localhost)
 * - Deep linking with direct module access & browser refresh preservation
 * - Browser Back & Forward (popstate) seamless handling without full page reload
 * - Sub-feature and Tab routing (/reports/transfers, /manpower/active, /users/permissions, etc.)
 * - Zero permissions / RBAC authorization guard verification before view switch
 * - Graceful 404 query fallback (?p=/inventory) and legacy hash fallback (#inventory)
 */

import { authService } from './authService.js';
import { state } from '../state.js';

// Canonical route-to-view mapping
const ROUTE_VIEW_MAP = {
  '': 'home',
  'home': 'home',
  'login': 'login',
  'dashboard': 'dashboard',
  'inventory': 'inventory',
  'machines': 'inventory',
  'machine-inventory': 'inventory',
  'relocate': 'relocate',
  'needle-operations': 'needle-operations',
  'needle-flow': 'needle-operations',
  'needle': 'needle-operations',
  'qr-codes': 'qr-codes',
  'qr': 'qr-codes',
  'transfers': 'transfers',
  'transfer-workflows': 'transfer-workflows',
  'parts-trace': 'parts-trace',
  'machine-history': 'machine-history',
  'passport': 'machine-history',
  'preventive-maintenance': 'preventive-maintenance',
  'pm': 'preventive-maintenance',
  'reports': 'reports',
  'resource-library': 'resource-library',
  'documents': 'resource-library',
  'excel-manager': 'excel-manager',
  'excel-center': 'excel-manager',
  'custom-fields': 'custom-fields',
  'et-lab': 'et-lab',
  'spare-parts': 'spare-parts',
  'tools-management': 'tools-management',
  'tools': 'tools-management',
  'tools-equipment': 'tools-management',
  'storage': 'storage',
  'manpower': 'manpower',
  'master-data': 'master-data',
  'users': 'users',
  'user-management': 'users',
  'user-access': 'users',
  'homepage-manager': 'homepage-manager',
  'email-config': 'email-config',
  'audit-logs': 'audit-logs',
  'settings': 'settings',
  'database-config': 'database-config',
  'no-access': 'no-access',
  'admin-login': 'admin-login',
  'secure-admin-gateway': 'admin-login'
};

// Map clean URL tab slugs to internal component state keys and vice versa
const USER_SLUG_TO_TAB = {
  'accounts': 'ACCOUNTS',
  'permissions': 'PERMISSIONS',
  'bulk-assign': 'BULK_ASSIGN',
  'passwords': 'PASSWORD_MGMT',
  'password-mgmt': 'PASSWORD_MGMT',
  'export': 'EXPORT_ACCOUNTS',
  'export-accounts': 'EXPORT_ACCOUNTS',
  'logs': 'ACTIVITY_LOGS',
  'activity-logs': 'ACTIVITY_LOGS',
  'presets': 'PRESETS'
};

const USER_TAB_TO_SLUG = {
  'ACCOUNTS': 'accounts',
  'PERMISSIONS': 'permissions',
  'BULK_ASSIGN': 'bulk-assign',
  'PASSWORD_MGMT': 'passwords',
  'EXPORT_ACCOUNTS': 'export',
  'ACTIVITY_LOGS': 'logs',
  'PRESETS': 'presets'
};

const REPORT_SLUG_MAP = {
  'machine': 'machines',
  'machines': 'machines',
  'transfer': 'transfers',
  'transfers': 'transfers',
  'spare': 'spareparts',
  'spare-parts': 'spareparts',
  'spareparts': 'spareparts',
  'etlab': 'etlab',
  'et-lab': 'etlab',
  'pm': 'preventive',
  'preventive': 'preventive',
  'export': 'export'
};

// Document titles for each view
const VIEW_TITLES = {
  'home': 'Al-Muslim Group — Maintenance Department ERP',
  'login': 'Sign In — Maintenance ERP | Al-Muslim Group',
  'dashboard': 'Dashboard — Factory Maintenance ERP',
  'inventory': 'Machine Inventory — Al-Muslim Group ERP',
  'relocate': 'Relocate & Verify — Al-Muslim Group ERP',
  'needle-operations': 'Needle Flow & Operations — Al-Muslim Group ERP',
  'qr-codes': 'QR Codes & Labels — Al-Muslim Group ERP',
  'transfers': 'Machine Transfers & Workflow — Al-Muslim Group ERP',
  'transfer-workflows': 'Transfer Workflow Engine — Al-Muslim Group ERP',
  'parts-trace': 'Parts Traceability — Al-Muslim Group ERP',
  'machine-history': 'Machine Passport & Lifetime History — Al-Muslim Group ERP',
  'preventive-maintenance': 'Preventive Maintenance — Al-Muslim Group ERP',
  'reports': 'Analytics & Diagnostics Reports — Al-Muslim Group ERP',
  'resource-library': 'Resource Library & Documentation — Al-Muslim Group ERP',
  'excel-manager': 'Excel Export & Structure Center — Al-Muslim Group ERP',
  'custom-fields': 'Custom Attributes Manager — Al-Muslim Group ERP',
  'et-lab': 'ENT Lab Management — Al-Muslim Group ERP',
  'spare-parts': 'Spare Parts Inventory — Al-Muslim Group ERP',
  'tools-management': 'Tools, Equipment & Accessories — Al-Muslim Group ERP',
  'storage': 'Factory Storage & Spare Machines — Al-Muslim Group ERP',
  'manpower': 'Workforce & Manpower — Al-Muslim Group ERP',
  'master-data': 'Master Schemas & Data — Al-Muslim Group ERP',
  'users': 'User Management & Permissions — Al-Muslim Group ERP',
  'homepage-manager': 'Homepage Management — Al-Muslim Group ERP',
  'email-config': 'Email & Alerts Setup — Al-Muslim Group ERP',
  'audit-logs': 'System Security & Audit Logs — Al-Muslim Group ERP',
  'settings': 'Factory ERP Settings — Al-Muslim Group ERP',
  'database-config': 'Primary Database & Sync Settings — Al-Muslim Group ERP',
  'no-access': 'Access Pending — Al-Muslim Group ERP',
  'admin-login': 'Admin Security Gateway — Al-Muslim Group ERP'
};

class SPAModuleRouter {
  constructor() {
    this._isNavigating = false;
    this._listeners = [];
  }

  /**
   * Detects base path:
   * Returns '/ERP' when deployed on GitHub Pages or subfolder,
   * otherwise returns '' for localhost, custom domains (cPanel), or root.
   */
  getBasePath() {
    if (typeof window === 'undefined' || !window.location) return '';
    const pathname = window.location.pathname || '';
    if (pathname.toLowerCase().startsWith('/erp')) {
      return '/ERP';
    }
    return '';
  }

  /**
   * Cleans path by removing base path prefix and leading/trailing slashes
   */
  getRelativePath(fullPath = null) {
    if (typeof window === 'undefined') return '';
    const rawPath = fullPath !== null ? fullPath : (window.location.pathname || '');
    const base = this.getBasePath();
    let path = rawPath;

    if (base && path.toLowerCase().startsWith(base.toLowerCase())) {
      path = path.slice(base.length);
    }

    path = path.replace(/^\/+|\/+$/g, '');
    return path;
  }

  /**
   * Parses current browser URL to determine view, subtabs, and query parameters.
   * Handles:
   * 1. Pathname routing: /inventory, /transfers, /reports/transfers
   * 2. Query params: ?tab=transfers, ?search=..., ?redirect=...
   * 3. Legacy hash routes: #/inventory, #inventory
   * 4. GitHub Pages 404 redirect param: ?p=/inventory or ?p=/reports/transfers
   */
  parseCurrentRoute() {
    if (typeof window === 'undefined' || !window.location) {
      return { view: 'home', tab: null, params: {}, path: '' };
    }

    const searchParams = new URLSearchParams(window.location.search || '');
    let relPath = this.getRelativePath();

    // Check if redirect path was passed via GitHub Pages 404 query param (?p=/inventory)
    if (searchParams.has('p')) {
      const p = decodeURIComponent(searchParams.get('p') || '');
      relPath = p.replace(/^\/+|\/+$/g, '');
    }

    // Split pathname segments e.g. "reports/machines" or "inventory"
    const segments = relPath ? relPath.split('/').filter(Boolean) : [];
    let routeKey = (segments[0] || '').toLowerCase().trim();
    let subSegment = segments[1] ? segments[1].toLowerCase().trim() : null;

    // Check legacy hash fallback if pathname is root
    if (!routeKey || routeKey === 'index.html' || routeKey === 'erp') {
      const hash = (window.location.hash || '').replace(/^[#\/]+/, '').trim().toLowerCase();
      if (hash) {
        const hashSegments = hash.split('?')[0].split('/').filter(Boolean);
        if (hashSegments.length > 0) {
          routeKey = hashSegments[0];
          if (hashSegments[1]) subSegment = hashSegments[1];
        }
      }
    }

    // Check if routeKey matches active custom admin login slug
    const activeAdminSlug = (typeof authService !== 'undefined' && typeof authService.getAdminLoginSlug === 'function')
      ? authService.getAdminLoginSlug()
      : (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_admin_login_slug') : 'secure-admin-gateway') || 'secure-admin-gateway';

    if (routeKey === activeAdminSlug || routeKey === 'admin-login' || routeKey === 'secure-admin-gateway') {
      routeKey = 'admin-login';
    }

    // Determine target view
    let targetView = ROUTE_VIEW_MAP[routeKey] || (routeKey ? routeKey : 'home');

    // Extract subtab from query param or secondary path segment
    let rawTab = searchParams.get('tab') || subSegment || null;
    let tab = rawTab;

    if (targetView === 'reports' && tab) {
      tab = REPORT_SLUG_MAP[tab] || tab;
    } else if (targetView === 'users' && tab) {
      tab = USER_SLUG_TO_TAB[tab.toLowerCase()] || tab;
    }

    // Build parameter dictionary
    const params = {};
    for (const [k, v] of searchParams.entries()) {
      if (k !== 'p' && k !== 'tab') {
        params[k] = v;
      }
    }

    return {
      view: targetView,
      tab: tab,
      params: params,
      path: relPath,
      search: window.location.search || '',
      hash: window.location.hash || ''
    };
  }

  /**
   * Builds canonical URL for a given view and options
   */
  buildUrl(view, options = {}) {
    const base = this.getBasePath();
    let tab = options.tab || null;
    const query = options.params ? { ...options.params } : {};

    // Normalize user tab to clean slug if applicable
    if (tab && view === 'users' && USER_TAB_TO_SLUG[tab]) {
      tab = USER_TAB_TO_SLUG[tab];
    }

    let pathPart = '';
    if (!view || view === 'home') {
      pathPart = base ? base + '/' : '/';
    } else if (view === 'admin-login') {
      const activeAdminSlug = (typeof authService !== 'undefined' && typeof authService.getAdminLoginSlug === 'function')
        ? authService.getAdminLoginSlug()
        : (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_admin_login_slug') : 'secure-admin-gateway') || 'secure-admin-gateway';
      pathPart = (base ? base : '') + '/' + encodeURIComponent(activeAdminSlug);
      if (tab) {
        pathPart += '/' + encodeURIComponent(tab);
      }
    } else {
      pathPart = (base ? base : '') + '/' + encodeURIComponent(view);
      if (tab) {
        pathPart += '/' + encodeURIComponent(tab);
      }
    }

    const queryString = Object.keys(query).length > 0 
      ? '?' + new URLSearchParams(query).toString()
      : '';

    return pathPart + queryString;
  }

  /**
   * Sets document title based on the active view and optional subtab
   * and enforces search engine indexing protection.
   */
  updateTitle(view, tab = null) {
    if (typeof document === 'undefined') return;
    let baseTitle = VIEW_TITLES[view] || (view ? `${view.charAt(0).toUpperCase() + view.slice(1)} — Al-Muslim Group ERP` : 'Al-Muslim Group ERP');
    if (tab && tab !== 'dashboard' && tab !== 'machines' && tab !== 'active' && tab !== 'tools-list' && tab !== 'boards' && tab !== 'scan') {
      const displayTab = USER_TAB_TO_SLUG[tab] || tab;
      const formattedTab = displayTab.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      baseTitle = `${formattedTab} | ${baseTitle}`;
    }
    document.title = baseTitle;
    this.manageRobotsMeta(view === 'admin-login');
  }

  /**
   * Dynamically enforces search engine robots directives:
   * Strictly blocks Googlebot, Bingbot and all web crawlers from indexing Admin Login Gateway.
   * Restores normal indexing for standard public portal views.
   */
  manageRobotsMeta(isPrivateAdminGateway = false) {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    if (isPrivateAdminGateway) {
      meta.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
    } else {
      meta.content = 'index, follow';
    }
  }

  /**
   * Retrieves active subtab for a given view from reactive state
   */
  getCurrentSubtab(view) {
    if (!view) return null;
    if (view === 'reports') return state.get('reportActiveTab') || 'machines';
    if (view === 'manpower') return state.get('manpowerActiveTab') || 'active';
    if (view === 'preventive-maintenance') return state.get('pmActiveTab') || 'dashboard';
    if (view === 'master-data') return state.get('masterDataActiveTab') || 'fast-entry';
    if (view === 'users') {
      const uTab = state.get('userAccessActiveTab') || 'ACCOUNTS';
      return USER_TAB_TO_SLUG[uTab] || uTab.toLowerCase();
    }
    if (view === 'tools-management') return state.get('toolsActiveTab') || 'tools-add';
    if (view === 'et-lab') return state.get('etLabActiveTab') || 'boards';
    if (view === 'excel-manager') return state.get('excelActiveTab') || 'structure';
    if (view === 'homepage-manager') return state.get('homeManagerActiveTab') || 'sections';
    if (view === 'relocate') return state.get('relocateActiveTab') || 'scan';
    if (view === 'parts-trace') return state.get('partsTraceActiveTab') || 'dashboard';
    if (view === 'machine-history') return state.get('historyActiveTab') || 'timeline';
    if (view === 'qr-codes') return state.get('qrStudioTab') || 'machine';
    return null;
  }

  /**
   * Synchronizes subtab state in GlobalState if provided in URL or options
   */
  syncSubtabState(view, tab) {
    if (!tab) return;
    const lowerTab = String(tab).toLowerCase();
    if (view === 'reports') {
      const normalized = REPORT_SLUG_MAP[lowerTab] || tab;
      state.set('reportActiveTab', normalized);
    } else if (view === 'manpower') {
      state.set('manpowerActiveTab', tab);
    } else if (view === 'preventive-maintenance') {
      state.set('pmActiveTab', tab);
    } else if (view === 'master-data') {
      state.set('masterDataActiveTab', tab);
    } else if (view === 'users') {
      const normalized = USER_SLUG_TO_TAB[lowerTab] || tab.toUpperCase();
      state.set('userAccessActiveTab', normalized);
      if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem('al_muslim_user_access_section', normalized); } catch (_) {}
      }
    } else if (view === 'tools-management') {
      state.set('toolsActiveTab', tab);
    } else if (view === 'et-lab') {
      state.set('etLabActiveTab', tab);
    } else if (view === 'excel-manager') {
      state.set('excelActiveTab', tab);
    } else if (view === 'homepage-manager') {
      state.set('homeManagerActiveTab', tab);
    } else if (view === 'relocate') {
      state.set('relocateActiveTab', tab);
    } else if (view === 'parts-trace') {
      state.set('partsTraceActiveTab', tab);
    } else if (view === 'machine-history') {
      state.set('historyActiveTab', tab);
    } else if (view === 'qr-codes') {
      state.set('qrStudioTab', tab);
    }
  }

  /**
   * Main SPA Navigation method:
   * Changes URL instantly via history API without reloading the page,
   * updates document title, and triggers smooth view change.
   */
  navigate(targetView, options = {}) {
    if (typeof window === 'undefined') return;

    const replace = !!options.replace;
    let tab = options.tab !== undefined ? options.tab : this.getCurrentSubtab(targetView);
    const params = options.params || {};
    const targetUrl = this.buildUrl(targetView, { tab, params });

    // Handle subtab state
    if (tab) {
      this.syncSubtabState(targetView, tab);
    }

    // Update browser URL state cleanly
    try {
      const currentFullUrl = window.location.pathname + window.location.search;
      if (currentFullUrl !== targetUrl || (window.location.hash && !options.preserveHash)) {
        if (replace) {
          window.history.replaceState({ view: targetView, tab, params }, '', targetUrl);
        } else {
          window.history.pushState({ view: targetView, tab, params }, '', targetUrl);
        }
      }
    } catch (e) {
      console.warn('[Router] History pushState notice:', e);
    }

    // Update document title
    this.updateTitle(targetView, tab);

    // Synchronize global reactive state if needed
    if (state.get('currentView') !== targetView) {
      state.set('currentView', targetView);
    }

    // Trigger view transition in app singleton unless skipped
    if (!options.skipViewSwitch && typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
      window.app.switchView(targetView, { tab, replace: true, skipHistory: true });
    }

    // Notify registered router listeners
    this._emit('route:changed', { view: targetView, tab, params, url: targetUrl });
  }

  /**
   * Handles popstate events (Browser Back & Forward buttons)
   */
  handlePopState(event) {
    const parsed = this.parseCurrentRoute();
    let targetView = parsed.view;
    const currentUser = authService.getCurrentUser();

    // Security & Authorization Guard on Back/Forward navigation
    if (!currentUser && targetView !== 'home' && targetView !== 'login' && targetView !== 'admin-login') {
      this.navigate('login', { replace: true, params: { redirect: targetView } });
      return;
    }

    if (currentUser && targetView !== 'home' && targetView !== 'login' && targetView !== 'admin-login') {
      if (!authService.isViewAllowed(targetView, currentUser)) {
        const allowedView = authService.getFirstAllowedView(currentUser);
        this.navigate(allowedView, { replace: true });
        return;
      }
    }

    // Sync subtabs if URL contains tab
    if (parsed.tab) {
      this.syncSubtabState(targetView, parsed.tab);
    }

    this.updateTitle(targetView, parsed.tab);

    // Seamlessly transition view via app singleton
    if (typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
      window.app.switchView(targetView, { tab: parsed.tab, replace: true, skipHistory: true });
    } else {
      state.set('currentView', targetView);
    }

    this._emit('route:changed', { view: targetView, tab: parsed.tab, params: parsed.params });
  }

  /**
   * Initializes router listeners, normalizes legacy hash URLs or 404 redirects, and binds popstate
   */
  init() {
    if (typeof window === 'undefined') return;

    // Listen to browser Back/Forward navigation
    window.addEventListener('popstate', (e) => this.handlePopState(e));

    // Intercept clicks on links or elements with data-view or data-route
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-route], [data-view]');
      if (!target) return;

      // Allow default behavior for external links or modifier keys (Ctrl/Cmd click)
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const view = target.getAttribute('data-view') || target.getAttribute('data-route');
      const tab = target.getAttribute('data-report-tab') || 
                  target.getAttribute('data-manpower-tab') || 
                  target.getAttribute('data-pm-tab') || 
                  target.getAttribute('data-user-tab') || 
                  target.getAttribute('data-master-tab') || 
                  target.getAttribute('data-tab');

      if (view) {
        // Prevent default browser link navigation
        e.preventDefault();
        this.navigate(view, { tab });
      }
    });

    // Clean up any 404 query param (?p=...) or normalize legacy hash URLs on startup to clean pathname
    const searchParams = new URLSearchParams(window.location.search || '');
    const parsed = this.parseCurrentRoute();
    if (searchParams.has('p') || (window.location.hash && (window.location.pathname === '/' || window.location.pathname.toLowerCase() === '/erp' || window.location.pathname.toLowerCase() === '/erp/'))) {
      const cleanUrl = this.buildUrl(parsed.view, { tab: parsed.tab, params: parsed.params });
      try {
        window.history.replaceState({ view: parsed.view, tab: parsed.tab, params: parsed.params }, '', cleanUrl);
      } catch (_) {}
    }

    this.updateTitle(parsed.view, parsed.tab);
  }

  on(event, callback) {
    this._listeners.push({ event, callback });
  }

  _emit(event, payload) {
    this._listeners.filter(l => l.event === event).forEach(l => {
      try { l.callback(payload); } catch (e) { console.error('[Router] Listener error:', e); }
    });
  }
}

export const router = new SPAModuleRouter();

if (typeof window !== 'undefined') {
  window.router = router;
}

export default router;
