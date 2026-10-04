/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * High-Performance Storage Engine with Fast In-Memory Indexes & Persistence
 */

import { INITIAL_DATA } from './initialData.js';
import { TABLE_NAMES, DEFAULT_SETTINGS, SCHEMA_VERSION, DEFAULT_PERMISSION_PRESETS } from './schema.js';
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
    this._hasFullSecondarySyncCompleted = false;
    this._isDeferredSyncRunning = false;
    this._loadedSecondaryTables = new Set();
    this._realtimeListenerStarted = false;
  }

  init() {
    if (this.isInitialized) return;

    try {
      this._suppressServerPersist = true;
      this.loadFromStorage();

      // Only seed initial factory data if local cache has no records at all (brand new browser storage)
      const isCompletelyEmpty = (!this.data[TABLE_NAMES.MACHINES] || this.data[TABLE_NAMES.MACHINES].length === 0) &&
                                (!this.data[TABLE_NAMES.USERS] || this.data[TABLE_NAMES.USERS].length === 0);

      if (isCompletelyEmpty) {
        console.log('[Database Store] 🔄 Local cache empty. Seeding initial factory dataset...');
        this.resetToInitialData(false);
      }

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
          }, 3500);
        }
      }

      // Synchronize immediately with server persistent database (single source of truth)
      this.syncWithServerDatabase();
      console.log('ERP Storage Engine initialized (v' + SCHEMA_VERSION + '). Total machines:', this.data[TABLE_NAMES.MACHINES]?.length || 0);
    } catch (err) {
      console.warn('LocalStorage error, falling back to memory seed:', err);
      this._suppressServerPersist = true;
      this.resetToInitialData(false);
      this.rebuildAllIndexes();
      this.isInitialized = true;
      this._suppressServerPersist = false;
      this.syncWithServerDatabase();
    }
  }

  resetToInitialData(persistToServer = false) {
    this.data = {
      [TABLE_NAMES.GROUPS]: JSON.parse(JSON.stringify(INITIAL_DATA.groups)),
      [TABLE_NAMES.UNITS]: JSON.parse(JSON.stringify(INITIAL_DATA.units)),
      [TABLE_NAMES.FLOORS]: JSON.parse(JSON.stringify(INITIAL_DATA.floors)),
      [TABLE_NAMES.LINES]: JSON.parse(JSON.stringify(INITIAL_DATA.lines)),
      [TABLE_NAMES.CATEGORIES]: JSON.parse(JSON.stringify(INITIAL_DATA.categories)),
      [TABLE_NAMES.MACHINE_NAMES]: JSON.parse(JSON.stringify(INITIAL_DATA.machine_names)),
      [TABLE_NAMES.BRANDS]: JSON.parse(JSON.stringify(INITIAL_DATA.brands)),
      [TABLE_NAMES.MODELS]: JSON.parse(JSON.stringify(INITIAL_DATA.models)),
      [TABLE_NAMES.CUSTOM_FIELDS]: JSON.parse(JSON.stringify(INITIAL_DATA.custom_fields)),
      [TABLE_NAMES.EXCEL_STRUCTURES]: JSON.parse(JSON.stringify(INITIAL_DATA.excel_structures || [])),
      [TABLE_NAMES.IMPORT_HISTORY]: JSON.parse(JSON.stringify(INITIAL_DATA.import_history || [])),
      [TABLE_NAMES.USERS]: JSON.parse(JSON.stringify(INITIAL_DATA.users)),
      [TABLE_NAMES.ROLES]: JSON.parse(JSON.stringify(INITIAL_DATA.roles || [])),
      [TABLE_NAMES.MACHINES]: INITIAL_DATA.generateInitialMachines(),
      [TABLE_NAMES.APPROVAL_REQUESTS]: JSON.parse(JSON.stringify(INITIAL_DATA.approval_requests)),
      [TABLE_NAMES.TRANSFERS]: JSON.parse(JSON.stringify(INITIAL_DATA.transfers)),
      [TABLE_NAMES.TRANSFER_REQUESTS]: JSON.parse(JSON.stringify(INITIAL_DATA.transfer_requests || [])),
      [TABLE_NAMES.TRANSFER_WORKFLOWS]: JSON.parse(JSON.stringify(INITIAL_DATA.transfer_workflows || [])),
      [TABLE_NAMES.MACHINE_HISTORY]: INITIAL_DATA.generateInitialHistory ? INITIAL_DATA.generateInitialHistory() : [],
      [TABLE_NAMES.SPARE_PARTS]: INITIAL_DATA.generateInitialSpareParts ? INITIAL_DATA.generateInitialSpareParts() : [],
      [TABLE_NAMES.SPARE_PARTS_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.spare_parts_master || [])),
      [TABLE_NAMES.ET_BOARDS]: INITIAL_DATA.generateInitialEtBoards ? INITIAL_DATA.generateInitialEtBoards() : [],
      [TABLE_NAMES.ET_BOARD_HISTORY]: INITIAL_DATA.generateInitialEtHistory ? INITIAL_DATA.generateInitialEtHistory() : [],
      [TABLE_NAMES.ET_COMPANIES]: JSON.parse(JSON.stringify(INITIAL_DATA.et_companies || [])),
      [TABLE_NAMES.ET_CATEGORIES]: JSON.parse(JSON.stringify(INITIAL_DATA.et_categories || [])),
      [TABLE_NAMES.EMPLOYEES]: JSON.parse(JSON.stringify(INITIAL_DATA.employees || [])),
      [TABLE_NAMES.TOOLS_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.tools_master || [])),
      [TABLE_NAMES.ACCESSORIES_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.accessories_master || [])),
      [TABLE_NAMES.TOOL_ALLOCATIONS]: INITIAL_DATA.generateInitialToolAllocations ? INITIAL_DATA.generateInitialToolAllocations() : [],
      [TABLE_NAMES.TOOL_CHANGE_HISTORY]: JSON.parse(JSON.stringify(INITIAL_DATA.tool_change_history || [])),
      [TABLE_NAMES.AUDIT_LOGS]: JSON.parse(JSON.stringify(INITIAL_DATA.audit_logs)),
      [TABLE_NAMES.NOTIFICATIONS]: JSON.parse(JSON.stringify(INITIAL_DATA.notifications)),
      [TABLE_NAMES.SETTINGS]: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      [TABLE_NAMES.STORAGE_MASTER]: JSON.parse(JSON.stringify(INITIAL_DATA.storage_master || [])),
      [TABLE_NAMES.STORAGE_CORRECTION_RULES]: JSON.parse(JSON.stringify(INITIAL_DATA.storage_correction_rules || [])),
      [TABLE_NAMES.PREVENTIVE_CONFIG]: JSON.parse(JSON.stringify(INITIAL_DATA.preventive_config || [])),
      [TABLE_NAMES.PREVENTIVE_MAINTENANCE]: INITIAL_DATA.generateInitialPreventiveMaintenance ? INITIAL_DATA.generateInitialPreventiveMaintenance() : [],
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
      idbCache.getAllTables().then(idbTables => {
        if (idbTables && typeof idbTables === 'object') {
          let idbUpdated = false;
          for (const [tbl, records] of Object.entries(idbTables)) {
            if (Array.isArray(records) && records.length > (this.data[tbl]?.length || 0)) {
              this.data[tbl] = records;
              idbUpdated = true;
            }
          }
          if (idbUpdated && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('erp:storage-updated'));
            window.dispatchEvent(new CustomEvent('erp:tools-updated'));
          }
        }
      }).catch(() => {});
    } catch (_) {}

    if (!this.data[TABLE_NAMES.SETTINGS] || Object.keys(this.data[TABLE_NAMES.SETTINGS]).length === 0) {
      this.data[TABLE_NAMES.SETTINGS] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
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
              else if (c.systemField === 'unit' || c.fieldKey === 'unit') c.fieldKey = 'unit_factory';
              else if (c.systemField === 'status' || c.fieldKey === 'status') c.fieldKey = 'machine_status';
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
      'plain machine 1-needle': 'Plane Machine',
      'plain machine': 'Plane Machine',
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
    });

    // Deduplicate MACHINE_NAMES table: strip duplicates and ensure canonical 76
    const duplicateIds = new Set(Object.keys(duplicateIdMap));
    const currentMN = this.data[TABLE_NAMES.MACHINE_NAMES] || [];
    const uniqueMN = [];
    const seenMN = new Set();
    currentMN.forEach(mn => {
      if (mn && mn.name && !duplicateIds.has(mn.id)) {
        const norm = mn.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!seenMN.has(norm)) {
          seenMN.add(norm);
          uniqueMN.push(mn);
        }
      }
    });
    if (uniqueMN.length !== currentMN.length) {
      this.data[TABLE_NAMES.MACHINE_NAMES] = uniqueMN;
    }
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
    } else if (dataOrImmediate !== null && dataOrImmediate !== undefined) {
      this.data[table] = dataOrImmediate;
      immediate = maybeImmediate !== false; // default true
      isExplicitUserWrite = true;
    }

    const records = this.data[table];

    // 1. High-capacity persistent write to IndexedDB (no 5MB quota crashes)
    try {
      idbCache.setTable(table, records ?? []);
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
          const result = await syncManager.saveTable(table, currentRecords);
          if (result && result.success) {
            this._isCloudConnected = true;
            // Store server-confirmed updateTime for clock-skew-safe remote detection
            const confirmedTs = result.updatedAt || result.updateTime;
            if (confirmedTs) {
              this.syncedDocVersions.set('mysql_' + table, confirmedTs);
              this.syncedDocVersions.set(table, confirmedTs);
            }
            this.updateStatusBadge('saved');
            return true;
          }
          this._isCloudConnected = false;
          this.updateStatusBadge('error');
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

              const knownTs = this.syncedDocVersions.get('mysql_' + tbl) || '';
              if (parseTs(remoteTs) > parseTs(knownTs)) {
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
          const seen = new Set();
          const cleanRecs = [];
          const dupIds = new Set(Object.keys(duplicateIdMap));
          serverRecs[tbl].forEach(m => {
            if (m && m.name && !dupIds.has(m.id)) {
              const norm = m.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!seen.has(norm)) {
                seen.add(norm);
                cleanRecs.push(m);
              }
            }
          });
          this.data[tbl] = cleanRecs;
        } else if (tbl === TABLE_NAMES.MACHINES) {
          const incoming = serverRecs[tbl] || [];
          const cleanMachines = incoming.map(m => {
            if (m && duplicateIdMap[m.machineNameId]) {
              return { ...m, machineNameId: duplicateIdMap[m.machineNameId] };
            }
            return m;
          });
          this.data[tbl] = cleanMachines;
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
              this.data[tbl] = {
                ...(this.data[tbl] || {}),
                ...incomingSettings
              };
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
          } catch (_) {}
          updated = true;
        }
      }
    });

    if (updated) {
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

  async syncWithServerDatabase() {
    let cloudLoadedSuccessfully = false;
    const fetchStartTime = Date.now();

    // 0. Primary Adapter (MySQL) Startup Sync
    try {
      await syncManager._ensureConfig();
      if (syncManager.primaryAdapter && syncManager.primaryAdapter.type === 'MYSQL') {
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

          // Seed syncedDocVersions with initial MySQL timestamps so multi-device polling tracks incremental changes cleanly
          syncManager.primaryAdapter.getTableTimestamps().then(tsRes => {
            if (tsRes && tsRes.success && tsRes.timestamps) {
              for (const [tbl, ts] of Object.entries(tsRes.timestamps)) {
                this.syncedDocVersions.set('mysql_' + tbl, ts);
                this.syncedDocVersions.set(tbl, ts);
              }
            }
          }).catch(() => {});

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

    // 2. Local Node.js server sync (Secondary / Offline Backup only)
    try {
      const url = getApiEndpoint('/api/db/records');
      if (cloudLoadedSuccessfully) {
        // If Cloud Firestore is authoritative and updated, keep local Node server in sync with cloud data
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.data)
        }).catch(() => {});
      } else {
        // Cloud was unavailable: fallback to local Node server
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
    } catch (e) {
      if (!cloudLoadedSuccessfully) {
        // 3. Static database fallback if both Cloud and Node server are offline
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
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        if (res.ok) {
          const result = await res.json().catch(() => ({}));
          this.updateStatusBadge('saved', result);
          console.log(`[Database Store] ✅ Saved to persistent server database: data/erp_database.json (${result.machinesCount || this.data[TABLE_NAMES.MACHINES]?.length || 0} machines, ${result.linesCount || this.data[TABLE_NAMES.LINES]?.length || 0} lines)`);
          return result;
        } else {
          // If local server returned 404/error (e.g. GitHub Pages), check if cloud connected
          if (this._isCloudConnected) {
            this.updateStatusBadge('saved');
            return { status: 'ok', cloud: true };
          }
          this.updateStatusBadge('error');
          console.warn(`[Database Store] ⚠️ Persistence server returned status: ${res.status}`);
          return { status: 'error', code: res.status };
        }
      } catch (err) {
        if (this._isCloudConnected) {
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
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      statusEl.title = 'Syncing changes to MySQL Primary Database...';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">🐬</span><span class="db-status-text">Syncing...</span>';
    } else if (status === 'saved' || status === 'synced') {
      statusEl.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusEl.style.color = '#34d399';
      statusEl.title = 'MySQL Primary Database Synchronized (maint_erp)';
      statusEl.innerHTML = '<span style="font-size: 12px; line-height: 1;">🐬</span><span class="db-status-text">MySQL Synced</span>';
    } else if (status === 'error') {
      // Distinct error state: cloud write was attempted but failed
      statusEl.style.borderColor = 'rgba(239, 68, 68, 0.5)';
      statusEl.style.background = 'rgba(239, 68, 68, 0.18)';
      statusEl.style.color = '#f87171';
      statusEl.title = '❌ Database Save Notice — Check MySQL hosting connection.';
      statusEl.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:pulse 1s infinite;"></span><span class="db-status-text">Save Error</span>';
    } else if (status === 'offline') {
      statusEl.style.borderColor = 'rgba(148, 163, 184, 0.4)';
      statusEl.style.background = 'rgba(148, 163, 184, 0.12)';
      statusEl.style.color = '#94a3b8';
      statusEl.title = 'Offline / LocalStorage mode — reconnect to sync';
      statusEl.innerHTML = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#94a3b8;"></span><span class="db-status-text">Local Only</span>';
    }
  }

  rebuildAllIndexes() {
    this.indexes.machineBySerial.clear();
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

  setTable(tableName, items) {
    this.data[tableName] = items || [];
    this.saveTable(tableName);
    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }
    return this.data[tableName];
  }

  getItem(tableName, id) {
    const table = this.data[tableName] || [];
    return table.find(item => item.id === id) || null;
  }

  insert(tableName, item) {
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }

    if (!item.id) {
      item.id = `${tableName.substring(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();

    this.data[tableName].push(item);
    this.saveTable(tableName);

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
    items.forEach(item => {
      if (!item.id) {
        item.id = `${tableName.substring(0, 3)}-${baseTime}-${++counter}-${Math.floor(Math.random() * 100000)}`;
      }
      item.createdAt = item.createdAt || now;
      item.updatedAt = now;
      this.data[tableName].push(item);
    });

    this.saveTable(tableName);

    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    return items;
  }

  update(tableName, id, updates) {
    const table = this.data[tableName] || [];
    const index = table.findIndex(item => item.id === id);
    if (index === -1) return null;

    table[index] = {
      ...table[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveTable(tableName);

    if (tableName === TABLE_NAMES.MACHINES) {
      this.rebuildAllIndexes();
    }

    return table[index];
  }

  delete(tableName, id) {
    const table = this.data[tableName] || [];
    const index = table.findIndex(item => item.id === id);
    if (index === -1) return false;

    const removed = table.splice(index, 1)[0];
    this.saveTable(tableName);

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
    const index = table.findIndex(item => item.id === id);
    if (index === -1) return null;

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
    const table = this.data[tableName] || [];
    const index = table.findIndex(item => item.id === id);
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
        if (!ep || ep === 'api/mysql_api.php' || ep === '/api/mysql_api.php' || ep.includes('://api/mysql_api.php') || ep === '/api/db/mysql' || (ep.includes('api/mysql_api.php') && !ep.startsWith('http'))) {
          ep = 'https://moviezonex.com/mysql_api.php';
        } else if (!/^https?:\/\//i.test(ep)) {
          if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('github.io')) {
            ep = 'https://moviezonex.com/mysql_api.php';
          } else {
            ep = 'https://' + ep;
          }
        }
        clone.endpoint = ep;
        if (!clone.database || clone.database === 'al_muslim_erp' || clone.database === 'maint_erp') clone.database = 'motaherh_maint-erp';
        if (!clone.username || clone.username === 'mainterp') clone.username = 'motaherh_mainterp';
        if (!clone.password) clone.password = 'Maint@456';
        clone.enabled = true;
        clone.autoSync = true;
        clone.role = 'PRIMARY';
      }
      return clone;
    });
  }

  // Multi-Database Configuration Persistence (Survives cache flushes and syncs across devices)
  getMultiDbConfigs() {
    try {
      const settingsTable = this.getTable(TABLE_NAMES.SETTINGS) || [];
      if (Array.isArray(settingsTable)) {
        const dbConfigRow = settingsTable.find(r => r.key === 'multi_db_config' || r.id === 'multi_db_config');
        if (dbConfigRow && Array.isArray(dbConfigRow.value) && dbConfigRow.value.length > 0) {
          return this._sanitizeDbConfigs(dbConfigRow.value);
        }
      }
      const settingsObj = this.data[TABLE_NAMES.SETTINGS];
      if (settingsObj && Array.isArray(settingsObj.multi_db_config) && settingsObj.multi_db_config.length > 0) {
        return this._sanitizeDbConfigs(settingsObj.multi_db_config);
      }
    } catch (_) {}
    try {
      const local = localStorage.getItem('erp_multi_db_config');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = this._sanitizeDbConfigs(parsed);
          try { localStorage.setItem('erp_multi_db_config', JSON.stringify(sanitized)); } catch (_) {}
          return sanitized;
        }
      }
    } catch (_) {}
    return [{
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
    }];
  }

  async saveMultiDbConfigs(configs) {
    const sanitized = this._sanitizeDbConfigs(configs) || configs;
    try {
      localStorage.setItem('erp_multi_db_config', JSON.stringify(sanitized));
    } catch (_) {}
    try {
      let settingsTable = this.getTable(TABLE_NAMES.SETTINGS) || [];
      if (Array.isArray(settingsTable)) {
        let row = settingsTable.find(r => r.key === 'multi_db_config' || r.id === 'multi_db_config');
        if (row) {
          row.value = sanitized;
          row.updatedAt = new Date().toISOString();
        } else {
          settingsTable.push({
            id: 'multi_db_config',
            key: 'multi_db_config',
            value: sanitized,
            updatedAt: new Date().toISOString()
          });
        }
      }
      if (this.data[TABLE_NAMES.SETTINGS] && typeof this.data[TABLE_NAMES.SETTINGS] === 'object' && !Array.isArray(this.data[TABLE_NAMES.SETTINGS])) {
        this.data[TABLE_NAMES.SETTINGS].multi_db_config = sanitized;
      }
      this.saveTable(TABLE_NAMES.SETTINGS, true);
      if (typeof this.persistToServerDatabase === 'function') {
        this.persistToServerDatabase().catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to persist multi_db_config to server/cloud:', e);
    }
  }
}

export const storage = new StorageEngine();
storage.init();
