/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * High-Performance Storage Engine with Fast In-Memory Indexes & Persistence
 */

import { TABLE_NAMES, DEFAULT_SETTINGS, SCHEMA_VERSION, DEFAULT_PERMISSION_PRESETS } from './schema.js';
export { TABLE_NAMES, SCHEMA_VERSION };
import { syncManager } from './syncManager.js';
import { idbCache } from './idbCache.js';

const STORAGE_KEY_PREFIX = 'al_muslim_erp_';

function getApiEndpoint(path) {
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    return 'http://localhost:3030' + path;
  }
  return path;
}

// Canonical map to normalize legacy machine name IDs
const DUPLICATE_ID_MAP = {
  'mac-1788870296741-262': 'mn-1788869247076-glop', // Double Needle Auto -> Double Needle Machine
  'mac-1788870296741-927': 'mn-1788869247118-qyw5', // Over Lock Mechine -> Over Lock Machine
  'mac-1788870296741-484': 'mn-1788869247492-lklr', // Zipper Joint -> Zipper Joint Machine
  'mac-1788870296741-259': 'mn-1788869247176-2gzf', // Multi Needle Chain Stitch -> Multi Needle Chain Stitch Machine
  'mac-1788870296741-196': 'mn-1788869247141-kx1a', // Chain Stitch -> Chain Stitch Machine
  'mac-1788870296741-404': 'mn-1788869247061-9dsy', // Vertical Bedoly -> Vertical Machine
  'mac-1788870296742-5':   'mn-1788869247572-yzvd', // Sleeve Joint -> Sleeve Joint Machine
  'mac-1788870296742-799': 'mn-1788869248254-ez5p', // Snap Button Hydrolic -> Snap Button Machine
  'mac-1788870296742-855': 'mn-1788869247076-glop', // Double Needle Manual -> Double Needle Machine
  'mac-1788870296742-252': 'mn-1788869247100-2uyc', // Feed of The Arm-Brother -> Feed of The Arm Machine
  'mac-1788870296742-285': 'mn-1788869247100-2uyc', // Feed of The Arm-Narrow -> Feed of The Arm Machine
  'mac-1788870296742-208': 'mn-1788869247738-cne3', // Loop Attach -> Loop Attach Machine
  'mac-1788870296742-973': 'mn-1788869247100-2uyc', // Feed of The Arm-AGM -> Feed of The Arm Machine
  'mac-1788870296742-664': 'mn-1788869247100-2uyc', // Feed of The Arm -> Feed of The Arm Machine
  'mac-1788870296742-107': 'mn-1788869247243-7wlt', // Botton Hole -> Button Hole Machine
  'mac-1788870296741-340': 'mn-1788869247205-his3'  // Bartack -> Bar tak Machine
};
const duplicateIdMap = DUPLICATE_ID_MAP;

export const SERIAL_PREFIX_MAP = {
  'C/C/M': 'Cloth Cutting Machine',
  'P/C/Drill': 'Power Cloth Drill Machine',
  'T/S': 'Thread Sucker',
  'F/M': 'Fusing Machine',
  'R/C/M': 'Rib Cutting Machine',
  'E/C/M': 'End Cutter Machine',
  'F/R/M': 'Fabric Relax Machine',
  'B/K/M': 'Band Knife Cutting Machine',
  'Bnd/K/C/M': 'Band Knife Cutting Machine',
  'S/M': 'Spreading Machine',
  'Spd/M': 'Spreading Machine',
  'P/M': 'Plane Machine',
  'O/L': 'Over Lock Machine',
  'F/L': 'Flat Lock Machine',
  'D/N': 'Double Needle Machine',
  'B/T': 'Bar tak Machine',
  'B/H': 'Button Hole Machine',
  'B/S': 'Button Stitch Machine',
  'F/A': 'Feed of The Arm Machine',
  'F/O/A': 'Feed of The Arm Machine',
  'K/S': 'Multi Needle Chain Stitch Machine',
  'C/S': 'Chain Stitch Machine',
  'S/B': 'Snap Button Machine',
  'SNAP': 'Snap Button Machine',
  'Y.K.K': 'Snap Button Machine',
  'S/S': 'Safety Stitch M/C',
  'V/T': 'Edge Cutter Machine (Vertical)',
  'Z/Z': 'Zig Zag Machine',
  'B/Ham': 'Bottom Hamming Chain Stitch Machine',
  'P/A': 'Pocket Attach Machine',
  'P/R': 'Pocket Rolling Machine',
  'P/F': 'Pocket Facing Machine',
  'Pls/S/A': 'Plastic Staple Attache Machine',
  'Pls/St': 'Plastic Staple Attache Machine',
  'Wr/Kt': 'Wrapping & Knotting Machine',
  'N/D': 'Needle Detector',
  'APW': 'Automatic Pocket Welting',
  'Tem': 'Single Head Template',
  'Tem/Ct': 'Template Plastic Cutter Machine',
  'Els/Jt': 'Double Head Auto Elastic Joint Sewing Machine',
  'Bln/St': 'Ham  Blind Stitch Machine',
  'F/D/Fill': 'Fake Down Filling Machine',
  'L/A': 'Pattern Machine',
  'L/Ct': 'Laser Cut APW Machine',
  'V/A': 'Lable Attach Machine (Velcro)',
  'Z/Jt': 'Zipper Joint Machine',
  'Zi/Jn': 'Zipper Joint Machine'
};

/**
 * CloudSaveError — thrown when a Firestore write was attempted but HTTP 200 was NOT confirmed.
 * UI components catch this to keep modals open and show error toast without showing false success.
 */
export class CloudSaveError extends Error {
  constructor(message = 'Cloud Save Failed: Database write was not confirmed.') {
    super(message);
    this.name = 'CloudSaveError';
  }
}

/**
 * Critical Tables required for initial page shell, auth, and primary dashboard/inventory view
 * Loaded in parallel immediately on startup (<400ms target)
 */
export const CRITICAL_TABLES = [
  TABLE_NAMES.MACHINES,
  TABLE_NAMES.UNITS,
  TABLE_NAMES.FLOORS,
  TABLE_NAMES.LINES,
  TABLE_NAMES.GROUPS,
  TABLE_NAMES.MACHINE_NAMES,
  TABLE_NAMES.BRANDS,
  TABLE_NAMES.MODELS,
  TABLE_NAMES.CATEGORIES,
  TABLE_NAMES.SETTINGS,
  TABLE_NAMES.USERS,
  TABLE_NAMES.ROLES,
  TABLE_NAMES.PERMISSION_PRESETS,
  TABLE_NAMES.CUSTOM_FIELDS,
  TABLE_NAMES.HOMEPAGE_CONFIG
];

/**
 * Secondary Tables deferred to background idle streaming or loaded on-demand
 */
export const SECONDARY_TABLES = [
  TABLE_NAMES.PREVENTIVE_MAINTENANCE,
  TABLE_NAMES.PREVENTIVE_CONFIG,
  TABLE_NAMES.MACHINE_HISTORY,
  TABLE_NAMES.AUDIT_LOGS,
  TABLE_NAMES.SPARE_PARTS,
  TABLE_NAMES.SPARE_PARTS_MASTER,
  TABLE_NAMES.TRANSFERS,
  TABLE_NAMES.TRANSFER_REQUESTS,
  TABLE_NAMES.TRANSFER_WORKFLOWS,
  TABLE_NAMES.APPROVAL_REQUESTS,
  TABLE_NAMES.TOOLS_MASTER,
  TABLE_NAMES.ACCESSORIES_MASTER,
  TABLE_NAMES.TOOL_ALLOCATIONS,
  TABLE_NAMES.TOOL_CHANGE_HISTORY,
  TABLE_NAMES.EMPLOYEES,
  TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS,
  TABLE_NAMES.EMPLOYEE_TRANSFERS,
  TABLE_NAMES.EMPLOYEE_LEAVES,
  TABLE_NAMES.ET_BOARDS,
  TABLE_NAMES.ET_BOARD_HISTORY,
  TABLE_NAMES.ET_COMPANIES,
  TABLE_NAMES.ET_CATEGORIES,
  TABLE_NAMES.ET_TECHNICIANS,
  TABLE_NAMES.STORAGE_MASTER,
  TABLE_NAMES.STORAGE_CORRECTION_RULES,
  TABLE_NAMES.RELOCATE_SESSIONS,
  TABLE_NAMES.RELOCATION_HISTORY,
  TABLE_NAMES.RELOCATION_APPROVALS,
  TABLE_NAMES.PARTS_TRACE_ISSUES,
  TABLE_NAMES.PARTS_TRACE_PDFS,
  TABLE_NAMES.NOTIFICATIONS,
  TABLE_NAMES.DOCUMENTS,
  TABLE_NAMES.EXCEL_STRUCTURES,
  TABLE_NAMES.IMPORT_HISTORY
];

/**
 * Mapping of view IDs to required tables for on-demand module loading
 */
export const MODULE_TABLE_MAP = {
  'dashboard': [TABLE_NAMES.MACHINES, TABLE_NAMES.SETTINGS],
  'inventory': [TABLE_NAMES.MACHINES, TABLE_NAMES.CUSTOM_FIELDS, TABLE_NAMES.UNITS, TABLE_NAMES.FLOORS, TABLE_NAMES.LINES],
  'preventive-maintenance': [TABLE_NAMES.PREVENTIVE_MAINTENANCE, TABLE_NAMES.PREVENTIVE_CONFIG, TABLE_NAMES.MACHINES],
  'machine-history': [TABLE_NAMES.MACHINE_HISTORY, TABLE_NAMES.MACHINES],
  'spare-parts': [TABLE_NAMES.SPARE_PARTS, TABLE_NAMES.SPARE_PARTS_MASTER],
  'transfers': [TABLE_NAMES.TRANSFERS, TABLE_NAMES.TRANSFER_REQUESTS, TABLE_NAMES.MACHINES],
  'transfer-workflows': [TABLE_NAMES.TRANSFER_WORKFLOWS, TABLE_NAMES.TRANSFERS, TABLE_NAMES.MACHINES],
  'tools-management': [TABLE_NAMES.TOOLS_MASTER, TABLE_NAMES.ACCESSORIES_MASTER, TABLE_NAMES.TOOL_ALLOCATIONS, TABLE_NAMES.TOOL_CHANGE_HISTORY],
  'manpower': [TABLE_NAMES.EMPLOYEES, TABLE_NAMES.EMPLOYEE_LEAVES, TABLE_NAMES.EMPLOYEE_TRANSFERS, TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS],
  'et-lab': [TABLE_NAMES.ET_BOARDS, TABLE_NAMES.ET_BOARD_HISTORY, TABLE_NAMES.ET_COMPANIES, TABLE_NAMES.ET_CATEGORIES, TABLE_NAMES.ET_TECHNICIANS],
  'storage': [TABLE_NAMES.STORAGE_MASTER, TABLE_NAMES.STORAGE_CORRECTION_RULES],
  'relocate': [TABLE_NAMES.RELOCATE_SESSIONS, TABLE_NAMES.RELOCATION_HISTORY, TABLE_NAMES.RELOCATION_APPROVALS, TABLE_NAMES.MACHINES],
  'parts-trace': [TABLE_NAMES.PARTS_TRACE_ISSUES, TABLE_NAMES.PARTS_TRACE_PDFS, TABLE_NAMES.SPARE_PARTS_MASTER, TABLE_NAMES.MACHINES, TABLE_NAMES.EMPLOYEES],
  'reports': [TABLE_NAMES.MACHINES, TABLE_NAMES.PREVENTIVE_MAINTENANCE, TABLE_NAMES.MACHINE_HISTORY, TABLE_NAMES.SPARE_PARTS, TABLE_NAMES.TRANSFERS, TABLE_NAMES.TRANSFER_REQUESTS],
  'qr-codes': [TABLE_NAMES.MACHINES],
  'resource-library': [TABLE_NAMES.DOCUMENTS],
  'audit-logs': [TABLE_NAMES.AUDIT_LOGS],
  'users': [TABLE_NAMES.USERS, TABLE_NAMES.ROLES, TABLE_NAMES.PERMISSION_PRESETS],
  'settings': [TABLE_NAMES.SETTINGS],
  'homepage-manager': [TABLE_NAMES.HOMEPAGE_CONFIG]
};

class StorageEngine {
  constructor() {
    this.data = {};
    this.indexes = {
      machineBySerial: new Map(),
      machineByAssetId: new Map(),
      machinesByLine: new Map(),
      machinesByUnit: new Map(),
      machinesByFloor: new Map(),
      machinesByName: new Map(),
      machinesByBrand: new Map(),
      machinesByModel: new Map(),
      machinesByStatus: new Map()
    };
    this.isInitialized = false;
    this._isPersisting = false;
    this._hasPendingPersist = false;
    this._unloadRegistered = false;
    this._suppressServerPersist = false;
    this._isCloudConnected = true;
    this._cloudPersistDebounces = {};
    this.lastTableUpdates = {};
    this._remoteSyncTimer = null;
    this._isCheckingRemote = false;
    // Map<tableName, serverUpdateTime> — tracks the server-confirmed updateTime for each table.
    // Used for clock-skew-safe remote change detection without relying on local clock.
    this.syncedDocVersions = new Map();
    this._hasCriticalSyncCompleted = false;
    this._hasInitialSyncCompleted = false;
    this._hasFullSecondarySyncCompleted = false;
    this._isDeferredSyncRunning = false;
    this._loadedSecondaryTables = new Set();
    this._realtimeListenerStarted = false;
    this._hydrationPromise = null;
    this._tableIdMaps = {};
  }

  init() {
    if (this.isInitialized) return;

    try {
      this._suppressServerPersist = true;
      this.loadFromStorage();

      // Only seed initial factory data if local cache has no records at all AND never previously initialized
      const hasSeededBefore = typeof localStorage !== 'undefined' ? !!localStorage.getItem('al_muslim_initial_seeded') : true;
      const isCompletelyEmpty = (!this.data[TABLE_NAMES.MACHINES] || this.data[TABLE_NAMES.MACHINES].length === 0) &&
                                (!this.data[TABLE_NAMES.USERS] || this.data[TABLE_NAMES.USERS].length === 0);

      if (isCompletelyEmpty && !hasSeededBefore) {
        console.log('[Database Store] 🔄 Local cache empty. Seeding initial factory dataset...');
        this.resetToInitialData(false).catch(e => console.warn('Reset seed notice:', e));
        try { if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_initial_seeded', '1'); } catch (_) {}
      }

      this.ensureMachineSystemAssetIds();
      this.rebuildAllIndexes();
      this.isInitialized = true;
      // Keep this._suppressServerPersist = true until syncWithServerDatabase completes to avoid premature auto-sync writes

      // Register unload flush handler and multi-device cloud synchronizers
      if (!this._unloadRegistered && typeof window !== 'undefined') {
        this._unloadRegistered = true;
        window.addEventListener('beforeunload', () => this.flushImmediate());
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            this.flushImmediate();
          } else if (document.visibilityState === 'visible') {
            if (!this.isUserTyping()) {
              this.checkAndSyncRemoteChanges();
            }
          }
        });
        window.addEventListener('focus', () => {
          if (!this.isUserTyping()) {
            this.checkAndSyncRemoteChanges();
          }
        });
        window.addEventListener('erp:modal-closed', () => {
          if (this._pendingRemoteManifest && !this.isUserTyping()) {
            const pending = this._pendingRemoteManifest;
            this._pendingRemoteManifest = null;
            this.handleRemoteManifestUpdate(pending);
          }
        });
        window.addEventListener('erp:menu-closed', () => {
          if (this._pendingRemoteManifest && !this.isUserTyping()) {
            const pending = this._pendingRemoteManifest;
            this._pendingRemoteManifest = null;
            this.handleRemoteManifestUpdate(pending);
          }
        });
        // 1. Start official Google Cloud Firestore onSnapshot real-time listener
        this.initRealtimeSyncListener();

        // 2. Multi-device sync backup heartbeat (polls every 3.5s for fast multi-device sync)
        if (!this._remoteSyncTimer) {
          this._remoteSyncTimer = setInterval(() => {
            if (this._pendingRemoteManifest && !this.isUserTyping()) {
              const pending = this._pendingRemoteManifest;
              this._pendingRemoteManifest = null;
              this.handleRemoteManifestUpdate(pending);
            }
            if (!this.isUserTyping()) {
              this.checkAndSyncRemoteChanges();
            }
            // Multi-device session security check (terminates session if password changed elsewhere)
            if (typeof window !== 'undefined' && window.__authService && typeof window.__authService.checkSessionSecurity === 'function') {
              window.__authService.checkSessionSecurity();
            }
          }, 3500);
        }
      }

      // Synchronize immediately with server persistent database (single source of truth)
      this.syncWithServerDatabase();
      console.log('ERP Storage Engine initialized (v' + SCHEMA_VERSION + '). Total machines:', this.data[TABLE_NAMES.MACHINES]?.length || 0);
    } catch (err) {
      console.warn('LocalStorage error, falling back to memory seed:', err);
      this._suppressServerPersist = true;
      this.resetToInitialData(false).then(() => {
        this.rebuildAllIndexes();
        this._suppressServerPersist = false;
        this.syncWithServerDatabase();
      }).catch(e => console.error('Fallback seed error:', e));
      this.isInitialized = true;
    }
  }

  async resetToInitialData(persistToServer = false) {
    let INITIAL_DATA;
    try {
      const mod = await import('./initialData.js');
      INITIAL_DATA = mod.INITIAL_DATA;
    } catch (err) {
      console.error('[Storage] Failed to dynamically load initialData.js:', err);
      return false;
    }
    this.data = {
      [TABLE_NAMES.GROUPS]: JSON.parse(JSON.stringify(INITIAL_DATA.groups || [])),
      [TABLE_NAMES.UNITS]: JSON.parse(JSON.stringify(INITIAL_DATA.units || [])),
      [TABLE_NAMES.FLOORS]: JSON.parse(JSON.stringify(INITIAL_DATA.floors || [])),
      [TABLE_NAMES.LINES]: JSON.parse(JSON.stringify(INITIAL_DATA.lines || [])),
      [TABLE_NAMES.CATEGORIES]: JSON.parse(JSON.stringify(INITIAL_DATA.categories || [])),
      [TABLE_NAMES.MACHINE_NAMES]: JSON.parse(JSON.stringify(INITIAL_DATA.machine_names || [])),
      [TABLE_NAMES.BRANDS]: JSON.parse(JSON.stringify(INITIAL_DATA.brands || [])),
      [TABLE_NAMES.MODELS]: JSON.parse(JSON.stringify(INITIAL_DATA.models || [])),
      [TABLE_NAMES.CUSTOM_FIELDS]: JSON.parse(JSON.stringify(INITIAL_DATA.custom_fields || [])),
      [TABLE_NAMES.EXCEL_STRUCTURES]: JSON.parse(JSON.stringify(INITIAL_DATA.excel_structures || [])),
      [TABLE_NAMES.IMPORT_HISTORY]: JSON.parse(JSON.stringify(INITIAL_DATA.import_history || [])),
      [TABLE_NAMES.USERS]: JSON.parse(JSON.stringify(INITIAL_DATA.users || [])),
      [TABLE_NAMES.ROLES]: JSON.parse(JSON.stringify(INITIAL_DATA.roles || [])),
      [TABLE_NAMES.MACHINES]: (typeof INITIAL_DATA.generateInitialMachines === 'function' ? INITIAL_DATA.generateInitialMachines() : JSON.parse(JSON.stringify(INITIAL_DATA.machines || []))),
      [TABLE_NAMES.APPROVAL_REQUESTS]: JSON.parse(JSON.stringify(INITIAL_DATA.approval_requests || [])),
      [TABLE_NAMES.TRANSFERS]: JSON.parse(JSON.stringify(INITIAL_DATA.transfers || [])),
      [TABLE_NAMES.TRANSFER_REQUESTS]: JSON.parse(JSON.stringify(INITIAL_DATA.transfer_requests || [])),
      [TABLE_NAMES.TRANSFER_WORKFLOWS]: JSON.parse(JSON.stringify(INITIAL_DATA.transfer_workflows || [])),
      [TABLE_NAMES.MACHINE_HISTORY]: (typeof INITIAL_DATA.generateInitialHistory === 'function' ? INITIAL_DATA.generateInitialHistory() : JSON.parse(JSON.stringify(INITIAL_DATA.machine_history || []))),
      [TABLE_NAMES.SPARE_PARTS]: (typeof INITIAL_DATA.generateInitialSpareParts === 'function' ? INITIAL_DATA.generateInitialSpareParts() : JSON.parse(JSON.stringify(INITIAL_DATA.spare_parts || []))),
      [TABLE_NAMES.SPARE_PARTS_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.spare_parts_master || [])),
      [TABLE_NAMES.ET_BOARDS]: (typeof INITIAL_DATA.generateInitialEtBoards === 'function' ? INITIAL_DATA.generateInitialEtBoards() : JSON.parse(JSON.stringify(INITIAL_DATA.et_boards || []))),
      [TABLE_NAMES.ET_BOARD_HISTORY]: (typeof INITIAL_DATA.generateInitialEtHistory === 'function' ? INITIAL_DATA.generateInitialEtHistory() : JSON.parse(JSON.stringify(INITIAL_DATA.et_board_history || []))),
      [TABLE_NAMES.ET_COMPANIES]: JSON.parse(JSON.stringify(INITIAL_DATA.et_companies || [])),
      [TABLE_NAMES.ET_CATEGORIES]: JSON.parse(JSON.stringify(INITIAL_DATA.et_categories || [])),
      [TABLE_NAMES.EMPLOYEES]: JSON.parse(JSON.stringify(INITIAL_DATA.employees || [])),
      [TABLE_NAMES.TOOLS_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.tools_master || [])),
      [TABLE_NAMES.ACCESSORIES_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.accessories_master || [])),
      [TABLE_NAMES.TOOL_ALLOCATIONS]: (typeof INITIAL_DATA.generateInitialToolAllocations === 'function' ? INITIAL_DATA.generateInitialToolAllocations() : JSON.parse(JSON.stringify(INITIAL_DATA.tool_allocations || []))),
      [TABLE_NAMES.TOOL_CHANGE_HISTORY]: JSON.parse(JSON.stringify(INITIAL_DATA.tool_change_history || [])),
      [TABLE_NAMES.AUDIT_LOGS]: JSON.parse(JSON.stringify(INITIAL_DATA.audit_logs || [])),
      [TABLE_NAMES.NOTIFICATIONS]: JSON.parse(JSON.stringify(INITIAL_DATA.notifications || [])),
      [TABLE_NAMES.SETTINGS]: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      [TABLE_NAMES.STORAGE_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.storage_master || [])),
      [TABLE_NAMES.STORAGE_CORRECTION_RULES]: JSON.parse(JSON.stringify(INITIAL_DATA.storage_correction_rules || [])),
      [TABLE_NAMES.PREVENTIVE_CONFIG]: JSON.parse(JSON.stringify(INITIAL_DATA.preventive_config || [])),
      [TABLE_NAMES.PREVENTIVE_MAINTENANCE]: (typeof INITIAL_DATA.generateInitialPreventiveMaintenance === 'function' ? INITIAL_DATA.generateInitialPreventiveMaintenance() : JSON.parse(JSON.stringify(INITIAL_DATA.preventive_maintenance || []))),
      [TABLE_NAMES.RELOCATE_SESSIONS]: [],
      [TABLE_NAMES.RELOCATION_HISTORY]: [],
      [TABLE_NAMES.RELOCATION_APPROVALS]: [],
      [TABLE_NAMES.DOCUMENTS]: [],
      [TABLE_NAMES.PERMISSION_PRESETS]: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_PRESETS || [])),
      [TABLE_NAMES.HOMEPAGE_CONFIG]: null
    };

    Object.values(TABLE_NAMES).forEach(table => {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(this.data[table] || []));
      } catch (_) {}
    });
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'version', SCHEMA_VERSION);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'last_saved', new Date().toISOString());
    } catch (_) {}

    if (persistToServer) {
      this.persistToServerDatabase();
    }
    this.rebuildAllIndexes();
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    Object.values(TABLE_NAMES).forEach(table => {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + table);
      if (stored) {
        try {
          this.data[table] = JSON.parse(stored);
        } catch (e) {
          this.data[table] = [];
        }
      } else {
        this.data[table] = [];
      }
    });

    // High-capacity IndexedDB recovery (bypasses 5MB localStorage quota limit for large enterprise tables)
    try {
      this.ensureHydrated().then(updated => {
        if (updated && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp:storage-updated'));
          window.dispatchEvent(new CustomEvent('erp:inventory-updated'));
          window.dispatchEvent(new CustomEvent('erp:tools-updated'));
        }
      }).catch(() => {});
    } catch (_) {}

    if (!this.data[TABLE_NAMES.SETTINGS] || Object.keys(this.data[TABLE_NAMES.SETTINGS]).length === 0) {
      this.data[TABLE_NAMES.SETTINGS] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    // Always hydrate custom admin slug and homepage visibility mode from dedicated localStorage keys if present
    if (typeof localStorage !== 'undefined') {
      try {
        const cachedSlug = localStorage.getItem('al_muslim_admin_login_slug');
        if (cachedSlug && (!this.data[TABLE_NAMES.SETTINGS].adminLoginSlug || this.data[TABLE_NAMES.SETTINGS].adminLoginSlug === 'secure-admin-gateway')) {
          this.data[TABLE_NAMES.SETTINGS].adminLoginSlug = cachedSlug;
        } else if (this.data[TABLE_NAMES.SETTINGS].adminLoginSlug) {
          localStorage.setItem('al_muslim_admin_login_slug', this.data[TABLE_NAMES.SETTINGS].adminLoginSlug);
        }

        const cachedMode = localStorage.getItem('al_muslim_homepage_visibility_mode');
        if (cachedMode && (!this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode || this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode === 'public')) {
          this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode = cachedMode;
        } else if (this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode) {
          localStorage.setItem('al_muslim_homepage_visibility_mode', this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode);
        }
      } catch (_) {}
    }

    if (!this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode) {
      this.data[TABLE_NAMES.SETTINGS].homepageVisibilityMode = DEFAULT_SETTINGS.homepageVisibilityMode || 'login';
    }
    if (!this.data[TABLE_NAMES.SETTINGS].adminLoginSlug) {
      this.data[TABLE_NAMES.SETTINGS].adminLoginSlug = DEFAULT_SETTINGS.adminLoginSlug || 'secure-admin-gateway';
    }

    if (Array.isArray(this.data[TABLE_NAMES.EXCEL_STRUCTURES]) && this.data[TABLE_NAMES.EXCEL_STRUCTURES].length > 0) {
      // Normalize and sanitize field keys, stripping legacy assetId and sl (Sl. No. is purely automatic in software)
      this.data[TABLE_NAMES.EXCEL_STRUCTURES].forEach(struct => {
        if (struct.columns) {
          struct.columns = struct.columns.filter(c => 
            c.systemField !== 'assetId' && c.fieldKey !== 'assetId' && c.fieldKey !== 'asset_id' &&
            c.systemField !== 'sl' && c.fieldKey !== 'sl' && c.fieldKey !== 'sl_no'
          );
          struct.columns.forEach((c, idx) => {
            if (!c.fieldKey || c.systemField) {
              if (c.systemField === 'machineName' || c.fieldKey === 'machineName') c.fieldKey = 'machine_name';
              else if (c.systemField === 'brand' || c.fieldKey === 'brand') c.fieldKey = 'machine_brand';
              else if (c.systemField === 'model' || c.fieldKey === 'model') c.fieldKey = 'machine_model';
              else if (c.systemField === 'serialNumber' || c.fieldKey === 'serialNumber') c.fieldKey = 'machine_serial';
              else if (c.systemField === 'manufacturing_serial' || c.fieldKey === 'manufacturing_serial' || c.systemField === 'manufacturingSerial') c.fieldKey = 'manufacturing_serial';
              else if (c.systemField === 'unit' || c.fieldKey === 'unit') c.fieldKey = 'unit_factory';
              else if (c.systemField === 'status' || c.fieldKey === 'status') c.fieldKey = 'machine_status';
              else if (c.systemField === 'service_date' || c.fieldKey === 'service_date' || c.systemField === 'lastServiceDate') c.fieldKey = 'service_date';
              else if (c.systemField === 'remarks' || c.fieldKey === 'remarks') c.fieldKey = 'remarks';
              else if (!c.fieldKey) c.fieldKey = c.systemField || `col_${idx + 1}`;
            }
            c.order = idx + 1;
          });
        }
      });
    }

    if (!Array.isArray(this.data[TABLE_NAMES.RELOCATE_SESSIONS])) {
      this.data[TABLE_NAMES.RELOCATE_SESSIONS] = [];
    }
    if (!Array.isArray(this.data[TABLE_NAMES.RELOCATION_HISTORY])) {
      this.data[TABLE_NAMES.RELOCATION_HISTORY] = [];
    }
    if (!Array.isArray(this.data[TABLE_NAMES.RELOCATION_APPROVALS])) {
      this.data[TABLE_NAMES.RELOCATION_APPROVALS] = [];
    }

    if (!Array.isArray(this.data[TABLE_NAMES.PERMISSION_PRESETS]) || this.data[TABLE_NAMES.PERMISSION_PRESETS].length === 0) {
      this.data[TABLE_NAMES.PERMISSION_PRESETS] = JSON.parse(JSON.stringify(DEFAULT_PERMISSION_PRESETS || []));
    }

    // Auto-migrate existing users to default permission presets
    const currentUsers = this.data[TABLE_NAMES.USERS] || [];
    currentUsers.forEach(u => {
      const uRole = (u.role || '').toUpperCase();
      if (!u.presetId || u.presetId === 'preset-super-admin' || u.presetId === 'preset-admin' || u.presetId === 'preset-maintenance-user') {
        if (uRole === 'SUPER_ADMIN' || u.username === 'superadmin') {
          u.presetId = 'preset_super_admin';
          u.presetName = 'Super Admin';
        } else if (uRole === 'ADMIN') {
          u.presetId = 'preset_admin';
          u.presetName = 'Admin';
        } else {
          u.presetId = 'preset_maintenance_user';
          u.presetName = 'Maintenance User';
        }
      }
    });

    // Auto-migrate legacy storage_master machine names to canonical names
    const currentSM = this.data[TABLE_NAMES.STORAGE_MASTER] || [];
    const smAliasMap = {
      'plain machine 1-needle': 'Single Needle Lock Stitch Machine',
      'plain machine': 'Single Needle Lock Stitch Machine',
      'plane machine': 'Single Needle Lock Stitch Machine',
      'overlock 4-thread': 'Over Lock Machine',
      'overlock 5-thread': 'Over Lock Machine',
      'flatlock cylinder bed': 'Flat Lock Machine',
      'bar tack machine': 'Bar tak Machine',
      'feed off the arm': 'Feed of The Arm Machine'
    };
    currentSM.forEach(it => {
      if (it && it.category === 'MACHINE' && it.machineName) {
        const lower = it.machineName.trim().toLowerCase();
        if (smAliasMap[lower]) {
          it.machineName = smAliasMap[lower];
        }
      }
    });

    // Auto-migrate legacy/duplicate machine IDs to canonical 76 machine types
    const duplicateIdMap = {
      'mac-1788870296741-262': 'mn-1788869247076-glop', // Double Needle Auto -> Double Needle Machine
      'mac-1788870296741-927': 'mn-1788869247118-qyw5', // Over Lock Mechine -> Over Lock Machine
      'mac-1788870296741-484': 'mn-1788869247492-lklr', // Zipper Joint -> Zipper Joint Machine
      'mac-1788870296741-259': 'mn-1788869247176-2gzf', // Multi Needle Chain Stitch -> Multi Needle Chain Stitch Machine
      'mac-1788870296741-196': 'mn-1788869247141-kx1a', // Chain Stitch -> Chain Stitch Machine
      'mac-1788870296741-404': 'mn-1788869247061-9dsy', // Vertical Bedoly -> Vertical Machine
      'mac-1788870296742-5':   'mn-1788869247572-yzvd', // Sleeve Joint -> Sleeve Joint Machine
      'mac-1788870296742-799': 'mn-1788869248254-ez5p', // Snap Button Hydrolic -> Snap Button Machine
      'mac-1788870296742-855': 'mn-1788869247076-glop', // Double Needle Manual -> Double Needle Machine
      'mac-1788870296742-252': 'mn-1788869247100-2uyc', // Feed of The Arm-Brother -> Feed of The Arm Machine
      'mac-1788870296742-285': 'mn-1788869247100-2uyc', // Feed of The Arm-Narrow -> Feed of The Arm Machine
      'mac-1788870296742-208': 'mn-1788869247738-cne3', // Loop Attach -> Loop Attach Machine
      'mac-1788870296742-973': 'mn-1788869247100-2uyc', // Feed of The Arm-AGM -> Feed of The Arm Machine
      'mac-1788870296742-664': 'mn-1788869247100-2uyc', // Feed of The Arm -> Feed of The Arm Machine
      'mac-1788870296742-107': 'mn-1788869247243-7wlt', // Botton Hole -> Button Hole Machine
      'mac-1788870296741-340': 'mn-1788869247205-his3'  // Bartack -> Bar tak Machine
    };

    const currentMachines = this.data[TABLE_NAMES.MACHINES] || [];
    currentMachines.forEach(m => {
      if (m && duplicateIdMap[m.machineNameId]) {
        m.machineNameId = duplicateIdMap[m.machineNameId];
      }
      if (m && typeof m.remarks === 'string' && /imported from sheet/i.test(m.remarks)) {
        m.remarks = m.remarks.replace(/^Imported from sheet\s*['"]?[^'"\]\n\r]*['"]?\s*/gi, '').trim();
      }
    });

    // Retain all valid records in MACHINE_NAMES table (preserve IDs actively referenced by machines)
    const currentMN = this.data[TABLE_NAMES.MACHINE_NAMES] || [];
    const mnMapById = new Map();
    currentMN.forEach(mn => { if (mn && mn.id) mnMapById.set(mn.id, mn); });
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(this.data[TABLE_NAMES.MACHINES])) {
      const activeMnIds = new Set(this.data[TABLE_NAMES.MACHINES].map(m => m && m.machineNameId).filter(Boolean));
      (INITIAL_DATA.machine_names || []).forEach(mn => {
        if (mn && mn.id && activeMnIds.has(mn.id) && !mnMapById.has(mn.id)) {
          mnMapById.set(mn.id, mn);
        }
      });
    }
    this.data[TABLE_NAMES.MACHINE_NAMES] = Array.from(mnMapById.values());

    // Auto-heal empty or missing core master tables from INITIAL_DATA if present
    if (typeof INITIAL_DATA !== 'undefined') {
      if (!Array.isArray(this.data[TABLE_NAMES.MACHINE_NAMES]) || this.data[TABLE_NAMES.MACHINE_NAMES].length === 0) {
        this.data[TABLE_NAMES.MACHINE_NAMES] = JSON.parse(JSON.stringify(INITIAL_DATA.machine_names || []));
      }
      if (!Array.isArray(this.data[TABLE_NAMES.MODELS]) || this.data[TABLE_NAMES.MODELS].length === 0) {
        this.data[TABLE_NAMES.MODELS] = JSON.parse(JSON.stringify(INITIAL_DATA.models || []));
      }
      if (!Array.isArray(this.data[TABLE_NAMES.BRANDS]) || this.data[TABLE_NAMES.BRANDS].length === 0) {
        this.data[TABLE_NAMES.BRANDS] = JSON.parse(JSON.stringify(INITIAL_DATA.brands || []));
      }
      if (!Array.isArray(this.data[TABLE_NAMES.GROUPS]) || this.data[TABLE_NAMES.GROUPS].length === 0) {
        this.data[TABLE_NAMES.GROUPS] = JSON.parse(JSON.stringify(INITIAL_DATA.groups || []));
      }
      if (!Array.isArray(this.data[TABLE_NAMES.UNITS]) || this.data[TABLE_NAMES.UNITS].length === 0) {
        this.data[TABLE_NAMES.UNITS] = JSON.parse(JSON.stringify(INITIAL_DATA.units || []));
      }
      if (!Array.isArray(this.data[TABLE_NAMES.FLOORS]) || this.data[TABLE_NAMES.FLOORS].length === 0) {
        this.data[TABLE_NAMES.FLOORS] = JSON.parse(JSON.stringify(INITIAL_DATA.floors || []));
      }
      if (!Array.isArray(this.data[TABLE_NAMES.LINES]) || this.data[TABLE_NAMES.LINES].length === 0) {
        this.data[TABLE_NAMES.LINES] = JSON.parse(JSON.stringify(INITIAL_DATA.lines || []));
      }
    }

    // Automatically purge dummy "test" machine and master data records
    let testPurged = false;
    if (Array.isArray(this.data[TABLE_NAMES.MACHINES])) {
      const origMachCount = this.data[TABLE_NAMES.MACHINES].length;
      this.data[TABLE_NAMES.MACHINES] = this.data[TABLE_NAMES.MACHINES].filter(m => {
        if (!m) return false;
        const s = String(m.serialNumber || '').trim().toLowerCase();
        const n = String(m.machineName || m.name || '').trim().toLowerCase();
        const id = String(m.id || '').trim().toLowerCase();
        return s !== 'test' && n !== 'test' && id !== 'test' && id !== 'test_item_999';
      });
      if (this.data[TABLE_NAMES.MACHINES].length !== origMachCount) {
        testPurged = true;
      }
    }

    if (Array.isArray(this.data[TABLE_NAMES.MACHINE_NAMES])) {
      const origMnCount = this.data[TABLE_NAMES.MACHINE_NAMES].length;
      this.data[TABLE_NAMES.MACHINE_NAMES] = this.data[TABLE_NAMES.MACHINE_NAMES].filter(mn => {
        if (!mn) return false;
        const n = String(mn.name || '').trim().toLowerCase();
        const id = String(mn.id || '').trim().toLowerCase();
        return n !== 'test' && id !== 'test';
      });
      if (this.data[TABLE_NAMES.MACHINE_NAMES].length !== origMnCount) {
        testPurged = true;
        try { idbCache.setTable(TABLE_NAMES.MACHINE_NAMES, this.data[TABLE_NAMES.MACHINE_NAMES]); } catch (_) {}
      }
    }

    if (Array.isArray(this.data[TABLE_NAMES.MODELS])) {
      const origMdlCount = this.data[TABLE_NAMES.MODELS].length;
      this.data[TABLE_NAMES.MODELS] = this.data[TABLE_NAMES.MODELS].filter(mdl => {
        if (!mdl) return false;
        const n = String(mdl.name || '').trim().toLowerCase();
        const id = String(mdl.id || '').trim().toLowerCase();
        return n !== 'test' && id !== 'test';
      });
      if (this.data[TABLE_NAMES.MODELS].length !== origMdlCount) {
        testPurged = true;
        try { idbCache.setTable(TABLE_NAMES.MODELS, this.data[TABLE_NAMES.MODELS]); } catch (_) {}
      }
    }

    if (testPurged) {
      try { idbCache.setTable(TABLE_NAMES.MACHINES, this.data[TABLE_NAMES.MACHINES]); } catch (_) {}
      try { localStorage.setItem(STORAGE_KEY_PREFIX + TABLE_NAMES.MACHINES, JSON.stringify(this.data[TABLE_NAMES.MACHINES])); } catch (_) {}
    }

    // Auto-generate permanent unique System Asset IDs (e.g. AMG-MNT-000001) for all machines
    this.ensureMachineSystemAssetIds();
    this.ensureForeignIntegrity();
  }

  /**
   * Ensures in-memory database is fully hydrated from high-capacity IndexedDB cache.
   * Resolves within ~10ms on startup before first render to guarantee instant page load with zero delay.
   */
  async ensureHydrated() {
    if (this._hydrationPromise) return this._hydrationPromise;
    this._hydrationPromise = (async () => {
      try {
        const idbTables = await idbCache.getAllTables();
        if (idbTables && typeof idbTables === 'object') {
          let idbUpdated = false;
          for (const [tbl, records] of Object.entries(idbTables)) {
            if (Array.isArray(records) && records.length > 0) {
              const currentRecs = this.data[tbl];
              const currentCount = Array.isArray(currentRecs) ? currentRecs.length : 0;
              // Hydrate from IDB if memory is empty, or if IDB has more records
              if (currentCount === 0 || records.length > currentCount) {
                if (tbl === TABLE_NAMES.MACHINES) {
                  this.data[tbl] = records.filter(m => {
                    if (!m) return false;
                    const s = String(m.serialNumber || '').trim().toLowerCase();
                    const n = String(m.machineName || m.name || '').trim().toLowerCase();
                    const id = String(m.id || '').trim().toLowerCase();
                    return s !== 'test' && n !== 'test' && id !== 'test' && id !== 'test_item_999';
                  });
                } else if (tbl === TABLE_NAMES.MACHINE_NAMES || tbl === TABLE_NAMES.MODELS) {
                  this.data[tbl] = records.filter(item => {
                    if (!item) return false;
                    const n = String(item.name || '').trim().toLowerCase();
                    const id = String(item.id || '').trim().toLowerCase();
                    return n !== 'test' && id !== 'test';
                  });
                } else {
                  this.data[tbl] = records;
                }
                idbUpdated = true;
              }
            } else if (records && typeof records === 'object' && !Array.isArray(records) && Object.keys(records).length > 0) {
              // Hydrate object tables (homepage_config, settings)
              this.data[tbl] = {
                ...(this.data[tbl] || {}),
                ...records
              };
              if (tbl === TABLE_NAMES.SETTINGS && typeof localStorage !== 'undefined') {
                try {
                  if (this.data[tbl].adminLoginSlug) {
                    localStorage.setItem('al_muslim_admin_login_slug', this.data[tbl].adminLoginSlug);
                  }
                  if (this.data[tbl].homepageVisibilityMode) {
                    localStorage.setItem('al_muslim_homepage_visibility_mode', this.data[tbl].homepageVisibilityMode);
                  }
                } catch (_) {}
              }
              idbUpdated = true;
            }
          }
          if (idbUpdated) {
            this.ensureMachineSystemAssetIds();
            this.rebuildAllIndexes();
            return true;
          }
        }
      } catch (err) {
        console.warn('[Storage] ensureHydrated notice:', err);
      }
      return false;
    })();
    return this._hydrationPromise;
  }

  /**
   * Persist a table to localStorage (immediate) and Google Cloud Firestore (confirmed write).
   *
   * CONFIRMED WRITE DISCIPLINE:
   * - Always awaits Firestore HTTP 200 before returning true
   * - Returns false if cloud write is not confirmed (caller must decide rollback)
   * - Updates syncedDocVersions with server updateTime on success
   *
   * @param {string} table - Table name
   * @param {boolean|*} dataOrImmediate - Optional new data or immediate flag
   * @param {boolean} maybeImmediate - Immediate flag if dataOrImmediate is data (default true)
   * @returns {Promise<boolean>} - true if Firestore write confirmed, false otherwise
   */
  async saveTable(table, dataOrImmediate = null, maybeImmediate = true) {
    let immediate = true; // Default to immediate (confirmed write)
    let isExplicitUserWrite = false;
    if (typeof dataOrImmediate === 'boolean') {
      immediate = dataOrImmediate;
      // When called as saveTable(table, true) from updateConfirmed/insertConfirmed/deleteConfirmed,
      // this is always an explicit, confirmed user-action write and must NEVER be suppressed by
      // _suppressServerPersist (which is only meant to block background auto-sync during boot).
      if (dataOrImmediate === true) {
        isExplicitUserWrite = true;
      }
    } else if (dataOrImmediate !== null && dataOrImmediate !== undefined) {
      this.data[table] = dataOrImmediate;
      immediate = maybeImmediate !== false; // default true
      isExplicitUserWrite = true;
    }

    const records = this.data[table];
    this._invalidateTableIdMap(table);

    // 1. High-capacity persistent write to IndexedDB (no 5MB quota crashes)
    try {
      await idbCache.setTable(table, records ?? []);
    } catch (_) {}

    // 2. Write to localStorage immediately (local cache)
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(records ?? []));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'version', SCHEMA_VERSION);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'last_saved', new Date().toISOString());
    } catch (err) {
      console.warn('LocalStorage quota notice for table:', table, err.message);
    }

    if (!this.lastTableUpdates) this.lastTableUpdates = {};
    this.lastTableUpdates[table] = Date.now();

    // If server persist is suppressed (during boot/initialization), do not fire cloud writes UNLESS it is an explicit user write
    if (this._suppressServerPersist && !isExplicitUserWrite) {
      return true;
    }

    // Secondary backup to local node server (debounced, non-blocking)
    if (this._autoPersistDebounce) clearTimeout(this._autoPersistDebounce);
    this._autoPersistDebounce = setTimeout(() => {
      this.persistToServerDatabase();
    }, 400);

    // 2. Direct Confirmed Firestore Cloud Write
    this.updateStatusBadge('saving');

    const doCloudSave = async () => {
      if (!this._tableSavePromises) this._tableSavePromises = new Map();

      // If a write for this specific table is already in flight, wait for it before writing latest state
      if (this._tableSavePromises.has(table)) {
        try {
          await this._tableSavePromises.get(table);
        } catch (_) {}
      }

      const currentPromise = (async () => {
        try {
          const currentRecords = this.data[table];
          if (table === TABLE_NAMES.MACHINES && Array.isArray(currentRecords)) {
            if (currentRecords.length === 0 && !this._allowEmptyTableSave) {
              console.warn(`[Anti-Wipe Safeguard] Blocked saving completely empty machines table without explicit authorization.`);
              return { success: false, error: 'Cannot overwrite machines table with empty array.' };
            }
          }
          const result = await syncManager.saveTable(table, currentRecords);
          if (result && result.success) {
            this._isCloudConnected = true;
            // Store server-confirmed updateTime for clock-skew-safe remote detection
            const confirmedTs = result.updatedAt || result.updateTime;
            if (confirmedTs) {
              this.syncedDocVersions.set('mysql_' + table, confirmedTs);
              this.syncedDocVersions.set(table, confirmedTs);
            }
            if (typeof localStorage !== 'undefined') {
              try { localStorage.setItem('erp_last_mysql_sync_ts', String(Date.now())); } catch (_) {}
            }
            this.updateStatusBadge('saved');
            return true;
          }

          // Rule 4: Write Protection Triggered (Dual Database Failure / Network Disconnect)
          this._isCloudConnected = false;
          this.updateStatusBadge('error');
          const errDetail = result?.error || 'Write Blocked: Cloud database servers are currently unreachable. Save action blocked to prevent data corruption.';
          console.error(`[Storage Protection] 🚨 ${errDetail}`);

          // Only display intrusive toast alert if this is an explicit, logged-in user action
          // Suppress during boot, on login gateway, or for automated background tasks
          const currentUser = (typeof authService !== 'undefined' && typeof authService.getCurrentUser === 'function') ? authService.getCurrentUser() : null;
          const currentView = (typeof state !== 'undefined' && typeof state.get === 'function') ? state.get('currentView') : '';
          const isAuthGateway = ['login', 'admin-login', 'home'].includes(currentView);
          const isRealUserSave = isExplicitUserWrite && currentUser && !isAuthGateway && Boolean(window.__appLoaded);

          if (isRealUserSave && typeof window !== 'undefined' && window.notificationService) {
            window.notificationService.error(
              result?.dualFailure 
                ? '🚨 System Write-Protected: Central cloud connection is unavailable. Changes paused to protect system data.' 
                : (result?.error || 'Cloud save paused. Please check your network connection.')
            );
          }
          return false;
        } catch (e) {
          console.warn(`[Storage] Remote save warning for ${table}:`, e.message);
          this.updateStatusBadge('error');
          return false;
        } finally {
          this._tableSavePromises.delete(table);
        }
      })();

      this._tableSavePromises.set(table, currentPromise);
      return await currentPromise;
    };

    // Background (healing / bulk init) writes use a short 100ms debounce
    if (!immediate) {
      if (!this._cloudPersistDebounces) this._cloudPersistDebounces = {};
      if (this._cloudPersistDebounces[table]) clearTimeout(this._cloudPersistDebounces[table]);
      return new Promise(resolve => {
        this._cloudPersistDebounces[table] = setTimeout(async () => {
          const res = await doCloudSave();
          resolve(res);
        }, 100);
      });
    }

    // Immediate (user-action) write — await confirmation with 0ms delay
    return await doCloudSave();
  }

  /**
   * Atomically save multiple tables in a single transaction (IndexedDB, localStorage, and MySQL Primary)
   * Prevents rate-limiting and race conditions from multiple sequential saveTable calls.
   *
   * @param {Object} tablesObj - Map of { tableName: dataArray }
   * @returns {Promise<boolean>} - true if remote write confirmed
   */
  async saveMultipleTables(tablesObj, isExplicitUserAction = false) {
    if (!tablesObj || typeof tablesObj !== 'object') return false;

    // 1. High-capacity persistent write to IndexedDB & localStorage for all tables
    for (const [table, records] of Object.entries(tablesObj)) {
      this.data[table] = records ?? [];
      try {
        await idbCache.setTable(table, this.data[table]);
      } catch (_) {}
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(this.data[table]));
      } catch (_) {}
      if (!this.lastTableUpdates) this.lastTableUpdates = {};
      this.lastTableUpdates[table] = Date.now();
    }
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'version', SCHEMA_VERSION);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'last_saved', new Date().toISOString());
    } catch (_) {}

    // Rebuild indexes if machines updated
    if (TABLE_NAMES.MACHINES in tablesObj) {
      this.rebuildAllIndexes();
    }

    this.updateStatusBadge('saving');

    try {
      const result = await syncManager.saveMultipleTables(tablesObj);
      if (result && result.success) {
        this._isCloudConnected = true;
        const confirmedTs = result.updatedAt || result.updateTime || new Date().toISOString();
        for (const table of Object.keys(tablesObj)) {
          this.syncedDocVersions.set('mysql_' + table, confirmedTs);
          this.syncedDocVersions.set(table, confirmedTs);
        }
        this.updateStatusBadge('saved');
        return true;
      }

      // Rule 4: Write Protection
      this.updateStatusBadge('error');
      const currentUser = (typeof authService !== 'undefined' && typeof authService.getCurrentUser === 'function') ? authService.getCurrentUser() : null;
      const currentView = (typeof state !== 'undefined' && typeof state.get === 'function') ? state.get('currentView') : '';
      const isAuthGateway = ['login', 'admin-login', 'home'].includes(currentView);
      const isRealUserSave = isExplicitUserAction && currentUser && !isAuthGateway && Boolean(window.__appLoaded);

      if (isRealUserSave && typeof window !== 'undefined' && window.notificationService) {
        window.notificationService.error(
          result?.dualFailure 
            ? '🚨 System Write-Protected: Central cloud connection is unavailable. Changes paused to protect system data.' 
            : (result?.error || 'Cloud save paused. Please check your network connection.')
        );
      }
      return false;
    } catch (e) {
      console.warn('[Storage] Remote saveMultipleTables warning:', e.message);
      this.updateStatusBadge('error');
      return false;
    }
  }

  /**
   * Atomic write-and-confirm transaction helper.
   *
   * Snapshots the current table state, applies mutation in memory, then persists to Firestore.
   * If the Firestore write fails (HTTP non-200 or network error), the snapshot is restored
   * and a CloudSaveError is thrown — caller's modal stays open, no false success.
   *
   * @param {string} tableName - Table to mutate
   * @param {Function} mutationFn - Synchronous function that receives data array and mutates it
   * @returns {Promise<any>} - The updated table data after confirmed cloud write
   * @throws {CloudSaveError} - If Firestore write was not confirmed
   */
  async writeAndConfirm(tableName, mutationFn) {
    // Snapshot for rollback
    const snapshot = JSON.parse(JSON.stringify(this.data[tableName] ?? []));

    // Apply mutation in-memory
    if (!this.data[tableName]) this.data[tableName] = [];
    mutationFn(this.data[tableName]);

    // Rebuild indexes if needed
    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    // Attempt confirmed cloud write
    const ok = await this.saveTable(tableName, true);

    if (!ok) {
      // Rollback in-memory state
      this.data[tableName] = snapshot;
      if (tableName === TABLE_NAMES.MACHINES) {
        this.rebuildAllIndexes();
      }
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(snapshot));
      } catch (_) {}
      this.updateStatusBadge('error');
      throw new CloudSaveError(`❌ Cloud Save Failed: Database write for '${tableName}' was not confirmed. Check your connection.`);
    }

    return this.data[tableName];
  }

  isUserTyping() {
    try {
      if (typeof window !== 'undefined' && window.__isActionMenuOpen) return true;
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        return true;
      }
      if (active && active.isContentEditable) return true;
      if (typeof window !== 'undefined' && window.state && window.state.get('activeModal')) {
        return true;
      }
      if (typeof document !== 'undefined') {
        const hasOpenMenu = document.querySelector('.actions-dropdown-menu.show, .dropdown-menu.show, .btn-actions-trigger.active, .table-row-actions-menu.show');
        if (hasOpenMenu) return true;
      }
      // Also block sync re-render if the user is actively scrolling the inventory table
      if (typeof document !== 'undefined') {
        const invVp = document.getElementById('inventory-table-scroll-viewport');
        if (invVp && invVp._scrollGuardAttached && invVp._isScrolling) return true;
      }
    } catch (_) {}
    return false;
  }

  async checkAndSyncRemoteChanges() {
    if (this._isCheckingRemote || this.isUserTyping()) return;
    this._isCheckingRemote = true;
    try {
      const isViewingSettings = typeof window !== 'undefined' && window.state && window.state.get('currentView') === 'settings';

      // 0. Failover Route: If MySQL is offline, poll PostgreSQL replica for remote multi-device updates
      if (syncManager && syncManager.isFailoverActive) {
        const pgAdapter = syncManager.getPostgresAdapter();
        if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
          try {
            const pgTsRes = await pgAdapter.getTableTimestamps();
            if (pgTsRes && pgTsRes.success && pgTsRes.timestamps) {
              const parseTs = (ts) => {
                if (!ts) return 0;
                const s = String(ts).trim().replace(' ', 'T');
                const ms = Date.parse(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
                return isNaN(ms) ? 0 : ms;
              };
              const updates = [];
              for (const [tbl, remoteTs] of Object.entries(pgTsRes.timestamps)) {
                if (!remoteTs) continue;
                if (tbl === TABLE_NAMES.SETTINGS && isViewingSettings) continue;
                if (this._tableSavePromises && this._tableSavePromises.has(tbl)) continue;
                if (this.lastTableUpdates && (Date.now() - (this.lastTableUpdates[tbl] || 0) < 8000)) continue;
                const knownTs = this.syncedDocVersions.get(tbl) || '';
                if (parseTs(remoteTs) > parseTs(knownTs)) {
                  updates.push({ tbl, remoteTs });
                }
              }
              if (updates.length > 0) {
                console.log(`[Storage Failover Multi-Device] 🐘 Remote PostgreSQL changes detected in ${updates.length} tables:`, updates.map(u => u.tbl));
                for (const { tbl, remoteTs } of updates) {
                  try {
                    const res = await pgAdapter.getTable(tbl);
                    if (res && res.success && res.data !== undefined) {
                      this.data[tbl] = res.data;
                      this._invalidateTableIdMap(tbl);
                      this.syncedDocVersions.set(tbl, remoteTs);
                    }
                  } catch (_) {}
                }
                this.updateStatusBadge('failover');
                if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:storage-updated'));
              }
            }
          } catch (pgErr) {
            console.warn('[Storage Failover Multi-Device] PostgreSQL check notice:', pgErr.message);
          }
        }
        return;
      }

      // 1. Primary MySQL Adapter Real-Time Multi-Device Sync Check (<30ms check across all tables)
      if (syncManager && syncManager.primaryAdapter && syncManager.primaryAdapter.type === 'MYSQL') {
        try {
          const mysqlTsRes = await syncManager.primaryAdapter.getTableTimestamps();
          if (mysqlTsRes && mysqlTsRes.success && mysqlTsRes.timestamps) {
            const mysqlUpdates = [];
            const parseTs = (ts) => {
              if (!ts) return 0;
              const s = String(ts).trim().replace(' ', 'T');
              const ms = Date.parse(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
              return isNaN(ms) ? 0 : ms;
            };

            for (const [tbl, remoteTs] of Object.entries(mysqlTsRes.timestamps)) {
              if (!remoteTs) continue;
              if (tbl === TABLE_NAMES.SETTINGS && isViewingSettings) continue;
              if (this._tableSavePromises && this._tableSavePromises.has(tbl)) continue;
              // Guard: If table was updated locally within last 8 seconds, do not let background poll overwrite it
              if (this.lastTableUpdates && (Date.now() - (this.lastTableUpdates[tbl] || 0) < 8000)) continue;

              const knownTs = this.syncedDocVersions.get('mysql_' + tbl) || '';
              const localMachCount = this.data[TABLE_NAMES.MACHINES]?.length || 0;
              const isMachinesDeficient = (tbl === TABLE_NAMES.MACHINES && localMachCount < 6400);

              if (parseTs(remoteTs) > (parseTs(knownTs) + 1500) || isMachinesDeficient) {
                mysqlUpdates.push({ tbl, remoteTs });
              }
            }

            if (mysqlUpdates.length > 0) {
              console.log(`[Storage Multi-Device Sync] 🐬 Remote MySQL changes detected in ${mysqlUpdates.length} tables:`, mysqlUpdates.map(u => u.tbl));
              const fetchResults = await Promise.all(
                mysqlUpdates.map(async ({ tbl, remoteTs }) => {
                  try {
                    const res = await syncManager.primaryAdapter.getTable(tbl);
                    return { tbl, remoteTs, res };
                  } catch (_) {
                    return { tbl, remoteTs, res: null };
                  }
                })
              );

              const recordsToApply = {};
              for (const { tbl, remoteTs, res } of fetchResults) {
                if (res && res.success && res.data !== undefined) {
                  recordsToApply[tbl] = res.data;
                  if (!this.lastTableUpdates) this.lastTableUpdates = {};
                  this.lastTableUpdates[tbl] = Date.now();
                  this.syncedDocVersions.set('mysql_' + tbl, remoteTs);
                  this.syncedDocVersions.set(tbl, remoteTs);
                }
              }

              if (Object.keys(recordsToApply).length > 0) {
                this.applyIncomingDatabaseRecords(recordsToApply, `MySQL Remote (${Object.keys(recordsToApply).join(', ')})`);
                this._isCloudConnected = true;
                this.updateStatusBadge('saved');
              }
            }
          }
        } catch (myErr) {
          console.warn('[Storage Multi-Device Sync] MySQL check note:', myErr.message);
        }
      }
    } catch (err) {
      console.warn('[Storage Multi-Device Sync] Remote check note:', err.message);
    } finally {
      this._isCheckingRemote = false;
    }
  }

  /**
   * Real-time sync listener — MySQL primary adapter runs fast timestamp polling (3.5s)
   */
  initRealtimeSyncListener() {
    if (typeof window === 'undefined') return;
    if (this._realtimeListenerStarted) return;
    this._realtimeListenerStarted = true;
    this._isCloudConnected = true;
    this.updateStatusBadge('saved');
  }

  async handleRemoteManifestUpdate(manifest) {
    // Handled directly via MySQL timestamp checks in checkAndSyncRemoteChanges
  }

  saveAll() {
    Object.values(TABLE_NAMES).forEach(table => {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(this.data[table] || []));
      } catch (_) {}
    });
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'version', SCHEMA_VERSION);
      localStorage.setItem(STORAGE_KEY_PREFIX + 'last_saved', new Date().toISOString());
    } catch (_) {}
    return this.persistToServerDatabase();
  }

  applyIncomingDatabaseRecords(serverRecs, sourceName = 'Persistent Store') {
    if (!serverRecs || typeof serverRecs !== 'object') return false;
    let updated = false;

    Object.keys(serverRecs).forEach(tbl => {
      if (!this.lastTableUpdates) this.lastTableUpdates = {};
      this.lastTableUpdates[tbl] = Date.now();

      if (Array.isArray(serverRecs[tbl])) {
        if (tbl === TABLE_NAMES.MACHINE_NAMES) {
          const incomingMN = serverRecs[tbl] || [];
          if (incomingMN.length > 0) {
            this.data[tbl] = incomingMN;
          }
        } else if (tbl === TABLE_NAMES.MACHINES) {
          const incoming = serverRecs[tbl] || [];
          let hasRemarksChanged = false;
          const cleanMachines = incoming.map(m => {
            if (!m) return m;
            let updatedM = m;
            if (duplicateIdMap[m.machineNameId]) {
              updatedM = { ...updatedM, machineNameId: duplicateIdMap[m.machineNameId] };
            }
            if (typeof updatedM.remarks === 'string' && /imported from sheet/i.test(updatedM.remarks)) {
              const cleaned = updatedM.remarks.replace(/^Imported from sheet\s*['"]?[^'"\]\n\r]*['"]?\s*/gi, '').trim();
              if (cleaned !== updatedM.remarks) {
                hasRemarksChanged = true;
                updatedM = { ...updatedM, remarks: cleaned };
              }
            }
            return updatedM;
          });

          // 🛡️ ANTI-DOWNGRADE PROTECTION:
          // If local client already has MORE valid machines than incoming server dataset,
          // NEVER blindly discard local machines! Keep the local machines, merge, and re-sync to server.
          const currentLocal = this.data[tbl] || [];
          if (currentLocal.length > cleanMachines.length && cleanMachines.length > 0) {
            console.warn(`[Storage Anti-Downgrade] 🛡️ Incoming server machines (${cleanMachines.length}) is smaller than local (${currentLocal.length}). Preserving local dataset to prevent data loss.`);
            const serverSerialSet = new Set(cleanMachines.map(m => String(m.serialNumber || '').trim().toUpperCase()).filter(Boolean));
            const serverIdSet = new Set(cleanMachines.map(m => String(m.id || '').trim()).filter(Boolean));

            const uncommittedLocal = currentLocal.filter(m => {
              const sn = String(m.serialNumber || '').trim().toUpperCase();
              const id = String(m.id || '').trim();
              return (!sn || !serverSerialSet.has(sn)) && (!id || !serverIdSet.has(id));
            });

            if (uncommittedLocal.length > 0) {
              const merged = [...cleanMachines, ...uncommittedLocal];
              this.data[tbl] = merged;
              this.ensureMachineSystemAssetIds();
              console.log(`[Storage Anti-Downgrade] 🛡️ Merged and preserved ${uncommittedLocal.length} local machines. Total: ${merged.length}. Syncing to MySQL...`);
              setTimeout(() => {
                this.saveTable(TABLE_NAMES.MACHINES, merged, true).catch(() => {});
              }, 1500);
            } else {
              this.data[tbl] = cleanMachines;
              this.ensureMachineSystemAssetIds();
            }
          } else {
            this.data[tbl] = cleanMachines;
            this.ensureMachineSystemAssetIds();
            this.ensureForeignIntegrity();
          }
        } else if (tbl === TABLE_NAMES.SETTINGS && Array.isArray(serverRecs[tbl])) {
          const localMultiDb = localStorage.getItem('erp_multi_db_config');
          let preservedMultiDb = null;
          if (localMultiDb) {
            try { preservedMultiDb = JSON.parse(localMultiDb); } catch (_) {}
          }
          const recs = serverRecs[tbl];
          if (preservedMultiDb && Array.isArray(preservedMultiDb)) {
            const r = recs.find(x => x.key === 'multi_db_config' || x.id === 'multi_db_config');
            if (r) r.value = preservedMultiDb;
          }
          this.data[tbl] = recs;
        } else if (tbl === TABLE_NAMES.USERS && Array.isArray(serverRecs[tbl])) {
          // Anti-downgrade protection for users: NEVER overwrite newer local passwords with older server copies
          const incomingUsers = serverRecs[tbl] || [];
          const currentUsers = this.data[tbl] || [];
          const userMap = new Map();
          currentUsers.forEach(u => {
            if (u) {
              if (u.id) userMap.set(u.id, u);
              if (u.username) userMap.set(String(u.username).toLowerCase(), u);
            }
          });

          const mergedUsers = incomingUsers.map(inUser => {
            if (!inUser) return inUser;
            const local = userMap.get(inUser.id) || (inUser.username ? userMap.get(String(inUser.username).toLowerCase()) : null);
            if (local) {
              const localTs = new Date(local.passwordChangedAt || local.updatedAt || local.lastPasswordReset || 0).getTime();
              const serverTs = new Date(inUser.passwordChangedAt || inUser.updatedAt || inUser.lastPasswordReset || 0).getTime();
              if (localTs > serverTs) {
                // Local password / credentials are newer than server record; preserve local!
                return {
                  ...inUser,
                  password: local.password,
                  passwordHash: local.passwordHash,
                  passwordStatus: local.passwordStatus,
                  mustChangePassword: local.mustChangePassword,
                  passwordChangedAt: local.passwordChangedAt,
                  lastPasswordReset: local.lastPasswordReset,
                  updatedAt: local.updatedAt
                };
              }
            }
            return inUser;
          });
          this.data[tbl] = mergedUsers;
        } else {
          // Firestore / persistent database is the authoritative single source of truth
          this.data[tbl] = serverRecs[tbl];
        }

        try {
          idbCache.setTable(tbl, this.data[tbl]);
        } catch (_) {}
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + tbl, JSON.stringify(this.data[tbl]));
        } catch (_) {}
        updated = true;
      } else if (serverRecs[tbl] && typeof serverRecs[tbl] === 'object' && !Array.isArray(serverRecs[tbl])) {
        // Handle object tables such as settings and homepage_config
        if (tbl === TABLE_NAMES.SETTINGS) {
          const isViewingSettings = typeof window !== 'undefined' && window.state && window.state.get('currentView') === 'settings';
          if (!isViewingSettings) {
            const incomingSettings = serverRecs[tbl];
            if (incomingSettings && typeof incomingSettings === 'object' && Object.keys(incomingSettings).length > 0) {
              const localMultiDb = localStorage.getItem('erp_multi_db_config');
              let preservedMultiDb = null;
              if (localMultiDb) {
                try { preservedMultiDb = JSON.parse(localMultiDb); } catch (_) {}
              }

              // Preserve locally updated admin slug and visibility mode if local has newer timestamp
              const localSlug = this.data[tbl]?.adminLoginSlug || (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_admin_login_slug') : null);
              const localSlugTs = this.data[tbl]?.adminLoginSlugUpdatedAt || (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_admin_login_slug_updated_at') : null);
              const remoteSlugTs = incomingSettings.adminLoginSlugUpdatedAt;
              const keepLocalSlug = Boolean(localSlug && localSlugTs && (!remoteSlugTs || new Date(localSlugTs) >= new Date(remoteSlugTs)));

              const localMode = this.data[tbl]?.homepageVisibilityMode || (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_homepage_visibility_mode') : null);
              const localModeTs = this.data[tbl]?.homepageVisibilityUpdatedAt || (typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_homepage_visibility_updated_at') : null);
              const remoteModeTs = incomingSettings.homepageVisibilityUpdatedAt;
              const keepLocalMode = Boolean(localMode && localModeTs && (!remoteModeTs || new Date(localModeTs) >= new Date(remoteModeTs)));

              this.data[tbl] = {
                ...(this.data[tbl] || {}),
                ...incomingSettings
              };

              if (keepLocalSlug) {
                this.data[tbl].adminLoginSlug = localSlug;
                this.data[tbl].adminLoginSlugUpdatedAt = localSlugTs;
              }
              if (keepLocalMode) {
                this.data[tbl].homepageVisibilityMode = localMode;
                this.data[tbl].homepageVisibilityUpdatedAt = localModeTs;
              }

              if (preservedMultiDb && Array.isArray(preservedMultiDb)) {
                this.data[tbl].multi_db_config = preservedMultiDb;
              }

              if (this.data[tbl].adminLoginSlug && typeof localStorage !== 'undefined') {
                try {
                  localStorage.setItem('al_muslim_admin_login_slug', this.data[tbl].adminLoginSlug);
                } catch (_) {}
              }

              if (this.data[tbl].homepageVisibilityMode && typeof localStorage !== 'undefined') {
                try {
                  localStorage.setItem('al_muslim_homepage_visibility_mode', this.data[tbl].homepageVisibilityMode);
                } catch (_) {}
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('erp:homepage-visibility-changed', {
                    detail: { mode: this.data[tbl].homepageVisibilityMode }
                  }));
                }
              }

              try {
                localStorage.setItem(STORAGE_KEY_PREFIX + tbl, JSON.stringify(this.data[tbl]));
              } catch (_) {}
              updated = true;
            }
          }
        } else if (tbl === TABLE_NAMES.HOMEPAGE_CONFIG) {
          this.data[tbl] = serverRecs[tbl];
          try {
            localStorage.setItem(STORAGE_KEY_PREFIX + tbl, JSON.stringify(this.data[tbl]));
            localStorage.setItem('al_muslim_homepage_published_config', JSON.stringify(this.data[tbl]));
          } catch (_) {}
          try {
            idbCache.setTable(tbl, this.data[tbl]);
          } catch (_) {}
          updated = true;
        }
      }
    });

    if (updated) {
      this._invalidateTableIdMap();
      this.rebuildAllIndexes();
      this.updateStatusBadge('saved');
      console.log(`[Database Store] ✅ Synchronized with ${sourceName}. Total machines: ${this.data[TABLE_NAMES.MACHINES]?.length || 0}, Total lines: ${this.data[TABLE_NAMES.LINES]?.length || 0}`);

      if (typeof window !== 'undefined') {
        const hasMachinesUpdated = serverRecs && (TABLE_NAMES.MACHINES in serverRecs);
        const hasMasterDataUpdated = serverRecs && (
          TABLE_NAMES.GROUPS in serverRecs ||
          TABLE_NAMES.UNITS in serverRecs ||
          TABLE_NAMES.FLOORS in serverRecs ||
          TABLE_NAMES.LINES in serverRecs ||
          TABLE_NAMES.MACHINE_NAMES in serverRecs ||
          TABLE_NAMES.BRANDS in serverRecs ||
          TABLE_NAMES.MODELS in serverRecs ||
          TABLE_NAMES.CATEGORIES in serverRecs
        );

        if (hasMasterDataUpdated) {
          window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
        }
        const hasTransfersUpdated = serverRecs && (
          TABLE_NAMES.TRANSFERS in serverRecs ||
          TABLE_NAMES.TRANSFER_REQUESTS in serverRecs ||
          TABLE_NAMES.APPROVAL_REQUESTS in serverRecs
        );
        if (hasTransfersUpdated) {
          window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
        }
        window.dispatchEvent(new CustomEvent('erp:storage-updated'));
        if (hasMachinesUpdated) {
          window.dispatchEvent(new CustomEvent('erp:inventory-updated'));
          if (window.state && typeof window.state.emit === 'function') {
            window.state.emit('inventory:updated');
          }
        }
        if (TABLE_NAMES.PREVENTIVE_MAINTENANCE in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
        }
        if (TABLE_NAMES.AUDIT_LOGS in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:audit-logs-updated'));
        }
        if (TABLE_NAMES.MACHINE_HISTORY in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:history-updated'));
        }
        if (TABLE_NAMES.SPARE_PARTS in serverRecs || TABLE_NAMES.SPARE_PARTS_MASTER in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:spare-parts-updated'));
        }
        if (TABLE_NAMES.TOOLS_MASTER in serverRecs || TABLE_NAMES.TOOL_ALLOCATIONS in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:tools-updated'));
        }
        if (TABLE_NAMES.EMPLOYEES in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:employees-updated'));
        }
        if (TABLE_NAMES.ET_BOARDS in serverRecs || TABLE_NAMES.ET_BOARD_HISTORY in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:et-lab-updated'));
        }
        if (TABLE_NAMES.RELOCATE_SESSIONS in serverRecs || TABLE_NAMES.RELOCATION_HISTORY in serverRecs) {
          window.dispatchEvent(new CustomEvent('erp:relocate-updated'));
        }
        // Dispatch homepage-specific event when homepage_config is updated from remote
        if (serverRecs && serverRecs[TABLE_NAMES.HOMEPAGE_CONFIG]) {
          window.dispatchEvent(new CustomEvent('erp:homepage-updated', {
            detail: this.data[TABLE_NAMES.HOMEPAGE_CONFIG]
          }));
        }
      }
    }
    return updated;
  }

  async syncWithServerDatabase(force = false) {
    let cloudLoadedSuccessfully = false;
    const fetchStartTime = Date.now();

    // 0. Primary Adapter (MySQL) Startup Sync with Option A 0ms Cache Check
    try {
      await syncManager._ensureConfig();
      if (syncManager.primaryAdapter && syncManager.primaryAdapter.type === 'MYSQL') {
        const localMachCount = this.data[TABLE_NAMES.MACHINES]?.length || 0;
        const hasFullLocalData = (localMachCount >= 6400) && (this.data[TABLE_NAMES.USERS]?.length > 0);
        const lastSyncTs = typeof localStorage !== 'undefined' ? localStorage.getItem('erp_last_mysql_sync_ts') : '';

        // OPTION A OPTIMIZATION: Check if MySQL Primary data was modified before making heavy download
        if (!force && hasFullLocalData && typeof syncManager.primaryAdapter.checkVersion === 'function') {
          try {
            const verRes = await syncManager.primaryAdapter.checkVersion(lastSyncTs || 0);
            const serverMachCount = verRes?.tables?.machines?.count || 6450;
            // Case 1: Zero modifications across all tables -> instant 0ms confirmation
            if (verRes && verRes.success && verRes.modified === false && localMachCount >= serverMachCount) {
              console.log(`[Storage Option A] ⚡ 0ms Cache Hit: MySQL Primary unchanged (${Date.now() - fetchStartTime}ms). 100% Data freshness verified from local store (${localMachCount} machines).`);
              this._isCloudConnected = true;
              cloudLoadedSuccessfully = true;
              this._hasCriticalSyncCompleted = true;
              this._hasInitialSyncCompleted = true;
              this._hasFullSecondarySyncCompleted = true;
              this._suppressServerPersist = false;
              this.updateStatusBadge('saved');

              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('erp:critical-data-ready'));
                window.dispatchEvent(new CustomEvent('erp:storage-updated'));
                window.dispatchEvent(new CustomEvent('erp:secondary-data-ready'));
              }
              return;
            }

            // Case 2: Granular Delta Sync (Oracle APEX style)
            // If machines table is untouched on server, bypass 12MB monolithic download and only fetch changed delta tables
            const machMeta = verRes?.tables?.machines;
            const machUnchanged = machMeta && (machMeta.count === localMachCount) && (!lastSyncTs || (machMeta.timestamp * 1000 <= Number(lastSyncTs) + 5000));
            if (verRes && verRes.success && machUnchanged && localMachCount >= 6400) {
              console.log(`[Storage Granular Sync] 🚀 Machines table unchanged (${localMachCount} records). Bypassing heavy 12MB download, syncing only modified delta tables...`);
              this._isCloudConnected = true;
              cloudLoadedSuccessfully = true;
              this._hasCriticalSyncCompleted = true;
              this._hasInitialSyncCompleted = true;
              this._hasFullSecondarySyncCompleted = true;
              this._suppressServerPersist = false;
              this.updateStatusBadge('saved');
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('erp_last_mysql_sync_ts', String(Date.now()));
              }
              // Granularly fetch only modified tables in background
              this.checkAndSyncRemoteChanges().catch(() => {});
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('erp:critical-data-ready'));
                window.dispatchEvent(new CustomEvent('erp:storage-updated'));
                window.dispatchEvent(new CustomEvent('erp:secondary-data-ready'));
              }
              return;
            }
          } catch (_) {}
        }

        const mysqlRes = await syncManager.primaryAdapter.getAllTables();
        if (mysqlRes && mysqlRes.success && mysqlRes.tables && Object.keys(mysqlRes.tables).length > 0) {
          console.log(`[Storage] 🐬 Loaded ${Object.keys(mysqlRes.tables).length} tables from MySQL Primary (${syncManager.primaryAdapter.endpoint})`);
          this.applyIncomingDatabaseRecords(mysqlRes.tables, 'MySQL Primary');
          this._isCloudConnected = true;
          cloudLoadedSuccessfully = true;
          this._hasCriticalSyncCompleted = true;
          this._hasInitialSyncCompleted = true;
          this._hasFullSecondarySyncCompleted = true;
          this._suppressServerPersist = false;
          Object.keys(mysqlRes.tables).forEach(t => this._loadedSecondaryTables.add(t));
          this.updateStatusBadge('saved');
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('erp_last_mysql_sync_ts', String(Date.now()));
          }

          // Seed syncedDocVersions with initial MySQL timestamps so multi-device polling tracks incremental changes cleanly
          syncManager.primaryAdapter.getTableTimestamps().then(tsRes => {
            if (tsRes && tsRes.success && tsRes.timestamps) {
              for (const [tbl, ts] of Object.entries(tsRes.timestamps)) {
                this.syncedDocVersions.set('mysql_' + tbl, ts);
                this.syncedDocVersions.set(tbl, ts);
              }
            }
          }).catch(() => {});

          // Asynchronously backup to PostgreSQL secondary replica (unidirectional MySQL -> PostgreSQL)
          syncManager.backupToPostgres().catch(err => {
            console.warn('[Storage Startup] PostgreSQL replica backup notice:', err.message);
          });

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('erp:critical-data-ready'));
            window.dispatchEvent(new CustomEvent('erp:storage-updated'));
            window.dispatchEvent(new CustomEvent('erp:secondary-data-ready'));
            window.dispatchEvent(new CustomEvent('erp:tools-updated'));
          }

          return;
        }
      }
    } catch (e) {
      console.warn('[Storage] MySQL Primary startup sync notice:', e.message);
      this._hasInitialSyncCompleted = true;
      this._suppressServerPersist = false;
    }

    // 1. Enterprise Read Failover: If MySQL Primary is unreachable, seamlessly load all tables from PostgreSQL replica
    if (!cloudLoadedSuccessfully) {
      console.warn('[Storage] ⚠️ MySQL Primary is unreachable. Initiating Automatic Read Failover to PostgreSQL replica...');
      const pgAdapter = syncManager.getPostgresAdapter();
      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgRes = await pgAdapter.getAllTables();
          if (pgRes && pgRes.success && pgRes.tables && Object.keys(pgRes.tables).length > 0) {
            console.log(`[Storage Failover] 🐘 Successfully loaded ${Object.keys(pgRes.tables).length} tables from PostgreSQL Fallback Replica!`);
            this.applyIncomingDatabaseRecords(pgRes.tables, 'PostgreSQL Fallback Replica');
            this._isCloudConnected = true;
            cloudLoadedSuccessfully = true;
            this._hasCriticalSyncCompleted = true;
            this._hasInitialSyncCompleted = true;
            this._hasFullSecondarySyncCompleted = true;
            this._suppressServerPersist = false;
            Object.keys(pgRes.tables).forEach(t => this._loadedSecondaryTables.add(t));

            syncManager.setFailoverMode(true, 'MySQL Primary unreachable during startup');
            this.updateStatusBadge('failover');

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('erp:critical-data-ready'));
              window.dispatchEvent(new CustomEvent('erp:storage-updated'));
              window.dispatchEvent(new CustomEvent('erp:secondary-data-ready'));
              window.dispatchEvent(new CustomEvent('erp:tools-updated'));
            }
            return;
          }
        } catch (pgErr) {
          console.error('[Storage Failover] PostgreSQL read fallback error:', pgErr);
        }
      }

      console.warn('[Storage] ⚠️ Both MySQL and PostgreSQL are unreachable. Preserving authoritative local cache without overwriting operational state.');
      this._isCloudConnected = false;
      this._hasInitialSyncCompleted = true;
      this._suppressServerPersist = false;
      this.updateStatusBadge('offline');
    }

    // 2. Local Node.js server sync (Secondary / Offline Backup only)
    try {
      const url = getApiEndpoint('/api/db/records');
      if (cloudLoadedSuccessfully) {
        // Keep local Node server in sync with cloud data
        const cu = (typeof window !== 'undefined' && window.authService?.getCurrentUser) ? window.authService.getCurrentUser() : null;
        fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-User-Role': cu?.role || '',
            'X-User-Id': cu?.id || ''
          },
          body: JSON.stringify(this.data)
        }).catch(() => {});
      } else {
        // Cloud was unavailable: only fallback if local memory has no machine data
        const hasExistingData = (this.data[TABLE_NAMES.MACHINES]?.length > 0) || (this.data[TABLE_NAMES.USERS]?.length > 0);
        if (!hasExistingData) {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.status === 'ok' && data.records && typeof data.records === 'object') {
              const serverRecs = data.records;
              const hasServerData = Array.isArray(serverRecs.machines) && serverRecs.machines.length > 0;
              if (hasServerData) {
                this.applyIncomingDatabaseRecords(serverRecs, 'Local Server (data/erp_database.json)');
              }
            }
          }
        }
      }
    } catch (e) {
      if (!cloudLoadedSuccessfully) {
        const hasExistingData = (this.data[TABLE_NAMES.MACHINES]?.length > 0) || (this.data[TABLE_NAMES.USERS]?.length > 0);
        if (!hasExistingData) {
          // 3. Static database fallback ONLY if no cached data exists at all
          try {
            const staticRes = await fetch('data/erp_database.json?v=' + Date.now(), { cache: 'no-store' });
            if (staticRes.ok) {
              const staticData = await staticRes.json();
              if (staticData && Array.isArray(staticData.machines) && staticData.machines.length > 0) {
                this.applyIncomingDatabaseRecords(staticData, 'Static Factory Database (data/erp_database.json)');
              }
            }
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Fast, targeted refresh of a single table directly from MySQL Primary Database (<200ms).
   * Enterprise Failover: If MySQL is offline or in failover mode, seamlessly fetches from PostgreSQL replica.
   *
   * @param {string} tableName - e.g. TABLE_NAMES.USERS or TABLE_NAMES.EMPLOYEES
   * @returns {Promise<{success: boolean, count: number}>}
   */
  async refreshTableFromMySQL(tableName) {
    if (!tableName) return { success: false, count: 0 };
    try {
      await syncManager._ensureConfig();

      // Failover Route: If failover is active, fetch from PostgreSQL replica
      if (syncManager && syncManager.isFailoverActive) {
        const pgAdapter = syncManager.getPostgresAdapter();
        if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
          console.log(`[Storage Failover] 🐘 Refreshing table '${tableName}' from PostgreSQL replica...`);
          try {
            const pgRes = await pgAdapter.getTable(tableName);
            if (pgRes && pgRes.success && pgRes.data !== undefined) {
              const records = pgRes.data;
              this.data[tableName] = records;
              this._invalidateTableIdMap(tableName);
              try { await idbCache.setTable(tableName, records); } catch (_) {}
              try { localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(records)); } catch (_) {}
              const confirmedTs = pgRes.updateTime || new Date().toISOString();
              this.syncedDocVersions.set(tableName, confirmedTs);
              this.updateStatusBadge('failover');
              const count = Array.isArray(records) ? records.length : (records && typeof records === 'object' ? Object.keys(records).length : 0);
              return { success: true, count, failover: true };
            }
          } catch (pgErr) {
            console.warn(`[Storage Failover] PostgreSQL getTable('${tableName}') failed:`, pgErr.message);
          }
        }
      }

      if (!syncManager.primaryAdapter || syncManager.primaryAdapter.type !== 'MYSQL') {
        throw new Error('MySQL Primary adapter is not configured or offline.');
      }

      console.log(`[Storage] 🐬 Refreshing table '${tableName}' directly from MySQL Primary...`);
      let res = null;
      try {
        res = await syncManager.primaryAdapter.getTable(tableName);
      } catch (fetchErr) {
        res = { success: false, error: fetchErr.message };
      }

      // If MySQL fails, failover to PostgreSQL
      if (!res || !res.success || res.data === undefined) {
        console.warn(`[Storage] MySQL getTable('${tableName}') failed. Triggering PostgreSQL fallback...`);
        const pgAdapter = syncManager.getPostgresAdapter();
        if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
          try {
            const pgRes = await pgAdapter.getTable(tableName);
            if (pgRes && pgRes.success && pgRes.data !== undefined) {
              syncManager.setFailoverMode(true, `MySQL getTable('${tableName}') failed`);
              const records = pgRes.data;
              this.data[tableName] = records;
              this._invalidateTableIdMap(tableName);
              try { await idbCache.setTable(tableName, records); } catch (_) {}
              try { localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(records)); } catch (_) {}
              const confirmedTs = pgRes.updateTime || new Date().toISOString();
              this.syncedDocVersions.set(tableName, confirmedTs);
              this.updateStatusBadge('failover');
              const count = Array.isArray(records) ? records.length : (records && typeof records === 'object' ? Object.keys(records).length : 0);
              return { success: true, count, failover: true };
            }
          } catch (_) {}
        }
        return { success: false, count: 0, error: res?.error || 'Failed to fetch table from MySQL Primary' };
      }

      const records = res.data;
      this.data[tableName] = records;
      this._invalidateTableIdMap(tableName);

      // Update high-capacity caches
      try { await idbCache.setTable(tableName, records); } catch (_) {}
      try { localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(records)); } catch (_) {}

      // Update sync timestamp
      const confirmedTs = res.updateTime || new Date().toISOString();
      this.syncedDocVersions.set('mysql_' + tableName, confirmedTs);
      this.syncedDocVersions.set(tableName, confirmedTs);
      if (!this.lastTableUpdates) this.lastTableUpdates = {};
      this.lastTableUpdates[tableName] = Date.now();

      // Dispatch events
      if (typeof window !== 'undefined') {
        if (tableName === TABLE_NAMES.USERS) {
          window.dispatchEvent(new CustomEvent('erp:users-updated'));
        } else if (tableName === TABLE_NAMES.EMPLOYEES) {
          window.dispatchEvent(new CustomEvent('erp:employees-updated'));
        } else if (tableName === TABLE_NAMES.MACHINES) {
          this.rebuildAllIndexes();
          window.dispatchEvent(new CustomEvent('erp:inventory-updated'));
        }
        window.dispatchEvent(new CustomEvent('erp:storage-updated'));
      }

      this.updateStatusBadge('saved');
      const count = Array.isArray(records) ? records.length : (records && typeof records === 'object' ? Object.keys(records).length : 0);
      return { success: true, count };
    } catch (err) {
      console.warn(`[Storage] Refresh table '${tableName}' failed:`, err.message);
      return { success: false, count: 0, error: err.message };
    }
  }

  /**
   * Authoritative MySQL Primary Database Synchronization.
   * Triggered by the header status badge or manual sync actions.
   * If in Failover Mode: checks if MySQL Primary is back online and performs Auto-Recovery (Reverse Sync).
   */
  async syncWithMySQLPrimary() {
    this.updateStatusBadge('saving');
    try {
      await syncManager._ensureConfig();

      // 1. Failover Mode Recovery Check
      if (syncManager && syncManager.isFailoverActive) {
        console.log('[Storage Sync] Currently in PostgreSQL Failover Mode. Checking if MySQL Primary has recovered...');
        const recovered = await syncManager.checkPrimaryRecovery();
        if (recovered) {
          const pendingCount = await syncManager.getPendingRecoveryCount();
          return { success: true, timestamp: new Date().toLocaleTimeString(), recoveryPending: true, pendingCount };
        } else {
          this.updateStatusBadge('failover');
          return { success: true, timestamp: new Date().toLocaleTimeString(), failover: true };
        }
      }

      if (!syncManager.primaryAdapter || syncManager.primaryAdapter.type !== 'MYSQL') {
        throw new Error('MySQL Primary adapter is not configured.');
      }

      // 2. Ping MySQL Primary
      let pingRes = null;
      try {
        const pingFn = typeof syncManager.primaryAdapter.ping === 'function'
          ? syncManager.primaryAdapter.ping.bind(syncManager.primaryAdapter)
          : syncManager.primaryAdapter.testConnection.bind(syncManager.primaryAdapter);
        pingRes = await pingFn();
      } catch (pErr) {
        pingRes = { success: false, error: pErr.message };
      }

      if (!pingRes || !pingRes.success) {
        console.warn('[Sync] MySQL Primary ping failed. Activating PostgreSQL Failover...');
        syncManager.setFailoverMode(true, pingRes?.error || 'MySQL ping failed');
        this.updateStatusBadge('failover');
        return { success: true, timestamp: new Date().toLocaleTimeString(), failover: true };
      }

      // 3. Sync remote table changes
      await this.checkAndSyncRemoteChanges();

      // 4. Trigger unidirectional background backup to PostgreSQL Secondary Replica
      syncManager.backupToPostgres().catch(err => {
        console.warn('[Sync] Background PostgreSQL backup notice:', err.message);
      });

      this._isCloudConnected = true;
      const nowStr = new Date().toLocaleTimeString();
      this.updateStatusBadge('saved');

      const statusEl = document.getElementById('nav-db-status');
      if (statusEl) {
        statusEl.title = `System Cloud Synchronized (Last Sync: ${nowStr})`;
      }

      return { success: true, timestamp: nowStr };
    } catch (err) {
      console.error('[Sync] MySQL Primary sync error:', err);
      this.updateStatusBadge('error');
      throw err;
    }
  }

  /**
   * Schedules a non-blocking background fetch for secondary tables in small batches
   * Ensures the main thread and UI remain responsive while secondary data streams in
   */
  scheduleDeferredSecondarySync(manifest) {
    this._hasFullSecondarySyncCompleted = true;
    this._isDeferredSyncRunning = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:secondary-data-ready'));
    }
  }

  /**
   * On-demand loader for a list of tables
   * Used when user navigates directly to a module before background sync finishes
   */
  async ensureTablesLoaded(tableList) {
    if (!Array.isArray(tableList) || tableList.length === 0) return true;
    const needed = tableList.filter(tbl => {
      if (CRITICAL_TABLES.includes(tbl) && this._hasCriticalSyncCompleted) return false;
      if (this._loadedSecondaryTables.has(tbl)) return false;
      return true;
    });

    if (needed.length === 0) return true;

    try {
      console.log(`[Storage] ⚡ On-demand loading for ${needed.join(', ')}...`);
      const results = await Promise.all(
        needed.map(async (tbl) => {
          try {
            if (syncManager.primaryAdapter && typeof syncManager.primaryAdapter.getTable === 'function') {
              const res = await syncManager.primaryAdapter.getTable(tbl);
              return { tbl, res };
            }
            return { tbl, res: null };
          } catch (_) {
            return { tbl, res: null };
          }
        })
      );

      const recordsToApply = {};
      for (const { tbl, res } of results) {
        if (res && res.success && res.data !== undefined) {
          recordsToApply[tbl] = res.data;
          this._loadedSecondaryTables.add(tbl);
        }
      }

      if (Object.keys(recordsToApply).length > 0) {
        this.applyIncomingDatabaseRecords(recordsToApply, `On-Demand Module (${needed.join(', ')})`);
      }
      return true;
    } catch (e) {
      console.warn('[Storage] On-demand load note:', e.message);
      return false;
    }
  }

  /**
   * On-demand loader for a specific view route
   */
  async ensureTablesForView(view) {
    const tables = MODULE_TABLE_MAP[view];
    if (tables && tables.length > 0) {
      return this.ensureTablesLoaded(tables);
    }
    return true;
  }

  async persistToServerDatabase() {
    if (this._suppressServerPersist) return { status: 'suppressed' };

    // On GitHub Pages or static file host, remote persistence is handled via MySQL Primary (syncManager)
    const currentHost = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
    const currentProto = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : '';
    if (typeof window !== 'undefined' && window.location && (currentHost.includes('github.io') || currentProto === 'file:')) {
      if (this._isCloudConnected) {
        this.updateStatusBadge('saved');
      }
      return { status: 'ok', staticHost: true };
    }

    if (!this.data || !Array.isArray(this.data[TABLE_NAMES.MACHINES]) || this.data[TABLE_NAMES.MACHINES].length === 0) {
      return { status: 'skipped' };
    }

    if (this._autoPersistDebounce) {
      clearTimeout(this._autoPersistDebounce);
      this._autoPersistDebounce = null;
    }

    if (this._activePersistPromise) {
      this._hasPendingPersist = true;
      try {
        await this._activePersistPromise;
      } catch (_) {}
      if (this._hasPendingPersist) {
        return this.persistToServerDatabase();
      }
      return { status: 'ok' };
    }

    this._hasPendingPersist = false;
    this.updateStatusBadge('saving');

    this._activePersistPromise = (async () => {
      try {
        const payload = JSON.stringify(this.data);
        const url = getApiEndpoint('/api/db/records');
        const cu = (typeof window !== 'undefined' && window.authService?.getCurrentUser) ? window.authService.getCurrentUser() : null;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-User-Role': cu?.role || '',
            'X-User-Id': cu?.id || '',
            'X-Location-Scope': cu?.assignedScope ? JSON.stringify(cu.assignedScope) : ''
          },
          body: payload
        });

        if (res.ok) {
          const result = await res.json().catch(() => ({}));
          this.updateStatusBadge('saved', result);
          console.log(`[Database Store] ✅ Saved to persistent server database: data/erp_database.json (${result.machinesCount || this.data[TABLE_NAMES.MACHINES]?.length || 0} machines, ${result.linesCount || this.data[TABLE_NAMES.LINES]?.length || 0} lines)`);
          return result;
        } else {
          // If local server returned 404/error (e.g. GitHub Pages), keep saved badge if cloud connected
          if (this._isCloudConnected || (syncManager && syncManager.primaryAdapter)) {
            this.updateStatusBadge('saved');
            return { status: 'ok', cloud: true };
          }
          this.updateStatusBadge('error');
          console.warn(`[Database Store] ⚠️ Persistence server returned status: ${res.status}`);
          return { status: 'error', code: res.status };
        }
      } catch (err) {
        if (this._isCloudConnected || (syncManager && syncManager.primaryAdapter)) {
          this.updateStatusBadge('saved');
          return { status: 'ok', cloud: true };
        }
        this.updateStatusBadge('offline');
        console.warn('[Database Store] ⚠️ Persistence offline / network note:', err.message);
        return { status: 'offline', error: err.message };
      } finally {
        this._activePersistPromise = null;
      }
    })();

    const finalResult = await this._activePersistPromise;
    if (this._hasPendingPersist) {
      return this.persistToServerDatabase();
    }
    return finalResult;
  }

  flushImmediate() {
    if (this._suppressServerPersist) return;

    // Immediately trigger any pending single-table cloud persistence
    if (this._cloudPersistDebounces) {
      Object.keys(this._cloudPersistDebounces).forEach(table => {
        if (this._cloudPersistDebounces[table]) {
          clearTimeout(this._cloudPersistDebounces[table]);
          this._cloudPersistDebounces[table] = null;
          syncManager.saveTable(table, this.data[table]).catch(() => {});
        }
      });
    }

    if (!this.data || !Array.isArray(this.data[TABLE_NAMES.MACHINES]) || this.data[TABLE_NAMES.MACHINES].length === 0) {
      return;
    }

    try {
      const payload = JSON.stringify(this.data);
      const url = getApiEndpoint('/api/db/records');
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else if (typeof fetch === 'function') {
        const cu = (typeof window !== 'undefined' && window.authService?.getCurrentUser) ? window.authService.getCurrentUser() : null;
        fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-User-Role': cu?.role || '',
            'X-User-Id': cu?.id || ''
          },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch (_) {}
  }

  updateStatusBadge(status, details = null) {
    if (typeof document === 'undefined') return;
    const statusEl = document.getElementById('nav-db-status');
    if (!statusEl) return;

    if (status === 'saving') {
      statusEl.style.borderColor = 'rgba(245, 158, 11, 0.5)';
      statusEl.style.background = 'rgba(245, 158, 11, 0.12)';
      statusEl.style.color = '#fbbf24';
      statusEl.title = 'Syncing changes to Cloud Database...';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">⚡</span><span class="db-status-text">Syncing...</span>';
    } else if (status === 'failover') {
      // Seamless High Availability: Keep status green and clean without tech leaks
      statusEl.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#34d399';
      statusEl.title = 'Cloud Network Active (High Availability)';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">☁️</span><span class="db-status-text">Cloud Synced</span>';
    } else if (status === 'recovery-pending') {
      statusEl.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#34d399';
      statusEl.title = 'Cloud Network Synchronized';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">☁️</span><span class="db-status-text">System Synced</span>';
    } else if (status === 'recovering') {
      statusEl.style.borderColor = 'rgba(56, 189, 248, 0.6)';
      statusEl.style.background = 'rgba(56, 189, 248, 0.16)';
      statusEl.style.color = '#38bdf8';
      statusEl.title = 'Updating cloud records...';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">🔄</span><span class="db-status-text">Updating...</span>';
    } else if (status === 'saved' || status === 'synced') {
      statusEl.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#34d399';
      statusEl.title = 'System Cloud Database Synchronized';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">☁️</span><span class="db-status-text">System Synced</span>';
    } else if (status === 'error') {
      // Distinct error state: cloud write was attempted but failed
      statusEl.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      statusEl.style.background = 'rgba(239, 68, 68, 0.18)';
      statusEl.style.color = '#f87171';
      statusEl.title = 'Connection Notice — Reconnecting to cloud...';
      statusEl.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:pulse 1s infinite;"></span><span class="db-status-text">Reconnecting...</span>';
    } else if (status === 'offline') {
      statusEl.style.borderColor = 'rgba(148, 163, 184, 0.4)';
      statusEl.style.background = 'rgba(148, 163, 184, 0.12)';
      statusEl.style.color = '#94a3b8';
      statusEl.title = 'Offline mode — reconnect to sync';
      statusEl.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#94a3b8;"></span><span class="db-status-text">Offline</span>';
    }
  }

  rebuildAllIndexes() {
    this._invalidateTableIdMap(TABLE_NAMES.MACHINES);
    this.indexes.machineBySerial.clear();
    if (this.indexes.machineByAssetId) this.indexes.machineByAssetId.clear();
    this.indexes.machinesByLine.clear();
    this.indexes.machinesByUnit.clear();
    this.indexes.machinesByFloor.clear();
    this.indexes.machinesByName.clear();
    this.indexes.machinesByBrand.clear();
    this.indexes.machinesByModel.clear();
    this.indexes.machinesByStatus.clear();

    const machines = this.data[TABLE_NAMES.MACHINES] || [];
    machines.forEach(mc => {
      if (mc.serialNumber) {
        this.indexes.machineBySerial.set(mc.serialNumber.trim().toUpperCase(), mc);
      }
      if (mc.systemAssetId && this.indexes.machineByAssetId) {
        this.indexes.machineByAssetId.set(mc.systemAssetId.trim().toUpperCase(), mc);
      }
      if (mc.permanentMachineId && this.indexes.machineByAssetId) {
        const rawUpper = mc.permanentMachineId.trim().toUpperCase();
        this.indexes.machineByAssetId.set(rawUpper, mc);
        const amgVariant = rawUpper.replace(/^MID-/i, 'AMG-MNT-');
        this.indexes.machineByAssetId.set(amgVariant, mc);
      }

      this._addToIndexMap(this.indexes.machinesByLine, mc.lineId, mc);
      this._addToIndexMap(this.indexes.machinesByUnit, mc.unitId, mc);
      this._addToIndexMap(this.indexes.machinesByFloor, mc.floorId, mc);
      this._addToIndexMap(this.indexes.machinesByName, mc.machineNameId, mc);
      this._addToIndexMap(this.indexes.machinesByBrand, mc.brandId, mc);
      this._addToIndexMap(this.indexes.machinesByModel, mc.modelId, mc);
      this._addToIndexMap(this.indexes.machinesByStatus, mc.status, mc);
    });
  }

  _addToIndexMap(map, key, item) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }

  getTable(tableName) {
    return this.data[tableName] || [];
  }

  resolveMachineName(m) {
    if (!m) return 'Plane Machine';
    const brandTable = this.data[TABLE_NAMES.BRANDS] || [];
    const brandSet = new Set(brandTable.map(b => (b?.name || '').trim().toLowerCase()).filter(Boolean));
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.brands)) {
      INITIAL_DATA.brands.forEach(b => { if (b?.name) brandSet.add(b.name.trim().toLowerCase()); });
    }

    let nameFromId = '';
    if (m.machineNameId) {
      const mnObj = this.getItem(TABLE_NAMES.MACHINE_NAMES, m.machineNameId);
      if (mnObj && mnObj.name) nameFromId = mnObj.name.trim();
    }

    const isBrand = nameFromId && brandSet.has(nameFromId.toLowerCase());
    if (nameFromId && !isBrand && nameFromId !== 'Sewing Machine') {
      return nameFromId;
    }

    // Serial prefix match (e.g. C/C/M -> Cloth Cutting Machine, T/S -> Thread Sucker, Z/Z -> Zig Zag Machine)
    if (m.serialNumber && typeof m.serialNumber === 'string') {
      const s = m.serialNumber.trim();
      for (const [pfx, canon] of Object.entries(SERIAL_PREFIX_MAP)) {
        if (s.startsWith(pfx + '-') || s.startsWith(pfx + ' ') || s.startsWith(pfx + '/') || s.toUpperCase().startsWith(pfx.toUpperCase() + '-')) {
          return canon;
        }
      }
      const part = s.split(/[-_]/)[0];
      if (SERIAL_PREFIX_MAP[part]) return SERIAL_PREFIX_MAP[part];
    }

    if (nameFromId && !isBrand) return nameFromId;

    // Inline machineName / name (if not brand name)
    const inline = (m.machineName || m.name || '').trim();
    if (inline && !brandSet.has(inline.toLowerCase())) {
      return inline;
    }

    return 'Plane Machine';
  }

  resolveMachineModel(m) {
    if (!m) return 'Standard';

    // 1. Check raw inline fields on machine first if they have a non-"Standard" factory model
    const raw = (m.model || m.modelName || m.modelStr || (m.customValues && m.customValues.model) || '').trim();
    if (raw && raw.toLowerCase() !== 'standard') return raw;

    // 2. Lookup by m.modelId in MODELS table
    let mdl = '';
    if (m.modelId) {
      const mdlObj = this.getItem(TABLE_NAMES.MODELS, m.modelId);
      if (mdlObj && mdlObj.name) mdl = mdlObj.name.trim();
    }
    if (mdl && mdl.toLowerCase() !== 'standard') return mdl;

    // 3. Master seed & canonical fallback lookup
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machines)) {
      if (!this._initialMachineBySerial) {
        this._initialMachineBySerial = new Map();
        this._initialMachineById = new Map();
        (INITIAL_DATA.machines || []).forEach(im => {
          if (im && im.serialNumber) this._initialMachineBySerial.set(String(im.serialNumber).trim().toUpperCase(), im);
          if (im && im.id) this._initialMachineById.set(im.id, im);
        });
      }
      const sn = (m.serialNumber || '').trim().toUpperCase();
      const canon = (sn ? this._initialMachineBySerial.get(sn) : null) || (m.id ? this._initialMachineById.get(m.id) : null);
      if (canon) {
        const cRaw = (canon.model || canon.modelName || canon.modelStr || '').trim();
        if (cRaw && cRaw.toLowerCase() !== 'standard') return cRaw;
        if (canon.modelId) {
          const cMdlObj = this.getItem(TABLE_NAMES.MODELS, canon.modelId) || (INITIAL_DATA.models || []).find(x => x.id === canon.modelId);
          if (cMdlObj && cMdlObj.name && cMdlObj.name.toLowerCase() !== 'standard') return cMdlObj.name.trim();
        }
      }
    }

    // 4. Return any existing value or fallback
    return raw || mdl || 'Standard';
  }

  setTable(tableName, items, persistToCloud = false) {
    this.data[tableName] = items || [];
    try { idbCache.setTable(tableName, this.data[tableName]); } catch (_) {}
    try { localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(this.data[tableName])); } catch (_) {}
    if (persistToCloud) {
      this.saveTable(tableName, false);
    }
    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }
    return this.data[tableName];
  }

  _invalidateTableIdMap(tableName = null) {
    if (!this._tableIdMaps) this._tableIdMaps = {};
    if (tableName) {
      delete this._tableIdMaps[tableName];
    } else {
      this._tableIdMaps = {};
    }
  }

  getItem(tableName, id) {
    if (!id) return null;
    if (!this._tableIdMaps) this._tableIdMaps = {};
    let map = this._tableIdMaps[tableName];
    if (!map) {
      map = new Map();
      const table = this.data[tableName] || [];
      for (let i = 0; i < table.length; i++) {
        const item = table[i];
        if (item && item.id != null) {
          map.set(item.id, item);
          const strId = String(item.id);
          if (strId !== item.id) map.set(strId, item);
        }
      }
      this._tableIdMaps[tableName] = map;
    }
    const found = map.get(id) || map.get(String(id)) || null;
    if (!found && tableName === TABLE_NAMES.MACHINES) {
      return this.getMachineByAssetId(id) || this.getMachineBySerial(id);
    }
    return found;
  }

  getMachineBySerial(serialNumber) {
    if (!serialNumber) return null;
    const clean = String(serialNumber).trim().toUpperCase();
    if (this.indexes && this.indexes.machineBySerial && this.indexes.machineBySerial.has(clean)) {
      return this.indexes.machineBySerial.get(clean);
    }
    const machines = this.data[TABLE_NAMES.MACHINES] || [];
    return machines.find(m => m.serialNumber && String(m.serialNumber).trim().toUpperCase() === clean) || null;
  }

  getMachineByAssetId(assetId) {
    if (!assetId) return null;
    const clean = String(assetId).trim().toUpperCase();
    if (this.indexes && this.indexes.machineByAssetId && this.indexes.machineByAssetId.has(clean)) {
      return this.indexes.machineByAssetId.get(clean);
    }
    const cleanAmg = clean.replace(/^MID-/i, 'AMG-MNT-');
    if (this.indexes && this.indexes.machineByAssetId && this.indexes.machineByAssetId.has(cleanAmg)) {
      return this.indexes.machineByAssetId.get(cleanAmg);
    }
    const machines = this.data[TABLE_NAMES.MACHINES] || [];
    return machines.find(m => 
      (m.systemAssetId && String(m.systemAssetId).trim().toUpperCase() === clean) ||
      (m.permanentMachineId && String(m.permanentMachineId).trim().toUpperCase() === clean) ||
      (m.systemAssetId && String(m.systemAssetId).trim().toUpperCase() === cleanAmg) ||
      (m.permanentMachineId && String(m.permanentMachineId).trim().toUpperCase() === cleanAmg)
    ) || null;
  }

  findMachineByAssetId(assetId) {
    return this.getMachineByAssetId(assetId);
  }

  /**
   * Automatically heals foreign key relations between machines and master tables.
   * Guarantees 0 missing machine names, brands, or models.
   */
  ensureForeignIntegrity() {
    const machines = this.data[TABLE_NAMES.MACHINES];
    if (!Array.isArray(machines) || machines.length === 0) return false;

    let hasUpdates = false;

    // 1. Brands
    if (!Array.isArray(this.data[TABLE_NAMES.BRANDS])) this.data[TABLE_NAMES.BRANDS] = [];
    const brandMap = new Map(this.data[TABLE_NAMES.BRANDS].map(b => [b.id, b]));

    // 2. Machine Names
    if (!Array.isArray(this.data[TABLE_NAMES.MACHINE_NAMES])) this.data[TABLE_NAMES.MACHINE_NAMES] = [];
    const mnMap = new Map(this.data[TABLE_NAMES.MACHINE_NAMES].map(m => [m.id, m]));

    // 3. Models
    if (!Array.isArray(this.data[TABLE_NAMES.MODELS])) this.data[TABLE_NAMES.MODELS] = [];
    const mdlMap = new Map(this.data[TABLE_NAMES.MODELS].map(m => [m.id, m]));

    // Seed any missing master models from INITIAL_DATA.models
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.models)) {
      INITIAL_DATA.models.forEach(im => {
        if (im && im.id && !mdlMap.has(im.id)) {
          this.data[TABLE_NAMES.MODELS].push(im);
          mdlMap.set(im.id, im);
          hasUpdates = true;
        }
      });
    }

    // Auto-heal any machines with "Standard" or missing model
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machines)) {
      const canonBySerial = new Map();
      const canonById = new Map();
      (INITIAL_DATA.machines || []).forEach(im => {
        if (im && im.serialNumber) canonBySerial.set(String(im.serialNumber).trim().toUpperCase(), im);
        if (im && im.id) canonById.set(im.id, im);
      });

      machines.forEach(m => {
        if (!m) return;
        const currentMdl = (m.model || m.modelName || m.modelStr || '').trim();
        if (!currentMdl || currentMdl.toLowerCase() === 'standard' || m.modelId === 'mod-1792291200071-x7i9') {
          const sn = (m.serialNumber || '').trim().toUpperCase();
          const canon = (sn && canonBySerial.get(sn)) || (m.id && canonById.get(m.id));
          if (canon) {
            const cMdl = (canon.model || canon.modelName || canon.modelStr || '').trim();
            if (cMdl && cMdl.toLowerCase() !== 'standard') {
              m.model = cMdl;
              m.modelName = canon.modelName || cMdl;
              m.modelStr = canon.modelStr || cMdl;
              if (canon.modelId) m.modelId = canon.modelId;
              hasUpdates = true;
            }
          }
        }
      });
    }

    machines.forEach(m => {
      if (!m) return;

      // Brand check
      if (m.brandId && !brandMap.has(m.brandId)) {
        const newBrand = {
          id: m.brandId,
          name: m.brand || m.brandName || 'Generic',
          status: 'ACTIVE',
          createdAt: m.createdAt || new Date().toISOString()
        };
        this.data[TABLE_NAMES.BRANDS].push(newBrand);
        brandMap.set(newBrand.id, newBrand);
        hasUpdates = true;
      }

      // Machine Name check
      if (m.machineNameId && !mnMap.has(m.machineNameId)) {
        const newName = {
          id: m.machineNameId,
          name: m.machineName || m.machineNameStr || 'Sewing Machine',
          status: 'ACTIVE',
          createdAt: m.createdAt || new Date().toISOString()
        };
        this.data[TABLE_NAMES.MACHINE_NAMES].push(newName);
        mnMap.set(newName.id, newName);
        hasUpdates = true;
      }

      // Model check
      if (m.modelId && !mdlMap.has(m.modelId)) {
        const fallbackName = (m.model && m.model.toLowerCase() !== 'standard') ? m.model.trim() :
          ((m.modelStr && m.modelStr.toLowerCase() !== 'standard') ? m.modelStr.trim() :
          ((m.modelName && m.modelName.toLowerCase() !== 'standard') ? m.modelName.trim() : 'Standard'));
        const newModel = {
          id: m.modelId,
          brandId: m.brandId || 'bra-1',
          name: fallbackName,
          status: 'ACTIVE',
          createdAt: m.createdAt || new Date().toISOString()
        };
        this.data[TABLE_NAMES.MODELS].push(newModel);
        mdlMap.set(newModel.id, newModel);
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      this.saveTable(TABLE_NAMES.BRANDS, false);
      this.saveTable(TABLE_NAMES.MACHINE_NAMES, false);
      this.saveTable(TABLE_NAMES.MODELS, false);
    }
    return hasUpdates;
  }

  /**
   * Retrieves active Asset ID configuration from settings with fallback to defaults.
   */
  getAssetIdConfig() {
    const settings = this.data[TABLE_NAMES.SETTINGS] || {};
    let prefix = settings.assetIdPrefix !== undefined && settings.assetIdPrefix !== null
      ? String(settings.assetIdPrefix)
      : (DEFAULT_SETTINGS.assetIdPrefix || 'AMG-MNT-');
    if (!prefix.trim()) prefix = 'AMG-MNT-';

    let digitLength = parseInt(settings.assetIdDigitLength, 10);
    if (isNaN(digitLength) || digitLength < 1) {
      digitLength = parseInt(DEFAULT_SETTINGS.assetIdDigitLength, 10) || 6;
    }
    return { prefix, digitLength };
  }

  /**
   * Formats a sequential number with the given prefix and digit length.
   * Note: String(num).padStart(digitLength, '0') automatically expands if num has more digits than digitLength!
   */
  formatAssetId(seq, prefixOverride, digitLengthOverride) {
    const cfg = this.getAssetIdConfig();
    const prefix = prefixOverride !== undefined && prefixOverride !== null ? String(prefixOverride) : cfg.prefix;
    const digitLength = digitLengthOverride !== undefined && !isNaN(digitLengthOverride) ? parseInt(digitLengthOverride, 10) : cfg.digitLength;
    const num = Math.max(0, parseInt(seq, 10) || 0);
    return `${prefix}${String(num).padStart(Math.max(1, digitLength), '0')}`;
  }

  /**
   * Generates the next sequential Permanent Unique System Asset ID.
   * - Fully dynamic: Reads prefix and digit length from Admin Settings.
   * - Monotonically increasing: Scans all machines, metadata, and persistent sequence tracker.
   * - Automatically zero-padded and automatically expands when exceeding configured length.
   * - Guarantees globally unique IDs, zero collision, never resets or repeats.
   */
  generateNextSystemAssetId(prefixOverride, digitLengthOverride) {
    const machines = this.data[TABLE_NAMES.MACHINES] || [];
    const cfg = this.getAssetIdConfig();
    const prefix = prefixOverride !== undefined && prefixOverride !== null ? String(prefixOverride) : cfg.prefix;
    const digitLength = digitLengthOverride !== undefined && !isNaN(digitLengthOverride) ? parseInt(digitLengthOverride, 10) : cfg.digitLength;

    this._reservedAssetIds = this._reservedAssetIds || new Set();

    // 1. Gather all existing and reserved IDs
    const existingAssetIds = new Set(this._reservedAssetIds);
    let maxNum = 0;

    // Check persistent lastAssetSequence from settings
    const settings = this.data[TABLE_NAMES.SETTINGS] || {};
    if (settings.lastAssetSequence && !isNaN(settings.lastAssetSequence)) {
      maxNum = Math.max(maxNum, parseInt(settings.lastAssetSequence, 10));
    }

    // 2. Scan all machines for existing IDs and find max numerical sequence
    machines.forEach(m => {
      if (!m) return;
      [m.systemAssetId, m.permanentMachineId].forEach(raw => {
        if (!raw) return;
        const s = String(raw).trim();
        existingAssetIds.add(s.toUpperCase());
        // Extract sequence number from any format (e.g. AMG-MNT-000761, MID-123, AST-00000042, etc.)
        const match = s.match(/(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
    });

    // 3. Monotonically increment sequence
    let nextSeq = Math.max(machines.length, maxNum) + 1;
    let candidate = this.formatAssetId(nextSeq, prefix, digitLength);

    // 4. Guarantee 100% collision-free uniqueness
    while (existingAssetIds.has(candidate.toUpperCase())) {
      nextSeq++;
      candidate = this.formatAssetId(nextSeq, prefix, digitLength);
    }

    // 5. Reserve candidate in memory & persist latest sequence tracker
    this._reservedAssetIds.add(candidate.toUpperCase());
    if (this.data[TABLE_NAMES.SETTINGS]) {
      this.data[TABLE_NAMES.SETTINGS].lastAssetSequence = Math.max(
        Number(this.data[TABLE_NAMES.SETTINGS].lastAssetSequence) || 0,
        nextSeq
      );
    }

    return candidate;
  }

  /**
   * Returns a live preview of the next Asset ID given current or hypothetical prefix & digit length
   */
  getAssetIdPreview(prefixOverride, digitLengthOverride) {
    const machines = this.data[TABLE_NAMES.MACHINES] || [];
    const cfg = this.getAssetIdConfig();
    const prefix = prefixOverride !== undefined && prefixOverride !== null ? String(prefixOverride) : cfg.prefix;
    const digitLength = digitLengthOverride !== undefined && !isNaN(digitLengthOverride) ? parseInt(digitLengthOverride, 10) : cfg.digitLength;

    let maxNum = 0;
    const settings = this.data[TABLE_NAMES.SETTINGS] || {};
    if (settings.lastAssetSequence && !isNaN(settings.lastAssetSequence)) {
      maxNum = Math.max(maxNum, parseInt(settings.lastAssetSequence, 10));
    }

    machines.forEach(m => {
      if (!m) return;
      [m.systemAssetId, m.permanentMachineId].forEach(raw => {
        if (!raw) return;
        const match = String(raw).trim().match(/(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
    });

    const nextSeq = Math.max(machines.length, maxNum) + 1;
    const previewId = this.formatAssetId(nextSeq, prefix, digitLength);
    return {
      previewId,
      nextSeq,
      maxNum,
      prefix,
      digitLength,
      totalMachines: machines.length
    };
  }

  /**
   * Non-destructive verification and assignment of Machine System Asset IDs.
   * - Preserves 100% of all existing Asset IDs (format, prefix, and digit length).
   * - Only populates Asset IDs for records where it is currently missing.
   * - Resolves accidental duplicates without overwriting the original record.
   */
  ensureMachineSystemAssetIds() {
    let machines = this.data[TABLE_NAMES.MACHINES];
    if (!Array.isArray(machines) || machines.length === 0) return false;

    let hasUpdates = false;

    // Step 1: Detect and deduplicate according to ERP 4-Field Composite Rules:
    // Core Rule: Composite Key = Machine Name + Brand + Model + Machine Serial Number
    const cleanStr = (val) => String(val || '').trim().toUpperCase();
    const compositeMap = new Map();
    const serialMap = new Map();
    let hasDuplicateRecords = false;

    machines.forEach((m, idx) => {
      if (!m) return;
      const serial = cleanStr(m.serialNumber || m.machineSerial);
      if (!serial) return;

      const name = cleanStr(m.name || m.machineName);
      const brand = cleanStr(m.brand);
      const model = cleanStr(m.model);
      const compKey = `${name}|${brand}|${model}|${serial}`;

      if (compositeMap.has(compKey) || serialMap.has(serial)) {
        hasDuplicateRecords = true;
      }

      if (!serialMap.has(serial)) serialMap.set(serial, []);
      serialMap.get(serial).push({ index: idx, machine: m, compKey });

      if (!compositeMap.has(compKey)) compositeMap.set(compKey, []);
      compositeMap.get(compKey).push({ index: idx, machine: m });
    });

    if (hasDuplicateRecords) {
      console.warn(`[Asset ID Safeguard] ⚠️ Duplicate machine records detected. Resolving strictly by 4-field rule (Machine Name + Brand + Model + Serial)...`);
      const retainedList = [];
      for (const [serial, entries] of serialMap.entries()) {
        if (entries.length === 1) {
          retainedList.push(entries[0]);
        } else {
          hasUpdates = true;
          const sorted = [...entries].sort((a, b) => {
            const aComp = (a.machine.name || a.machine.machineName) && a.machine.brand && a.machine.model ? 1 : 0;
            const bComp = (b.machine.name || b.machine.machineName) && b.machine.brand && b.machine.model ? 1 : 0;
            if (aComp !== bComp) return bComp - aComp;

            const aTime = new Date(a.machine.updatedAt || a.machine.createdAt || 0).getTime();
            const bTime = new Date(b.machine.updatedAt || b.machine.createdAt || 0).getTime();
            if (aTime !== bTime) return bTime - aTime;

            const score = (m) => {
              let s = 0;
              if (m.name || m.machineName) s += 2;
              if (m.brand) s += 2;
              if (m.model) s += 2;
              if (m.floor) s++;
              if (m.line) s++;
              if (m.status) s++;
              if (m.lastServiceDate || m.lastService) s++;
              return s;
            };
            return score(b.machine) - score(a.machine);
          });
          const minIndex = Math.min(...entries.map(e => e.index));
          retainedList.push({ index: minIndex, machine: sorted[0].machine });
        }
      }
      // Also retain machines without serial
      machines.forEach((m, idx) => {
        const s = String(m?.serialNumber || m?.machineSerial || '').trim().toUpperCase();
        if (!s && m) retainedList.push({ index: idx, machine: m });
      });

      retainedList.sort((a, b) => a.index - b.index);
      machines = retainedList.map(item => item.machine);
      this.data[TABLE_NAMES.MACHINES] = machines;
    }

    // Step 2: Strict Preservation of Existing Asset IDs
    // - Existing Asset IDs (regardless of prefix, digit length, or format) are NEVER changed, re-formatted, or renumbered.
    // - Only missing IDs are populated using the dynamic generator.
    // - If duplicate IDs exist across records, the original is preserved and only the duplicate gets a new ID.
    const seenAssetIds = new Map();

    machines.forEach((m) => {
      if (!m) return;
      let raw = m.systemAssetId || m.permanentMachineId;
      if (raw) {
        let str = String(raw).trim();
        // Backward-compat for legacy MID- prefix only if not yet normalized
        if (/^MID-(\d+)$/i.test(str)) {
          str = str.replace(/^MID-/i, 'AMG-MNT-');
          hasUpdates = true;
        }
        m.systemAssetId = str;
        if (!m.permanentMachineId || m.permanentMachineId !== str) {
          m.permanentMachineId = str;
          hasUpdates = true;
        }

        const upper = str.toUpperCase();
        if (seenAssetIds.has(upper)) {
          console.warn(`[Asset ID Safeguard] ⚠️ Duplicate Asset ID '${str}' detected for machine ${m.id}. Generating new unique ID...`);
          const newId = this.generateNextSystemAssetId();
          m.systemAssetId = newId;
          m.permanentMachineId = newId;
          seenAssetIds.set(newId.toUpperCase(), m);
          hasUpdates = true;
        } else {
          seenAssetIds.set(upper, m);
        }
      }
    });

    // Step 3: Populate any completely missing Asset IDs
    machines.forEach((m) => {
      if (!m) return;
      if (!m.systemAssetId) {
        const newId = this.generateNextSystemAssetId();
        m.systemAssetId = newId;
        m.permanentMachineId = newId;
        seenAssetIds.set(newId.toUpperCase(), m);
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      try {
        idbCache.setTable(TABLE_NAMES.MACHINES, machines);
      } catch (_) {}
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + TABLE_NAMES.MACHINES, JSON.stringify(machines));
      } catch (_) {}
      this._invalidateTableIdMap(TABLE_NAMES.MACHINES);
    }

    return hasUpdates;
  }

  insert(tableName, item) {
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }

    if (!item.id) {
      item.id = `${tableName.substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    if (tableName === TABLE_NAMES.MACHINES) {
      const existingAssetIds = new Set(
        (this.data[TABLE_NAMES.MACHINES] || [])
          .map(m => m && m.systemAssetId ? String(m.systemAssetId).trim().toUpperCase() : null)
          .filter(Boolean)
      );
      const curAssetId = item.systemAssetId ? String(item.systemAssetId).trim().toUpperCase() : '';
      if (!curAssetId || existingAssetIds.has(curAssetId)) {
        item.systemAssetId = this.generateNextSystemAssetId();
      }
      const curPermId = item.permanentMachineId ? String(item.permanentMachineId).trim().toUpperCase() : '';
      if (!curPermId || existingAssetIds.has(curPermId)) {
        item.permanentMachineId = item.systemAssetId;
      }
      // Also prevent duplicate machine array insertion by id
      const existingIdx = this.data[TABLE_NAMES.MACHINES].findIndex(m => m && m.id === item.id);
      if (existingIdx !== -1) {
        this.data[TABLE_NAMES.MACHINES][existingIdx] = item;
        this._invalidateTableIdMap(tableName);
        this.saveTable(tableName, true);
        this.rebuildAllIndexes();
        return item;
      }
    }

    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();

    this.data[tableName].push(item);
    this._invalidateTableIdMap(tableName);
    this.saveTable(tableName, true);

    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    return item;
  }

  insertMany(tableName, items) {
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }

    const now = new Date().toISOString();
    const baseTime = Date.now();
    let counter = 0;

    const existingAssetIds = new Set();
    if (tableName === TABLE_NAMES.MACHINES) {
      (this.data[TABLE_NAMES.MACHINES] || []).forEach(m => {
        if (!m) return;
        if (m.systemAssetId) existingAssetIds.add(String(m.systemAssetId).trim().toUpperCase());
        if (m.permanentMachineId) existingAssetIds.add(String(m.permanentMachineId).trim().toUpperCase());
      });
    }

    items.forEach(item => {
      if (!item.id) {
        item.id = `${tableName.substring(0, 3)}-${baseTime}-${++counter}-${Math.floor(Math.random() * 100000)}`;
      }
      if (tableName === TABLE_NAMES.MACHINES) {
        const itemUpper = item.systemAssetId ? String(item.systemAssetId).trim().toUpperCase() : '';
        if (!itemUpper || existingAssetIds.has(itemUpper)) {
          item.systemAssetId = this.generateNextSystemAssetId();
        }
        existingAssetIds.add(String(item.systemAssetId).trim().toUpperCase());
        if (!item.permanentMachineId) {
          item.permanentMachineId = item.systemAssetId;
        }
      }
      item.createdAt = item.createdAt || now;
      item.updatedAt = now;
      this.data[tableName].push(item);
    });

    this._invalidateTableIdMap(tableName);
    this.saveTable(tableName);

    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    return items;
  }

  update(tableName, id, updates) {
    const table = this.data[tableName] || [];
    let index = -1;
    if (tableName === TABLE_NAMES.MACHINES && updates && updates.serialNumber) {
      const sn = String(updates.serialNumber).trim().toUpperCase();
      index = table.findIndex(item => item.id === id && String(item.serialNumber || '').trim().toUpperCase() === sn);
    }
    if (index === -1) {
      index = table.findIndex(item => item && (item.id === id || String(item.id) === String(id)));
    }
    if (index === -1) return null;

    if (tableName === TABLE_NAMES.MACHINES && updates && updates.systemAssetId) {
      const isDuplicate = (this.data[TABLE_NAMES.MACHINES] || []).some(
        m => m && m.id !== id && m.systemAssetId === updates.systemAssetId
      );
      if (isDuplicate) {
        console.warn(`[Asset ID Safeguard] ⚠️ Duplicate systemAssetId '${updates.systemAssetId}' rejected on update for machine ${id}.`);
        delete updates.systemAssetId;
      }
    }

    table[index] = {
      ...table[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this._invalidateTableIdMap(tableName);
    this.saveTable(tableName, true);

    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    return table[index];
  }

  delete(tableName, id) {
    // Safeguard: Prevent deleting master entities if active machines reference them
    if ([TABLE_NAMES.MACHINE_NAMES, TABLE_NAMES.BRANDS, TABLE_NAMES.MODELS, TABLE_NAMES.UNITS, TABLE_NAMES.FLOORS, TABLE_NAMES.LINES].includes(tableName)) {
      const machines = this.data[TABLE_NAMES.MACHINES] || [];
      const hasReference = machines.some(m => {
        if (!m) return false;
        if (tableName === TABLE_NAMES.MACHINE_NAMES) return m.machineNameId === id;
        if (tableName === TABLE_NAMES.BRANDS) return m.brandId === id;
        if (tableName === TABLE_NAMES.MODELS) return m.modelId === id;
        if (tableName === TABLE_NAMES.UNITS) return m.unitId === id;
        if (tableName === TABLE_NAMES.FLOORS) return m.floorId === id;
        if (tableName === TABLE_NAMES.LINES) return m.lineId === id;
        return false;
      });
      if (hasReference) {
        console.warn(`[Integrity Safeguard] 🛡️ Deletion prevented for ${tableName} id '${id}' because active machines reference it.`);
        return false;
      }
    }

    const table = this.data[tableName] || [];
    const index = table.findIndex(item => item && (item.id === id || String(item.id) === String(id)));
    if (index === -1) return false;

    const removed = table.splice(index, 1)[0];
    this.saveTable(tableName, true);

    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    return removed;
  }

  /**
   * Confirmed mutation methods: guarantees database write confirmation
   * If database write fails, state is automatically rolled back and CloudSaveError is thrown.
   */
  async insertConfirmed(tableName, item) {
    if (!this.data[tableName]) this.data[tableName] = [];
    if (!item.id) {
      item.id = `${tableName.substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    if (tableName === TABLE_NAMES.MACHINES) {
      const existingAssetIds = new Set(
        (this.data[TABLE_NAMES.MACHINES] || [])
          .map(m => m && m.systemAssetId ? String(m.systemAssetId).trim().toUpperCase() : null)
          .filter(Boolean)
      );
      const curAssetId = item.systemAssetId ? String(item.systemAssetId).trim().toUpperCase() : '';
      if (!curAssetId || existingAssetIds.has(curAssetId)) {
        item.systemAssetId = this.generateNextSystemAssetId();
      }
      const curPermId = item.permanentMachineId ? String(item.permanentMachineId).trim().toUpperCase() : '';
      if (!curPermId || existingAssetIds.has(curPermId)) {
        item.permanentMachineId = item.systemAssetId;
      }
    }

    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();

    const snapshot = JSON.parse(JSON.stringify(this.data[tableName]));
    this.data[tableName].push(item);
    if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();

    const ok = await this.saveTable(tableName, true);
    if (!ok) {
      this.data[tableName] = snapshot;
      if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(snapshot));
      } catch (_) {}
      throw new CloudSaveError(`❌ Cloud Save Failed: Database write for '${tableName}' was not confirmed. Check your connection.`);
    }
    return item;
  }

  async updateConfirmed(tableName, id, updates) {
    const table = this.data[tableName] || [];
    const index = table.findIndex(item => item && (item.id === id || String(item.id) === String(id)));
    if (index === -1) return null;

    if (tableName === TABLE_NAMES.MACHINES && updates && updates.systemAssetId) {
      const isDuplicate = (this.data[TABLE_NAMES.MACHINES] || []).some(
        m => m && m.id !== id && m.systemAssetId === updates.systemAssetId
      );
      if (isDuplicate) {
        console.warn(`[Asset ID Safeguard] ⚠️ Duplicate systemAssetId '${updates.systemAssetId}' rejected on update for machine ${id}.`);
        delete updates.systemAssetId;
      }
    }

    const oldItem = JSON.parse(JSON.stringify(table[index]));
    table[index] = {
      ...table[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();

    const ok = await this.saveTable(tableName, true);
    if (!ok) {
      table[index] = oldItem;
      if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(table));
      } catch (_) {}
      throw new CloudSaveError(`❌ Cloud Save Failed: Database write for '${tableName}' was not confirmed. Check your connection.`);
    }
    return table[index];
  }

  async deleteConfirmed(tableName, id) {
    // Safeguard: Prevent deleting master entities if active machines reference them
    if ([TABLE_NAMES.MACHINE_NAMES, TABLE_NAMES.BRANDS, TABLE_NAMES.MODELS, TABLE_NAMES.UNITS, TABLE_NAMES.FLOORS, TABLE_NAMES.LINES].includes(tableName)) {
      const machines = this.data[TABLE_NAMES.MACHINES] || [];
      const hasReference = machines.some(m => {
        if (!m) return false;
        if (tableName === TABLE_NAMES.MACHINE_NAMES) return m.machineNameId === id;
        if (tableName === TABLE_NAMES.BRANDS) return m.brandId === id;
        if (tableName === TABLE_NAMES.MODELS) return m.modelId === id;
        if (tableName === TABLE_NAMES.UNITS) return m.unitId === id;
        if (tableName === TABLE_NAMES.FLOORS) return m.floorId === id;
        if (tableName === TABLE_NAMES.LINES) return m.lineId === id;
        return false;
      });
      if (hasReference) {
        console.warn(`[Integrity Safeguard] 🛡️ Deletion prevented for ${tableName} id '${id}' because active machines reference it.`);
        return false;
      }
    }

    const table = this.data[tableName] || [];
    const index = table.findIndex(item => item && (item.id === id || String(item.id) === String(id)));
    if (index === -1) return false;

    const removed = table[index];
    const snapshot = JSON.parse(JSON.stringify(table));
    table.splice(index, 1);
    if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();

    const ok = await this.saveTable(tableName, true);
    if (!ok) {
      this.data[tableName] = snapshot;
      if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(snapshot));
      } catch (_) {}
      throw new CloudSaveError(`❌ Cloud Save Failed: Database write for '${tableName}' was not confirmed. Check your connection.`);
    }
    return removed;
  }

  async setTableConfirmed(tableName, items) {
    const snapshot = JSON.parse(JSON.stringify(this.data[tableName] || []));
    this.data[tableName] = items || [];
    if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();

    const ok = await this.saveTable(tableName, true);
    if (!ok) {
      this.data[tableName] = snapshot;
      if (tableName === TABLE_NAMES.MACHINES) this.rebuildAllIndexes();
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(snapshot));
      } catch (_) {}
      throw new CloudSaveError(`❌ Cloud Save Failed: Database write for '${tableName}' was not confirmed. Check your connection.`);
    }
    return this.data[tableName];
  }

  // Fast Index Lookups
  findMachineBySerial(serial) {
    if (!serial) return null;
    return this.indexes.machineBySerial.get(serial.trim().toUpperCase()) || null;
  }

  // Export full DB backup as JSON
  exportBackup() {
    return JSON.stringify({
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
      system: 'Al-Muslim Group Maintenance Department ERP',
      data: this.data
    }, null, 2);
  }

  // Restore DB from JSON backup
  importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.data) throw new Error('Invalid backup schema');
      this.data = parsed.data;
      this.saveAll();
      this.rebuildAllIndexes();
      return { success: true, count: this.data[TABLE_NAMES.MACHINES]?.length || 0 };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  _sanitizeDbConfigs(configs) {
    if (!Array.isArray(configs) || configs.length === 0) return null;
    return configs.map(c => {
      if (!c) return c;
      const clone = { ...c };
      if (clone.id === 'mysql_primary' || (clone.type === 'MYSQL' && clone.role === 'PRIMARY')) {
        let ep = (clone.endpoint || '').trim().replace(/\/$/, '');
        if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('moviezonex.com')) {
          ep = window.location.origin + '/mysql_api.php';
        } else if (!ep || ep === '/api/db/mysql') {
          ep = 'https://moviezonex.com/mysql_api.php';
        } else if (ep === 'api/mysql_api.php' || ep === '/api/mysql_api.php') {
          if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('github.io')) {
            ep = 'https://moviezonex.com/mysql_api.php';
          } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
            ep = window.location.origin + '/api/mysql_api.php';
          } else {
            ep = 'https://moviezonex.com/mysql_api.php';
          }
        } else if (!/^https?:\/\//i.test(ep)) {
          ep = (ep.startsWith('localhost') || ep.startsWith('127.0.0.1')) ? ('http://' + ep) : ('https://' + ep);
        }
        clone.endpoint = ep;
        if (!clone.database) clone.database = 'motaherh_maint-erp';
        if (!clone.username) clone.username = 'motaherh_mainterp';
        if (clone.password === undefined || clone.password === null) clone.password = 'Maint@456';
        clone.enabled = true;
        clone.autoSync = true;
        clone.role = 'PRIMARY';
      } else if (clone.type === 'POSTGRESQL' || clone.type === 'POSTGRES') {
        let ep = (clone.endpoint || '').trim().replace(/\/$/, '');
        if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('moviezonex.com')) {
          ep = window.location.origin + '/api/pg_api.php';
        } else if (!ep || ep === 'api/pg_api.php' || ep === '/api/pg_api.php' || ep.includes('://api/pg_api.php') || ep === '/api/db/pg' || (ep.includes('api/pg_api.php') && !ep.startsWith('http'))) {
          ep = 'https://moviezonex.com/api/pg_api.php';
        } else if (!/^https?:\/\//i.test(ep) && !ep.startsWith('/')) {
          ep = 'https://' + ep;
        }
        clone.endpoint = ep || 'https://moviezonex.com/api/pg_api.php';
        clone.id = 'db_postgresql_replica';
        clone.name = clone.name || 'PostgreSQL Database Connection';
        clone.role = 'BACKUP';
        if (!clone.host) clone.host = '127.0.0.1';
        if (!clone.port) clone.port = 5432;
        if (!clone.database || clone.database === 'motaherh_maint_pg') clone.database = 'motaherh_Maintenance';
        if (!clone.username || clone.username === 'motaherh_pguser') clone.username = 'motaherh_AMG-maint';
        if (!clone.password) clone.password = 'ol(5_MK8mF{~7cdG';
        clone.enabled = true;
        clone.autoSync = true;
        clone.retryEnabled = true;
      }
      return clone;
    });
  }

  // Multi-Database Configuration Persistence (Survives cache flushes, reloads, and multi-device syncs)
  getMultiDbConfigs() {
    // 1. First priority: Check localStorage as the user's direct, latest browser configuration
    try {
      const local = localStorage.getItem('erp_multi_db_config');
      if (local) {
        let parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasPg = parsed.some(c => (c.type || '').toUpperCase() === 'POSTGRESQL' || (c.type || '').toUpperCase() === 'POSTGRES');
          if (!hasPg) {
            parsed.push({
              id: 'db_postgresql_replica',
              name: 'PostgreSQL Database Connection',
              type: 'POSTGRESQL',
              role: 'BACKUP',
              host: '127.0.0.1',
              port: 5432,
              database: 'motaherh_Maintenance',
              username: 'motaherh_AMG-maint',
              password: 'ol(5_MK8mF{~7cdG',
              endpoint: 'https://moviezonex.com/api/pg_api.php',
              apiKey: '',
              ssl: false,
              enabled: true,
              autoSync: true,
              retryEnabled: true,
              updatedAt: new Date().toISOString()
            });
          }
          const sanitized = this._sanitizeDbConfigs(parsed);
          this._syncMultiDbToSettings(sanitized);
          return sanitized;
        }
      }
    } catch (_) {}

    // 2. Fallback to settings table only if localStorage is empty (e.g. fresh browser)
    try {
      const settingsTable = this.getTable(TABLE_NAMES.SETTINGS) || [];
      if (Array.isArray(settingsTable)) {
        const dbConfigRow = settingsTable.find(r => r.key === 'multi_db_config' || r.id === 'multi_db_config');
        if (dbConfigRow && Array.isArray(dbConfigRow.value) && dbConfigRow.value.length > 0) {
          const sanitized = this._sanitizeDbConfigs(dbConfigRow.value);
          try { localStorage.setItem('erp_multi_db_config', JSON.stringify(sanitized)); } catch (_) {}
          return sanitized;
        }
      }
      const settingsObj = this.data[TABLE_NAMES.SETTINGS];
      if (settingsObj && Array.isArray(settingsObj.multi_db_config) && settingsObj.multi_db_config.length > 0) {
        const sanitized = this._sanitizeDbConfigs(settingsObj.multi_db_config);
        try { localStorage.setItem('erp_multi_db_config', JSON.stringify(sanitized)); } catch (_) {}
        return sanitized;
      }
    } catch (_) {}

    return [
      {
        id: 'mysql_primary',
        name: 'MySQL (maint_erp)',
        type: 'MYSQL',
        role: 'PRIMARY',
        host: 'localhost',
        port: 3306,
        database: 'motaherh_maint-erp',
        username: 'motaherh_mainterp',
        password: 'Maint@456',
        endpoint: 'https://moviezonex.com/mysql_api.php',
        apiKey: '',
        enabled: true,
        autoSync: true,
        retryEnabled: true,
        updatedAt: new Date().toISOString()
      },
      {
        id: 'db_postgresql_replica',
        name: 'PostgreSQL Database Connection',
        type: 'POSTGRESQL',
        role: 'BACKUP',
        host: '127.0.0.1',
        port: 5432,
        database: 'motaherh_Maintenance',
        username: 'motaherh_AMG-maint',
        password: 'ol(5_MK8mF{~7cdG',
        endpoint: 'https://moviezonex.com/api/pg_api.php',
        apiKey: '',
        ssl: false,
        enabled: true,
        autoSync: true,
        retryEnabled: true,
        updatedAt: new Date().toISOString()
      }
    ];
  }

  _syncMultiDbToSettings(configs) {
    if (!configs) return;
    try {
      let settingsTable = this.getTable(TABLE_NAMES.SETTINGS);
      if (Array.isArray(settingsTable)) {
        let row = settingsTable.find(r => r.key === 'multi_db_config' || r.id === 'multi_db_config');
        if (row) {
          row.value = configs;
          row.updatedAt = new Date().toISOString();
        } else {
          settingsTable.push({
            id: 'multi_db_config',
            key: 'multi_db_config',
            value: configs,
            updatedAt: new Date().toISOString()
          });
        }
      }
      if (this.data[TABLE_NAMES.SETTINGS] && typeof this.data[TABLE_NAMES.SETTINGS] === 'object' && !Array.isArray(this.data[TABLE_NAMES.SETTINGS])) {
        this.data[TABLE_NAMES.SETTINGS].multi_db_config = configs;
      }
    } catch (_) {}
  }

  async saveMultiDbConfigs(configs) {
    const sanitized = this._sanitizeDbConfigs(configs) || configs;
    try {
      localStorage.setItem('erp_multi_db_config', JSON.stringify(sanitized));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'multi_db_config', JSON.stringify(sanitized));
    } catch (_) {}
    try {
      this._syncMultiDbToSettings(sanitized);
      // Persist immediately to IndexedDB
      try {
        await idbCache.setTable(TABLE_NAMES.SETTINGS, this.data[TABLE_NAMES.SETTINGS]);
      } catch (_) {}
      // Sync immediately to MySQL Primary cloud so erp_tables stores the latest configuration
      if (syncManager && syncManager.primaryAdapter) {
        syncManager.primaryAdapter.saveTable(TABLE_NAMES.SETTINGS, this.data[TABLE_NAMES.SETTINGS]).catch(() => {});
      }
      if (typeof this.persistToServerDatabase === 'function') {
        this.persistToServerDatabase().catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist multi_db_config to server/cloud:', e);
    }
  }
}

export const storage = (typeof window !== 'undefined' && window.__erpStorageEngine)
  ? window.__erpStorageEngine
  : new StorageEngine();

if (typeof window !== 'undefined') {
  if (!window.__erpStorageEngine) {
    window.__erpStorageEngine = storage;
    window.storage = storage;
    storage.init();
  }
} else {
  storage.init();
}
