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
      'unit', 'floor', 'line', 'running', 'usable_idle', 'repairable_idle',
      'total_quantity', 'status', 'actions'
    ];

    let savedCols = null;
    try {
      const stored = localStorage.getItem('erp_visible_columns_v3');
      if (stored) savedCols = JSON.parse(stored);
    } catch (e) {}

    const defaultFrozenCols = ['machineName', 'model', 'serialNumber'];
    let savedFrozenCols = null;
    try {
      const storedFrozen = localStorage.getItem('erp_frozen_columns_v1');
      if (storedFrozen) savedFrozenCols = JSON.parse(storedFrozen);
    } catch (e) {}

    const activeUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    let initialView = 'home';
    try {
      if (typeof window !== 'undefined' && window.location && window.location.hash) {
        const h = window.location.hash.replace(/^#/, '').trim();
        if (h && h !== 'home') {
          if (!activeUserId && h !== 'login') {
            initialView = 'login';
          } else {
            initialView = h;
          }
        }
      }
    } catch (_) {}

    this.state = {
      currentView: initialView, // 'dashboard', 'inventory', 'master-data', 'custom-fields', 'approvals', 'users', 'reports', 'audit-logs', 'settings'
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
    this.state.filters = {
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
    };
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

  toggleColumnVisibility(colId) {
    if (this.state.visibleColumns.has(colId)) {
      this.state.visibleColumns.delete(colId);
    } else {
      this.state.visibleColumns.add(colId);
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

export const state = new GlobalState();
if (typeof window !== 'undefined') {
  window.state = state;
}
