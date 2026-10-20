/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * High-Performance Module Lazy-Loader & Intelligent Prefetch Engine
 * 
 * Features:
 * - Dynamic on-demand ES module importing with memory caching for 0ms instantaneous transitions
 * - Intelligent Proactive Background Preloader: warms all operational modules post-startup
 * - Immediate Zero-Delay Hover/Touch Warmup (pre-loads before user click finishes)
 * - Accordion Group Pre-warming (preloads child views on category hover/expand)
 * - Shimmering dark-mode layout skeleton for graceful fallback
 * - Race-condition guard for rapid switching & parallel startup hydration
 */

export const BUILD_VER = '4.26.57';

const MODULE_REGISTRY = {
  'inventory': {
    path: `../components/inventoryTable.js?v=${BUILD_VER}`,
    renderName: 'renderInventoryTable',
    initName: 'initInventoryTableEvents',
    type: 'table'
  },
  'transfers': {
    path: `../components/transfersView.js?v=${BUILD_VER}`,
    renderName: 'renderTransfersView',
    initName: 'initTransfersViewEvents',
    type: 'table'
  },
  'relocate': {
    path: `../components/relocateView.js?v=${BUILD_VER}`,
    renderName: 'renderRelocateView',
    initName: 'initRelocateViewEvents',
    type: 'table'
  },
  'needle-operations': {
    path: `../components/needleOperationsView.js?v=${BUILD_VER}`,
    renderName: 'renderNeedleOperationsView',
    initName: 'initNeedleOperationsEvents',
    type: 'table'
  },
  'qr-codes': {
    path: `../components/qrCodeView.js?v=${BUILD_VER}`,
    renderName: 'renderQrCodeView',
    initName: 'initQrCodeEvents',
    type: 'grid'
  },
  'parts-trace': {
    path: `../components/partsTraceView.js?v=${BUILD_VER}`,
    renderName: 'renderPartsTraceView',
    initName: 'initPartsTraceEvents',
    type: 'table'
  },
  'machine-history': {
    path: `../components/machineHistoryView.js?v=${BUILD_VER}`,
    renderName: 'renderMachineHistoryView',
    initName: 'initMachineHistoryEvents',
    type: 'cards'
  },
  'preventive-maintenance': {
    path: `../components/preventiveMaintenanceView.js?v=${BUILD_VER}`,
    renderName: 'renderPreventiveMaintenanceView',
    initName: 'initPreventiveMaintenanceEvents',
    type: 'table'
  },
  'transfer-workflows': {
    path: `../components/transferWorkflowBuilder.js?v=${BUILD_VER}`,
    renderName: 'renderTransferWorkflowBuilder',
    initName: 'initTransferWorkflowBuilderEvents',
    type: 'form'
  },
  'reports': {
    path: `../components/reportsView.js?v=${BUILD_VER}`,
    renderName: 'renderReportsView',
    initName: 'initReportsEvents',
    type: 'grid'
  },
  'resource-library': {
    path: `../components/resourceLibraryView.js?v=${BUILD_VER}`,
    renderName: 'renderResourceLibraryView',
    initName: 'initResourceLibraryEvents',
    type: 'grid'
  },
  'excel-manager': {
    path: `../components/excelManagerView.js?v=${BUILD_VER}`,
    renderName: 'renderExcelManagerView',
    initName: 'initExcelManagerEvents',
    type: 'cards'
  },
  'custom-fields': {
    path: `../components/inventoryTable.js?v=${BUILD_VER}`,
    renderName: 'renderInventoryTable',
    initName: 'initInventoryTableEvents',
    type: 'table'
  },
  'et-lab': {
    path: `../components/etLabManagementView.js?v=${BUILD_VER}`,
    renderName: 'renderEtLabManagementView',
    initName: 'initEtLabEvents',
    type: 'table',
    beforeRender: (mod) => {
      try {
        const tab = (typeof window !== 'undefined' && window.state) ? window.state.get('etLabActiveTab') : 'boards';
        if (typeof mod.setEntActiveTab === 'function') mod.setEntActiveTab(tab || 'boards');
      } catch (_) {}
    }
  },
  'spare-parts': {
    path: `../components/etLabManagementView.js?v=${BUILD_VER}`,
    renderName: 'renderEtLabManagementView',
    initName: 'initEtLabEvents',
    type: 'table',
    beforeRender: (mod) => {
      try {
        if (typeof mod.setEntActiveTab === 'function') mod.setEntActiveTab('spare-parts');
      } catch (_) {}
    }
  },
  'tools-management': {
    path: `../components/toolsManagementView.js?v=${BUILD_VER}`,
    renderName: 'renderToolsManagementView',
    initName: 'initToolsManagementEvents',
    type: 'table'
  },
  'storage': {
    path: `../components/storageView.js?v=${BUILD_VER}`,
    renderName: 'renderStorageView',
    initName: 'initStorageEvents',
    type: 'table'
  },
  'manpower': {
    path: `../components/manpowerView.js?v=${BUILD_VER}`,
    renderName: 'renderManpowerView',
    initName: 'initManpowerEvents',
    type: 'table'
  },
  'master-data': {
    path: `../components/masterDataView.js?v=${BUILD_VER}`,
    renderName: 'renderMasterDataView',
    initName: 'initMasterDataEvents',
    type: 'table'
  },
  'users': {
    path: `../components/userManagement.js?v=${BUILD_VER}`,
    renderName: 'renderUserManagement',
    initName: 'initUserManagementEvents',
    type: 'table'
  },
  'homepage-manager': {
    path: `../components/homepageManagerView.js?v=${BUILD_VER}`,
    renderName: 'renderHomepageManagerView',
    initName: 'initHomepageManagerEvents',
    type: 'form'
  },
  'email-config': {
    path: `../components/emailConfigView.js?v=${BUILD_VER}`,
    renderName: 'renderEmailConfigView',
    initName: 'initEmailConfigEvents',
    type: 'form'
  },
  'audit-logs': {
    path: `../components/auditLogsView.js?v=${BUILD_VER}`,
    renderName: 'renderAuditLogsView',
    initName: 'initAuditLogsEvents',
    type: 'table'
  },
  'settings': {
    path: `../components/settingsView.js?v=${BUILD_VER}`,
    renderName: 'renderSettingsView',
    initName: 'initSettingsEvents',
    type: 'form'
  },
  'database-config': {
    path: `../components/databaseConfigView.js?v=${BUILD_VER}`,
    renderName: 'renderDatabaseConfigView',
    initName: 'initDatabaseConfigEvents',
    type: 'form'
  }
};

class ModuleLazyLoader {
  constructor() {
    this._loadedModules = new Map();
    this._loadingPromises = new Map();
    this._prefetched = new Set();
    this._isPreloadingAll = false;
  }

  /**
   * Returns true if module is already downloaded and cached in memory
   */
  isLoaded(view) {
    return this._loadedModules.has(view);
  }

  /**
   * Returns cached module synchronously if loaded, or null
   */
  getLoaded(view) {
    return this._loadedModules.get(view) || null;
  }

  /**
   * Returns true if view is registered as an on-demand lazy module
   */
  isLazyView(view) {
    return !!MODULE_REGISTRY[view];
  }

  /**
   * Dynamically imports and caches module definition
   * Re-uses inflight promise to avoid redundant concurrent network calls
   */
  async load(view) {
    if (this._loadedModules.has(view)) {
      return this._loadedModules.get(view);
    }

    if (this._loadingPromises.has(view)) {
      return this._loadingPromises.get(view);
    }

    const reg = MODULE_REGISTRY[view];
    if (!reg) {
      throw new Error(`Module registry definition for '${view}' not found.`);
    }

    const promise = (async () => {
      try {
        const mod = await import(reg.path);
        const resolved = {
          render: mod[reg.renderName],
          initEvents: mod[reg.initName],
          beforeRender: reg.beforeRender ? () => reg.beforeRender(mod) : null,
          module: mod
        };
        this._loadedModules.set(view, resolved);
        return resolved;
      } catch (err) {
        console.error(`[LazyLoader] Failed to load module '${view}' from ${reg.path}:`, err);
        throw err;
      } finally {
        this._loadingPromises.delete(view);
      }
    })();

    this._loadingPromises.set(view, promise);
    return promise;
  }

  /**
   * Prefetches module in background without blocking active view.
   * If immediate is true, initiates import directly (used on hover, touch, pointerdown).
   */
  prefetch(view, immediate = false) {
    if (!view || this.isLoaded(view) || !this.isLazyView(view)) {
      return;
    }

    if (immediate) {
      this.load(view).catch(() => {});
      return;
    }

    if (this._prefetched.has(view)) {
      return;
    }
    this._prefetched.add(view);

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          this.load(view).catch(() => {});
        }, { timeout: 1500 });
      } else {
        setTimeout(() => {
          this.load(view).catch(() => {});
        }, 50);
      }
    }
  }

  /**
   * Immediately pre-warms a list of views (e.g. all children of an expanded accordion)
   */
  prefetchGroup(views) {
    if (!Array.isArray(views)) return;
    views.forEach(v => {
      if (v && this.isLazyView(v) && !this.isLoaded(v)) {
        this.load(v).catch(() => {});
      }
    });
  }

  /**
   * Proactive background preloader:
   * Systematically warms up all ERP modules in background batches post-initialization.
   * Ensures that by the time the user explores ANY menu or section, it is already cached!
   */
  async preloadAllModules() {
    if (this._isPreloadingAll) return;
    this._isPreloadingAll = true;

    // High priority operational views to pre-warm first
    const priorityViews = [
      'users',
      'inventory',
      'transfers',
      'preventive-maintenance',
      'relocate',
      'needle-operations',
      'reports',
      'manpower',
      'storage',
      'qr-codes',
      'parts-trace',
      'machine-history',
      'tools-management',
      'master-data',
      'settings'
    ];

    const secondaryViews = Object.keys(MODULE_REGISTRY).filter(v => !priorityViews.includes(v));
    const allViewsToPreload = [...priorityViews, ...secondaryViews];

    for (const view of allViewsToPreload) {
      if (!this.isLoaded(view) && this.isLazyView(view)) {
        try {
          await this.load(view);
          // Yield to UI thread between module compiles
          await new Promise(resolve => setTimeout(resolve, 40));
        } catch (_) {}
      }
    }

    this._isPreloadingAll = false;
  }

  /**
   * Backwards compatible helper
   */
  prefetchCommonModules() {
    this.preloadAllModules();
  }

  /**
   * Returns an ultra-smooth, dark-mode skeleton placeholder while a chunk loads
   */
  renderSkeleton(view) {
    const reg = MODULE_REGISTRY[view] || { type: 'table' };
    const type = reg.type || 'table';

    return `
      <div class="page-view module-loading-skeleton" style="padding: 24px; animation: skeletonPulse 1.5s ease-in-out infinite;">
        <!-- Header Placeholder -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="width: 220px; height: 26px; background: rgba(255,255,255,0.08); border-radius: 6px; margin-bottom: 8px;"></div>
            <div style="width: 320px; height: 14px; background: rgba(255,255,255,0.04); border-radius: 4px;"></div>
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="width: 90px; height: 36px; background: rgba(255,255,255,0.06); border-radius: 6px;"></div>
            <div style="width: 120px; height: 36px; background: rgba(2, 132, 199, 0.25); border-radius: 6px;"></div>
          </div>
        </div>

        ${type === 'table' ? `
          <!-- Table Filter Bar Skeleton -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; gap: 12px; flex-wrap: wrap;">
            <div style="flex: 2; min-width: 200px; height: 36px; background: rgba(255,255,255,0.05); border-radius: 6px;"></div>
            <div style="flex: 1; min-width: 130px; height: 36px; background: rgba(255,255,255,0.05); border-radius: 6px;"></div>
            <div style="flex: 1; min-width: 130px; height: 36px; background: rgba(255,255,255,0.05); border-radius: 6px;"></div>
            <div style="width: 80px; height: 36px; background: rgba(255,255,255,0.05); border-radius: 6px;"></div>
          </div>

          <!-- Table Body Skeleton -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; overflow: hidden;">
            <div style="height: 44px; background: rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; padding: 0 16px; gap: 20px;">
              <div style="width: 30px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 3px;"></div>
              <div style="width: 140px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 3px;"></div>
              <div style="width: 100px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 3px;"></div>
              <div style="width: 110px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 3px;"></div>
              <div style="width: 80px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 3px;"></div>
              <div style="width: 90px; height: 14px; background: rgba(255,255,255,0.1); border-radius: 3px;"></div>
              <div style="flex: 1; height: 14px; background: rgba(255,255,255,0.05); border-radius: 3px;"></div>
            </div>
            ${Array.from({ length: 9 }).map((_, i) => `
              <div style="height: 48px; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; padding: 0 16px; gap: 20px; opacity: ${1 - i * 0.08};">
                <div style="width: 24px; height: 12px; background: rgba(255,255,255,0.06); border-radius: 3px;"></div>
                <div style="width: 130px; height: 12px; background: rgba(56, 189, 248, 0.15); border-radius: 3px;"></div>
                <div style="width: 90px; height: 12px; background: rgba(255,255,255,0.06); border-radius: 3px;"></div>
                <div style="width: 100px; height: 12px; background: rgba(255,255,255,0.06); border-radius: 3px;"></div>
                <div style="width: 70px; height: 18px; background: rgba(52, 211, 153, 0.15); border-radius: 12px;"></div>
                <div style="width: 80px; height: 12px; background: rgba(255,255,255,0.06); border-radius: 3px;"></div>
                <div style="flex: 1; height: 12px; background: rgba(255,255,255,0.03); border-radius: 3px;"></div>
              </div>
            `).join('')}
          </div>
        ` : `
          <!-- Card / Grid Skeleton -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
            ${Array.from({ length: 6 }).map((_, i) => `
              <div style="height: 180px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; opacity: ${1 - i * 0.1};">
                <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.08); border-radius: 10px; margin-bottom: 16px;"></div>
                <div style="width: 160px; height: 18px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 10px;"></div>
                <div style="width: 220px; height: 12px; background: rgba(255,255,255,0.04); border-radius: 4px; margin-bottom: 6px;"></div>
                <div style="width: 180px; height: 12px; background: rgba(255,255,255,0.04); border-radius: 4px;"></div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
      <style>
        @keyframes skeletonPulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      </style>
    `;
  }
}

export const moduleLoader = new ModuleLazyLoader();

if (typeof window !== 'undefined') {
  window.moduleLoader = moduleLoader;
}

export default moduleLoader;
