/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Central Reactive State Store & Pub/Sub Event Bus
 */

import { authService } from './services/authService.js?v=4.26.60';
import { storage } from './db/storage.js';
import { TABLE_NAMES } from './db/schema.js';

export const SYSTEM_DEFAULT_COLUMNS = [
  'sl', 'select', 'machineName', 'brand', 'model', 'serialNumber',
  'systemAssetId', 'manufacturing_serial', 'manufacturing_year', 'unit', 'floor', 'line',
  'running', 'usable_idle', 'repairable_idle', 'total_quantity', 'status',
  'service_date', 'purchase_date', 'installation_date', 'supplier_name',
  'country_of_origin', 'machine_capacity', 'remarks', 'actions'
];
export const SYSTEM_DEFAULT_FROZEN_COLUMNS = ['machineName', 'model', 'serialNumber'];

export function extractAdminDefaultsFromSettings(settingsObjOrArr) {
  let cols = null;
  let frozen = null;
  let updatedAt = null;
  if (!settingsObjOrArr) return { cols: null, frozen: null, updatedAt: null };

  if (Array.isArray(settingsObjOrArr)) {
    const colRow = settingsObjOrArr.find(r => r && (r.key === 'default_visible_columns' || r.id === 'default_visible_columns'));
    if (colRow && Array.isArray(colRow.value) && colRow.value.length > 0) cols = colRow.value;
    const fzRow = settingsObjOrArr.find(r => r && (r.key === 'default_frozen_columns' || r.id === 'default_frozen_columns'));
    if (fzRow && Array.isArray(fzRow.value) && fzRow.value.length > 0) frozen = fzRow.value;
    const tsRow = settingsObjOrArr.find(r => r && (r.key === 'admin_columns_updated_at' || r.id === 'admin_columns_updated_at'));
    if (tsRow && tsRow.value) updatedAt = tsRow.value;
  } else if (typeof settingsObjOrArr === 'object') {
    if (Array.isArray(settingsObjOrArr.default_visible_columns) && settingsObjOrArr.default_visible_columns.length > 0) {
      cols = settingsObjOrArr.default_visible_columns;
    }
    if (Array.isArray(settingsObjOrArr.default_frozen_columns) && settingsObjOrArr.default_frozen_columns.length > 0) {
      frozen = settingsObjOrArr.default_frozen_columns;
    }
    if (settingsObjOrArr.admin_columns_updated_at) {
      updatedAt = settingsObjOrArr.admin_columns_updated_at;
    }
  }
  return { cols, frozen, updatedAt };
}

class GlobalState {
  constructor() {
    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    const resolved = this.resolveActiveColumns(activeUserId);

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

        let activeAdminSlug = null;
        if (typeof localStorage !== 'undefined') {
          activeAdminSlug = localStorage.getItem('al_muslim_admin_login_slug');
          if (!activeAdminSlug) {
            try {
              const savedSettings = JSON.parse(localStorage.getItem('al_muslim_erp_settings') || '{}');
              activeAdminSlug = savedSettings.adminLoginSlug || savedSettings.admin_login_slug || null;
            } catch (_) {}
          }
        }
        activeAdminSlug = (activeAdminSlug || 'secure-admin-gateway').trim().toLowerCase();

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
      frozenColumns: resolved.frozenColumns,
      visibleColumns: new Set(resolved.visibleColumns),
      activeModal: null,
      activeMachineId: null,
      dashboardDateFilter: 'TODAY',
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

  set(key, value, options = {}) {
    this.state[key] = value;
    if (!options || !options.silent) {
      this.emit(`change:${key}`, value);
      this.emit('change', { [key]: value });
    }
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

  resolveActiveColumns(activeUserId = null) {
    const defaultCols = [...SYSTEM_DEFAULT_COLUMNS];
    const defaultFrozen = [...SYSTEM_DEFAULT_FROZEN_COLUMNS];

    // 1. Resolve Admin-configured Organization Defaults from Settings (Database / Storage / Local cache)
    let adminDefaultCols = null;
    let adminDefaultFrozen = null;
    let adminUpdatedAt = null;

    try {
      if (typeof storage !== 'undefined') {
        const s = (storage.getTable ? storage.getTable(TABLE_NAMES.SETTINGS) : null) || storage.data?.[TABLE_NAMES.SETTINGS];
        const extracted = extractAdminDefaultsFromSettings(s);
        if (extracted.cols) adminDefaultCols = extracted.cols;
        if (extracted.frozen) adminDefaultFrozen = extracted.frozen;
        if (extracted.updatedAt) adminUpdatedAt = extracted.updatedAt;
      }
      if (!adminDefaultCols && typeof localStorage !== 'undefined') {
        const rawSettings = localStorage.getItem('al_muslim_erp_settings');
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          const extracted = extractAdminDefaultsFromSettings(parsed);
          if (extracted.cols) adminDefaultCols = extracted.cols;
          if (extracted.frozen) adminDefaultFrozen = extracted.frozen;
          if (extracted.updatedAt && !adminUpdatedAt) adminUpdatedAt = extracted.updatedAt;
        }
      }
    } catch (_) {}

    // 2. Resolve User Customization (Keyed strictly by active user ID ONLY IF explicitly saved by user)
    const uid = activeUserId || (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null);
    let userCustomCols = null;
    let userCustomFrozen = null;

    if (uid && typeof localStorage !== 'undefined') {
      try {
        const hasCustom = localStorage.getItem('erp_user_has_custom_cols_' + uid) === 'true';
        if (hasCustom) {
          const userStored = localStorage.getItem('erp_user_visible_cols_' + uid);
          if (userStored) {
            const parsedUser = JSON.parse(userStored);
            if (Array.isArray(parsedUser) && parsedUser.length > 0) {
              userCustomCols = parsedUser;
            }
          }
        }
        const hasCustomFrozen = localStorage.getItem('erp_user_has_custom_frozen_' + uid) === 'true';
        if (hasCustomFrozen) {
          const uFrozen = localStorage.getItem('erp_user_frozen_cols_' + uid);
          if (uFrozen) {
            const p = JSON.parse(uFrozen);
            if (Array.isArray(p) && p.length > 0) userCustomFrozen = p;
          }
        }
      } catch (_) {}
    }

    // 3. Fallback Hierarchy:
    // User Custom (ONLY IF explicitly customized by user) > Admin Organization Default > System Default
    const finalCols = (userCustomCols && userCustomCols.length > 0)
      ? userCustomCols
      : (adminDefaultCols && adminDefaultCols.length > 0 ? adminDefaultCols : defaultCols);

    const finalFrozen = (userCustomFrozen && userCustomFrozen.length > 0)
      ? userCustomFrozen
      : (adminDefaultFrozen && adminDefaultFrozen.length > 0 ? adminDefaultFrozen : defaultFrozen);

    return {
      visibleColumns: finalCols,
      frozenColumns: finalFrozen,
      adminDefaultCols,
      adminDefaultFrozen,
      isUserCustomized: Boolean(userCustomCols && userCustomCols.length > 0)
    };
  }

  setVisibleColumns(colsArray, isGlobalAdmin = false, isUserCustom = true) {
    if (!Array.isArray(colsArray)) return;
    this.state.visibleColumns = new Set(colsArray);
    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (activeUserId) {
          localStorage.setItem('erp_user_visible_cols_' + activeUserId, JSON.stringify(colsArray));
          if (isUserCustom) {
            localStorage.setItem('erp_user_has_custom_cols_' + activeUserId, 'true');
            localStorage.setItem('erp_user_custom_cols_updated_at_' + activeUserId, new Date().toISOString());
          }
        }
      }
    } catch (e) {}

    if (isGlobalAdmin) {
      this.saveAdminDefaultColumns(colsArray, this.state.frozenColumns).catch(err => {
        console.warn('Failed to save global default columns:', err);
      });
      return;
    }

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

    const colsArray = Array.from(this.state.visibleColumns);
    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (activeUserId) {
          localStorage.setItem('erp_user_visible_cols_' + activeUserId, JSON.stringify(colsArray));
          localStorage.setItem('erp_user_has_custom_cols_' + activeUserId, 'true');
          localStorage.setItem('erp_user_custom_cols_updated_at_' + activeUserId, new Date().toISOString());
        }
      }
    } catch (e) {}

    this.emit('columns:changed', colsArray);
  }

  setFrozenColumns(colsArray, isGlobalAdmin = false, isUserCustom = true) {
    if (!Array.isArray(colsArray)) return;
    this.state.frozenColumns = colsArray;
    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (activeUserId) {
          localStorage.setItem('erp_user_frozen_cols_' + activeUserId, JSON.stringify(colsArray));
          if (isUserCustom) {
            localStorage.setItem('erp_user_has_custom_frozen_' + activeUserId, 'true');
          }
        }
      }
    } catch (e) {}

    if (isGlobalAdmin) {
      const currentCols = Array.from(this.state.visibleColumns);
      this.saveAdminDefaultColumns(currentCols, colsArray).catch(err => {
        console.warn('Failed to save global default frozen columns:', err);
      });
      return;
    }

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
    this.setFrozenColumns(current, false, true);
  }

  isColumnFrozen(colKey) {
    return Array.isArray(this.state.frozenColumns) && this.state.frozenColumns.includes(colKey);
  }

  resetFrozenColumns() {
    const defaultFrozenCols = ['machineName', 'model', 'serialNumber'];
    this.setFrozenColumns(defaultFrozenCols, false, true);
  }

  resetVisibleColumnsToAdminDefault() {
    return this.reloadColumnsFromSettings(true);
  }

  reloadColumnsFromSettings(forceReset = false) {
    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    if (forceReset && activeUserId && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('erp_user_has_custom_cols_' + activeUserId);
        localStorage.removeItem('erp_user_visible_cols_' + activeUserId);
        localStorage.removeItem('erp_user_has_custom_frozen_' + activeUserId);
        localStorage.removeItem('erp_user_frozen_cols_' + activeUserId);
        localStorage.removeItem('erp_user_custom_cols_updated_at_' + activeUserId);
      } catch (_) {}
    }

    const resolved = this.resolveActiveColumns(activeUserId);
    const newColsArray = resolved.visibleColumns;
    const newFrozenArray = resolved.frozenColumns;

    const currCols = Array.from(this.state.visibleColumns || []);
    const currFrozen = this.state.frozenColumns || [];

    const colsEqual = currCols.length === newColsArray.length && currCols.every((c, i) => c === newColsArray[i]);
    const frozenEqual = currFrozen.length === newFrozenArray.length && currFrozen.every((f, i) => f === newFrozenArray[i]);

    this.state.visibleColumns = new Set(newColsArray);
    this.state.frozenColumns = newFrozenArray;

    if (!colsEqual || !frozenEqual || forceReset) {
      this.emit('frozenColumns:changed', newFrozenArray);
      this.emit('columns:changed', newColsArray);
    }
    return resolved;
  }

  async saveAdminDefaultColumns(colsArray, frozenArray) {
    if (!Array.isArray(colsArray)) return false;
    const finalCols = [...colsArray];
    if (!finalCols.includes('machineName')) finalCols.push('machineName');
    if (!finalCols.includes('actions')) finalCols.push('actions');
    if (!finalCols.includes('sl')) finalCols.unshift('sl');
    if (!finalCols.includes('select')) finalCols.splice(1, 0, 'select');

    const finalFrozen = Array.isArray(frozenArray) ? frozenArray : ['machineName', 'model', 'serialNumber'];

    // 1. Immediately apply to in-memory state
    this.state.visibleColumns = new Set(finalCols);
    this.state.frozenColumns = finalFrozen;

    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;

    // 2. Clear any personal custom column override on current admin so admin view stays identical to default
    if (typeof localStorage !== 'undefined') {
      try {
        if (activeUserId) {
          localStorage.removeItem('erp_user_has_custom_cols_' + activeUserId);
          localStorage.removeItem('erp_user_visible_cols_' + activeUserId);
          localStorage.removeItem('erp_user_has_custom_frozen_' + activeUserId);
          localStorage.removeItem('erp_user_frozen_cols_' + activeUserId);
          localStorage.removeItem('erp_user_custom_cols_updated_at_' + activeUserId);
        }
        localStorage.removeItem('erp_visible_columns_v4');
        localStorage.removeItem('erp_visible_columns_v3');
        localStorage.removeItem('erp_frozen_columns_v2');
        localStorage.removeItem('erp_frozen_columns_v1');
      } catch (_) {}
    }

    // 3. Atomically update settings in memory, localStorage, and MySQL/PostgreSQL
    try {
      let settings = (typeof storage !== 'undefined' && storage.getTable) ? storage.getTable(TABLE_NAMES.SETTINGS) : {};
      const now = new Date().toISOString();
      if (Array.isArray(settings)) {
        let colRow = settings.find(r => r && (r.key === 'default_visible_columns' || r.id === 'default_visible_columns'));
        if (colRow) colRow.value = finalCols;
        else settings.push({ id: 'default_visible_columns', key: 'default_visible_columns', value: finalCols });

        let fzRow = settings.find(r => r && (r.key === 'default_frozen_columns' || r.id === 'default_frozen_columns'));
        if (fzRow) fzRow.value = finalFrozen;
        else settings.push({ id: 'default_frozen_columns', key: 'default_frozen_columns', value: finalFrozen });

        let tsRow = settings.find(r => r && (r.key === 'admin_columns_updated_at' || r.id === 'admin_columns_updated_at'));
        if (tsRow) tsRow.value = now;
        else settings.push({ id: 'admin_columns_updated_at', key: 'admin_columns_updated_at', value: now });
      } else {
        if (!settings || typeof settings !== 'object') settings = {};
        settings.default_visible_columns = finalCols;
        settings.default_frozen_columns = finalFrozen;
        settings.admin_columns_updated_at = now;
      }

      if (typeof storage !== 'undefined') {
        storage.data[TABLE_NAMES.SETTINGS] = settings;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('al_muslim_erp_settings', JSON.stringify(settings));
        localStorage.setItem('erp_admin_columns_version', String(Date.now()));
      }

      // Persist to IndexedDB & MySQL Primary Cloud
      if (typeof storage !== 'undefined' && storage.saveTable) {
        await storage.saveTable(TABLE_NAMES.SETTINGS, settings, true);
      }
    } catch (e) {
      console.error('Failed to save global default columns to database:', e);
      throw e;
    }

    // 4. Broadcast changes to UI
    this.emit('frozenColumns:changed', finalFrozen);
    this.emit('columns:changed', finalCols);
    return true;
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

  // Real-time synchronization listeners for multi-device & cloud hydration
  window.addEventListener('erp:storage-updated', () => {
    state.reloadColumnsFromSettings();
  });
  window.addEventListener('erp:critical-data-ready', () => {
    state.reloadColumnsFromSettings();
  });
  window.addEventListener('erp:user-changed', (e) => {
    state.reloadColumnsFromSettings(false);
  });
}
