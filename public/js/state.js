/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Central Reactive State Store & Pub/Sub Event Bus
 */

import { authService } from './services/authService.js';
import { storage } from './db/storage.js';
import { TABLE_NAMES } from './db/schema.js';

class GlobalState {
  constructor() {
    const defaultCols = [
      'sl', 'select', 'machineName', 'brand', 'model', 'serialNumber',
      'systemAssetId', 'manufacturing_serial', 'unit', 'floor', 'line', 'running',
      'usable_idle', 'repairable_idle', 'total_quantity', 'status',
      'service_date', 'remarks', 'actions'
    ];

    let savedCols = null;
    try {
      const stored = localStorage.getItem('erp_visible_columns_v3');
      if (stored) {
        savedCols = JSON.parse(stored);
        if (Array.isArray(savedCols) && !savedCols.includes('manufacturing_serial') && !savedCols.includes('manufacturingSerial')) {
          const serialIdx = savedCols.indexOf('serialNumber');
          if (serialIdx >= 0) savedCols.splice(serialIdx + 1, 0, 'manufacturing_serial');
          else savedCols.push('manufacturing_serial');
        }
        if (Array.isArray(savedCols) && !savedCols.includes('systemAssetId')) {
          const serialIdx = savedCols.indexOf('serialNumber');
          if (serialIdx >= 0) savedCols.splice(serialIdx + 1, 0, 'systemAssetId');
          else savedCols.push('systemAssetId');
        }
      }
    } catch (e) {}

    const defaultFrozenCols = ['machineName', 'model', 'serialNumber'];
    let savedFrozenCols = null;
    try {
      const storedFrozen = localStorage.getItem('erp_frozen_columns_v1');
      if (storedFrozen) savedFrozenCols = JSON.parse(storedFrozen);
    } catch (e) {}

    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    let initialView = 'home';
    let initialSubtab = null;
    try {
      if (typeof window !== 'undefined' && window.location) {
        // 1. Check pathname (e.g. /inventory, /ERP/transfers, /reports/transfers)
        let pathname = window.location.pathname || '';
        if (pathname.toLowerCase().startsWith('/erp')) {
          pathname = pathname.slice(4);
        }
        let cleanPath = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();

        // 2. Check query params (?p=/inventory or ?p=/reports/transfers from 404 fallback or ?tab=...)
        const searchParams = new URLSearchParams(window.location.search || '');
        if (searchParams.has('p')) {
          cleanPath = decodeURIComponent(searchParams.get('p') || '').replace(/^\/+|\/+$/g, '').toLowerCase();
        }
        if (searchParams.has('tab')) {
          initialSubtab = searchParams.get('tab');
        }

        // 3. Fallback to hash if pathname is empty or index.html
        if (!cleanPath || cleanPath === 'index.html') {
          const h = (window.location.hash || '').replace(/^[#\/]+/, '').trim().toLowerCase();
          if (h) cleanPath = h;
        }

        const segments = cleanPath ? cleanPath.split('/').filter(Boolean) : [];
        const routeKey = segments[0] || '';
        if (segments[1] && !initialSubtab) {
          initialSubtab = segments[1];
        }

        const activeAdminSlug = ((typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_admin_login_slug') : null) || 'secure-admin-gateway').trim().toLowerCase();

        const routeMap = {
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
          'secure-admin-gateway': 'admin-login',
          [activeAdminSlug]: 'admin-login'
        };

        let resolvedView = routeMap[routeKey] || (routeKey ? routeKey : 'home');
        if (routeKey === activeAdminSlug || routeKey === 'secure-admin-gateway') {
          resolvedView = 'admin-login';
        }

        if (resolvedView && resolvedView !== 'home') {
          if (!activeUserId && resolvedView !== 'login' && resolvedView !== 'admin-login') {
            initialView = 'login';
            try {
              const redirectPath = initialSubtab ? `${resolvedView}/${initialSubtab}` : resolvedView;
              sessionStorage.setItem('al_muslim_post_login_redirect', redirectPath);
            } catch (_) {}
          } else {
            initialView = resolvedView;
          }
        }
      }
    } catch (_) {}

    // Normalize initial subtabs
    const userSlugMap = {
      'accounts': 'ACCOUNTS', 'permissions': 'PERMISSIONS', 'bulk-assign': 'BULK_ASSIGN',
      'passwords': 'PASSWORD_MGMT', 'password-mgmt': 'PASSWORD_MGMT', 'export': 'EXPORT_ACCOUNTS',
      'logs': 'ACTIVITY_LOGS', 'presets': 'PRESETS'
    };
    const reportSlugMap = {
      'machine': 'machines', 'machines': 'machines', 'transfer': 'transfers', 'transfers': 'transfers',
      'spare': 'spareparts', 'spare-parts': 'spareparts', 'spareparts': 'spareparts',
      'etlab': 'etlab', 'et-lab': 'etlab', 'pm': 'preventive', 'preventive': 'preventive', 'export': 'export'
    };

    let resolvedReportTab = 'machines';
    if (initialView === 'reports' && initialSubtab) {
      resolvedReportTab = reportSlugMap[initialSubtab.toLowerCase()] || initialSubtab;
    }

    let resolvedUserTab = 'ACCOUNTS';
    if (initialView === 'users' && initialSubtab) {
      resolvedUserTab = userSlugMap[initialSubtab.toLowerCase()] || initialSubtab.toUpperCase();
    }

    this.state = {
      currentView: initialView,
      reportActiveTab: resolvedReportTab,
      manpowerActiveTab: (initialView === 'manpower' && initialSubtab) ? initialSubtab : 'active',
      pmActiveTab: (initialView === 'preventive-maintenance' && initialSubtab) ? initialSubtab : 'dashboard',
      masterDataActiveTab: (initialView === 'master-data' && initialSubtab) ? initialSubtab : 'fast-entry',
      userAccessActiveTab: resolvedUserTab,
      toolsActiveTab: (initialView === 'tools-management' && initialSubtab) ? initialSubtab : 'tools-add',
      etLabActiveTab: (initialView === 'et-lab' && initialSubtab) ? initialSubtab : (initialView === 'spare-parts' ? 'spare-parts' : 'boards'),
      excelActiveTab: (initialView === 'excel-manager' && initialSubtab) ? initialSubtab : 'structure',
      homeManagerActiveTab: (initialView === 'homepage-manager' && initialSubtab) ? initialSubtab : 'sections',
      relocateActiveTab: (initialView === 'relocate' && initialSubtab) ? initialSubtab : 'scan',
      partsTraceActiveTab: (initialView === 'parts-trace' && initialSubtab) ? initialSubtab : 'dashboard',
      historyActiveTab: (initialView === 'machine-history' && initialSubtab) ? initialSubtab : 'timeline',
      qrStudioTab: (initialView === 'qr-codes' && initialSubtab) ? initialSubtab : 'machine',
      showCrossFloorIdle: false, // Explicit toggle for viewing cross-floor idle machines
      filters: {
        groupId: '',
        unitId: '',
        floorId: '',
        lineId: '',
        machineNameId: '',
        brandId: '',
        modelId: '',
        status: 'ALL',
        search: '',
        customFilters: {},
        page: 1,
        limit: 50,
        sortField: 'sl',
        sortOrder: 'asc'
      },
      selectedMachineIds: new Set(),
      frozenColumns: savedFrozenCols && Array.isArray(savedFrozenCols) ? savedFrozenCols : defaultFrozenCols,
      visibleColumns: new Set(savedCols && Array.isArray(savedCols) && savedCols.length > 0 ? savedCols : defaultCols),
      activeModal: null,
      activeMachineId: null,
      theme: 'dark'
    };

    this.listeners = new Map();
  }

  getDefaultScopeFilters() {
    let defFloor = '';
    let defUnit = '';
    let defLine = '';
    try {
      if (typeof authService !== 'undefined') {
        const u = authService.getCurrentUser();
        if (u && !authService.isSuperAdmin(u) && u.assignedScope && !u.assignedScope.allGroups) {
          if (Array.isArray(u.assignedScope.floorIds) && u.assignedScope.floorIds.length === 1) {
            defFloor = u.assignedScope.floorIds[0];
          }
          if (Array.isArray(u.assignedScope.unitIds) && u.assignedScope.unitIds.length === 1) {
            defUnit = u.assignedScope.unitIds[0];
          }
          if (Array.isArray(u.assignedScope.lineIds) && u.assignedScope.lineIds.length === 1) {
            defLine = u.assignedScope.lineIds[0];
          }
        }
      }
    } catch (_) {}
    return { floorId: defFloor, unitId: defUnit, lineId: defLine };
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this.emit(`change:${key}`, value);
    this.emit('change', { [key]: value });
  }

  updateFilters(partialFilters) {
    this.state.filters = {
      ...this.state.filters,
      ...partialFilters
    };
    this.emit('filters:changed', this.state.filters);
  }

  resetFilters() {
    const scopeDefaults = this.getDefaultScopeFilters();
    this.state.showCrossFloorIdle = false;
    this.state.filters = {
      groupId: '',
      unitId: scopeDefaults.unitId || '',
      floorId: scopeDefaults.floorId || '',
      lineId: scopeDefaults.lineId || '',
      machineNameId: '',
      brandId: '',
      modelId: '',
      status: 'ALL',
      search: '',
      customFilters: {},
      page: 1,
      limit: 50,
      sortField: 'sl',
      sortOrder: 'asc'
    };
    this.emit('change:showCrossFloorIdle', false);
    this.emit('filters:changed', this.state.filters);
  }

  toggleSelectMachine(id) {
    if (this.state.selectedMachineIds.has(id)) {
      this.state.selectedMachineIds.delete(id);
    } else {
      this.state.selectedMachineIds.add(id);
    }
    this.emit('selection:changed', Array.from(this.state.selectedMachineIds));
  }

  selectAllMachines(ids) {
    this.state.selectedMachineIds = new Set(ids);
    this.emit('selection:changed', Array.from(this.state.selectedMachineIds));
  }

  clearSelection() {
    this.state.selectedMachineIds.clear();
    this.emit('selection:changed', []);
  }

  setVisibleColumns(colsArray) {
    if (!Array.isArray(colsArray)) return;
    this.state.visibleColumns = new Set(colsArray);
    try {
      localStorage.setItem('erp_visible_columns_v3', JSON.stringify(colsArray));
    } catch (e) {}
    this.emit('columns:changed', colsArray);
  }

  toggleColumnVisibility(colId) {
    const aliases = {
      machineName: 'machine_name',
      brand: 'machine_brand',
      model: 'machine_model',
      serialNumber: 'machine_serial',
      unit: 'unit_factory',
      status: 'machine_status',
      service_date: 'last_service_date',
      manufacturing_serial: 'manufacturingSerial'
    };
    const reverseAliases = Object.fromEntries(Object.entries(aliases).map(([k, v]) => [v, k]));
    const partner = aliases[colId] || reverseAliases[colId] || null;

    const isVisible = this.state.visibleColumns.has(colId) || (partner && this.state.visibleColumns.has(partner));
    if (isVisible) {
      this.state.visibleColumns.delete(colId);
      if (partner) this.state.visibleColumns.delete(partner);
    } else {
      this.state.visibleColumns.add(colId);
      if (partner) this.state.visibleColumns.add(partner);
    }
    try {
      localStorage.setItem('erp_visible_columns_v3', JSON.stringify(Array.from(this.state.visibleColumns)));
    } catch (e) {}
    this.emit('columns:changed', Array.from(this.state.visibleColumns));
  }

  setFrozenColumns(colsArray) {
    if (!Array.isArray(colsArray)) return;
    this.state.frozenColumns = colsArray;
    try {
      localStorage.setItem('erp_frozen_columns_v1', JSON.stringify(colsArray));
    } catch (e) {}
    this.emit('frozenColumns:changed', colsArray);
    this.emit('columns:changed', Array.from(this.state.visibleColumns));
  }

  toggleFreezeColumn(colKey) {
    let current = Array.isArray(this.state.frozenColumns) ? [...this.state.frozenColumns] : ['machineName', 'model', 'serialNumber'];
    const idx = current.indexOf(colKey);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(colKey);
    }
    this.setFrozenColumns(current);
  }

  isColumnFrozen(colKey) {
    return Array.isArray(this.state.frozenColumns) && this.state.frozenColumns.includes(colKey);
  }

  resetFrozenColumns() {
    const defaultFrozenCols = ['machineName', 'model', 'serialNumber'];
    this.setFrozenColumns(defaultFrozenCols);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, list);
  }

  emit(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      });
    }
  }
}

export const state = (typeof window !== 'undefined' && window.__erpGlobalState)
  ? window.__erpGlobalState
  : new GlobalState();

if (typeof window !== 'undefined') {
  window.__erpGlobalState = state;
  window.state = state;
}
