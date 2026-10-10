/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Preventive Machine Maintenance Core Service
 * 
 * Features:
 * 1. Machine Data Live Auto-Sync (Zero Duplicate Data Storage)
 * 2. Next Service Date Auto Calculation based on Machine Type Interval
 * 3. Dynamic Urgency Engine (Overdue, Due Today, Due Tomorrow, Due Soon, Scheduled)
 * 4. Service Entry Logging with Automatic Lifetime Passport Sync
 * 5. Service Sticker Serial Management (Generate, Lookup, Edit, Replace, Delete)
 * 6. Smart Manpower Auto-Suggest & Auto-Fill (Integrated with Manpower Management)
 * 7. Prioritized Reminders & In-App Notification Dispatcher
 * 8. Summary Dashboard Metrics (8 KPI Cards)
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from './authService.js';
import { machineService } from './machineService.js';
import { employeeService } from './employeeService.js';
import { historyService } from './historyService.js';
import { notificationService } from './notificationService.js';
import { auditService } from './auditService.js';
import { excelService } from './excelService.js';

class PreventiveMaintenanceService {

  // =========================================================================
  // 1. ADMIN CONFIGURATION (MACHINE TYPE SCHEDULES & CHECKLISTS)
  // =========================================================================

  // =========================================================================
  // 1. ADMIN CONFIGURATION (MASTER DATA STORAGE AUTO-SYNC & ZERO DUPLICATES)
  // =========================================================================

  /**
   * Canonical machine type normalizer: merges typo and naming variations
   * e.g. "Plane Machine", "Lock Stitch" -> "Plane / Lock Stitch Machine"
   * "Over Lock Machine", "Over Lock Mechine" -> "Overlock Machine"
   * "Flat Lock Machine", "Flatlock" -> "Flatlock Machine"
   */
  getCanonicalMachineType(rawName) {
    if (!rawName) return 'General Sewing Machine';
    const s = String(rawName).trim();
    const lower = s.toLowerCase();

    if (lower.includes('plane') || lower.includes('lock stitch') || lower.includes('lockstitch') || lower.includes('single needle')) {
      if (lower.includes('bottom ham') || lower.includes('bottom hem')) return 'Bottom Hemming Lock Stitch';
      return 'Plane / Lock Stitch Machine';
    }
    if (lower.includes('over lock') || lower.includes('overlock') || lower.includes('over lock mechine')) {
      if (lower.includes('safety stitch')) return 'Safety Stitch / Overlock M/C';
      return 'Overlock Machine';
    }
    if (lower.includes('flat lock') || lower.includes('flatlock')) {
      if (lower.includes('raw edge')) return 'Flatlock with Raw Edge Cutting';
      return 'Flatlock Machine';
    }
    if (lower.includes('double needle')) {
      if (lower.includes('auto')) return 'Double Needle Auto Machine';
      if (lower.includes('manual')) return 'Double Needle Manual Machine';
      return 'Double Needle Machine';
    }
    if (lower.includes('chain stitch') || lower.includes('chainstitch')) {
      if (lower.includes('multi needle')) return 'Multi Needle Chain Stitch';
      if (lower.includes('bottom ham') || lower.includes('bottom hem')) return 'Bottom Hemming Chain Stitch';
      return 'Chain Stitch Machine';
    }
    if (lower.includes('button hole') || lower.includes('botton hole') || lower.includes('eye let hole') || lower.includes('eyelet hole')) {
      if (lower.includes('eye let') || lower.includes('eyelet')) return 'Eyelet Hole Machine';
      return 'Button Hole Machine';
    }
    if (lower.includes('button stitch') || lower.includes('button attach') || lower.includes('snap button')) {
      if (lower.includes('snap button')) return 'Snap Button Machine';
      return 'Button Stitch / Attach Machine';
    }
    if (lower.includes('bar tak') || lower.includes('bar tack') || lower.includes('bartack')) {
      return 'Bar Tack Machine';
    }
    if (lower.includes('feed of the arm') || lower.includes('feed off the arm') || lower.includes('fota')) {
      return 'Feed of The Arm Machine';
    }
    if (lower.includes('loop attach')) {
      return 'Loop Attach Machine';
    }
    if (lower.includes('sleeve joint')) {
      return 'Sleeve Joint Machine';
    }
    if (lower.includes('zipper joint')) {
      return 'Zipper Joint Machine';
    }
    if (lower.includes('vertical')) {
      return 'Vertical Machine';
    }
    if (lower.includes('pocket')) {
      if (lower.includes('facing')) return 'Pocket Facing Machine';
      if (lower.includes('welting')) return 'Automatic Pocket Welting';
      if (lower.includes('attach')) return 'Pocket Attach Machine';
      return 'Pocket Processing Machine';
    }
    if (lower.includes('spreading')) {
      return 'Spreading Machine';
    }
    return s.replace(/\s+/g, ' ');
  }

  /**
   * Automatically synchronizes all Machine Types from Master Data Storage (MACHINE_NAMES and MACHINES)
   * with ZERO duplicate configs. Preserves any existing customized intervals and checklists.
   */
  syncConfigsFromMasterData() {
    const rawMasterList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    const activeMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    let currentConfigs = storage.getTable(TABLE_NAMES.PREVENTIVE_CONFIG) || [];

    // Count machine occurrences in factory
    const machineCountMap = new Map();
    activeMachines.forEach(m => {
      const mnObj = rawMasterList.find(x => x.id === m.machineNameId);
      const rawName = mnObj?.name || m.machineName || 'Sewing Machine';
      const canonical = this.getCanonicalMachineType(rawName);
      machineCountMap.set(canonical, (machineCountMap.get(canonical) || 0) + 1);
    });

    // Group all master data machine names into unique canonical types
    const canonicalGroups = new Map();
    rawMasterList.forEach(mn => {
      const canonical = this.getCanonicalMachineType(mn.name);
      if (!canonicalGroups.has(canonical)) {
        canonicalGroups.set(canonical, new Set());
      }
      canonicalGroups.get(canonical).add(mn.name);
    });

    // Also include any active machines that may have ad-hoc names
    activeMachines.forEach(m => {
      const rawName = m.machineName || '';
      if (rawName) {
        const canonical = this.getCanonicalMachineType(rawName);
        if (!canonicalGroups.has(canonical)) {
          canonicalGroups.set(canonical, new Set());
        }
        canonicalGroups.get(canonical).add(rawName);
      }
    });

    let modified = false;

    // Deduplicate existing configs first by canonical key
    const deduplicatedMap = new Map();
    currentConfigs.forEach(cfg => {
      const canonKey = this.getCanonicalMachineType(cfg.machineType);
      if (!deduplicatedMap.has(canonKey)) {
        deduplicatedMap.set(canonKey, {
          ...cfg,
          machineType: canonKey,
          aliases: Array.isArray(cfg.aliases) ? cfg.aliases : [cfg.machineType]
        });
      } else {
        // Merge aliases into the primary config
        const existing = deduplicatedMap.get(canonKey);
        const set = new Set([...(existing.aliases || []), cfg.machineType]);
        existing.aliases = [...set];
        modified = true;
      }
    });

    // Merge Master Data machine types into configs
    for (const [canonical, aliasSet] of canonicalGroups.entries()) {
      const count = machineCountMap.get(canonical) || 0;
      if (deduplicatedMap.has(canonical)) {
        const existing = deduplicatedMap.get(canonical);
        const mergedAliases = new Set([...(existing.aliases || []), ...aliasSet]);
        existing.aliases = [...mergedAliases];
        existing.machineCount = count;
      } else {
        // Create new schedule config for this machine type with sensible defaults
        let defaultDays = 91;
        const low = canonical.toLowerCase();
        if (low.includes('flatlock') || low.includes('feed of the arm') || low.includes('bar tack')) {
          defaultDays = 60;
        } else if (low.includes('button hole') || low.includes('eyelet')) {
          defaultDays = 30;
        } else if (low.includes('button stitch') || low.includes('button attach')) {
          defaultDays = 45;
        } else if (low.includes('spreading') || low.includes('cutting') || low.includes('fusing')) {
          defaultDays = 180;
        }

        const newCfg = {
          id: `pm-cfg-${canonical.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          machineType: canonical,
          aliases: [...aliasSet],
          modelId: 'ALL',
          modelName: 'All Models',
          frequencyDays: defaultDays,
          frequencyLabel: `Every ${defaultDays} Days`,
          serviceIntervalDays: defaultDays,
          reminderDays: [7, 3, 0],
          responsibleDepartment: 'Mechanical Maintenance',
          defaultManpowerId: null,
          defaultManpowerName: null,
          machineCount: count,
          checklist: [
            'Motor & Drive Belt Inspection & Tension Adjustment',
            'Oil Level & High Speed Lubrication System',
            'Needle Bar Height & Timing Alignment',
            'Safety Guard & Eye Shield Intactness Check',
            'Dust, Lint Cleaning & Waste Suction'
          ],
          status: 'ACTIVE',
          syncedFromMasterData: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        deduplicatedMap.set(canonical, newCfg);
        modified = true;
      }
    }

    const finalConfigs = Array.from(deduplicatedMap.values());
    // Sort: Machines in factory first, then alphabetically
    finalConfigs.sort((a, b) => {
      const countA = a.machineCount || 0;
      const countB = b.machineCount || 0;
      if (countA !== countB) return countB - countA;
      return a.machineType.localeCompare(b.machineType);
    });

    if (modified || finalConfigs.length !== currentConfigs.length) {
      storage.setTable(TABLE_NAMES.PREVENTIVE_CONFIG, finalConfigs);
      storage.saveTable(TABLE_NAMES.PREVENTIVE_CONFIG);
    }

    return finalConfigs;
  }

  getConfigs() {
    let configs = storage.getTable(TABLE_NAMES.PREVENTIVE_CONFIG) || [];
    if (!configs || configs.length < 20 || !configs[0]?.aliases) {
      configs = this.syncConfigsFromMasterData();
    }
    // Clean any legacy default manpower pre-assignments and migrate 90 days to 91 days
    let modified = false;
    for (const c of configs) {
      if (c.defaultManpowerName || c.defaultManpowerId) {
        c.defaultManpowerName = null;
        c.defaultManpowerId = null;
        modified = true;
      }
      if (c.frequencyDays === 90 || c.serviceIntervalDays === 90) {
        c.frequencyDays = 91;
        c.serviceIntervalDays = 91;
        c.frequencyLabel = 'Every 91 Days';
        modified = true;
      }
    }
    if (modified) {
      storage.setTable(TABLE_NAMES.PREVENTIVE_CONFIG, configs);
    }
    return configs;
  }

  getConfigById(id) {
    return this.getConfigs().find(c => c.id === id) || storage.getItem(TABLE_NAMES.PREVENTIVE_CONFIG, id);
  }

  getConfigByMachineType(machineTypeOrName) {
    if (!machineTypeOrName) return null;
    const configs = this.getConfigs();
    const query = String(machineTypeOrName).toLowerCase().trim();
    const queryNorm = query.replace(/[\s\-_/]+/g, '');

    // 1. Exact or canonical match on machineType
    let match = configs.find(c => c.machineType && c.machineType.toLowerCase() === query);
    if (match) return match;

    const canonicalTarget = this.getCanonicalMachineType(machineTypeOrName).toLowerCase();
    match = configs.find(c => c.machineType && c.machineType.toLowerCase() === canonicalTarget);
    if (match) return match;

    // 2. Alias match
    match = configs.find(c => {
      if (Array.isArray(c.aliases)) {
        return c.aliases.some(a => a.toLowerCase() === query || a.toLowerCase().replace(/[\s\-_/]+/g, '') === queryNorm);
      }
      return false;
    });
    if (match) return match;

    // 3. Keyword/substring match
    match = configs.find(c => {
      const t = (c.machineType || '').toLowerCase().replace(/[\s\-_/]+/g, '');
      return queryNorm.includes(t) || t.includes(queryNorm);
    });
    if (match) return match;

    // Fallback: Return Plane / Lock Stitch config
    return configs.find(c => c.machineType.includes('Lock Stitch') || c.machineType.includes('Plane')) || configs[0] || {
      machineType: machineTypeOrName,
      frequencyDays: 91,
      frequencyLabel: 'Every 91 Days',
      reminderDays: [7, 3, 0],
      responsibleDepartment: 'Mechanical Maintenance',
      checklist: [
        'Motor & Drive Belt Inspection',
        'Oil Level & High Speed Lubrication System',
        'Needle Bar Height & Timing Alignment',
        'Safety Guard & Eye Shield Intactness',
        'Dust, Lint & Waste Suction Cleaning'
      ]
    };
  }

  async saveConfig(configData) {
    const user = authService.getCurrentUser();
    const canonicalName = this.getCanonicalMachineType(configData.machineType);
    const id = configData.id || `pm-cfg-${canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const cleanFrequency = parseInt(configData.frequencyDays, 10) || 91;

    const existingConfigs = storage.getTable(TABLE_NAMES.PREVENTIVE_CONFIG) || [];
    const existingIndex = existingConfigs.findIndex(c => c.id === id || c.machineType.toLowerCase() === canonicalName.toLowerCase());

    const record = {
      ...(existingIndex >= 0 ? existingConfigs[existingIndex] : {}),
      id,
      machineType: canonicalName,
      aliases: existingIndex >= 0 ? existingConfigs[existingIndex].aliases : [configData.machineType],
      modelId: configData.modelId || 'ALL',
      modelName: configData.modelName || 'All Models',
      frequencyDays: cleanFrequency,
      frequencyLabel: configData.frequencyLabel || `Every ${cleanFrequency} Days`,
      serviceIntervalDays: cleanFrequency,
      fixedCalendarDate: configData.fixedCalendarDate || null,
      reminderDays: Array.isArray(configData.reminderDays) ? configData.reminderDays : [7, 3, 0],
      responsibleDepartment: configData.responsibleDepartment || 'Mechanical Maintenance',
      defaultManpowerId: null,
      defaultManpowerName: null,
      checklist: Array.isArray(configData.checklist) ? configData.checklist : [],
      status: configData.status || 'ACTIVE',
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      existingConfigs[existingIndex] = record;
      auditService.log('CONFIG', 'PREVENTIVE_MAINTENANCE', id, `Updated Preventive Schedule Config for ${record.machineType}`);
    } else {
      record.createdAt = new Date().toISOString();
      existingConfigs.push(record);
      auditService.log('CONFIG', 'PREVENTIVE_MAINTENANCE', id, `Created Preventive Schedule Config for ${record.machineType}`);
    }

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.PREVENTIVE_CONFIG, existingConfigs);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: PM config was not confirmed by the cloud.');
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
    return record;
  }

  async deleteConfig(id) {
    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.PREVENTIVE_CONFIG, (tbl) => {
      const idx = tbl.findIndex(c => c.id === id);
      if (idx !== -1) tbl.splice(idx, 1);
    });
    auditService.log('CONFIG', 'PREVENTIVE_MAINTENANCE', id, `Deleted Preventive Schedule Config [${id}]`);
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
    return true;
  }

  /**
   * Admin-controlled Inspection Checklist Manager:
   * Adds, edits, or removes checklist items for a machine type.
   * Persists immediately to PREVENTIVE_CONFIG storage so all machines of that type reflect it.
   * @param {string} machineTypeOrName - Target machine type or canonical type name
   * @param {Array<string>} updatedChecklist - Array of checklist item strings
   * @returns {Object} Updated configuration record
   */
  async updateChecklistForMachineType(machineTypeOrName, updatedChecklist) {
    if (!machineTypeOrName) throw new Error('Machine type is required to update checklist');
    if (!Array.isArray(updatedChecklist)) throw new Error('Checklist must be an array of strings');

    const cleanItems = updatedChecklist
      .map(item => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
      .filter(Boolean);

    const configs = this.getConfigs();
    let config = this.getConfigByMachineType(machineTypeOrName);

    if (config) {
      config.checklist = cleanItems;
      config.updatedAt = new Date().toISOString();
      const idx = configs.findIndex(c => c.id === config.id);
      if (idx >= 0) {
        configs[idx] = config;
      } else {
        configs.push(config);
      }
    } else {
      const canonicalName = this.getCanonicalMachineType(machineTypeOrName);
      const id = `pm-cfg-${canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      config = {
        id,
        machineType: canonicalName,
        aliases: [machineTypeOrName],
        modelId: 'ALL',
        modelName: 'All Models',
        frequencyDays: 91,
        frequencyLabel: 'Every 91 Days',
        serviceIntervalDays: 91,
        reminderDays: [7, 3, 0],
        responsibleDepartment: 'Mechanical Maintenance',
        checklist: cleanItems,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      configs.push(config);
    }

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.PREVENTIVE_CONFIG, configs);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Checklist update was not confirmed by the cloud.');
    auditService.log('CONFIG', 'PREVENTIVE_MAINTENANCE', config.id, `Admin updated inspection checklist (${cleanItems.length} items) for ${config.machineType}`);
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
    return config;
  }

  // =========================================================================
  // 1.1 BULK EXCEL SCHEDULE INTERVAL IMPORT & TEMPLATE EXPORTER
  // =========================================================================

  /**
   * Generates and downloads a clean, pre-populated Excel workbook containing all
   * 76 machine types and their current service interval days.
   */
  async exportScheduleConfigExcelTemplate() {
    const configs = this.getConfigs();
    const rows = configs.map((c, idx) => ({
      'SL': idx + 1,
      'Machine Type Name': c.machineType,
      'Service Interval (Days)': c.frequencyDays || 91,
      'Frequency Label': c.frequencyLabel || `Every ${c.frequencyDays || 91} Days`,
      'Responsible Department': c.responsibleDepartment || 'Mechanical Maintenance',
      'Factory Active Machines': c.machineCount || 0,
      'Status': c.status || 'ACTIVE',
      'Checklist Items': Array.isArray(c.checklist) ? c.checklist.join(' | ') : ''
    }));

    const fileName = `AlMuslim_Preventive_Maintenance_Schedule_Config_${new Date().toISOString().split('T')[0]}.xlsx`;
    await excelService.exportToExcel(rows, fileName);
    if (typeof notificationService !== 'undefined' && notificationService.success) {
      notificationService.success(`Downloaded Schedule Configuration Excel template with ${rows.length} machine types.`);
    }
  }

  /**
   * Helper to extract numeric days from user-provided Excel cell values
   * Supports numbers (30), strings ("Every 30 Days"), words ("Monthly", "Quarterly"), etc.
   */
  extractDaysFromValue(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') {
      const n = Math.round(val);
      return n > 0 && n <= 3650 ? n : null;
    }
    const str = String(val).trim().toLowerCase();
    if (!str) return null;

    if (str.includes('quarter') || str.includes('3 month')) return 91;
    if (str.includes('half year') || str.includes('6 month')) return 180;
    if (str.includes('yearly') || (str.includes('1 year') && !str.includes('half'))) return 365;
    if (str.includes('bi-month') || str.includes('2 month')) return 60;
    if (str.includes('month') && !str.includes('bi') && !str.includes('3') && !str.includes('6')) return 30;
    if (str.includes('bi-week') || str.includes('15 day')) return 15;
    if (str.includes('week') && !str.includes('bi')) return 7;

    const numMatch = str.match(/\d+/);
    if (numMatch) {
      const n = parseInt(numMatch[0], 10);
      return n > 0 && n <= 3650 ? n : null;
    }
    return null;
  }

  /**
   * Previews and validates rows parsed from an uploaded Excel file
   * Compares each row against existing system configurations
   */
  previewBulkScheduleImport(rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return {
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        changedCount: 0,
        unchangedCount: 0,
        newCount: 0,
        items: []
      };
    }

    const configs = this.getConfigs();
    const configMap = new Map();
    configs.forEach(c => {
      configMap.set(c.machineType.toLowerCase(), c);
      if (Array.isArray(c.aliases)) {
        c.aliases.forEach(a => configMap.set(a.toLowerCase(), c));
      }
    });

    const processedRows = [];

    rawRows.forEach((row, idx) => {
      let rawType = '';
      let rawDays = '';
      let rawDept = '';
      let rawChecklist = '';
      let rawSerial = '';

      for (const [key, val] of Object.entries(row)) {
        const k = key.toLowerCase().trim().replace(/[\s\-_/()]+/g, '');
        if (k.includes('machinetype') || k === 'type' || k === 'machinename' || k === 'itemname' || k === 'machinetypename') {
          rawType = String(val || '').trim();
        } else if (k.includes('interval') || k.includes('frequency') || k === 'days' || k.includes('servicingdays') || k.includes('kotodin') || k.includes('porpor')) {
          rawDays = val;
        } else if (k.includes('dept') || k.includes('department')) {
          rawDept = String(val || '').trim();
        } else if (k.includes('checklist') || k.includes('tasks')) {
          rawChecklist = String(val || '').trim();
        } else if (k.includes('serial') || k.includes('machineno')) {
          rawSerial = String(val || '').trim();
        }
      }

      if (!rawType && row['Machine Type Name']) rawType = String(row['Machine Type Name']).trim();
      if (!rawType && row['Machine Type']) rawType = String(row['Machine Type']).trim();
      if (!rawType && row['Machine Name']) rawType = String(row['Machine Name']).trim();
      if (rawDays === '' && row['Service Interval (Days)']) rawDays = row['Service Interval (Days)'];
      if (rawDays === '' && row['Frequency Days']) rawDays = row['Frequency Days'];
      if (rawDays === '' && row['Days']) rawDays = row['Days'];

      if (!rawType && !rawSerial) {
        return; // skip blank row
      }

      const extractedDays = this.extractDaysFromValue(rawDays);
      const canonicalType = rawType ? this.getCanonicalMachineType(rawType) : '';
      const matchedConfig = canonicalType ? (configMap.get(canonicalType.toLowerCase()) || this.getConfigByMachineType(rawType)) : null;

      const checklistItems = rawChecklist 
        ? rawChecklist.split(/[,|;]+/).map(s => s.trim()).filter(Boolean)
        : null;

      const currentDays = matchedConfig ? (matchedConfig.frequencyDays || 91) : null;
      const isChanged = (extractedDays !== null) && (matchedConfig ? (currentDays !== extractedDays) : true);
      const isNew = !matchedConfig && !!canonicalType;
      const isValid = (extractedDays !== null && extractedDays > 0 && extractedDays <= 3650) && (!!canonicalType || !!rawSerial);

      let actionStatus = 'UNCHANGED';
      let actionLabel = 'No Change';
      if (!isValid) {
        actionStatus = 'INVALID';
        actionLabel = extractedDays === null ? 'Missing / Invalid Days' : 'Invalid Data';
      } else if (isNew) {
        actionStatus = 'NEW';
        actionLabel = 'New Machine Type';
      } else if (isChanged) {
        actionStatus = 'UPDATE';
        actionLabel = `Update: ${currentDays}d → ${extractedDays}d`;
      }

      processedRows.push({
        sl: idx + 1,
        machineType: canonicalType || rawType,
        rawMachineType: rawType,
        machineSerial: rawSerial,
        currentDays,
        newDays: extractedDays,
        newLabel: extractedDays ? `Every ${extractedDays} Days` : '',
        department: rawDept || matchedConfig?.responsibleDepartment || 'Mechanical Maintenance',
        checklist: checklistItems || matchedConfig?.checklist || [],
        targetMachinesCount: matchedConfig?.machineCount || 0,
        isValid,
        isChanged,
        isNew,
        actionStatus,
        actionLabel,
        matchedConfigId: matchedConfig?.id || null
      });
    });

    return {
      totalRows: processedRows.length,
      validRows: processedRows.filter(r => r.isValid),
      invalidRows: processedRows.filter(r => !r.isValid),
      changedCount: processedRows.filter(r => r.isValid && r.isChanged).length,
      unchangedCount: processedRows.filter(r => r.isValid && !r.isChanged && !r.isNew).length,
      newCount: processedRows.filter(r => r.isValid && r.isNew).length,
      items: processedRows
    };
  }

  /**
   * Commits and applies validated rows from bulk Excel import
   * Automatically synchronizes next target service dates for all affected factory machines!
   */
  applyBulkScheduleImport(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No valid rows provided to import.');
    }

    const configs = this.getConfigs();
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const allMaintenanceRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];

    let updatedConfigsCount = 0;
    let newConfigsCount = 0;
    let affectedMachinesCount = 0;
    const changedTypeFrequencies = new Map();

    items.forEach(item => {
      if (!item.isValid || !item.newDays) return;

      const canonicalType = this.getCanonicalMachineType(item.machineType);
      const existing = configs.find(c => 
        c.machineType.toLowerCase() === canonicalType.toLowerCase() || 
        (c.aliases && c.aliases.some(a => a.toLowerCase() === (item.rawMachineType || '').toLowerCase()))
      );

      if (existing) {
        if (existing.frequencyDays !== item.newDays || (item.department && existing.responsibleDepartment !== item.department)) {
          changedTypeFrequencies.set(canonicalType.toLowerCase(), item.newDays);
          existing.frequencyDays = item.newDays;
          existing.serviceIntervalDays = item.newDays;
          existing.frequencyLabel = item.newLabel || `Every ${item.newDays} Days`;
          if (item.department) existing.responsibleDepartment = item.department;
          if (item.checklist && item.checklist.length > 0) existing.checklist = item.checklist;
          existing.updatedAt = new Date().toISOString();
          updatedConfigsCount++;
        }
      } else {
        const newCfg = {
          id: `pm-cfg-${canonicalType.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          machineType: canonicalType,
          aliases: [item.rawMachineType || canonicalType],
          modelId: 'ALL',
          modelName: 'All Models',
          frequencyDays: item.newDays,
          frequencyLabel: item.newLabel || `Every ${item.newDays} Days`,
          serviceIntervalDays: item.newDays,
          reminderDays: [7, 3, 0],
          responsibleDepartment: item.department || 'Mechanical Maintenance',
          defaultManpowerId: null,
          defaultManpowerName: null,
          machineCount: 0,
          checklist: item.checklist && item.checklist.length > 0 ? item.checklist : [
            'Motor & Drive Belt Inspection & Tension Adjustment',
            'Oil Level & High Speed Lubrication System',
            'Needle Bar Height & Timing Alignment',
            'Safety Guard & Eye Shield Intactness Check',
            'Dust, Lint Cleaning & Waste Suction'
          ],
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        configs.push(newCfg);
        changedTypeFrequencies.set(canonicalType.toLowerCase(), item.newDays);
        newConfigsCount++;
      }
    });

    storage.setTable(TABLE_NAMES.PREVENTIVE_CONFIG, configs);
    storage.saveTable(TABLE_NAMES.PREVENTIVE_CONFIG);

    // Re-synchronize next service dates for all machines belonging to changed types
    if (changedTypeFrequencies.size > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      let maintenanceRecordsModified = false;

      allMachines.forEach(m => {
        const enriched = machineService.getEnrichedMachine(m.id) || m;
        const mTypeName = enriched.machineName?.name || m.machineName || 'Sewing Machine';
        const canon = this.getCanonicalMachineType(mTypeName).toLowerCase();

        if (changedTypeFrequencies.has(canon)) {
          const newFreq = changedTypeFrequencies.get(canon);
          affectedMachinesCount++;

          const records = allMaintenanceRecords
            .filter(r => r.machineId === m.id || (r.serialNumber && r.serialNumber.trim().toUpperCase() === m.serialNumber?.trim().toUpperCase()))
            .sort((a, b) => new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt));

          if (records.length > 0) {
            const latest = records[0];
            const baseDate = latest.serviceDate || todayStr;
            latest.nextServiceDate = this.calculateNextServiceDate(baseDate, newFreq);
            latest.updatedAt = new Date().toISOString();
            maintenanceRecordsModified = true;
          }
        }
      });

      if (maintenanceRecordsModified) {
        storage.setTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE, allMaintenanceRecords);
        storage.saveTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE);
      }
    }

    auditService.log(
      'CONFIG',
      'PREVENTIVE_MAINTENANCE',
      'BULK_IMPORT',
      `Bulk updated maintenance schedule intervals via Excel: ${updatedConfigsCount} updated, ${newConfigsCount} created, ${affectedMachinesCount} factory machines resynchronized.`
    );
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));

    return {
      updatedConfigsCount,
      newConfigsCount,
      affectedMachinesCount,
      totalProcessed: items.length
    };
  }

  // =========================================================================
  // 1.2 BULK EXCEL MACHINE SERVICING IMPORT & TEMPLATE EXPORTER
  // =========================================================================

  /**
   * Generates and downloads a pre-populated Excel template containing all machines in factory.
   * Users can enter or update Last Service Date, Serviced By, and Physical Sticker Sl No. in bulk.
   */
  async exportServicingExcelTemplate() {
    const allMachines = this.getAllMachinesWithMaintenance();
    const rows = allMachines.map((m, idx) => ({
      'SL': idx + 1,
      'Machine Serial': m.serialNumber,
      'Machine Name': m.machineName,
      'Brand': m.brand,
      'Model': m.model,
      'Floor': m.floor,
      'Line': m.line,
      'Machine Status': m.machineStatus,
      'Last Service Date': m.lastServiceDate ? this.formatDateDMY(m.lastServiceDate) : '',
      'Serviced By (Card # / Name)': m.assignedManpower || m.lastServicedBy || '',
      'Physical Sticker Sl No.': m.serviceStickerSerial && m.serviceStickerSerial !== 'STK-PENDING' ? m.serviceStickerSerial : '',
      'Service Remarks': m.serviceRemarks || 'Routine maintenance servicing'
    }));

    const fileName = `AlMuslim_Preventive_Maintenance_Servicing_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
    await excelService.exportToExcel(rows, fileName);
    if (typeof notificationService !== 'undefined' && notificationService.success) {
      notificationService.success(`Downloaded Servicing Excel template with ${rows.length} machines.`);
    }
  }

  /**
   * Previews and validates rows parsed from an uploaded Servicing Excel file.
   * Matches machines by serial number, validates service dates, and computes next due dates.
   */
  previewBulkServicingExcel(rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return {
        totalRows: 0,
        validRows: [],
        invalidRows: [],
        notFoundCount: 0,
        invalidDateCount: 0,
        items: []
      };
    }

    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const machineMap = new Map();
    allMachines.forEach(m => {
      if (m.serialNumber) {
        machineMap.set(m.serialNumber.trim().toUpperCase(), m);
      }
    });

    const processedRows = [];

    rawRows.forEach((row, idx) => {
      let rawSerial = '';
      let rawServiceDate = '';
      let rawServicedBy = '';
      let rawSticker = '';
      let rawRemarks = '';

      for (const [key, val] of Object.entries(row)) {
        const k = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (k.includes('serial') || k.includes('machineno') || k === 'sn' || k === 'mcserial' || k === 'assetno') {
          if (!rawSerial && val !== undefined && val !== null && String(val).trim() !== '') {
            rawSerial = String(val).trim();
          }
        } else if (k.includes('servicedate') || k.includes('servicingdate') || k.includes('maintenancedate') || k.includes('pmdate') || k === 'lastservice' || k === 'date') {
          if (!rawServiceDate && val !== undefined && val !== null && String(val).trim() !== '') {
            rawServiceDate = val;
          }
        } else if (k.includes('servicedby') || k.includes('technician') || k.includes('mechanic') || k.includes('serviceman') || k.includes('manpower')) {
          if (!rawServicedBy && val !== undefined && val !== null && String(val).trim() !== '') {
            rawServicedBy = String(val).trim();
          }
        } else if (k.includes('sticker') || k.includes('stickerno') || k.includes('stickerserial')) {
          if (!rawSticker && val !== undefined && val !== null && String(val).trim() !== '') {
            rawSticker = String(val).trim();
          }
        } else if (k.includes('remark') || k.includes('note') || k.includes('comment')) {
          if (!rawRemarks && val !== undefined && val !== null && String(val).trim() !== '') {
            rawRemarks = String(val).trim();
          }
        }
      }

      // Explicit fallbacks
      if (!rawSerial) rawSerial = String(row['Machine Serial'] || row['Serial Number'] || row['Serial'] || '').trim();
      if (!rawServiceDate) rawServiceDate = row['Last Service Date'] || row['Service Date'] || row['Servicing Date'] || '';
      if (!rawServicedBy) rawServicedBy = String(row['Serviced By (Card # / Name)'] || row['Serviced By'] || row['Technician'] || '').trim();
      if (!rawSticker) rawSticker = String(row['Physical Sticker Sl No.'] || row['Sticker Serial'] || row['Sticker No'] || '').trim();
      if (!rawRemarks) rawRemarks = String(row['Service Remarks'] || row['Remarks'] || '').trim();

      if (!rawSerial && !rawServiceDate) return; // skip blank row

      const cleanDate = excelService.parseCleanDate(rawServiceDate);
      const matchedMachine = rawSerial ? machineMap.get(rawSerial.toUpperCase()) : null;

      let status = 'VALID';
      let statusLabel = 'Ready to Update';

      if (!matchedMachine) {
        status = 'NOT_FOUND';
        statusLabel = 'Machine Serial Not Found';
      } else if (!cleanDate) {
        status = 'INVALID_DATE';
        statusLabel = 'Missing / Invalid Date';
      }

      const isValid = status === 'VALID';
      const mProfile = matchedMachine ? (machineService.getEnrichedMachine(matchedMachine.id) || matchedMachine) : null;
      const mTypeName = mProfile?.machineName?.name || matchedMachine?.machineName || 'Sewing Machine';
      const config = this.getConfigByMachineType(mTypeName);
      const frequencyDays = config?.frequencyDays || 91;
      const nextDate = isValid ? this.calculateNextServiceDate(cleanDate, frequencyDays) : '';

      processedRows.push({
        sl: idx + 1,
        machineId: matchedMachine?.id || null,
        serialNumber: rawSerial,
        machineName: mTypeName,
        brand: mProfile?.brand?.name || matchedMachine?.brand || '—',
        model: mProfile?.model?.name || matchedMachine?.model || '—',
        floor: mProfile?.floor?.name || matchedMachine?.floor || '—',
        line: mProfile?.line?.name || matchedMachine?.line || '—',
        serviceDate: cleanDate,
        rawServiceDate: String(rawServiceDate),
        nextServiceDate: nextDate,
        frequencyDays,
        servicedBy: rawServicedBy || 'Assigned Mechanic',
        serviceStickerSerial: rawSticker,
        serviceRemarks: rawRemarks || 'Bulk Excel Servicing Import',
        status,
        statusLabel,
        isValid
      });
    });

    return {
      totalRows: processedRows.length,
      validRows: processedRows.filter(r => r.isValid),
      invalidRows: processedRows.filter(r => !r.isValid),
      notFoundCount: processedRows.filter(r => r.status === 'NOT_FOUND').length,
      invalidDateCount: processedRows.filter(r => r.status === 'INVALID_DATE').length,
      items: processedRows
    };
  }

  /**
   * Applies validated servicing records from bulk Excel import.
   * Updates machine records, writes completed PM records, logs machine history, and dispatches events.
   */
  async applyBulkServicingImport(validItems) {
    if (!Array.isArray(validItems) || validItems.length === 0) {
      throw new Error('No valid servicing rows provided to import.');
    }

    const user = authService.getCurrentUser() || { id: 'admin-1', fullName: 'Administrator' };
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const pmTable = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];

    let updatedCount = 0;

    validItems.forEach(item => {
      if (!item.isValid || !item.serviceDate || !item.machineId) return;

      const machine = allMachines.find(m => m.id === item.machineId);
      if (!machine) return;

      const serviceDate = item.serviceDate;
      const nextDate = item.nextServiceDate || this.calculateNextServiceDate(serviceDate, item.frequencyDays || 91);
      const servicedBy = item.servicedBy || user.fullName || 'Routine Mechanic';
      const stickerSerial = item.serviceStickerSerial || machine.serviceStickerSerial || '';

      // 1. Update machine entity
      machine.lastServiceDate = serviceDate;
      machine.nextServiceDate = nextDate;
      machine.assignedManpower = servicedBy;
      machine.lastServicedBy = servicedBy;
      if (stickerSerial) machine.serviceStickerSerial = stickerSerial;
      machine.updatedAt = new Date().toISOString();

      // 2. Add or update record in PREVENTIVE_MAINTENANCE
      const existingPmIndex = pmTable.findIndex(r => 
        (r.machineId === machine.id || (r.serialNumber && r.serialNumber.trim().toUpperCase() === machine.serialNumber?.trim().toUpperCase())) &&
        r.serviceDate === serviceDate
      );

      const pmRecord = {
        id: existingPmIndex >= 0 ? pmTable[existingPmIndex].id : `pm-rec-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        machineId: machine.id,
        serialNumber: machine.serialNumber,
        machineName: item.machineName || machine.machineName || 'Machine',
        machineType: item.machineName || 'Sewing Machine',
        model: item.model || machine.model || '',
        brand: item.brand || machine.brand || '',
        unit: machine.unit || 'AKM Knitwear Ltd.',
        unitId: machine.unitId || null,
        floor: item.floor || machine.floor || '',
        floorId: machine.floorId || null,
        line: item.line || machine.line || '',
        lineId: machine.lineId || null,
        workingArea: `${item.floor || machine.floor || ''} - ${item.line || machine.line || ''}`,
        serviceDate: serviceDate,
        serviceType: 'PREVENTIVE_SERVICE',
        serviceStatus: 'COMPLETED',
        serviceStickerSerial: stickerSerial || (existingPmIndex >= 0 ? pmTable[existingPmIndex].serviceStickerSerial : 'STK-PENDING'),
        servicedBy: servicedBy,
        servicedByCardNumber: '',
        servicedByDesignation: 'Maintenance Mechanic',
        servicedByDepartment: 'Mechanical Maintenance',
        assignedManpower: servicedBy,
        frequencyDays: item.frequencyDays || 91,
        lastServiceDate: serviceDate,
        nextServiceDate: nextDate,
        serviceChecklist: [],
        serviceRemarks: item.serviceRemarks || 'Bulk Excel Servicing Import',
        createdAt: existingPmIndex >= 0 ? pmTable[existingPmIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        loggedBy: user.username || user.fullName || 'admin'
      };

      if (existingPmIndex >= 0) {
        pmTable[existingPmIndex] = pmRecord;
      } else {
        pmTable.push(pmRecord);
      }

      // 3. Record in machine passport history
      try {
        if (typeof historyService !== 'undefined' && historyService.recordActivity) {
          historyService.recordActivity({
            machineId: machine.id,
            serialNumber: machine.serialNumber,
            actionType: 'MAINTENANCE_SERVICE',
            title: `Preventive Maintenance Serviced [Sticker: ${stickerSerial || 'N/A'}]`,
            details: `Bulk servicing imported on ${serviceDate} by ${servicedBy}. Next scheduled service: ${nextDate}.`,
            performedBy: user.id,
            performedByName: servicedBy,
            remarks: item.serviceRemarks
          });
        }
      } catch (e) {
        console.warn('History activity log failed:', e);
      }

      updatedCount++;
    });

    storage.setTable(TABLE_NAMES.MACHINES, allMachines);
    storage.saveTable(TABLE_NAMES.MACHINES);

    storage.setTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE, pmTable);
    storage.saveTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE);

    auditService.log(
      'UPDATE',
      'PREVENTIVE_MAINTENANCE',
      'BULK_SERVICING_IMPORT',
      `Bulk imported servicing dates for ${updatedCount} machines via Excel.`
    );

    window.dispatchEvent(new CustomEvent('erp:machine-updated'));
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));

    return {
      totalImported: updatedCount,
      affectedMachinesCount: updatedCount
    };
  }

  // =========================================================================
  // 2. DYNAMIC DATE CALCULATION & URGENCY ENGINE
  // =========================================================================

  parseDateParts(rawDate) {
    if (rawDate === undefined || rawDate === null || rawDate === '') return null;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return {
        year: rawDate.getFullYear(),
        month: rawDate.getMonth() + 1,
        day: rawDate.getDate()
      };
    }

    // Excel numeric serial (1900 date system)
    if (typeof rawDate === 'number' || (!isNaN(rawDate) && !isNaN(parseFloat(rawDate)) && isFinite(rawDate) && !String(rawDate).includes('-') && !String(rawDate).includes('/'))) {
      const serial = parseFloat(rawDate);
      if (serial > 1000 && serial < 100000) {
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        return {
          year: dateInfo.getUTCFullYear(),
          month: dateInfo.getUTCMonth() + 1,
          day: dateInfo.getUTCDate()
        };
      }
    }

    const s = String(rawDate).trim();
    if (!s || s === '—' || s === 'N/A' || s === 'None' || s === 'Never' || s === '-') return null;

    // 1. Matches YYYY-MM-DD or YYYY/MM/DD
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
    if (m) {
      return {
        year: parseInt(m[1], 10),
        month: parseInt(m[2], 10),
        day: parseInt(m[3], 10)
      };
    }

    // 2. Matches DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      const part1 = parseInt(m[1], 10);
      const part2 = parseInt(m[2], 10);
      const yr = parseInt(m[3], 10);
      if (part2 > 12 && part1 <= 12) {
        return {
          year: yr,
          month: part1,
          day: part2
        };
      }
      return {
        year: yr,
        month: part2,
        day: part1
      };
    }

    // 3. Matches DD-MM-YY or DD/MM/YY (2-digit year)
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
    if (m) {
      let yr = parseInt(m[3], 10);
      yr = yr < 50 ? 2000 + yr : 1900 + yr;
      const part1 = parseInt(m[1], 10);
      const part2 = parseInt(m[2], 10);
      if (part2 > 12 && part1 <= 12) {
        return {
          year: yr,
          month: part1,
          day: part2
        };
      }
      return {
        year: yr,
        month: part2,
        day: part1
      };
    }

    // Fallback: Date object
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return {
        year: dt.getFullYear(),
        month: dt.getMonth() + 1,
        day: dt.getDate()
      };
    }

    return null;
  }

  formatDateDMY(d, separator = '-') {
    if (!d || d === 'N/A' || d === 'None' || d === 'Never' || d === '—') return d;
    const p = this.parseDateParts(d);
    if (p) {
      const dd = String(p.day).padStart(2, '0');
      const mm = String(p.month).padStart(2, '0');
      return `${dd}${separator}${mm}${separator}${p.year}`;
    }
    return String(d || '');
  }

  calculateNextServiceDate(serviceDateStr, frequencyDays = 91) {
    if (!serviceDateStr) return '';
    try {
      let days = parseInt(frequencyDays, 10);
      if (isNaN(days) || days <= 0 || days === 90) {
        days = 91;
      }
      const p = this.parseDateParts(serviceDateStr);
      if (!p) return '';
      const d = new Date(p.year, p.month - 1, p.day);
      d.setDate(d.getDate() + days);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      console.warn('Date calculation error:', e);
    }
    return '';
  }

  computeUrgencyStatus(nextServiceDateStr, lastServiceRecord = null) {
    if (!nextServiceDateStr) {
      return {
        status: 'SCHEDULED',
        label: 'Scheduled',
        badgeClass: 'badge-info',
        urgencyOrder: 5,
        daysDiff: 999,
        displayBadge: '<span class="pm-badge pm-badge-info">📅 Scheduled</span>'
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDate = null;
    const p = this.parseDateParts(nextServiceDateStr);
    if (p) {
      nextDate = new Date(p.year, p.month - 1, p.day);
    } else {
      nextDate = new Date(nextServiceDateStr);
    }
    nextDate.setHours(0, 0, 0, 0);

    const diffTime = nextDate.getTime() - today.getTime();
    const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      const overDays = Math.abs(daysDiff);
      return {
        status: 'OVERDUE',
        label: `Overdue – ${overDays} Day${overDays > 1 ? 's' : ''}`,
        badgeClass: 'badge-danger',
        urgencyOrder: 1,
        daysDiff,
        displayBadge: `<span class="pm-badge pm-badge-danger pm-pulse">🔴 Overdue – ${overDays} Day${overDays > 1 ? 's' : ''}</span>`
      };
    }

    if (daysDiff === 0) {
      return {
        status: 'DUE_TODAY',
        label: 'Due Today',
        badgeClass: 'badge-danger',
        urgencyOrder: 2,
        daysDiff: 0,
        displayBadge: '<span class="pm-badge pm-badge-danger pm-pulse">🔴 Due Today</span>'
      };
    }

    if (daysDiff === 1) {
      return {
        status: 'DUE_TOMORROW',
        label: 'Due Tomorrow',
        badgeClass: 'badge-warning',
        urgencyOrder: 3,
        daysDiff: 1,
        displayBadge: '<span class="pm-badge pm-badge-warning">🟠 Due in 1 Day</span>'
      };
    }

    if (daysDiff <= 7) {
      return {
        status: 'DUE_SOON',
        label: `Due in ${daysDiff} Days`,
        badgeClass: 'badge-warning',
        urgencyOrder: 4,
        daysDiff,
        displayBadge: `<span class="pm-badge pm-badge-warning">🟡 Due in ${daysDiff} Days</span>`
      };
    }

    return {
      status: 'SCHEDULED',
      label: `Due in ${daysDiff} Days`,
      badgeClass: 'badge-active',
      urgencyOrder: 5,
      daysDiff,
      displayBadge: `<span class="pm-badge pm-badge-success">🟢 Due in ${daysDiff} Days</span>`
    };
  }

  // =========================================================================
  // 3. MACHINE DATA AUTO-SYNC & PROFILE RESOLVER (ZERO DUPLICATION)
  // =========================================================================

  /**
   * Enriches a machine with live inventory data, maintenance profile, service sticker & history
   */
  getMachinePreventiveProfile(machineIdOrSerial) {
    if (!machineIdOrSerial) return null;

    // Resolve machine live from inventory
    let rawMachine = storage.getItem(TABLE_NAMES.MACHINES, machineIdOrSerial);
    if (!rawMachine) {
      rawMachine = historyService.findMachineBySerialOnly(machineIdOrSerial);
    }
    if (!rawMachine) {
      const allM = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const clean = String(machineIdOrSerial).trim().toUpperCase();
      rawMachine = allM.find(m => m.serialNumber && m.serialNumber.trim().toUpperCase() === clean);
    }
    if (!rawMachine) return null;

    // Enriched live details (machineName, brand, model, unit, floor, line)
    const enriched = machineService.getEnrichedMachine(rawMachine.id) || rawMachine;
    const machineTypeName = enriched.machineName?.name || rawMachine.machineName || 'Sewing Machine';
    const config = this.getConfigByMachineType(machineTypeName);

    // Fetch all maintenance records for this machine
    const allRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const machineRecords = allRecords
      .filter(r => (r.machineId === rawMachine.id) || (r.serialNumber && r.serialNumber.trim().toUpperCase() === rawMachine.serialNumber.trim().toUpperCase()))
      .sort((a, b) => new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt));

    const latestRecord = machineRecords[0] || null;

    let frequencyDays = config?.frequencyDays || 91;
    let lastServiceDate = latestRecord?.serviceDate || rawMachine.lastServiceDate || null;
    let nextServiceDate = latestRecord?.nextServiceDate || rawMachine.nextServiceDate || null;
    let serviceStickerSerial = latestRecord?.serviceStickerSerial || rawMachine.serviceStickerSerial || 'STK-PENDING';
    let lastServicedBy = latestRecord?.servicedBy || rawMachine.lastServicedBy || 'Not Yet Serviced';
    let lastServicedByCardNumber = latestRecord?.servicedByCardNumber || '';
    let lastServicedByDesignation = latestRecord?.servicedByDesignation || '';
    let assignedManpower = latestRecord?.assignedManpower || rawMachine.assignedManpower || latestRecord?.servicedBy || null;
    let serviceRemarks = latestRecord?.serviceRemarks || '';

    // If a service date exists, ensure nextServiceDate is calculated as serviceDate + 91 days
    if (lastServiceDate && (!nextServiceDate || latestRecord?.frequencyDays === 90 || config?.frequencyDays === 90)) {
      nextServiceDate = this.calculateNextServiceDate(lastServiceDate, frequencyDays);
    }

    // If no past service record exists, auto-calculate target from machine join/creation
    if (!nextServiceDate) {
      const baseDate = rawMachine.createdAt ? rawMachine.createdAt.split('T')[0] : '2026-06-01';
      nextServiceDate = this.calculateNextServiceDate(baseDate, frequencyDays);
    }

    const urgency = this.computeUrgencyStatus(nextServiceDate, latestRecord);

    return {
      machineId: rawMachine.id,
      serialNumber: rawMachine.serialNumber,
      machineNameId: rawMachine.machineNameId || null,
      machineName: machineTypeName,
      machineType: config?.machineType || this.getCanonicalMachineType(machineTypeName),
      model: enriched.model?.name || rawMachine.model || 'N/A',
      brand: enriched.brand?.name || rawMachine.brand || 'N/A',
      unit: enriched.unit?.name || rawMachine.unit || 'Al-Muslim Group Plant',
      unitId: rawMachine.unitId || null,
      floor: enriched.floor?.name || rawMachine.floor || 'N/A',
      floorId: rawMachine.floorId || null,
      floorCode: enriched.floor?.code || '',
      line: enriched.line?.name || rawMachine.line || 'N/A',
      lineId: rawMachine.lineId || null,
      workingArea: rawMachine.workingArea || `${enriched.floor?.name || ''} - ${enriched.line?.name || ''}`,
      machineStatus: rawMachine.status || 'ACTIVE',
      lastServiceDate,
      nextServiceDate,
      frequencyDays,
      frequencyLabel: config?.frequencyLabel || `Every ${frequencyDays} Days`,
      serviceStickerSerial,
      lastServicedBy,
      lastServicedByCardNumber,
      lastServicedByDesignation,
      assignedManpower,
      serviceRemarks,
      urgency,
      historyCount: machineRecords.length,
      history: machineRecords,
      configChecklist: config?.checklist || []
    };
  }

  /**
   * Returns all active factory machines enriched with live preventive maintenance status
   */
  getAllMachinesWithMaintenance(filters = {}) {
    let allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    // Filter location scoping if applicable
    const scoped = authService.getScopedFilter();
    if (scoped) {
      allMachines = allMachines.filter(m => {
        if (scoped.unitIds?.length > 0 && !scoped.unitIds.includes(m.unitId)) return false;
        if (scoped.floorIds?.length > 0 && !scoped.floorIds.includes(m.floorId)) return false;
        if (scoped.lineIds?.length > 0 && !scoped.lineIds.includes(m.lineId)) return false;
        return true;
      });
    }

    // Map all machines to full preventive profile
    const enrichedList = allMachines.map(m => this.getMachinePreventiveProfile(m.id)).filter(Boolean);

    // Filter by Search text (serial, name, model, brand, floor, line, sticker, mechanic)
    let filtered = enrichedList;
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.serialNumber?.toLowerCase().includes(q) ||
        p.machineName?.toLowerCase().includes(q) ||
        p.machineType?.toLowerCase().includes(q) ||
        p.model?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.floor?.toLowerCase().includes(q) ||
        p.line?.toLowerCase().includes(q) ||
        p.workingArea?.toLowerCase().includes(q) ||
        p.serviceStickerSerial?.toLowerCase().includes(q) ||
        p.lastServicedBy?.toLowerCase().includes(q) ||
        p.assignedManpower?.toLowerCase().includes(q)
      );
    }

    if (filters.floorId && filters.floorId !== 'ALL') {
      const flrObj = storage.getItem(TABLE_NAMES.FLOORS, filters.floorId);
      const flrName = (flrObj?.name || '').toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.floorId === filters.floorId || 
        (flrName && (p.floor || '').toLowerCase().trim() === flrName)
      );
    }

    if (filters.lineId && filters.lineId !== 'ALL') {
      const linObj = storage.getItem(TABLE_NAMES.LINES, filters.lineId);
      const linName = (linObj?.name || '').toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.lineId === filters.lineId || 
        (linName && (p.line || '').toLowerCase().trim() === linName)
      );
    }

    if (filters.machineType && filters.machineType !== 'ALL') {
      const target = filters.machineType.toLowerCase().trim();
      const targetNorm = target.replace(/[\s\-_/]+/g, '');
      filtered = filtered.filter(p => {
        const pType = (p.machineType || '').toLowerCase();
        const pName = (p.machineName || '').toLowerCase();
        const pTypeNorm = pType.replace(/[\s\-_/]+/g, '');
        const pNameNorm = pName.replace(/[\s\-_/]+/g, '');
        return pType === target || pName === target ||
               pTypeNorm.includes(targetNorm) || targetNorm.includes(pTypeNorm) ||
               pNameNorm.includes(targetNorm) || targetNorm.includes(pNameNorm);
      });
    }

    if (filters.urgencyStatus && filters.urgencyStatus !== 'ALL') {
      filtered = filtered.filter(p => p.urgency.status === filters.urgencyStatus);
    }

    return filtered;
  }

  // =========================================================================
  // 4. RECENTLY SERVICED & UPCOMING REMINDERS
  // =========================================================================

  getRecentlyServiced(filters = {}, limit = 50) {
    const allRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    
    // Enrich records with latest live machine info (preventing stale names/floors)
    let enrichedRecords = allRecords.map(rec => {
      const mProfile = this.getMachinePreventiveProfile(rec.machineId || rec.serialNumber);
      return {
        ...rec,
        floorId: mProfile?.floorId || rec.floorId || null,
        lineId: mProfile?.lineId || rec.lineId || null,
        machineName: mProfile?.machineName || rec.machineName || 'Machine',
        machineType: mProfile?.machineType || rec.machineType || '',
        model: mProfile?.model || rec.model || '',
        brand: mProfile?.brand || rec.brand || '',
        floor: mProfile?.floor || rec.floor || '',
        line: mProfile?.line || rec.line || '',
        workingArea: mProfile?.workingArea || rec.workingArea || '',
        currentMachineStatus: mProfile?.machineStatus || 'ACTIVE'
      };
    });

    // Sort Latest Service Date -> First
    enrichedRecords.sort((a, b) => new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt));

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      enrichedRecords = enrichedRecords.filter(r => 
        r.serialNumber?.toLowerCase().includes(q) ||
        r.machineName?.toLowerCase().includes(q) ||
        r.model?.toLowerCase().includes(q) ||
        r.floor?.toLowerCase().includes(q) ||
        r.line?.toLowerCase().includes(q) ||
        r.servicedBy?.toLowerCase().includes(q) ||
        r.serviceStickerSerial?.toLowerCase().includes(q) ||
        r.serviceRemarks?.toLowerCase().includes(q)
      );
    }

    if (filters.floorId && filters.floorId !== 'ALL') {
      const flrObj = storage.getItem(TABLE_NAMES.FLOORS, filters.floorId);
      const flrName = (flrObj?.name || '').toLowerCase().trim();
      enrichedRecords = enrichedRecords.filter(r => 
        r.floorId === filters.floorId || 
        (flrName && (r.floor || '').toLowerCase().trim() === flrName)
      );
    }

    if (filters.lineId && filters.lineId !== 'ALL') {
      const linObj = storage.getItem(TABLE_NAMES.LINES, filters.lineId);
      const linName = (linObj?.name || '').toLowerCase().trim();
      enrichedRecords = enrichedRecords.filter(r => 
        r.lineId === filters.lineId || 
        (linName && (r.line || '').toLowerCase().trim() === linName)
      );
    }

    if (filters.machineType && filters.machineType !== 'ALL') {
      const target = filters.machineType.toLowerCase().trim();
      const targetNorm = target.replace(/[\s\-_/]+/g, '');
      enrichedRecords = enrichedRecords.filter(r => {
        const rType = (r.machineType || '').toLowerCase();
        const rName = (r.machineName || '').toLowerCase();
        const rTypeNorm = rType.replace(/[\s\-_/]+/g, '');
        const rNameNorm = rName.replace(/[\s\-_/]+/g, '');
        return rType === target || rName === target ||
               rTypeNorm.includes(targetNorm) || targetNorm.includes(rTypeNorm) ||
               rNameNorm.includes(targetNorm) || targetNorm.includes(rNameNorm);
      });
    }

    if (filters.startDate) {
      enrichedRecords = enrichedRecords.filter(r => r.serviceDate >= filters.startDate);
    }
    if (filters.endDate) {
      enrichedRecords = enrichedRecords.filter(r => r.serviceDate <= filters.endDate);
    }
    if (filters.servicedBy && filters.servicedBy !== 'ALL') {
      enrichedRecords = enrichedRecords.filter(r => r.servicedBy === filters.servicedBy);
    }

    return enrichedRecords.slice(0, limit);
  }

  getUpcomingMaintenance(filters = {}) {
    const all = this.getAllMachinesWithMaintenance(filters);

    // Sort strictly by urgency priority:
    // 1. Overdue -> 2. Due Today -> 3. Due Tomorrow -> 4. Due in 7 Days -> 5. Upcoming
    return all.sort((a, b) => {
      if (a.urgency.urgencyOrder !== b.urgency.urgencyOrder) {
        return a.urgency.urgencyOrder - b.urgency.urgencyOrder;
      }
      return a.urgency.daysDiff - b.urgency.daysDiff;
    });
  }

  // =========================================================================
  // 5. SERVICE ENTRY SUBMISSION & LIFETIME PASSPORT SYNC
  // =========================================================================

  /**
   * Generates next sequential 6-digit physical sticker serial number based on factory registry
   * (e.g. 238168, 245231 -> 245232)
   */
  getNextStickerSlNo() {
    const allRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    let maxSl = 0;
    allRecords.forEach(r => {
      const serial = String(r.serviceStickerSerial || '').trim();
      const numMatch = serial.match(/\b(\d{5,7})\b/);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (val > maxSl) maxSl = val;
      }
    });

    if (maxSl > 0) {
      return String(maxSl + 1);
    }
    return '245232';
  }

  async createServiceEntry(payload) {
    const user = authService.getCurrentUser();
    if (!payload.machineId && !payload.serialNumber) {
      throw new Error('Machine selection is required for preventive service entry.');
    }

    const machineProfile = this.getMachinePreventiveProfile(payload.machineId || payload.serialNumber);
    if (!machineProfile) {
      throw new Error('Selected machine record not found in system.');
    }

    const serviceDate = payload.serviceDate || new Date().toISOString().split('T')[0];
    const frequencyDays = parseInt(payload.frequencyDays, 10) || machineProfile.frequencyDays || 91;

    // Strict system auto-generation: Next service date is strictly calculated from Service Date + Admin configured frequencyDays
    const nextServiceDate = this.calculateNextServiceDate(serviceDate, frequencyDays);

    // Company Physical Sticker Sl No. (e.g. 238168, 245231) - Manual entry from physical sticker pad
    let stickerSerial = payload.serviceStickerSerial?.trim();
    if (!stickerSerial) {
      throw new Error('Physical Service Sticker Sl No. is required. Please enter the number manually.');
    }

    const oldStickerSerial = machineProfile.serviceStickerSerial !== 'STK-PENDING' ? machineProfile.serviceStickerSerial : null;

    const recordId = `pm-rec-${Date.now()}`;
    const newRecord = {
      id: recordId,
      machineId: machineProfile.machineId,
      serialNumber: machineProfile.serialNumber,
      machineName: machineProfile.machineName,
      machineType: machineProfile.machineType,
      model: machineProfile.model,
      brand: machineProfile.brand,
      unit: machineProfile.unit,
      unitId: machineProfile.unitId,
      floor: machineProfile.floor,
      floorId: machineProfile.floorId,
      line: machineProfile.line,
      lineId: machineProfile.lineId,
      workingArea: machineProfile.workingArea,
      serviceDate,
      serviceType: payload.serviceType || 'PREVENTIVE_SERVICE',
      serviceStatus: 'COMPLETED',
      serviceStickerSerial: stickerSerial,
      previousStickerSerial: oldStickerSerial,
      servicedBy: payload.servicedBy || user?.name || 'Authorized Mechanic',
      servicedByCardNumber: payload.servicedByCardNumber || '',
      servicedByDesignation: payload.servicedByDesignation || 'Maintenance Mechanic',
      servicedByDepartment: payload.servicedByDepartment || 'Mechanical Maintenance',
      servicedById: payload.servicedById || null,
      assignedManpower: payload.assignedManpower || payload.servicedBy || 'Assigned Mechanic',
      frequencyDays,
      lastServiceDate: serviceDate,
      nextServiceDate,
      isNextDateOverridden: false,
      serviceChecklist: Array.isArray(payload.serviceChecklist) ? payload.serviceChecklist : [],
      serviceRemarks: payload.serviceRemarks || '',
      partsReplaced: payload.partsReplaced || '',
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loggedBy: user?.username || 'admin'
    };

    // 1. Save in PREVENTIVE_MAINTENANCE table — CONFIRMED WRITE
    const ok = await storage.saveTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE,
      [...(storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || []), newRecord]
    );
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: PM service entry was not confirmed by the cloud.');
    // Also update in-memory so getTable is consistent
    if (!storage.data[TABLE_NAMES.PREVENTIVE_MAINTENANCE]) storage.data[TABLE_NAMES.PREVENTIVE_MAINTENANCE] = [];
    // The saveTable call above already set the data

    // 2. Synchronize seamlessly into Machine Lifetime History (MACHINE_HISTORY)
    try {
      const stickerChangeNote = oldStickerSerial && oldStickerSerial !== stickerSerial 
        ? ` (Replaced old physical sticker Sl No: ${oldStickerSerial})` 
        : '';

      historyService.recordActivity({
        machineId: machineProfile.machineId,
        serialNumber: machineProfile.serialNumber,
        actionType: 'MAINTENANCE_SERVICE',
        title: `Preventive Maintenance Completed [Sticker Sl No: ${stickerSerial}]`,
        details: `Routine servicing performed by ${newRecord.servicedBy} (Card: ${newRecord.servicedByCardNumber || 'N/A'}). Next scheduled service: ${nextServiceDate}.${stickerChangeNote}`,
        performedBy: user?.id,
        performedByName: newRecord.servicedBy,
        remarks: newRecord.serviceRemarks,
        serviceRecord: {
          serviceType: 'PREVENTIVE_MAINTENANCE',
          stickerSerial,
          previousStickerSerial: oldStickerSerial,
          technician: newRecord.servicedBy,
          workPerformed: `Preventive inspection (${(newRecord.serviceChecklist || []).filter(c => c.checked).length} items verified). ${newRecord.serviceRemarks}`,
          sparePartsUsed: newRecord.partsReplaced,
          nextServiceDate
        }
      });
    } catch (histErr) {
      console.warn('Error syncing with machine history passport:', histErr);
    }

    // 3. Log Audit
    auditService.log('ADD', 'PREVENTIVE_MAINTENANCE', recordId, `Recorded Preventive Service for Machine ${machineProfile.serialNumber} [Physical Sticker Sl No: ${stickerSerial}]`);

    // 4. Dispatch in-app notification & toast
    notificationService.notify({
      title: '🔧 Preventive Maintenance Logged',
      message: `Machine ${machineProfile.serialNumber} serviced by ${newRecord.servicedBy}. Physical Sticker: ${stickerSerial}. Next due: ${nextServiceDate}.`,
      type: 'SUCCESS',
      module: 'preventive_maintenance',
      action: 'VIEW',
      entityType: 'MACHINE',
      entityId: machineProfile.serialNumber,
      locationScope: {
        unitId: machineProfile.unitId || null,
        floorId: machineProfile.floorId || null,
        lineId: machineProfile.lineId || null
      },
      targetUrl: '#preventive-maintenance'
    });

    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated', { detail: newRecord }));
    return newRecord;
  }

  async updateServiceEntry(recordId, updateData) {
    const existing = storage.getItem(TABLE_NAMES.PREVENTIVE_MAINTENANCE, recordId);
    if (!existing) throw new Error('Service record not found.');

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.PREVENTIVE_MAINTENANCE, (tbl) => {
      const idx = tbl.findIndex(r => r.id === recordId);
      if (idx !== -1) tbl[idx] = updated;
    });
    auditService.log('EDIT', 'PREVENTIVE_MAINTENANCE', recordId, `Updated Preventive Service Record for ${updated.serialNumber}`);
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated', { detail: updated }));
    return updated;
  }

  async deleteServiceEntry(recordId) {
    const existing = storage.getItem(TABLE_NAMES.PREVENTIVE_MAINTENANCE, recordId);
    if (!existing) return false;

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.PREVENTIVE_MAINTENANCE, (tbl) => {
      const idx = tbl.findIndex(r => r.id === recordId);
      if (idx !== -1) tbl.splice(idx, 1);
    });
    auditService.log('DELETE', 'PREVENTIVE_MAINTENANCE', recordId, `Deleted Service Record for ${existing.serialNumber}`);
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
    return true;
  }

  // =========================================================================
  // 6. SERVICE STICKER SERIAL MANAGEMENT (EDIT / REPLACE / DELETE)
  // =========================================================================

  async updateStickerSerial(recordId, newStickerSerial) {
    const cleanSerial = (newStickerSerial || '').trim().toUpperCase();
    if (!cleanSerial) throw new Error('Sticker serial number cannot be blank.');

    const record = storage.getItem(TABLE_NAMES.PREVENTIVE_MAINTENANCE, recordId);
    if (!record) throw new Error('Maintenance record not found.');

    const oldSerial = record.serviceStickerSerial;
    const updatedRecord = { ...record, serviceStickerSerial: cleanSerial, updatedAt: new Date().toISOString() };

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.PREVENTIVE_MAINTENANCE, (tbl) => {
      const idx = tbl.findIndex(r => r.id === recordId);
      if (idx !== -1) tbl[idx] = updatedRecord;
    });

    auditService.log('EDIT', 'PREVENTIVE_MAINTENANCE', recordId, `Updated Sticker Serial from [${oldSerial}] to [${cleanSerial}] for ${record.serialNumber}`);
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
    return updatedRecord;
  }

  /**
   * Directly replace a machine's physical sticker (e.g. if damaged or re-tagged)
   * Updates current service records and adds an audit trail in Machine Lifetime History.
   */
  replaceMachineSticker(machineIdOrSerial, newStickerSerial, reason = '') {
    const cleanSerial = (newStickerSerial || '').trim();
    if (!cleanSerial) throw new Error('New physical sticker Sl No. is required.');

    const profile = this.getMachinePreventiveProfile(machineIdOrSerial);
    if (!profile) throw new Error('Machine not found.');

    const oldSerial = profile.serviceStickerSerial;
    const user = authService.getCurrentUser();

    // Check if there is an existing record
    const allRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const latestRec = allRecords
      .filter(r => (r.machineId === profile.machineId) || (r.serialNumber === profile.serialNumber))
      .sort((a, b) => new Date(b.serviceDate || b.createdAt) - new Date(a.serviceDate || a.createdAt))[0];

    if (latestRec) {
      latestRec.serviceStickerSerial = cleanSerial;
      latestRec.previousStickerSerial = oldSerial;
      latestRec.updatedAt = new Date().toISOString();
      storage.update(TABLE_NAMES.PREVENTIVE_MAINTENANCE, latestRec.id, latestRec);
      storage.saveTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE);
    } else {
      const today = new Date().toISOString().split('T')[0];
      this.createServiceEntry({
        machineId: profile.machineId,
        serialNumber: profile.serialNumber,
        serviceDate: today,
        serviceType: 'STICKER_TAGGING',
        serviceStickerSerial: cleanSerial,
        serviceRemarks: `Initial physical sticker tagged. ${reason ? 'Reason: ' + reason : ''}`,
        servicedBy: user?.name || 'Maintenance In-Charge'
      });
    }

    // Record in Lifetime History
    try {
      historyService.recordActivity({
        machineId: profile.machineId,
        serialNumber: profile.serialNumber,
        actionType: 'STICKER_REPLACED',
        title: `Physical Sticker Replaced [Sl No: ${cleanSerial}]`,
        details: `Previous Sticker: ${oldSerial || 'None'}. New Sticker Sl No: ${cleanSerial}. ${reason ? 'Reason: ' + reason : ''}`,
        previousValue: oldSerial,
        newValue: cleanSerial,
        performedBy: user?.id,
        performedByName: user?.name || 'Maintenance In-Charge'
      });
    } catch (e) {
      console.warn('History sync error on sticker replacement:', e);
    }

    auditService.log('EDIT', 'PREVENTIVE_MAINTENANCE', profile.machineId, `Replaced physical sticker for machine ${profile.serialNumber} with Sl No: ${cleanSerial}`);
    notificationService.success(`Machine ${profile.serialNumber} physical sticker updated to Sl No: ${cleanSerial}`);
    window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
    return { 
      oldSerial, 
      newSerial: cleanSerial, 
      oldStickerSerial: oldSerial, 
      newStickerSerial: cleanSerial 
    };
  }

  findMachineByStickerSerial(stickerSerial) {
    if (!stickerSerial) return null;
    const clean = stickerSerial.trim().toUpperCase();
    const records = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const match = records.find(r => r.serviceStickerSerial && r.serviceStickerSerial.trim().toUpperCase() === clean);
    if (match) {
      return this.getMachinePreventiveProfile(match.machineId || match.serialNumber);
    }
    return null;
  }

  // =========================================================================
  // 7. SMART MANPOWER & MACHINE SUGGESTION ENGINE
  // =========================================================================

  /**
   * Search machines across inventory by serial, model, brand, machine type, floor, line
   */
  searchMachines(query = '', limit = 15) {
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const q = (query || '').toLowerCase().trim();

    let list = allMachines;
    if (q) {
      list = allMachines.filter(m => {
        const serial = (m.serialNumber || '').toLowerCase();
        const name = (m.machineName || '').toLowerCase();
        const model = (m.model || '').toLowerCase();
        const brand = (m.brand || '').toLowerCase();
        const floor = (m.floor || '').toLowerCase();
        const line = (m.line || '').toLowerCase();
        const id = (m.id || '').toLowerCase();
        return serial.includes(q) || name.includes(q) || model.includes(q) || brand.includes(q) || floor.includes(q) || line.includes(q) || id.includes(q);
      });
    }

    return list.slice(0, limit).map(m => this.getMachinePreventiveProfile(m.id)).filter(Boolean);
  }

  /**
   * Search manpower across active staff by ANY attribute:
   * Name, Card Number, ID, Designation, Department, Working Area, Floor, Unit, Phone, or Custom Fields.
   * Multi-token matching with intelligent scoring and mechanical/maintenance staff prioritization.
   */
  searchManpowerSuggestions(query = '', floorFilter = '') {
    const allEmployees = employeeService.getAllEmployees() || storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const activeStaff = allEmployees.filter(e => e.status !== 'INACTIVE' && e.status !== 'TERMINATED');
    const q = (query || '').toLowerCase().trim();

    if (!q) {
      // Return active maintenance personnel and mechanics first
      const defaultList = [...activeStaff];
      defaultList.sort((a, b) => {
        const aInfo = `${a.department || ''} ${a.designation || ''}`.toLowerCase();
        const bInfo = `${b.department || ''} ${b.designation || ''}`.toLowerCase();
        const aIsMaint = aInfo.includes('maint') || aInfo.includes('mechanic') || aInfo.includes('technician') || aInfo.includes('engineer');
        const bIsMaint = bInfo.includes('maint') || bInfo.includes('mechanic') || bInfo.includes('technician') || bInfo.includes('engineer');
        if (aIsMaint && !bIsMaint) return -1;
        if (!aIsMaint && bIsMaint) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      return defaultList.slice(0, 15);
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = [];

    activeStaff.forEach(emp => {
      const name = (emp.name || '').toLowerCase();
      const card = String(emp.cardNumber || '').toLowerCase().trim();
      const cardClean = card.replace(/[^a-z0-9]/g, '');
      const cardDigits = card.replace(/\D/g, '');
      const empId = String(emp.id || '').toLowerCase();
      const desig = (emp.designation || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const area = (emp.workingArea || '').toLowerCase();
      const floor = (emp.floorName || emp.floor || '').toLowerCase();
      const unit = (emp.unitName || emp.unit || '').toLowerCase();
      const line = (emp.lineName || emp.line || '').toLowerCase();
      const phone = (emp.phone || emp.mobile || '').toLowerCase();
      const phoneDigits = phone.replace(/\D/g, '');
      const phoneLocal = phoneDigits.startsWith('880') ? '0' + phoneDigits.slice(3) : (phoneDigits.startsWith('0') ? phoneDigits : '0' + phoneDigits);
      const customs = Object.values(emp.customFields || {}).map(v => String(v).toLowerCase()).join(' ');

      const fullSearchable = `${name} ${card} ${cardClean} ${cardDigits} ${empId} ${desig} ${dept} ${area} ${floor} ${unit} ${line} ${phone} ${phoneDigits} ${phoneLocal} ${customs}`;

      // Every token must match at least one attribute
      const isMatch = tokens.every(tok => {
        const tokClean = tok.replace(/[^a-z0-9]/g, '');
        return fullSearchable.includes(tok) || (tokClean && fullSearchable.includes(tokClean));
      });

      if (!isMatch) return;

      // Calculate relevance score
      let score = 0;

      // Card Number matching (Highest Priority)
      if (card === q || cardClean === q) score += 600;
      else if (card.startsWith(q) || cardClean.startsWith(q)) score += 400;
      else if (card.includes(q) || (cardDigits && cardDigits.includes(q.replace(/\D/g, '')))) score += 250;

      // Name matching
      if (name === q) score += 500;
      else if (name.startsWith(q)) score += 350;
      else if (name.split(/[\s-]+/).some(w => w.startsWith(q))) score += 250;
      else if (name.includes(q)) score += 150;

      // Designation & Department matching
      if (desig.includes(q)) score += 120;
      if (dept.includes(q)) score += 100;

      // Location matching (Area / Floor / Unit / Line)
      if (area.includes(q) || floor.includes(q) || line.includes(q) || unit.includes(q)) score += 80;

      // Phone matching
      const qDigits = q.replace(/\D/g, '');
      if (phone.includes(q) || (qDigits && (phoneDigits.includes(qDigits) || phoneLocal.includes(qDigits)))) score += 150;

      // Maintenance / Mechanic role bonus boost
      const info = `${dept} ${desig}`;
      if (info.includes('maint') || info.includes('mechanic') || info.includes('technician') || info.includes('engineer')) {
        score += 60;
      }

      // Bonus for matching tokens individually
      tokens.forEach(tok => {
        if (card.includes(tok) || name.includes(tok)) score += 50;
      });

      matches.push({ emp, score });
    });

    matches.sort((a, b) => b.score - a.score || (a.emp.name || '').localeCompare(b.emp.name || ''));
    return matches.slice(0, 15).map(m => m.emp);
  }

  // =========================================================================
  // 8. SUMMARY DASHBOARD METRICS (8 KPI CARDS - DYNAMIC FILTER REACTIVE)
  // =========================================================================

  getDashboardMetrics(filters = {}) {
    const allGlobalMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const filteredMachines = this.getAllMachinesWithMaintenance(filters);
    const records = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const todayStr = new Date().toISOString().split('T')[0];

    const globalTotalMachines = allGlobalMachines.length;
    const totalMachines = filteredMachines.length;
    const filteredMachineIds = new Set(filteredMachines.map(m => m.machineId));
    const filteredSerials = new Set(filteredMachines.map(m => m.serialNumber));

    const relevantRecords = records.filter(r => 
      filteredMachineIds.has(r.machineId) || filteredSerials.has(r.serialNumber)
    );

    const servicedToday = relevantRecords.filter(r => r.serviceDate === todayStr).length;
    const completedCount = relevantRecords.length;

    // Recently Serviced (within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split('T')[0];
    const recentlyServiced = relevantRecords.filter(r => r.serviceDate >= thirtyDaysStr).length;

    let dueToday = 0;
    let dueWithin7Days = 0;
    let overdue = 0;
    let upcoming = 0;

    filteredMachines.forEach(m => {
      const u = m.urgency;
      if (u.status === 'OVERDUE') overdue++;
      else if (u.status === 'DUE_TODAY') dueToday++;
      else if (u.status === 'DUE_TOMORROW' || u.status === 'DUE_SOON') dueWithin7Days++;
      else if (u.status === 'SCHEDULED') upcoming++;
    });

    const isFiltered = Boolean(
      (filters.floorId && filters.floorId !== 'ALL') ||
      (filters.lineId && filters.lineId !== 'ALL') ||
      (filters.machineType && filters.machineType !== 'ALL') ||
      (filters.urgencyStatus && filters.urgencyStatus !== 'ALL') ||
      filters.search
    );

    return {
      totalMachines,
      globalTotalMachines,
      isFiltered,
      servicedToday,
      recentlyServiced,
      dueToday,
      dueWithin7Days,
      overdue,
      upcoming,
      completedCount
    };
  }

  // =========================================================================
  // 9. AUTOMATIC NOTIFICATION CHECKER
  // =========================================================================

  checkAndSendReminders() {
    const machines = this.getAllMachinesWithMaintenance();
    const overdueList = machines.filter(m => m.urgency.status === 'OVERDUE');
    const dueTodayList = machines.filter(m => m.urgency.status === 'DUE_TODAY');

    if (overdueList.length > 0) {
      const sample = overdueList.slice(0, 2).map(m => m.serialNumber).join(', ');
      notificationService.notify(
        '⚠️ Preventive Maintenance Overdue',
        `${overdueList.length} machine(s) are overdue for servicing (${sample}${overdueList.length > 2 ? '...' : ''}). Immediate action required.`,
        'WARNING',
        '#preventive-maintenance'
      );
    }

    if (dueTodayList.length > 0) {
      const sample = dueTodayList.slice(0, 2).map(m => m.serialNumber).join(', ');
      notificationService.notify(
        '🔔 Preventive Maintenance Due Today',
        `${dueTodayList.length} machine(s) scheduled for maintenance today (${sample}).`,
        'INFO',
        '#preventive-maintenance'
      );
    }
  }
}

export const preventiveMaintenanceService = new PreventiveMaintenanceService();
