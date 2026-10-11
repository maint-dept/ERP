/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * QR Code Service: Machine QR (Permanent ID) & Location QR (Unit + Floor)
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { masterDataService } from './masterDataService.js';

class QrCodeService {
  /**
   * Generates or retrieves an immutable, permanent Unique Machine ID.
   * Machine QR is permanently tied to this ID, even if Serial Number or Location is updated.
   */
  getPermanentMachineId(machine) {
    if (!machine) return '';
    if (machine.permanentMachineId) {
      return machine.permanentMachineId;
    }

    // Auto-generate stable readable Permanent Machine ID from machine.id
    // e.g. mac-1788870312541-26 -> MID-000026
    const numPart = (machine.id || '').split('-').pop();
    const cleanNum = numPart && !isNaN(parseInt(numPart, 10))
      ? String(parseInt(numPart, 10)).padStart(6, '0')
      : String(Math.abs(this._hashString(machine.id || machine.serialNumber || '0'))).slice(-6).padStart(6, '0');

    const permanentId = `MID-${cleanNum}`;

    // Persist to machine in storage
    machine.permanentMachineId = permanentId;
    if (!machine.qrStatus) {
      machine.qrStatus = 'ACTIVE';
    }
    if (!machine.qrGeneratedAt) {
      machine.qrGeneratedAt = machine.createdAt || new Date().toISOString();
    }
    storage.update(TABLE_NAMES.MACHINES, machine.id, {
      permanentMachineId: permanentId,
      qrStatus: machine.qrStatus,
      qrGeneratedAt: machine.qrGeneratedAt
    });

    return permanentId;
  }

  /**
   * Generates official Machine QR Payload linked to permanent machine.id
   */
  getMachineQrPayload(machine) {
    if (!machine) return '';
    this.getPermanentMachineId(machine); // Ensure permanentMachineId is initialized
    return `AL-MUSLIM-ERP://MC/${machine.id}`;
  }

  /**
   * Generates official Location QR Payload for Unit + Floor
   */
  getLocationQrPayload(unitId, floorId) {
    return `AL-MUSLIM-ERP://LOC/${unitId}/${floorId}`;
  }

  /**
   * Generates a concise, industry-standard Location Tag string (e.g. AKM-TISTA)
   * Prioritizes admin-customized locationTag on Floor, otherwise derives from Unit-Floor
   */
  getLocationTag(unitId, floorId) {
    const unit = masterDataService.getUnitById(unitId);
    const floor = masterDataService.getFloorById(floorId);

    // 1. Highest priority: Admin customized Floor Tag (locationTag or tag)
    if (floor?.locationTag && String(floor.locationTag).trim()) {
      return String(floor.locationTag).trim().toUpperCase();
    }
    if (floor?.tag && String(floor.tag).trim()) {
      return String(floor.tag).trim().toUpperCase();
    }
    if (floor?.floorTag && String(floor.floorTag).trim()) {
      return String(floor.floorTag).trim().toUpperCase();
    }

    const unitStr = unit?.name || unitId || 'UNIT';
    const floorStr = floor?.name || floorId || 'FLOOR';

    // Extract acronym / short code:
    // If unit has an explicit code (e.g. "AKM"), prioritize it!
    let uCode = unit?.code ? String(unit.code).trim().toUpperCase() : '';
    if (!uCode) {
      const unitWords = unitStr.split(/\s+/);
      uCode = unitWords[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (uCode.length < 2 && unitWords[1]) {
        uCode = (unitWords[0][0] + unitWords[1][0]).toUpperCase();
      }
    }

    // e.g. "Tista Floor" -> "TISTA", "Floor 1" -> "FLR1"
    const fCode = floorStr
      .replace(/floor/gi, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase() || (floor?.code ? String(floor.code).toUpperCase() : 'FLR');

    return `${uCode}-${fCode}`;
  }

  /**
   * Parses any scanned QR code / barcode payload into a structured type.
   * Differentiates between Location QR, Machine QR (by permanent ID), and fallback Serial Number.
   */
  parseQrPayload(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') {
      return { type: 'UNKNOWN', raw: rawInput };
    }

    const trimmed = rawInput.trim();

    // 1. Location QR Format: AL-MUSLIM-ERP://LOC/{unitId}/{floorId}
    const locMatch = trimmed.match(/^AL-MUSLIM-ERP:\/\/LOC\/([^/]+)\/([^/]+)/i);
    if (locMatch) {
      return {
        type: 'LOCATION',
        unitId: locMatch[1],
        floorId: locMatch[2],
        raw: trimmed
      };
    }

    // 1b. Location QR Short Format: LOC:{unitId}:{floorId}
    const locShortMatch = trimmed.match(/^LOC:([^:]+):([^:]+)/i);
    if (locShortMatch) {
      return {
        type: 'LOCATION',
        unitId: locShortMatch[1],
        floorId: locShortMatch[2],
        raw: trimmed
      };
    }

    // 2. Machine QR Format: AL-MUSLIM-ERP://MC/{machineId}
    const mcMatch = trimmed.match(/^AL-MUSLIM-ERP:\/\/MC\/(.+)$/i);
    if (mcMatch) {
      return {
        type: 'MACHINE',
        identifier: mcMatch[1],
        isPermanentId: true,
        raw: trimmed
      };
    }

    // 3. Raw Permanent Machine ID (MID-xxxxxx or mac-xxxxxx)
    if (/^MID-\d+/i.test(trimmed) || /^mac-/i.test(trimmed)) {
      return {
        type: 'MACHINE',
        identifier: trimmed,
        isPermanentId: true,
        raw: trimmed
      };
    }

    // 4. Raw Serial Number (Legacy QR or manual barcode entry)
    return {
      type: 'MACHINE',
      identifier: trimmed,
      isPermanentId: false,
      raw: trimmed
    };
  }

  /**
   * Comprehensive machine specification resolver for QR sticker rendering and preview
   */
  getMachineQrDetails(machine) {
    if (!machine) return null;

    const permanentId = this.getPermanentMachineId(machine);
    const mn = masterDataService.getMachineNameById(machine.machineNameId);
    const brd = masterDataService.getBrandById(machine.brandId);
    const mdl = masterDataService.getModelById(machine.modelId);
    const unt = masterDataService.getUnitById(machine.unitId);
    const flr = masterDataService.getFloorById(machine.floorId);
    const lin = masterDataService.getLineById(machine.lineId);

    const locationTag = this.getLocationTag(machine.unitId, machine.floorId);

    return {
      machineId: machine.id,
      permanentMachineId: permanentId,
      serialNumber: machine.serialNumber || 'N/A',
      machineName: mn?.name || machine.machineName || 'Sewing Machine',
      brand: brd?.name || machine.brand || 'N/A',
      model: mdl?.name || machine.model || 'N/A',
      unitId: machine.unitId,
      unitName: unt?.name || machine.unit || 'N/A',
      floorId: machine.floorId,
      floorName: flr?.name || machine.floor || 'N/A',
      lineId: machine.lineId,
      lineName: lin?.name || machine.line || 'N/A',
      locationTag,
      status: machine.status || 'ACTIVE',
      needleQuantity: machine.presentNeedle || machine.needleQuantity || '',
      presentNeedle: machine.presentNeedle || machine.needleQuantity || '',
      qrStatus: machine.qrStatus || 'ACTIVE',
      qrGeneratedAt: machine.qrGeneratedAt || machine.createdAt || new Date().toISOString(),
      qrReprintCount: machine.qrReprintCount || 0,
      payload: this.getMachineQrPayload(machine)
    };
  }

  /**
   * Retrieves all Units and Floors to generate all Location QR placards
   */
  getAllLocationQrs() {
    const groups = masterDataService.getGroups();
    const result = [];

    groups.forEach(grp => {
      const units = masterDataService.getUnits(grp.id);
      units.forEach(unt => {
        const floors = masterDataService.getFloors(unt.id);
        floors.forEach(flr => {
          const locationTag = this.getLocationTag(unt.id, flr.id);
          result.push({
            groupId: grp.id,
            groupName: grp.name,
            unitId: unt.id,
            unitName: unt.name,
            floorId: flr.id,
            floorName: flr.name,
            locationTag,
            payload: this.getLocationQrPayload(unt.id, flr.id)
          });
        });
      });
    });

    return result;
  }

  /**
   * Updates QR Status (ACTIVE or INACTIVE)
   */
  updateMachineQrStatus(machineId, status) {
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const target = machines.find(m => m.id === machineId || m.permanentMachineId === machineId);
    if (!target) return false;

    target.qrStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    target.updatedAt = new Date().toISOString();
    storage.update(TABLE_NAMES.MACHINES, target.id, target);
    return true;
  }

  /**
   * Records a reprint event for audit history
   */
  recordMachineReprint(machineId) {
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const target = machines.find(m => m.id === machineId || m.permanentMachineId === machineId);
    if (!target) return false;

    target.qrReprintCount = (target.qrReprintCount || 0) + 1;
    target.lastReprintedAt = new Date().toISOString();
    storage.update(TABLE_NAMES.MACHINES, target.id, target);
    return true;
  }

  /**
   * Bulk updates QR generation metadata
   */
  bulkGenerateMachineQrs(machineIds) {
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const idSet = new Set(machineIds);
    let count = 0;

    machines.forEach(m => {
      if (idSet.has(m.id)) {
        this.getPermanentMachineId(m);
        m.qrStatus = 'ACTIVE';
        m.qrGeneratedAt = new Date().toISOString();
        storage.update(TABLE_NAMES.MACHINES, m.id, m);
        count++;
      }
    });

    return count;
  }

  /**
   * Retrieves the current Admin Label Configuration (persisted in localStorage)
   */
  getLabelConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('erp_qr_label_config');
        if (stored) {
          return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(stored) };
        }
      }
    } catch (_) {}
    return { ...DEFAULT_LABEL_CONFIG };
  }

  /**
   * Saves the Admin Label Configuration
   */
  saveLabelConfig(config) {
    const merged = { ...DEFAULT_LABEL_CONFIG, ...config };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('erp_qr_label_config', JSON.stringify(merged));
      }
    } catch (_) {}
    return merged;
  }

  /**
   * Resets Label Configuration to factory defaults
   */
  resetLabelConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('erp_qr_label_config');
      }
    } catch (_) {}
    return { ...DEFAULT_LABEL_CONFIG };
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const DEFAULT_LABEL_CONFIG = {
  companyName: 'AL-MUSLIM GROUP',
  showCompany: true,
  showTagStatus: true,
  
  // Floor / Location Tag customization (Marked in Red on sticker header, e.g. AKM-TISTA)
  showLocationTag: true,       // Show/hide floor tag on top right
  locationTagMode: 'auto',     // 'auto' (Master Data floor tag) | 'floor_only' | 'unit_only' | 'custom'
  customLocationTag: '',       // Specific custom text override if set by admin
  
  // Field visibility toggles
  showPermanentId: true,       // MID-000026
  showSerialNumber: true,      // SN: 5369
  showMachineName: true,       // Plane Machine
  showBrandModel: true,        // Juki • DDL-900BB
  showLocation: true,          // AKM Knit Wear Ltd. • Tista Floor • TS-G
  showNeedleQuantity: true,    // Needle Quantity
  
  // Layout & positioning
  qrPosition: 'left',          // 'left' | 'right' | 'top' | 'qr_only'
  qrSize: 86,                  // 70 | 86 | 100 | 120 (px)
  fontSize: 'medium',          // 'small' | 'medium' | 'large'
  
  // Sheet & print setup
  stickerSize: 'standard',     // 'compact' | 'standard' | 'large'
  stickersPerRow: 3,           // 2 | 3 | 4
  showCuttingBorder: true,
  
  // Custom footer
  showFooter: true,
  footerText: 'Factory Maintenance Machine Tag',
  
  // Error correction
  errorCorrectionLevel: 'M'    // L | M | Q | H
};

export const qrCodeService = new QrCodeService();

