/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Comprehensive Manpower & Workforce Management Service
 * Handles Employee Profiles, Dynamic Custom Fields, Hierarchical Placement,
 * Employee Relocations/Transfers, Leave Management, Multi-Filter Engine & Analytics
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { auditService } from './auditService.js';
import { masterDataService } from './masterDataService.js';
import { employeeCustomFieldService } from './employeeCustomFieldService.js';

export const DEPARTMENTS = [
  'Sewing & Assembly',
  'Mechanical Maintenance',
  'Electrical & Utility',
  'Quality Assurance (QA)',
  'Cutting Department',
  'Finishing & Packing',
  'Store & Inventory',
  'Industrial Engineering (IE)',
  'Administration & HR'
];

export const DESIGNATIONS = [
  'Senior Maintenance Engineer',
  'Maintenance Technician',
  'Senior Sewing Mechanic',
  'Junior Mechanic',
  'Electrical Technician',
  'Floor Line Supervisor',
  'Senior Machine Operator',
  'Quality Control Inspector',
  'Store Officer',
  'Maintenance Helper'
];

export const LEAVE_TYPES = [
  { code: 'CASUAL', label: 'Casual Leave (CL)', color: '#38bdf8' },
  { code: 'SICK', label: 'Sick / Medical Leave (SL)', color: '#f87171' },
  { code: 'EARNED', label: 'Annual / Earned Leave (AL)', color: '#34d399' },
  { code: 'MATERNITY', label: 'Maternity Leave', color: '#ec4899' },
  { code: 'UNPAID', label: 'Leave Without Pay (LWP)', color: '#94a3b8' }
];

const INITIAL_SEED_EMPLOYEES = [
  {
    id: 'emp-101',
    name: 'Engr. Tanvir Ahmed',
    cardNumber: '1001',
    designation: 'Senior Maintenance Engineer',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-4',
    lineId: 'lin-1',
    workingArea: '3rd Floor Maintenance Bay',
    phone: '+880 1711-234567',
    joinDate: '2020-01-15',
    status: 'ACTIVE',
    customFields: {
      national_id: '19882691234567890',
      blood_group: 'B+',
      skill_grade: 'Grade A (Master/Expert)',
      emergency_contact: '+880 1819-987654',
      overtime_eligible: 'No'
    },
    createdAt: '2020-01-15T08:00:00Z'
  },
  {
    id: 'emp-102',
    name: 'Md. Faruk Hossain',
    cardNumber: '1042',
    designation: 'Floor Line Supervisor',
    department: 'Sewing & Assembly',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-4',
    lineId: 'lin-1',
    workingArea: 'Line JA-A Production Floor',
    phone: '+880 1819-556677',
    joinDate: '2021-03-10',
    status: 'ACTIVE',
    customFields: {
      national_id: '19922692345678901',
      blood_group: 'O+',
      skill_grade: 'Grade A (Master/Expert)',
      emergency_contact: '+880 1722-112233',
      overtime_eligible: 'Yes'
    },
    createdAt: '2021-03-10T08:00:00Z'
  },
  {
    id: 'emp-103',
    name: 'Rahim Uddin',
    cardNumber: '1088',
    designation: 'Senior Sewing Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-4',
    lineId: 'lin-2',
    workingArea: 'Line JA-B Sewing Support',
    phone: '+880 1912-334455',
    joinDate: '2022-06-01',
    status: 'ACTIVE',
    customFields: {
      national_id: '19952693456789012',
      blood_group: 'A+',
      skill_grade: 'Grade B (Senior)',
      emergency_contact: '+880 1633-445566',
      overtime_eligible: 'Yes'
    },
    createdAt: '2022-06-01T08:00:00Z'
  },
  {
    id: 'emp-104',
    name: 'Nurul Islam',
    cardNumber: '1105',
    designation: 'Electrical Technician',
    department: 'Electrical & Utility',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-1',
    lineId: 'lin-4',
    workingArea: 'Ground Floor Substation & Line',
    phone: '+880 1723-889900',
    joinDate: '2023-01-20',
    status: 'ACTIVE',
    customFields: {
      national_id: '19942694567890123',
      blood_group: 'AB+',
      skill_grade: 'Grade B (Senior)',
      emergency_contact: '+880 1788-990011',
      overtime_eligible: 'Yes'
    },
    createdAt: '2023-01-20T08:00:00Z'
  },
  {
    id: 'emp-105',
    name: 'Kalam Sheikh',
    cardNumber: '1120',
    designation: 'Maintenance Technician',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-2',
    floorId: 'flr-5',
    lineId: 'lin-3',
    workingArea: 'Washing Plant Maintenance Desk',
    phone: '+880 1634-112244',
    joinDate: '2023-08-15',
    status: 'ON_LEAVE',
    customFields: {
      national_id: '19962695678901234',
      blood_group: 'O-',
      skill_grade: 'Grade C (Standard)',
      emergency_contact: '+880 1522-334455',
      overtime_eligible: 'Yes'
    },
    createdAt: '2023-08-15T08:00:00Z'
  },
  {
    id: 'emp-106',
    name: 'Fatema Begum',
    cardNumber: '1155',
    designation: 'Quality Control Inspector',
    department: 'Quality Assurance (QA)',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-2',
    lineId: 'lin-1',
    workingArea: '1st Floor QC Inspection Table',
    phone: '+880 1521-778899',
    joinDate: '2022-11-10',
    status: 'ACTIVE',
    customFields: {
      national_id: '19972696789012345',
      blood_group: 'A-',
      skill_grade: 'Grade B (Senior)',
      emergency_contact: '+880 1833-221100',
      overtime_eligible: 'No'
    },
    createdAt: '2022-11-10T08:00:00Z'
  },
  {
    id: 'emp-107',
    name: 'Al-Amin Mia',
    cardNumber: '1182',
    designation: 'Senior Machine Operator',
    department: 'Sewing & Assembly',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-4',
    lineId: 'lin-1',
    workingArea: 'Line JA-A Heavy Duty Lockstitch',
    phone: '+880 1845-667788',
    joinDate: '2024-02-01',
    status: 'ACTIVE',
    customFields: {
      national_id: '19982697890123456',
      blood_group: 'B+',
      skill_grade: 'Grade B (Senior)',
      emergency_contact: '+880 1977-889900',
      overtime_eligible: 'Yes'
    },
    createdAt: '2024-02-01T08:00:00Z'
  },
  {
    id: 'emp-108',
    name: 'Mizanur Rahman',
    cardNumber: '1190',
    designation: 'Store Officer',
    department: 'Store & Inventory',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-1',
    lineId: 'lin-4',
    workingArea: 'Central Spare Parts & Machine Store',
    phone: '+880 1766-443322',
    joinDate: '2021-09-01',
    status: 'ACTIVE',
    customFields: {
      national_id: '19902698901234567',
      blood_group: 'AB-',
      skill_grade: 'Grade A (Master/Expert)',
      emergency_contact: '+880 1688-776655',
      overtime_eligible: 'No'
    },
    createdAt: '2021-09-01T08:00:00Z'
  },
  {
    id: 'emp-109',
    name: 'Ashraful Alam Shahed',
    cardNumber: 'AMG-0147075',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-7',
    lineId: 'lin-1',
    workingArea: 'Sewing - Jamuna',
    phone: '+880 1712-345678',
    joinDate: '2021-04-10',
    status: 'ACTIVE',
    customFields: {
      national_id: '19912691234567800',
      blood_group: 'B+',
      skill_grade: 'Grade A (Master/Expert)'
    },
    createdAt: '2021-04-10T08:00:00Z'
  },
  {
    id: 'emp-110',
    name: 'Md. Jabad',
    cardNumber: 'AMG0072256',
    designation: 'Junior Mechanic (W)',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-1',
    lineId: 'lin-2',
    workingArea: 'Embroidery Section',
    phone: '+880 1819-223344',
    joinDate: '2022-01-15',
    status: 'ACTIVE',
    customFields: {
      national_id: '19962692345678900',
      blood_group: 'O+'
    },
    createdAt: '2022-01-15T08:00:00Z'
  },
  {
    id: 'emp-111',
    name: 'Md. Monirul Islam',
    cardNumber: 'AMG-0146997',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-9',
    lineId: 'lin-3',
    workingArea: 'Sewing - Padma',
    phone: '+880 1913-445566',
    joinDate: '2021-07-20',
    status: 'ACTIVE',
    customFields: {
      national_id: '19932693456789000',
      blood_group: 'A+'
    },
    createdAt: '2021-07-20T08:00:00Z'
  },
  {
    id: 'emp-112',
    name: 'Md. Jahid Khan',
    cardNumber: 'AMG0144906',
    designation: 'Assistant Mechanic (W)',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-4',
    lineId: 'lin-4',
    workingArea: 'Special M/C (P.A)',
    phone: '+880 1724-556677',
    joinDate: '2023-03-01',
    status: 'ACTIVE',
    customFields: {
      national_id: '19972694567890000',
      blood_group: 'AB+'
    },
    createdAt: '2023-03-01T08:00:00Z'
  },
  {
    id: 'emp-113',
    name: 'Md. Shamim Hossain',
    cardNumber: 'AMG-0144970',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-19',
    lineId: 'lin-22',
    workingArea: 'Sewing - Model Line',
    phone: '+880 1635-667788',
    joinDate: '2020-11-12',
    status: 'ACTIVE',
    customFields: {
      national_id: '19902695678900000',
      blood_group: 'O-'
    },
    createdAt: '2020-11-12T08:00:00Z'
  },
  {
    id: 'emp-114',
    name: 'Md. Jaed Hossan',
    cardNumber: 'AMG0141530',
    designation: 'Assistant Mechanic (W)',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-15',
    lineId: 'lin-18',
    workingArea: 'Sewing - Titas',
    phone: '+880 1522-778899',
    joinDate: '2023-05-18',
    status: 'ON_LEAVE',
    customFields: {
      national_id: '19982696789000000',
      blood_group: 'A-'
    },
    createdAt: '2023-05-18T08:00:00Z'
  },
  {
    id: 'emp-115',
    name: 'Md. Ainal Haque',
    cardNumber: 'AMG-0144901',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-11',
    lineId: 'lin-14',
    workingArea: 'Sample Section',
    phone: '+880 1846-889900',
    joinDate: '2021-08-05',
    status: 'ACTIVE',
    customFields: {
      national_id: '19922697890000000',
      blood_group: 'B+'
    },
    createdAt: '2021-08-05T08:00:00Z'
  },
  {
    id: 'emp-116',
    name: 'Md. Mosharraf Hossain',
    cardNumber: 'AMG-0144578',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-6',
    lineId: 'lin-6',
    workingArea: 'Sewing - Surma',
    phone: '+880 1767-990011',
    joinDate: '2020-09-15',
    status: 'ACTIVE',
    customFields: {
      national_id: '19892698900000000',
      blood_group: 'O+'
    },
    createdAt: '2020-09-15T08:00:00Z'
  },
  {
    id: 'emp-117',
    name: 'Md. Sumon Mia',
    cardNumber: 'AMG-0143448',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-19',
    lineId: 'lin-22',
    workingArea: 'Sewing - Model Line',
    phone: '+880 1978-112233',
    joinDate: '2022-04-01',
    status: 'ACTIVE',
    customFields: {
      national_id: '19952699010000000',
      blood_group: 'AB+'
    },
    createdAt: '2022-04-01T08:00:00Z'
  },
  {
    id: 'emp-118',
    name: 'Prosanto Kumar Sarkar',
    cardNumber: 'AMG-0142711',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-19',
    lineId: 'lin-22',
    workingArea: 'Sewing - Model Line',
    phone: '+880 1689-223344',
    joinDate: '2019-06-20',
    status: 'INACTIVE',
    customFields: {
      national_id: '19872690120000000',
      blood_group: 'B+'
    },
    createdAt: '2019-06-20T08:00:00Z'
  },
  {
    id: 'emp-119',
    name: 'Md. Nuru Nabi',
    cardNumber: 'AMG-0140022',
    designation: 'Mechanic',
    department: 'Finishing & Packing',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-12',
    lineId: 'lin-15',
    workingArea: 'Finishing Section',
    phone: '+880 1735-334455',
    joinDate: '2022-09-10',
    status: 'ACTIVE',
    customFields: {
      national_id: '19942691230000000',
      blood_group: 'A+'
    },
    createdAt: '2022-09-10T08:00:00Z'
  },
  {
    id: 'emp-120',
    name: 'Madhob Chandra',
    cardNumber: 'AMG-0147291',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-7',
    lineId: 'lin-1',
    workingArea: 'Sewing - Jamuna',
    phone: '+880 1715-445566',
    joinDate: '2021-05-15',
    status: 'ACTIVE',
    customFields: {
      blood_group: 'B+',
      skill_grade: 'Grade A (Master/Expert)'
    },
    createdAt: '2021-05-15T08:00:00Z'
  },
  {
    id: 'emp-121',
    name: 'Md. Shojib',
    cardNumber: 'AMG-0132694',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-7',
    lineId: 'lin-2',
    workingArea: 'Sewing - Jamuna',
    phone: '+880 1812-778899',
    joinDate: '2020-08-10',
    status: 'ACTIVE',
    customFields: {
      blood_group: 'O+',
      skill_grade: 'Grade A (Master/Expert)'
    },
    createdAt: '2020-08-10T08:00:00Z'
  },
  {
    id: 'emp-122',
    name: 'Md. Najmul Hossain',
    cardNumber: 'AMG-0142472',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-7',
    lineId: 'lin-1',
    workingArea: 'Sewing - Jamuna',
    phone: '+880 1718-992233',
    joinDate: '2021-03-01',
    status: 'ACTIVE',
    customFields: {
      blood_group: 'A+',
      skill_grade: 'Grade A (Master/Expert)'
    },
    createdAt: '2021-03-01T08:00:00Z'
  },
  {
    id: 'emp-123',
    name: 'Dipok Roy',
    cardNumber: 'AMG-0143446',
    designation: 'Senior Mechanic',
    department: 'Mechanical Maintenance',
    groupId: 'grp-1',
    unitId: 'unt-1',
    floorId: 'flr-1',
    lineId: 'lin-1',
    workingArea: 'Sample Floor',
    phone: '+880 1718-556677',
    joinDate: '2022-03-01',
    status: 'ACTIVE',
    customFields: {
      blood_group: 'O+',
      skill_grade: 'Grade A (Senior Mechanic)'
    },
    createdAt: '2022-03-01T08:00:00Z'
  }
];

class EmployeeService {

  constructor() {
    this._ensureSeedData();
    this.autoHealEmployeeUnits();
  }

  _ensureSeedData() {
    // Single source of truth is Firestore and StorageEngine.
    // Never resurrect deleted employees or overwrite user data with mock seeds.
  }

  /**
   * Automatically heals and reconciles employee Unit & Group IDs with Master Data
   */
  autoHealEmployeeUnits() {
    try {
      const table = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
      let modified = false;
      table.forEach(emp => {
        // If employee has a floorId, ensure unitId aligns with the floor's parent unit
        if (emp.floorId) {
          const flr = masterDataService.getFloorById ? masterDataService.getFloorById(emp.floorId) : null;
          if (flr && flr.unitId && (!emp.unitId || emp.unitId !== flr.unitId)) {
            emp.unitId = flr.unitId;
            emp.groupId = flr.groupId || (masterDataService.getUnitById ? masterDataService.getUnitById(flr.unitId)?.groupId : null) || emp.groupId || 'grp-1';
            modified = true;
          }
        }
        // If employee has unitName, attempt master data lookup
        if (emp.unitName && (!emp.unitId || emp.unitId === 'unt-1')) {
          const matched = this.resolveUnitFromMasterData(emp.unitName);
          if (matched && emp.unitId !== matched.id) {
            emp.unitId = matched.id;
            emp.groupId = matched.groupId || emp.groupId || 'grp-1';
            modified = true;
          }
        }
      });
      if (modified) {
        storage.setTable(TABLE_NAMES.EMPLOYEES, table);
        storage.saveTable(TABLE_NAMES.EMPLOYEES);
      }
    } catch (_) {}
  }

  /**
   * Resolves a Unit from Master Data by text (ID, code, exact name, or normalized name)
   */
  resolveUnitFromMasterData(rawUnitText) {
    if (!rawUnitText || typeof rawUnitText !== 'string') return null;
    const clean = rawUnitText.trim().toLowerCase();
    if (!clean) return null;
    const allUnits = masterDataService.getUnits ? masterDataService.getUnits(null, true) : [];
    
    // 1. Match by exact ID
    let found = allUnits.find(u => u.id && u.id.toLowerCase() === clean);
    if (found) return found;

    // 2. Match by Unit Code (e.g. 'AKM', 'PBJ', 'AMA', 'AGA', 'AMFS')
    found = allUnits.find(u => u.code && u.code.toLowerCase() === clean);
    if (found) return found;

    // 3. Match by exact Unit Name
    found = allUnits.find(u => u.name && u.name.toLowerCase() === clean);
    if (found) return found;

    // 4. Match normalized (e.g. "akm knitwear" vs "akm knit wear ltd")
    const cleanNorm = clean.replace(/[^a-z0-9]/g, '');
    found = allUnits.find(u => {
      const uNorm = (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cNorm = (u.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return uNorm === cleanNorm || cNorm === cleanNorm ||
             (cleanNorm.length >= 3 && (uNorm.includes(cleanNorm) || cleanNorm.includes(uNorm)));
    });
    if (found) return found;

    return null;
  }

  /**
   * Resolves a Floor from Master Data by text
   */
  resolveFloorFromMasterData(rawFloorText, unitId = null) {
    if (!rawFloorText || typeof rawFloorText !== 'string') return null;
    const clean = rawFloorText.trim().toLowerCase();
    if (!clean) return null;
    const allFloors = masterDataService.getFloors ? masterDataService.getFloors(unitId, null, true) : [];

    // 1. Match by exact ID
    let found = allFloors.find(f => f.id && f.id.toLowerCase() === clean);
    if (found) return found;

    // 2. Match by exact Name
    found = allFloors.find(f => f.name && f.name.toLowerCase() === clean);
    if (found) return found;

    // 3. Match substring
    found = allFloors.find(f => f.name && (f.name.toLowerCase().includes(clean) || clean.includes(f.name.toLowerCase())));
    if (found) return found;

    // Search across all floors if scoped unit search failed
    if (unitId) {
      const globalFloors = masterDataService.getFloors ? masterDataService.getFloors(null, null, true) : [];
      found = globalFloors.find(f => f.name && (f.name.toLowerCase() === clean || f.name.toLowerCase().includes(clean) || clean.includes(f.name.toLowerCase())));
      if (found) return found;
    }

    return null;
  }

  /**
   * Resolves a Line from Master Data by text
   */
  resolveLineFromMasterData(rawLineText, floorId = null, unitId = null) {
    if (!rawLineText || typeof rawLineText !== 'string') return null;
    const clean = rawLineText.trim().toLowerCase();
    if (!clean) return null;
    const allLines = masterDataService.getLines ? masterDataService.getLines(floorId, unitId, null, true) : [];

    let found = allLines.find(l => l.id && l.id.toLowerCase() === clean);
    if (found) return found;
    found = allLines.find(l => l.name && l.name.toLowerCase() === clean);
    if (found) return found;
    found = allLines.find(l => l.name && (l.name.toLowerCase().includes(clean) || clean.includes(l.name.toLowerCase())));
    if (found) return found;

    if (floorId || unitId) {
      const globalLines = masterDataService.getLines ? masterDataService.getLines(null, null, null, true) : [];
      found = globalLines.find(l => l.name && (l.name.toLowerCase() === clean || l.name.toLowerCase().includes(clean) || clean.includes(l.name.toLowerCase())));
      if (found) return found;
    }

    return null;
  }

  /**
   * Dynamically extracts all distinct departments from actual workforce data + defaults
   */
  getDistinctDepartments() {
    const table = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const set = new Set();
    table.forEach(e => {
      if (e.department && typeof e.department === 'string') {
        const d = e.department.trim();
        if (d && d !== 'ALL') set.add(d);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Dynamically extracts all distinct designations from actual workforce data + defaults
   */
  getDistinctDesignations() {
    const table = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const set = new Set();
    table.forEach(e => {
      if (e.designation && typeof e.designation === 'string') {
        const d = e.designation.trim();
        if (d && d !== 'ALL') set.add(d);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get all registered employees with comprehensive multi-parameter filtering
   * @param {Object} filters
   * @returns {Array} Enriched employee objects
   */
  getAllEmployees(filters = {}) {
    this._ensureSeedData();
    let list = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];

    // 1. Text Search (Name, Card ID, Phone, Designation, Working Area)
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(e =>
        (e.name && e.name.toLowerCase().includes(q)) ||
        (e.cardNumber && String(e.cardNumber).toLowerCase().includes(q)) ||
        (e.designation && e.designation.toLowerCase().includes(q)) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.phone && e.phone.toLowerCase().includes(q)) ||
        (e.workingArea && e.workingArea.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(e => e.status === filters.status);
    }

    // 3. Department Filter (Case-insensitive & trimmed)
    if (filters.department && filters.department !== 'ALL') {
      const targetDept = filters.department.trim().toLowerCase();
      list = list.filter(e => (e.department || '').trim().toLowerCase() === targetDept);
    }

    // 4. Designation Filter (Case-insensitive & trimmed)
    if (filters.designation && filters.designation !== 'ALL') {
      const targetDesig = filters.designation.trim().toLowerCase();
      list = list.filter(e => (e.designation || '').trim().toLowerCase() === targetDesig);
    }

    // 5. Plant Hierarchy Filters (Group -> Unit -> Floor -> Line)
    if (filters.groupId && filters.groupId !== 'ALL') {
      list = list.filter(e => e.groupId === filters.groupId);
    }
    if (filters.unitId && filters.unitId !== 'ALL') {
      list = list.filter(e => {
        if (e.unitId === filters.unitId) return true;
        if (e.floorId) {
          const flr = masterDataService.getFloorById ? masterDataService.getFloorById(e.floorId) : null;
          if (flr && flr.unitId === filters.unitId) return true;
        }
        if (e.unitName) {
          const uObj = masterDataService.getUnitById ? masterDataService.getUnitById(filters.unitId) : null;
          if (uObj && (uObj.name.toLowerCase() === e.unitName.trim().toLowerCase() || (uObj.code && uObj.code.toLowerCase() === e.unitName.trim().toLowerCase()))) return true;
        }
        return false;
      });
    }
    if (filters.floorId && filters.floorId !== 'ALL') {
      list = list.filter(e => e.floorId === filters.floorId);
    }
    if (filters.lineId && filters.lineId !== 'ALL') {
      list = list.filter(e => e.lineId === filters.lineId);
    }

    // 6. Dynamic Custom Fields Filter (Matches any active custom field value)
    if (filters.customFilters && typeof filters.customFilters === 'object') {
      Object.entries(filters.customFilters).forEach(([fieldCode, filterVal]) => {
        if (filterVal && filterVal !== 'ALL' && String(filterVal).trim() !== '') {
          const expected = String(filterVal).toLowerCase().trim();
          list = list.filter(e => {
            const actual = e.customFields ? String(e.customFields[fieldCode] || '').toLowerCase().trim() : '';
            return actual === expected || actual.includes(expected);
          });
        }
      });
    }

    return list.map(emp => this.enrichEmployee(emp));
  }

  /**
   * Enriches an employee record with location names from master data
   */
  enrichEmployee(emp) {
    if (!emp) return null;
    let unitId = emp.unitId || null;
    let floorId = emp.floorId || null;

    let floor = floorId ? (masterDataService.getFloorById ? masterDataService.getFloorById(floorId) : null) : null;
    if (!unitId && floor && floor.unitId) {
      unitId = floor.unitId;
    }

    let unit = unitId ? (masterDataService.getUnitById ? masterDataService.getUnitById(unitId) : null) : null;
    if (!unit && emp.unitName) {
      unit = this.resolveUnitFromMasterData(emp.unitName);
      if (unit) unitId = unit.id;
    }

    let groupId = emp.groupId || unit?.groupId || floor?.groupId || 'grp-1';
    let group = groupId ? (masterDataService.getGroupById ? masterDataService.getGroupById(groupId) : null) : null;
    let line = emp.lineId ? (masterDataService.getLineById ? masterDataService.getLineById(emp.lineId) : null) : null;

    const groupName = group?.name || emp.groupName || 'Al-Muslim Group';
    const unitName = unit?.name || emp.unitName || '';
    const floorName = floor?.name || emp.floorName || emp.floor || '';
    const lineName = line?.name || emp.lineName || '';

    const locationPath = [groupName, unitName, floorName, lineName || emp.workingArea].filter(Boolean).join(' > ');

    return {
      ...emp,
      groupId,
      unitId,
      groupName,
      unitName,
      floorName,
      lineName,
      locationPath: locationPath || 'Unassigned Location'
    };
  }

  getActiveEmployees() {
    return this.getAllEmployees({ status: 'ACTIVE' });
  }

  getInactiveEmployees() {
    return (this.getAllEmployees() || []).filter(e => e.status !== 'ACTIVE');
  }

  getTransfers() {
    return this.getEmployeeTransfers();
  }

  getLeaveRecords() {
    return this.getEmployeeLeaves();
  }

  getEmployeeById(id) {
    const list = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const emp = list.find(e => e.id === id) || null;
    return emp ? this.enrichEmployee(emp) : null;
  }

  getEmployeeByCardNumber(card) {
    if (!card) return null;
    const cleanCard = String(card).trim().toLowerCase();
    const list = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const emp = list.find(e => String(e.cardNumber || '').trim().toLowerCase() === cleanCard) || null;
    return emp ? this.enrichEmployee(emp) : null;
  }

  /**
   * Smart Autocomplete search for Card Number / Technician lookup in modals
   */
  searchEmployees(query = '') {
    const all = this.getAllEmployees();
    const q = (query || '').trim().toLowerCase();

    if (!q) {
      return all.filter(e => e.status !== 'INACTIVE' && e.status !== 'TERMINATED').slice(0, 15);
    }

    const matches = [];

    all.forEach(emp => {
      if (emp.status === 'INACTIVE' || emp.status === 'TERMINATED') return;

      const card = String(emp.cardNumber || '').trim().toLowerCase();
      const name = (emp.name || '').toLowerCase();
      const desig = (emp.designation || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const floor = (emp.floorName || '').toLowerCase();
      const phone = (emp.phone || '').toLowerCase();

      let score = 0;

      if (card === q) score += 250;
      else if (card.startsWith(q)) score += 180;
      else if (card.includes(q)) score += 120;

      if (name.startsWith(q)) score += 150;
      else if (name.split(/[\s-]+/).some(w => w.startsWith(q))) score += 110;
      else if (name.includes(q)) score += 80;

      if (desig.includes(q)) score += 60;
      if (dept.includes(q)) score += 50;
      if (floor.includes(q)) score += 40;
      if (phone.includes(q)) score += 30;

      if (score > 0) {
        matches.push({ emp, score });
      }
    });

    matches.sort((a, b) => b.score - a.score || (a.emp.name || '').localeCompare(b.emp.name || ''));
    return matches.slice(0, 20).map(m => m.emp);
  }

  checkDuplicateCardNumber(cardNumber, excludeId = null) {
    if (!cardNumber) return false;
    const clean = String(cardNumber).trim().toLowerCase();
    const all = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    return all.some(e => (!excludeId || e.id !== excludeId) && String(e.cardNumber || '').trim().toLowerCase() === clean);
  }

  // =========================================================================
  // CRUD OPERATIONS
  // =========================================================================

  async createEmployee(data) {
    const name = (data.name || '').trim();
    const cardNumber = (data.cardNumber || '').trim();

    if (!name) throw new Error('Employee Full Name is required.');
    if (!cardNumber) throw new Error('Employee / Card ID is required.');

    if (this.checkDuplicateCardNumber(cardNumber)) {
      throw new Error(`Employee/Card ID '${cardNumber}' is already assigned to another employee.`);
    }

    const resolvedUnitId = data.unitId || (data.floorId ? masterDataService.getFloorById?.(data.floorId)?.unitId : null) || null;
    const resolvedGroupId = data.groupId || (resolvedUnitId ? masterDataService.getUnitById?.(resolvedUnitId)?.groupId : null) || 'grp-1';

    const newEmp = {
      id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      cardNumber,
      designation: (data.designation || 'Senior Machine Operator').trim(),
      department: (data.department || 'Sewing & Assembly').trim(),
      groupId: resolvedGroupId,
      unitId: resolvedUnitId,
      unitName: data.unitName || (resolvedUnitId ? masterDataService.getUnitById?.(resolvedUnitId)?.name : '') || '',
      floorId: data.floorId || null,
      lineId: data.lineId || null,
      workingArea: (data.workingArea || '').trim(),
      phone: (data.phone || '').trim(),
      joinDate: data.joinDate || new Date().toISOString().split('T')[0],
      status: data.status || 'ACTIVE',
      customFields: data.customFields && typeof data.customFields === 'object' ? data.customFields : {},
      createdAt: new Date().toISOString()
    };

    const table = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    table.unshift(newEmp);
    // CONFIRMED WRITE: await Firebase HTTP 200 before success
    const ok = await storage.saveTable(TABLE_NAMES.EMPLOYEES, table);
    if (!ok) {
      // Rollback local state
      const rollback = table.filter(e => e.id !== newEmp.id);
      try { storage.data[TABLE_NAMES.EMPLOYEES] = rollback; } catch(_) {}
      throw new CloudSaveError('❌ Cloud Save Failed: Employee record was not confirmed by the cloud.');
    }

    auditService.log(
      'MANPOWER_EMPLOYEE_CREATED',
      'MANPOWER',
      newEmp.id,
      `Registered employee '${newEmp.name}' [ID #${newEmp.cardNumber}] - ${newEmp.designation} (${newEmp.department}).`
    );

    return this.enrichEmployee(newEmp);
  }

  async updateEmployee(id, updates) {
    const existing = this.getEmployeeById(id);
    if (!existing) throw new Error('Employee record not found.');

    if (updates.cardNumber && String(updates.cardNumber).trim() !== String(existing.cardNumber).trim()) {
      if (this.checkDuplicateCardNumber(updates.cardNumber, id)) {
        throw new Error(`Employee/Card ID '${updates.cardNumber}' is already in use.`);
      }
    }

    const resolvedUpdates = { ...updates };
    if (resolvedUpdates.floorId && !resolvedUpdates.unitId) {
      const flr = masterDataService.getFloorById ? masterDataService.getFloorById(resolvedUpdates.floorId) : null;
      if (flr && flr.unitId) {
        resolvedUpdates.unitId = flr.unitId;
        if (!resolvedUpdates.groupId) {
          resolvedUpdates.groupId = flr.groupId || masterDataService.getUnitById?.(flr.unitId)?.groupId || existing.groupId;
        }
      }
    }

    const mergedCustomFields = {
      ...(existing.customFields || {}),
      ...(resolvedUpdates.customFields || {})
    };

    const payload = {
      ...resolvedUpdates,
      customFields: mergedCustomFields,
      updatedAt: new Date().toISOString()
    };

    // Snapshot for rollback
    const snapshot = JSON.parse(JSON.stringify(existing));
    const updated = storage.update(TABLE_NAMES.EMPLOYEES, id, payload);
    // CONFIRMED WRITE: await Firebase HTTP 200
    const ok = await storage.saveTable(TABLE_NAMES.EMPLOYEES);
    if (!ok) {
      // Rollback
      storage.update(TABLE_NAMES.EMPLOYEES, id, snapshot);
      throw new CloudSaveError('❌ Cloud Save Failed: Employee update was not confirmed by the cloud.');
    }

    auditService.log(
      'MANPOWER_EMPLOYEE_UPDATED',
      'MANPOWER',
      id,
      `Updated profile for '${existing.name}' [ID #${existing.cardNumber}].`
    );

    return this.enrichEmployee(updated);
  }

  async deleteEmployee(id) {
    const existing = this.getEmployeeById(id);
    if (!existing) throw new Error('Employee not found.');

    // Snapshot for rollback
    const snapshot = JSON.parse(JSON.stringify(existing));
    storage.delete(TABLE_NAMES.EMPLOYEES, id);
    // CONFIRMED WRITE: await Firebase HTTP 200
    const ok = await storage.saveTable(TABLE_NAMES.EMPLOYEES);
    if (!ok) {
      // Rollback — re-add deleted record
      const table = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
      table.unshift(snapshot);
      await storage.saveTable(TABLE_NAMES.EMPLOYEES, table);
      throw new CloudSaveError('❌ Cloud Save Failed: Employee deletion was not confirmed by the cloud.');
    }

    auditService.log(
      'MANPOWER_EMPLOYEE_DELETED',
      'MANPOWER',
      id,
      `Deleted employee record for '${existing.name}' [ID #${existing.cardNumber}].`
    );

    return true;
  }

  toggleEmployeeStatus(id) {
    const emp = this.getEmployeeById(id);
    if (!emp) return null;
    const newStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateEmployee(id, { status: newStatus });
  }

  // =========================================================================
  // EMPLOYEE TRANSFER (RELOCATION)
  // =========================================================================

  async transferEmployee({
    employeeId,
    toGroupId,
    toUnitId,
    toFloorId,
    toLineId,
    toDepartment,
    toDesignation,
    toWorkingArea = '',
    transferDate = '',
    reason = '',
    transferredBy = 'Administrator'
  }) {
    const emp = this.getEmployeeById(employeeId);
    if (!emp) throw new Error('Employee not found for transfer.');

    const fromLoc = {
      groupId: emp.groupId,
      unitId: emp.unitId,
      floorId: emp.floorId,
      lineId: emp.lineId,
      department: emp.department,
      designation: emp.designation,
      workingArea: emp.workingArea,
      locationPath: emp.locationPath
    };

    const toGroup = toGroupId ? masterDataService.getGroupById(toGroupId) : null;
    const toUnit = toUnitId ? masterDataService.getUnitById(toUnitId) : null;
    const toFloor = toFloorId ? masterDataService.getFloorById(toFloorId) : null;
    const toLine = toLineId ? masterDataService.getLineById(toLineId) : null;

    const toLocPath = [toGroup?.name, toUnit?.name, toFloor?.name, toLine?.name || toWorkingArea].filter(Boolean).join(' > ');

    const transferRecord = {
      id: `emp-tr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      cardNumber: emp.cardNumber,
      fromLocation: fromLoc,
      toLocation: {
        groupId: toGroupId || emp.groupId,
        unitId: toUnitId || emp.unitId,
        floorId: toFloorId || emp.floorId,
        lineId: toLineId || emp.lineId,
        department: toDepartment || emp.department,
        designation: toDesignation || emp.designation,
        workingArea: toWorkingArea || emp.workingArea,
        locationPath: toLocPath
      },
      transferDate: transferDate || new Date().toISOString().split('T')[0],
      reason: (reason || 'Operational Workforce Balancing').trim(),
      transferredBy: transferredBy || 'Administrator',
      timestamp: new Date().toISOString()
    };

    // Save transfer in storage — CONFIRMED WRITE
    const transferTable = storage.getTable(TABLE_NAMES.EMPLOYEE_TRANSFERS) || [];
    transferTable.unshift(transferRecord);
    const trOk = await storage.saveTable(TABLE_NAMES.EMPLOYEE_TRANSFERS, transferTable);
    if (!trOk) throw new CloudSaveError('❌ Cloud Save Failed: Employee transfer record was not confirmed by the cloud.');

    // Update employee profile with new location — CONFIRMED WRITE
    await this.updateEmployee(emp.id, {
      groupId: toGroupId || emp.groupId,
      unitId: toUnitId || emp.unitId,
      floorId: toFloorId || emp.floorId,
      lineId: toLineId || emp.lineId,
      department: toDepartment || emp.department,
      designation: toDesignation || emp.designation,
      workingArea: toWorkingArea || emp.workingArea
    });

    auditService.log(
      'MANPOWER_EMPLOYEE_TRANSFERRED',
      'MANPOWER',
      emp.id,
      `Transferred '${emp.name}' [ID #${emp.cardNumber}] from ${fromLoc.locationPath} to ${toLocPath}. Reason: ${transferRecord.reason}`
    );

    return transferRecord;
  }

  getEmployeeTransfers(employeeId = null) {
    let list = storage.getTable(TABLE_NAMES.EMPLOYEE_TRANSFERS) || [];
    if (employeeId) {
      list = list.filter(t => t.employeeId === employeeId);
    }
    return list;
  }

  // =========================================================================
  // LEAVE MANAGEMENT
  // =========================================================================

  async addLeave({
    employeeId,
    leaveType = 'CASUAL',
    startDate = '',
    endDate = '',
    totalDays = 1,
    reason = '',
    status = 'APPROVED'
  }) {
    const emp = this.getEmployeeById(employeeId);
    if (!emp) throw new Error('Employee not found for leave request.');

    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || start;

    const leaveRecord = {
      id: `emp-lv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      cardNumber: emp.cardNumber,
      department: emp.department,
      leaveType: leaveType || 'CASUAL',
      startDate: start,
      endDate: end,
      totalDays: Number(totalDays) || 1,
      reason: (reason || 'Personal Leave').trim(),
      status: status || 'APPROVED',
      appliedAt: new Date().toISOString()
    };

    const leaves = storage.getTable(TABLE_NAMES.EMPLOYEE_LEAVES) || [];
    leaves.unshift(leaveRecord);
    // CONFIRMED WRITE: await Firebase HTTP 200
    const ok = await storage.saveTable(TABLE_NAMES.EMPLOYEE_LEAVES, leaves);
    if (!ok) {
      throw new CloudSaveError('❌ Cloud Save Failed: Leave record was not confirmed by the cloud.');
    }

    // If approved and active today, mark employee ON_LEAVE
    const today = new Date().toISOString().split('T')[0];
    if (status === 'APPROVED' && start <= today && today <= end) {
      await this.updateEmployee(emp.id, { status: 'ON_LEAVE' });
    }

    auditService.log(
      'MANPOWER_LEAVE_LOGGED',
      'MANPOWER',
      emp.id,
      `Logged ${leaveRecord.leaveType} leave for '${emp.name}' (${start} to ${end}).`
    );

    return leaveRecord;
  }

  async updateLeaveStatus(leaveId, newStatus) {
    const leaves = storage.getTable(TABLE_NAMES.EMPLOYEE_LEAVES) || [];
    const leave = leaves.find(l => l.id === leaveId);
    if (!leave) throw new Error('Leave record not found.');

    const oldStatus = leave.status;
    leave.status = newStatus;
    leave.updatedAt = new Date().toISOString();
    // CONFIRMED WRITE: await Firebase HTTP 200
    const ok = await storage.saveTable(TABLE_NAMES.EMPLOYEE_LEAVES, leaves);
    if (!ok) {
      // Rollback
      leave.status = oldStatus;
      delete leave.updatedAt;
      throw new CloudSaveError('❌ Cloud Save Failed: Leave status update was not confirmed by the cloud.');
    }

    // Update employee status if relevant
    const today = new Date().toISOString().split('T')[0];
    if (newStatus === 'APPROVED' && leave.startDate <= today && today <= leave.endDate) {
      await this.updateEmployee(leave.employeeId, { status: 'ON_LEAVE' });
    } else if (newStatus === 'REJECTED' || newStatus === 'COMPLETED') {
      const emp = this.getEmployeeById(leave.employeeId);
      if (emp && emp.status === 'ON_LEAVE') {
        await this.updateEmployee(leave.employeeId, { status: 'ACTIVE' });
      }
    }

    return leave;
  }

  async deleteLeave(leaveId) {
    const leaves = storage.getTable(TABLE_NAMES.EMPLOYEE_LEAVES) || [];
    const leave = leaves.find(l => l.id === leaveId);
    if (!leave) return false;

    const leaveSnapshot = JSON.parse(JSON.stringify(leave));
    storage.delete(TABLE_NAMES.EMPLOYEE_LEAVES, leaveId);
    // CONFIRMED WRITE: await Firebase HTTP 200
    const ok = await storage.saveTable(TABLE_NAMES.EMPLOYEE_LEAVES);
    if (!ok) {
      // Rollback — re-add leave
      const fresh = storage.getTable(TABLE_NAMES.EMPLOYEE_LEAVES) || [];
      fresh.unshift(leaveSnapshot);
      await storage.saveTable(TABLE_NAMES.EMPLOYEE_LEAVES, fresh);
      throw new CloudSaveError('❌ Cloud Save Failed: Leave deletion was not confirmed by the cloud.');
    }

    const emp = this.getEmployeeById(leave.employeeId);
    if (emp && emp.status === 'ON_LEAVE') {
      await this.updateEmployee(leave.employeeId, { status: 'ACTIVE' });
    }

    return true;
  }

  getEmployeeLeaves(employeeId = null) {
    let list = storage.getTable(TABLE_NAMES.EMPLOYEE_LEAVES) || [];
    if (employeeId) {
      list = list.filter(l => l.employeeId === employeeId);
    }
    return list;
  }

  // =========================================================================
  // ANALYTICS & DASHBOARD METRICS
  // =========================================================================

  getManpowerStats() {
    const employees = this.getAllEmployees();
    const total = employees.length;
    const active = employees.filter(e => e.status === 'ACTIVE').length;
    const inactive = employees.filter(e => e.status === 'INACTIVE' || e.status === 'TERMINATED').length;
    const onLeave = employees.filter(e => e.status === 'ON_LEAVE').length;

    // Department-wise distribution
    const deptCounts = {};
    employees.forEach(e => {
      const dept = e.department || 'Unassigned';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });

    // Floor-wise distribution
    const floorCounts = {};
    employees.forEach(e => {
      const flr = e.floorName || 'General Floor';
      floorCounts[flr] = (floorCounts[flr] || 0) + 1;
    });

    return {
      total,
      active,
      inactive,
      onLeave,
      deptCounts,
      floorCounts
    };
  }

  // =========================================================================
  // EXCEL IMPORT & EXPORT HUB WITH FLEXIBLE CARD & PROMOTION AUTO-DETECTION
  // =========================================================================

  /**
   * Flexible employee finder by Card Number or ID.
   * Auto-detects worker vs staff formats:
   * - Staff with hyphen: 'AMG-0144768'
   * - Worker without hyphen: 'AMG0144768'
   * - Pure numeric digits: '0144768', '144768', '1042'
   * - Case and whitespace insensitive
   */
  findEmployeeByFlexibleCard(queryCard) {
    if (!queryCard) return null;
    const raw = String(queryCard).trim();
    if (!raw) return null;

    const cleanLower = raw.toLowerCase();
    const list = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];

    // 1. Exact match (case insensitive)
    let exact = list.find(e =>
      String(e.cardNumber || '').trim().toLowerCase() === cleanLower ||
      String(e.id || '').trim().toLowerCase() === cleanLower
    );
    if (exact) return this.enrichEmployee(exact);

    // 2. Alphanumeric match (stripping hyphens, underscores, spaces)
    // E.g. 'AMG0144906' matches 'AMG-0144906'
    const rawAlpha = cleanLower.replace(/[^a-z0-9]/g, '');
    if (rawAlpha.length >= 3) {
      let alphaMatch = list.find(e => {
        const eAlpha = String(e.cardNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const eIdAlpha = String(e.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return eAlpha === rawAlpha || eIdAlpha === rawAlpha;
      });
      if (alphaMatch) return this.enrichEmployee(alphaMatch);
    }

    // 3. Digits match (e.g. '0144906' or '144906' or '1042')
    const rawDigits = raw.replace(/[^\d]/g, '');
    const rawDigitsNoZero = rawDigits.replace(/^0+/, '');
    if (rawDigits.length >= 3) {
      let digitMatch = list.find(e => {
        const eDigits = String(e.cardNumber || '').replace(/[^\d]/g, '');
        const eDigitsNoZero = eDigits.replace(/^0+/, '');
        return eDigits === rawDigits ||
          (rawDigitsNoZero && eDigitsNoZero === rawDigitsNoZero) ||
          (rawDigits.length >= 5 && eDigits.endsWith(rawDigits)) ||
          (eDigits.length >= 5 && rawDigits.endsWith(eDigits));
      });
      if (digitMatch) return this.enrichEmployee(digitMatch);
    }

    return null;
  }

  exportManpowerData(filters = {}) {
    const employees = this.getAllEmployees(filters);
    const customFields = employeeCustomFieldService.getActiveFields();

    return employees.map((emp, index) => {
      const row = {
        'Sl.': index + 1,
        'Employee / Card ID': emp.cardNumber,
        'Full Name': emp.name,
        'Designation': emp.designation,
        'Department': emp.department,
        'Factory / Unit': emp.unitName || '',
        'Plant Floor': emp.floorName || emp.floor || '',
        'Line / Working Area': emp.workingArea || emp.lineName || '',
        'Phone Number': emp.phone || '',
        'Joining Date': emp.joinDate || '',
        'Status': emp.status
      };

      // Append active dynamic custom fields
      customFields.forEach(cf => {
        row[cf.label] = emp.customFields ? (emp.customFields[cf.code] ?? '') : '';
      });

      return row;
    });
  }

  /**
   * Generates a sample template array for downloading Excel template
   */
  generateManpowerTemplateData() {
    return [
      {
        'Sl.': 1,
        'Employee / Card ID': 'AMG-0144970',
        'Full Name': 'Md. Shamim Hossain',
        'Designation': 'Senior Mechanic',
        'Department': 'Mechanical Maintenance',
        'Factory / Unit': 'AKM Knit Wear Ltd.',
        'Plant Floor': 'Sewing - Model Line',
        'Line / Working Area': 'Sewing - Model Line',
        'Phone Number': '+880 1635-667788',
        'Joining Date': '2020-11-12',
        'Status': 'ACTIVE'
      },
      {
        'Sl.': 2,
        'Employee / Card ID': 'AMG0144906',
        'Full Name': 'Md. Jahid Khan',
        'Designation': 'Assistant Mechanic (W)',
        'Department': 'Mechanical Maintenance',
        'Factory / Unit': 'Pacific Blue (Jeans Wear) Ltd.',
        'Plant Floor': 'Special M/C (P.A)',
        'Line / Working Area': 'Special M/C (P.A)',
        'Phone Number': '+880 1724-556677',
        'Joining Date': '2023-03-01',
        'Status': 'ACTIVE'
      },
      {
        'Sl.': 3,
        'Employee / Card ID': 'AMG-0147075',
        'Full Name': 'Ashraful Alam Shahed',
        'Designation': 'Senior Mechanic',
        'Department': 'Mechanical Maintenance',
        'Factory / Unit': 'Al-Muslim Apparels Ltd.',
        'Plant Floor': 'Sewing - Jamuna',
        'Line / Working Area': 'Sewing - Jamuna',
        'Phone Number': '+880 1712-345678',
        'Joining Date': '2021-04-10',
        'Status': 'ACTIVE'
      }
    ];
  }

  /**
   * Helper to extract cell values matching any of the candidate header names
   */
  _extractCell(row, candidateKeys) {
    if (!row || typeof row !== 'object') return '';
    const rowKeys = Object.keys(row);
    for (const cand of candidateKeys) {
      const candNorm = String(cand).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const k of rowKeys) {
        const kNorm = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (kNorm === candNorm && row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
      }
    }
    return '';
  }

  /**
   * Previews parsed Excel rows before applying changes:
   * Counts how many records will be updated, how many promotions detected,
   * how many unit/floor transfers detected, how many new employees to add.
   */
  previewManpowerImport(rows = []) {
    let updatedCount = 0;
    let addedCount = 0;
    let promotedCount = 0;
    let transferredCount = 0;
    let samplePromotions = [];
    let sampleTransfers = [];
    let sampleAdded = [];
    let errors = [];

    rows.forEach((row, idx) => {
      const cardNumber = this._extractCell(row, [
        'Employee / Card ID', 'Card ID', 'Card Number', 'Card No', 'Card', 'ID',
        'ID Number', 'ID Card', 'Employee ID', 'Emp ID', 'কার্ড নং', 'আইডি'
      ]);
      const name = this._extractCell(row, [
        'Full Name', 'Name', 'Employee Name', 'Worker Name', 'Staff Name',
        'Mechanic Name', 'নাম', 'কর্মীর নাম'
      ]);

      if (!cardNumber && !name) {
        return; // Skip empty rows
      }

      if (!cardNumber) {
        errors.push(`Row ${idx + 1}: Missing Card Number/ID.`);
        return;
      }

      const designation = this._extractCell(row, ['Designation', 'Designation Name', 'Position', 'Rank', 'পদবী', 'পদবি']);
      const unit = this._extractCell(row, [
        'Factory / Unit', 'Factory/Unit', 'Unit / Factory', 'Unit/Factory',
        'Unit', 'Factory', 'Plant', 'Company', 'Unit Name', 'Factory Name',
        'Company Name', 'Plant Unit', 'ইউনিট', 'কারখানা', 'প্রতিষ্ঠান'
      ]);
      const workingArea = this._extractCell(row, ['Line / Working Area', 'Working Area', 'Area', 'Line', 'Line Name', 'Section', 'কর্মক্ষেত্র', 'লাইন', 'সেকশন']);
      const floor = this._extractCell(row, ['Plant Floor', 'Floor', 'Floor Name', 'ফ্লোর']);

      const matchedUnit = this.resolveUnitFromMasterData(unit);
      const existing = this.findEmployeeByFlexibleCard(cardNumber);
      if (existing) {
        updatedCount++;
        // Check promotion (designation change)
        if (designation && existing.designation && designation.toLowerCase() !== existing.designation.toLowerCase()) {
          promotedCount++;
          if (samplePromotions.length < 5) {
            samplePromotions.push({
              name: existing.name,
              card: existing.cardNumber,
              newCard: cardNumber,
              from: existing.designation,
              to: designation
            });
          }
        }
        // Check transfer (unit / floor / working area change)
        const currentLoc = [existing.unitName, existing.floorName || existing.workingArea].filter(Boolean).join(' • ');
        const targetUnitName = matchedUnit ? matchedUnit.name : (unit || '');
        const newLoc = [targetUnitName, floor || workingArea].filter(Boolean).join(' • ');
        if (newLoc && currentLoc && currentLoc.toLowerCase() !== newLoc.toLowerCase()) {
          transferredCount++;
          if (sampleTransfers.length < 5) {
            sampleTransfers.push({
              name: existing.name,
              card: existing.cardNumber,
              fromLoc: currentLoc || 'General',
              toLoc: newLoc
            });
          }
        }
      } else {
        addedCount++;
        if (sampleAdded.length < 5) {
          sampleAdded.push({
            name: name || `Employee #${cardNumber}`,
            card: cardNumber,
            designation: designation || 'Technician',
            unit: matchedUnit?.name || unit || ''
          });
        }
      }
    });

    return {
      totalRows: rows.length,
      updatedCount,
      promotedCount,
      transferredCount,
      addedCount,
      samplePromotions,
      sampleTransfers,
      sampleAdded,
      errors
    };
  }

  /**
   * Bulk imports manpower data from Excel:
   * 1. Matches employee by Card Number flexibly (supporting both worker 'AMG0000000' and staff 'AMG-0000000' hyphen formats)
   * 2. Resolves Factory / Unit, Floor, and Line from Master Data Hierarchy
   * 3. Auto-updates designations (promotions), units, working areas, plant floors, departments, phones, status
   * 4. Creates new employees with correct Plant Hierarchy linking
   * 5. Immediately synchronizes Tools Management allocations so ID Card printouts and registers update automatically!
   */
  importManpowerData(rows = []) {
    let addedCount = 0;
    let updatedCount = 0;
    let promotedCount = 0;
    let transferredCount = 0;
    let promotionsList = [];
    let transfersList = [];
    let addedList = [];
    let errors = [];

    const customFields = employeeCustomFieldService.getActiveFields();

    rows.forEach((row, idx) => {
      try {
        const cardNumber = this._extractCell(row, [
          'Employee / Card ID', 'Card ID', 'Card Number', 'Card No', 'Card', 'ID',
          'ID Number', 'ID Card', 'Employee ID', 'Emp ID', 'Staff ID', 'কার্ড নং', 'আইডি'
        ]);

        const name = this._extractCell(row, [
          'Full Name', 'Name', 'Employee Name', 'Worker Name', 'Staff Name',
          'Technician Name', 'Mechanic Name', 'নাম', 'কর্মীর নাম'
        ]);

        if (!cardNumber && !name) {
          return; // Skip blank lines
        }

        if (!cardNumber) {
          errors.push(`Row ${idx + 1}: Employee / Card ID is required.`);
          return;
        }

        const designation = this._extractCell(row, ['Designation', 'Designation Name', 'Position', 'Rank', 'Job Title', 'পদবী', 'পদবি']);
        const department = this._extractCell(row, ['Department', 'Dept', 'Department Name', 'Section', 'বিভাগ']);
        const unit = this._extractCell(row, [
          'Factory / Unit', 'Factory/Unit', 'Unit / Factory', 'Unit/Factory',
          'Unit', 'Factory', 'Plant', 'Company', 'Unit Name', 'Factory Name',
          'Company Name', 'Plant Unit', 'ইউনিট', 'কারখানা', 'প্রতিষ্ঠান'
        ]);
        const workingArea = this._extractCell(row, ['Line / Working Area', 'Working Area', 'Area', 'Line', 'Line Name', 'Production Bay', 'Section', 'কর্মক্ষেত্র', 'লাইন', 'সেকশন']);
        const floor = this._extractCell(row, ['Plant Floor', 'Floor', 'Floor Name', 'ফ্লোর']);
        const phone = this._extractCell(row, ['Phone Number', 'Phone', 'Mobile', 'Mobile No', 'Contact Number', 'Contact', 'মোবাইল', 'ফোন']);
        const joinDate = this._extractCell(row, ['Joining Date', 'Join Date', 'DOJ', 'Date of Joining', 'যোগদানের তারিখ']);
        const rawStatus = this._extractCell(row, ['Status', 'Employment Status', 'Active', 'স্ট্যাটাস']).toUpperCase();
        const status = (rawStatus === 'INACTIVE' || rawStatus === 'TERMINATED' || rawStatus === 'ON_LEAVE') ? rawStatus : 'ACTIVE';

        // Master Data Plant Hierarchy Resolution (Unit -> Floor -> Line)
        let matchedUnit = this.resolveUnitFromMasterData(unit);
        let matchedFloor = this.resolveFloorFromMasterData(floor, matchedUnit?.id);
        if (!matchedUnit && matchedFloor && matchedFloor.unitId) {
          matchedUnit = masterDataService.getUnitById ? masterDataService.getUnitById(matchedFloor.unitId) : null;
        }
        let matchedLine = this.resolveLineFromMasterData(workingArea, matchedFloor?.id, matchedUnit?.id);
        if (!matchedFloor && matchedLine && matchedLine.floorId) {
          matchedFloor = masterDataService.getFloorById ? masterDataService.getFloorById(matchedLine.floorId) : null;
          if (!matchedUnit && matchedFloor && matchedFloor.unitId) {
            matchedUnit = masterDataService.getUnitById ? masterDataService.getUnitById(matchedFloor.unitId) : null;
          }
        }

        const resolvedUnitId = matchedUnit?.id || matchedFloor?.unitId || null;
        const resolvedGroupId = matchedUnit?.groupId || (matchedFloor?.unitId ? masterDataService.getUnitById?.(matchedFloor.unitId)?.groupId : null) || 'grp-1';

        // Dynamic custom fields extraction
        const empCustomFields = {};
        customFields.forEach(cf => {
          const val = row[cf.label] !== undefined ? row[cf.label] : row[cf.code];
          if (val !== undefined && String(val).trim() !== '') {
            empCustomFields[cf.code] = String(val).trim();
          }
        });

        // 1. Flexible Card Lookup (Worker AMG0000000 <-> Staff AMG-0000000)
        const existing = this.findEmployeeByFlexibleCard(cardNumber);

        if (existing) {
          const updates = {};
          if (name && name !== existing.name) updates.name = name;
          if (department && department !== existing.department) updates.department = department;
          if (phone && phone !== existing.phone) updates.phone = phone;
          if (joinDate && joinDate !== existing.joinDate) updates.joinDate = joinDate;
          if (status && status !== existing.status) updates.status = status;

          // Designation change (Promotion)
          if (designation && designation.toLowerCase() !== (existing.designation || '').toLowerCase()) {
            updates.designation = designation;
            promotedCount++;
            promotionsList.push({
              name: existing.name,
              card: existing.cardNumber,
              from: existing.designation,
              to: designation
            });
          }

          // Unit, Floor, and Working Area change (Relocation / Transfer)
          if (resolvedUnitId && resolvedUnitId !== existing.unitId) {
            updates.unitId = resolvedUnitId;
            updates.groupId = resolvedGroupId;
            updates.unitName = matchedUnit?.name || unit || '';
            transferredCount++;
            transfersList.push({
              name: existing.name,
              card: existing.cardNumber,
              from: existing.unitName || 'Unassigned',
              to: updates.unitName
            });
          }
          if (matchedFloor && matchedFloor.id !== existing.floorId) {
            updates.floorId = matchedFloor.id;
            if (!updates.unitId && matchedFloor.unitId) {
              updates.unitId = matchedFloor.unitId;
              updates.groupId = matchedFloor.groupId || resolvedGroupId;
            }
          }
          if (matchedLine && matchedLine.id !== existing.lineId) {
            updates.lineId = matchedLine.id;
          }
          if (workingArea && workingArea !== existing.workingArea) {
            updates.workingArea = workingArea;
          }

          // Card Format Upgrade: If worker promoted to staff with hyphen (e.g. AMG0144906 -> AMG-0144906)
          if (cardNumber && cardNumber !== existing.cardNumber) {
            if (!this.checkDuplicateCardNumber(cardNumber, existing.id)) {
              updates.cardNumber = cardNumber;
            }
          }

          if (Object.keys(empCustomFields).length > 0) {
            updates.customFields = empCustomFields;
          }

          this.updateEmployee(existing.id, updates);
          updatedCount++;

        } else {
          // Register new employee
          const newEmpData = {
            name: name || `Employee #${cardNumber}`,
            cardNumber,
            designation: designation || 'Senior Machine Operator',
            department: department || 'Sewing & Assembly',
            groupId: resolvedGroupId,
            unitId: resolvedUnitId,
            unitName: matchedUnit?.name || unit || '',
            floorId: matchedFloor?.id || null,
            lineId: matchedLine?.id || null,
            workingArea: workingArea || (matchedFloor?.name || floor || ''),
            phone: phone || '',
            joinDate: joinDate || new Date().toISOString().split('T')[0],
            status: status || 'ACTIVE',
            customFields: empCustomFields
          };

          const created = this.createEmployee(newEmpData);
          addedCount++;
          addedList.push({
            name: created.name,
            card: created.cardNumber,
            designation: created.designation,
            unit: created.unitName
          });
        }
      } catch (err) {
        errors.push(`Row ${idx + 1}: ${err.message}`);
      }
    });

    // 2. Automatically synchronize Tools Management allocations with newly updated Manpower
    let toolsSynced = 0;
    try {
      const ts = (typeof window !== 'undefined' && window.toolService) ? window.toolService : null;
      if (ts && typeof ts.syncAllocationsWithManpower === 'function') {
        const syncRes = ts.syncAllocationsWithManpower();
        toolsSynced = syncRes?.updatedCount || 0;
      }
    } catch (syncErr) {
      console.warn('Auto-sync with Tools Management after Manpower import:', syncErr);
    }

    auditService.log(
      'MANPOWER_EXCEL_IMPORTED',
      'MANPOWER',
      'BULK_IMPORT',
      `Bulk imported Excel: ${updatedCount} updated (${promotedCount} promotions, ${transfersList.length} transfers), ${addedCount} added. Tools synced: ${toolsSynced}.`
    );

    return {
      addedCount,
      updatedCount,
      promotedCount,
      transferredCount,
      promotionsList,
      transfersList,
      addedList,
      toolsSynced,
      errors
    };
  }
}

export const employeeService = new EmployeeService();
if (typeof window !== 'undefined') {
  window.employeeService = employeeService;
}
