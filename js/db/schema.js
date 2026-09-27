/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Database Schema Definitions, Permissions & Validation Rules
 */

export const SCHEMA_VERSION = '1.9.0';

export const TABLE_NAMES = {
  GROUPS: 'groups',
  UNITS: 'units',
  FLOORS: 'floors',
  LINES: 'lines',
  CATEGORIES: 'categories',
  MACHINE_NAMES: 'machine_names',
  BRANDS: 'brands',
  MODELS: 'models',
  MACHINES: 'machines',
  CUSTOM_FIELDS: 'custom_fields',
  EXCEL_STRUCTURES: 'excel_structures',
  IMPORT_HISTORY: 'import_history',
  USERS: 'users',
  APPROVAL_REQUESTS: 'approval_requests',
  TRANSFERS: 'transfers',
  TRANSFER_REQUESTS: 'transfer_requests',
  TRANSFER_WORKFLOWS: 'transfer_workflows',
  MACHINE_HISTORY: 'machine_history',
  SPARE_PARTS: 'spare_parts',
  SPARE_PARTS_MASTER: 'spare_parts_master',
  ET_BOARDS: 'et_boards',
  ET_BOARD_HISTORY: 'et_board_history',
  ET_COMPANIES: 'et_companies',
  ET_CATEGORIES: 'et_categories',
  ET_TECHNICIANS: 'et_technicians',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  DOCUMENTS: 'documents',
  ROLES: 'roles',
  EMPLOYEES: 'employees',
  EMPLOYEE_CUSTOM_FIELDS: 'employee_custom_fields',
  EMPLOYEE_TRANSFERS: 'employee_transfers',
  EMPLOYEE_LEAVES: 'employee_leaves',
  HOMEPAGE_CONFIG: 'homepage_config',
  TOOLS_MASTER: 'tools_master',
  ACCESSORIES_MASTER: 'accessories_master',
  TOOL_ALLOCATIONS: 'tool_allocations',
  TOOL_CHANGE_HISTORY: 'tool_change_history',
  STORAGE_MASTER: 'storage_master',
  STORAGE_CORRECTION_RULES: 'storage_correction_rules',
  PREVENTIVE_CONFIG: 'preventive_config',
  PREVENTIVE_MAINTENANCE: 'preventive_maintenance',
  RELOCATE_SESSIONS: 'relocate_sessions',
  RELOCATION_HISTORY: 'relocation_history',
  RELOCATION_APPROVALS: 'relocation_approvals',
  PERMISSION_PRESETS: 'permission_presets'
};

/**
 * Detailed Permission Modules and Applicable Action Definitions
 */
export const PERMISSION_MODULES = [
  {
    id: 'tools_management',
    name: 'Tools & Equipment Management',
    icon: '🧰',
    description: 'Mechanic tool sets, accessory allocation, historical registrations, tool replacement & SOP printable receipts',
    actions: [
      { code: 'VIEW', label: 'View Allocations', desc: 'Browse tool allocations and employee history' },
      { code: 'ALLOCATE', label: 'Allocate Tools', desc: 'Assign equipment to mechanics' },
      { code: 'REPLACE', label: 'Replace / Return Tools', desc: 'Record broken tool replacement and returns' },
      { code: 'MASTER_CONFIG', label: 'Manage Master Catalog', desc: 'Add/edit tools and accessories inventory' },
      { code: 'IMPORT', label: 'Import Excel', desc: 'Bulk import allocations or catalog from Excel' },
      { code: 'EXPORT', label: 'Export Excel', desc: 'Export allocation history and catalog' },
      { code: 'PRINT', label: 'Print Receipts', desc: 'Generate A4 SOP sheets and pocket bag slips' }
    ]
  },
  {
    id: 'machines',
    name: 'Machine Inventory',
    icon: '🏭',
    description: 'Master machine registry, plant location assignments, equipment specs & barcode tags',
    actions: [
      { code: 'VIEW', label: 'View Machines', desc: 'Browse inventory list' },
      { code: 'SEARCH', label: 'Search Machines', desc: 'Filter by serial, model, brand' },
      { code: 'DETAILS', label: 'View Machine Details', desc: 'Inspect specs and barcode' },
      { code: 'ADD', label: 'Add Machine', desc: 'Create new machine records' },
      { code: 'EDIT', label: 'Edit Machine', desc: 'Modify machine specs and status' },
      { code: 'DELETE', label: 'Delete Machine', desc: 'Permanently remove machine records' },
      { code: 'IMPORT', label: 'Import Machine Excel', desc: 'Bulk upload XLSX datasets' },
      { code: 'EXPORT', label: 'Export Machine Excel', desc: 'Download filtered Excel/PDF' }
    ]
  },
  {
    id: 'relocate',
    name: 'Machine Relocate & Verification',
    icon: '📍',
    description: 'Floor/Line physical verification, QR code live mobile scanning, automated idle machine identification, and relocation reconciliation with approval workflow',
    actions: [
      { code: 'VIEW', label: 'View Relocate System', desc: 'Access relocation dashboard and active sessions' },
      { code: 'SCAN', label: 'Perform Physical Scan', desc: 'Scan machines via QR code or manual search in verification sessions' },
      { code: 'COMPLETE_SESSION', label: 'Complete Verification Session', desc: 'Finalize scan sessions and trigger automatic idle reconciliation' },
      { code: 'APPROVE', label: 'Approve Relocations', desc: 'Approve or reject inter-floor relocation requests' },
      { code: 'VIEW_HISTORY', label: 'View Relocation History', desc: 'Browse comprehensive relocation audit timeline and past sessions' }
    ]
  },
  {
    id: 'transfers',
    name: 'Machine Transfer',
    icon: '🔄',
    description: 'Plant relocation workflows, transfer requests, reviews & gate passes',
    actions: [
      { code: 'VIEW', label: 'View Transfers', desc: 'Browse relocation requests' },
      { code: 'CREATE_REQUEST', label: 'Create Transfer Request', desc: 'Submit relocation requests' },
      { code: 'EDIT_REQUEST', label: 'Edit Transfer Request', desc: 'Update pending requests' },
      { code: 'CANCEL_REQUEST', label: 'Cancel Transfer Request', desc: 'Withdraw pending requests' },
      { code: 'APPROVE', label: 'Approve Transfer', desc: 'Authorize transfer steps' },
      { code: 'REJECT', label: 'Reject Transfer', desc: 'Decline transfer requests' },
      { code: 'DIRECT_TRANSFER', label: 'Direct Transfer', desc: 'Relocate machine without workflow' },
      { code: 'VIEW_HISTORY', label: 'View Transfer History', desc: 'Audit past location moves' },
      { code: 'EXPORT', label: 'Export Transfer Report', desc: 'Download relocation Excel sheets' }
    ]
  },
  {
    id: 'spare_parts',
    name: 'Spare Parts Management',
    icon: '🔧',
    description: 'Master catalog, stock inventory, and machine replacement records',
    actions: [
      { code: 'VIEW', label: 'View Spare Parts', desc: 'Browse catalog and stock' },
      { code: 'SEARCH', label: 'Search Spare Parts', desc: 'Find parts by item code or name' },
      { code: 'ADD', label: 'Add Spare Part Master', desc: 'Create new parts in catalog' },
      { code: 'EDIT', label: 'Edit Spare Part Master', desc: 'Update part prices and specs' },
      { code: 'DELETE', label: 'Delete Spare Part', desc: 'Remove parts from catalog' },
      { code: 'IMPORT', label: 'Import Parts Excel', desc: 'Bulk upload spare parts' },
      { code: 'EXPORT', label: 'Export Parts Excel', desc: 'Export spare parts catalog' },
      { code: 'ADD_REPLACEMENT', label: 'Add Replacement Entry', desc: 'Log parts fitted to a machine' },
      { code: 'EDIT_REPLACEMENT', label: 'Edit Replacement Entry', desc: 'Modify fitted parts records' },
      { code: 'DELETE_REPLACEMENT', label: 'Delete Replacement Entry', desc: 'Remove replacement records' },
      { code: 'VIEW_HISTORY', label: 'View Spare Parts History', desc: 'Review parts usage history' }
    ]
  },
  {
    id: 'machine_history',
    name: 'Machine History & Passport',
    icon: '📜',
    description: 'Complete lifetime lifecycle, service history, and parts log',
    actions: [
      { code: 'VIEW_LIFETIME', label: 'View Lifetime History', desc: 'Access full machine lifecycle' },
      { code: 'VIEW_TRANSFER_HISTORY', label: 'View Location Changes', desc: 'Historical relocation logs' },
      { code: 'VIEW_SERVICE_HISTORY', label: 'View Service History', desc: 'Repairs and servicing logs' },
      { code: 'VIEW_PARTS_HISTORY', label: 'View Parts Replaced', desc: 'Installed spare parts history' },
      { code: 'ADD_SERVICE', label: 'Add Service/Repair Entry', desc: 'Log repairs and maintenance' },
      { code: 'EDIT_HISTORY', label: 'Edit History Record', desc: 'Modify past event records' },
      { code: 'DELETE_HISTORY', label: 'Delete History Record', desc: 'Remove past event records' },
      { code: 'EXPORT', label: 'Export Machine History', desc: 'Download passport PDF/Excel' }
    ]
  },
  {
    id: 'reports',
    name: 'Reports & Analytics Hub',
    icon: '📊',
    description: 'Departmental reports, KPIs, line allocations, and Excel downloads',
    actions: [
      { code: 'VIEW_MACHINE_REPORT', label: 'View Machine Report', desc: 'Inspect inventory statistics' },
      { code: 'VIEW_TRANSFER_REPORT', label: 'View Transfer Report', desc: 'Inspect transfer audit sheets' },
      { code: 'VIEW_PARTS_REPORT', label: 'View Spare Parts Report', desc: 'Inspect parts usage stats' },
      { code: 'VIEW_HISTORY_REPORT', label: 'View Lifetime History Report', desc: 'Inspect lifecycle summaries' },
      { code: 'EXPORT_MACHINE_REPORT', label: 'Export Machine Report', desc: 'Download machine report Excel' },
      { code: 'EXPORT_TRANSFER_REPORT', label: 'Export Transfer Report', desc: 'Download transfer report Excel' },
      { code: 'EXPORT_PARTS_REPORT', label: 'Export Spare Parts Report', desc: 'Download parts report Excel' },
      { code: 'EXPORT_HISTORY_REPORT', label: 'Export Lifetime Report', desc: 'Download history report Excel' }
    ]
  },
  {
    id: 'excel_import',
    name: 'Excel Import & Export Center',
    icon: '📥',
    description: 'Bulk Excel operations, schema column matching, and export routines',
    actions: [
      { code: 'MACHINE_IMPORT', label: 'Import Machines Excel', desc: 'Upload machines XLSX' },
      { code: 'MACHINE_EXPORT', label: 'Export Machines Excel', desc: 'Download inventory XLSX' },
      { code: 'PARTS_IMPORT', label: 'Import Spare Parts Excel', desc: 'Upload parts master XLSX' },
      { code: 'PARTS_EXPORT', label: 'Export Spare Parts Excel', desc: 'Download parts XLSX' },
      { code: 'TRANSFER_EXPORT', label: 'Export Transfers Excel', desc: 'Download transfer XLSX' },
      { code: 'REPORT_EXPORT', label: 'Export Reports Excel', desc: 'Download reports XLSX' }
    ]
  },
  {
    id: 'user_management',
    name: 'Users & Permissions Administration',
    icon: '👥',
    description: 'Super Admin user accounts, role definitions, and access matrix',
    actions: [
      { code: 'VIEW_USERS', label: 'View Users', desc: 'List employee accounts' },
      { code: 'ADD_USER', label: 'Add User Account', desc: 'Create new users' },
      { code: 'EDIT_USER', label: 'Edit User Account', desc: 'Update details and passwords' },
      { code: 'DEACTIVATE_USER', label: 'Deactivate User', desc: 'Suspend user accounts' },
      { code: 'DELETE_USER', label: 'Delete User', desc: 'Permanently remove accounts' },
      { code: 'RESET_PASSWORD', label: 'Reset User Password', desc: 'Generate new passwords' },
      { code: 'ASSIGN_ROLE', label: 'Assign Roles', desc: 'Change user assigned roles' },
      { code: 'MANAGE_PERMISSIONS', label: 'Manage Roles & Matrix', desc: 'Configure custom roles and permissions' }
    ]
  },
  {
    id: 'admin_config',
    name: 'System Configuration & Master Data',
    icon: '⚙️',
    description: 'Factory plant hierarchy, custom fields, machine types, and workflow rules',
    actions: [
      { code: 'MACHINE_CONFIG', label: 'Machine Configuration', desc: 'Machine types, brands, models' },
      { code: 'LOCATION_CONFIG', label: 'Location Configuration', desc: 'Groups, units, floors, lines' },
      { code: 'PARTS_CONFIG', label: 'Spare Parts Configuration', desc: 'Part categories & suppliers' },
      { code: 'TRANSFER_CONFIG', label: 'Transfer Workflow Builder', desc: 'Multi-level approval rules' },
      { code: 'CUSTOM_FIELDS', label: 'Custom Fields Manager', desc: 'Define dynamic machine fields' },
      { code: 'EXCEL_CONFIG', label: 'Excel Mapping Configuration', desc: 'Map Excel column headers' },
      { code: 'SYSTEM_SETTINGS', label: 'System Settings', desc: 'Global settings & security policies' }
    ]
  },
  {
    id: 'manpower',
    name: 'Manpower Management',
    icon: '👥',
    description: 'Workforce registry, custom fields, employee transfers, leave management, and digital ID cards',
    actions: [
      { code: 'VIEW', label: 'View Manpower', desc: 'Browse employee list and dashboard' },
      { code: 'SEARCH', label: 'Search Employees', desc: 'Filter by ID, department, custom fields' },
      { code: 'DETAILS', label: 'View Profile / ID Card', desc: 'Inspect profile and printable ID' },
      { code: 'ADD', label: 'Add Employee', desc: 'Register new employees' },
      { code: 'EDIT', label: 'Edit Employee', desc: 'Modify employee data and custom fields' },
      { code: 'DELETE', label: 'Delete Employee', desc: 'Remove employee records' },
      { code: 'TRANSFER', label: 'Transfer Employee', desc: 'Relocate between floors and units' },
      { code: 'LEAVE_MANAGE', label: 'Manage Leaves', desc: 'Record and approve employee leaves' },
      { code: 'CUSTOM_FIELDS', label: 'Employee Custom Fields', desc: 'Create dynamic manpower fields' },
      { code: 'IMPORT', label: 'Import Excel', desc: 'Bulk upload employee rosters' },
      { code: 'EXPORT', label: 'Export Excel', desc: 'Download manpower Excel' }
    ]
  },
  {
    id: 'et_lab',
    name: 'ENT Lab Management',
    icon: '⚡',
    description: 'ENT Lab Board/PCB master inventory, machine installation, removal, in-house & external repairs, duplicate bill prevention and lifetime passport',
    actions: [
      { code: 'VIEW', label: 'View Boards & Lab', desc: 'Browse board inventory & status' },
      { code: 'SEARCH', label: 'Search Boards', desc: 'Search by SL, Unit No, Model, P.No, JUKI SL' },
      { code: 'ADD', label: 'Add Board Master', desc: 'Register new boards / parts' },
      { code: 'EDIT', label: 'Edit Board Master', desc: 'Modify board specs & metadata' },
      { code: 'DELETE', label: 'Delete Board', desc: 'Remove or archive board master' },
      { code: 'INSTALL', label: 'Install / Assign Board', desc: 'Assign board to machine' },
      { code: 'REMOVE', label: 'Remove Board', desc: 'Remove board from machine' },
      { code: 'REPAIR_INHOUSE', label: 'In-House Repair', desc: 'Log in-house repair start & completion' },
      { code: 'SEND_EXTERNAL', label: 'Send to External Company', desc: 'Dispatch board to external repair' },
      { code: 'RECEIVE_EXTERNAL', label: 'Receive from External Company', desc: 'Receive board & record duration' },
      { code: 'VIEW_HISTORY', label: 'View Board Lifetime', desc: 'Full lifetime lifecycle passport' },
      { code: 'CONFIG', label: 'Manage Configuration', desc: 'Manage external companies & categories' },
      { code: 'EXPORT', label: 'Export Reports', desc: 'Download Excel, PDF & print passport' }
    ]
  },
  {
    id: 'audit_logs',
    name: 'Audit Trail & Activity Logs',
    icon: '📝',
    description: 'Immutable system audit logs, user session tracking, and change history',
    actions: [
      { code: 'VIEW_LOGS', label: 'View Activity Logs', desc: 'Browse user and system actions' },
      { code: 'EXPORT_LOGS', label: 'Export Activity Logs', desc: 'Export audit logs to Excel' }
    ]
  },
  {
    id: 'storage_management',
    name: 'Storage & Auto-Correction Library',
    icon: '📦',
    description: 'Master storage for machine models, serials, spare parts, tools, location master and intelligent auto-correction engine',
    actions: [
      { code: 'VIEW', label: 'View Storage Master', desc: 'Browse reference storage catalog' },
      { code: 'ADD', label: 'Add Storage Record', desc: 'Add new reference items and models' },
      { code: 'EDIT', label: 'Edit Storage Record', desc: 'Modify reference items and aliases' },
      { code: 'DELETE', label: 'Delete Storage Record', desc: 'Remove reference entries' },
      { code: 'IMPORT', label: 'Import Reference Data', desc: 'Bulk upload Excel/CSV into storage' },
      { code: 'EXPORT', label: 'Export Storage Catalog', desc: 'Download storage data to Excel' },
      { code: 'HEALTH_SCAN', label: 'Run Health Scanner', desc: 'Scan and auto-correct database records' }
    ]
  },
  {
    id: 'preventive_maintenance',
    name: 'Preventive Machine Maintenance',
    icon: '🛡️',
    description: 'Central preventive servicing schedules, auto-sync with inventory, QR scanning, manpower assignment, service stickers, urgency reminders & notifications',
    actions: [
      { code: 'VIEW', label: 'View Schedules & Profiles', desc: 'Browse dashboard, upcoming schedules, and machine profiles' },
      { code: 'CREATE_SERVICE', label: 'Create Service Entry', desc: 'Log servicing completed with checklist and sticker serial' },
      { code: 'EDIT', label: 'Edit Service Record', desc: 'Modify maintenance records and remarks' },
      { code: 'ASSIGN_MANPOWER', label: 'Assign Manpower', desc: 'Assign mechanic or service personnel' },
      { code: 'RESCHEDULE', label: 'Override Next Service Date', desc: 'Manually override or reschedule next maintenance date' },
      { code: 'DELETE', label: 'Delete Service Record', desc: 'Permanently remove maintenance history records' },
      { code: 'CONFIGURATION', label: 'Configure Schedules & Checklists', desc: 'Admin configuration for machine types and intervals' },
      { code: 'NOTIFICATIONS', label: 'Manage Notifications', desc: 'Configure reminder intervals and notification receivers' }
    ]
  }
];

export const MODULES = {
  DASHBOARD: { id: 'dashboard', label: 'Dashboard & KPI', icon: '📊', category: 'Overview', route: 'dashboard' },
  STORAGE: { id: 'storage', label: 'Master Storage', icon: '📦', category: 'Core Operations', route: 'storage' },
  MACHINES: { id: 'machines', label: 'Machine Management', icon: '🧵', category: 'Core Operations', route: 'inventory' },
  MACHINE_HISTORY: { id: 'machine_history', label: 'Machine History', icon: '📜', category: 'Core Operations', route: 'machine-history' },
  PREVENTIVE_MAINTENANCE: { id: 'preventive_maintenance', label: 'Preventive Machine Maintenance', icon: '🛡️', category: 'Core Operations', route: 'preventive-maintenance' },
  TRANSFERS: { id: 'transfers', label: 'Machine Transfers', icon: '🔄', category: 'Core Operations', route: 'transfers' },
  APPROVALS: { id: 'approvals', label: 'Approval Center', icon: '🛡️', category: 'Core Operations', route: 'approvals' },
  ET_LAB: { id: 'et_lab', label: 'ENT Lab Management', icon: '⚡', category: 'Maintenance', route: 'et-lab' },
  SPARE_PARTS: { id: 'spare_parts', label: 'Spare Parts Management', icon: '⚙️', category: 'Maintenance', route: 'spare-parts' },
  MANPOWER: { id: 'manpower', label: 'Manpower Management', icon: '👥', category: 'Human Resources', route: 'manpower' },
  REPORTS: { id: 'reports', label: 'Reports & Analytics', icon: '📈', category: 'Analytics', route: 'reports' },
  EXCEL_IMPORT: { id: 'excel_import', label: 'Excel Import', icon: '📥', category: 'Data Management', route: 'excel-manager' },
  USER_MANAGEMENT: { id: 'user_management', label: 'User Management', icon: '👥', category: 'Administration', route: 'users' },
  ADMIN_CONFIG: { id: 'admin_config', label: 'Admin Configuration', icon: '🏭', category: 'Administration', route: 'master-data' },
  SYSTEM_SETTINGS: { id: 'system_settings', label: 'System Settings', icon: '⚙️', category: 'Administration', route: 'settings' }
};

export const ACTIONS = {
  VIEW: 'VIEW',
  ADD: 'ADD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT'
};

export const ALL_ACTIONS = ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'];

export const ET_BOARD_STATUSES = {
  AVAILABLE_SPARE: { id: 'AVAILABLE_SPARE', label: 'Available / Spare', badgeClass: 'badge-active', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '🟢' },
  INSTALLED: { id: 'INSTALLED', label: 'Installed', badgeClass: 'badge-info', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.15)', icon: '🧵' },
  UNDER_INHOUSE_REPAIR: { id: 'UNDER_INHOUSE_REPAIR', label: 'Under In-House Repair', badgeClass: 'badge-warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '🔧' },
  SENT_EXTERNAL: { id: 'SENT_EXTERNAL', label: 'Sent to External Company', badgeClass: 'badge-purple', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', icon: '🚚' },
  RETURNED: { id: 'RETURNED', label: 'Returned / Available', badgeClass: 'badge-teal', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)', icon: '📥' },
  REPAIR_ACCEPTED: { id: 'REPAIR_ACCEPTED', label: 'Accepted / Repair Successful', badgeClass: 'badge-active', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '✅' },
  REPAIR_REJECTED: { id: 'REPAIR_REJECTED', label: 'Rejected / Repair Not Successful', badgeClass: 'badge-danger', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '❌' },
  PARTIALLY_REPAIRED: { id: 'PARTIALLY_REPAIRED', label: 'Partially Repaired', badgeClass: 'badge-warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '⚠️' },
  DAMAGED_SCRAP: { id: 'DAMAGED_SCRAP', label: 'Damaged / Scrap', badgeClass: 'badge-danger', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '❌' }
};

export const ET_ACTIONS = {
  CREATE: { id: 'CREATE', label: 'Registered in ENT Lab', icon: '➕', color: '#10b981' },
  EDIT: { id: 'EDIT', label: 'Board Specs Updated', icon: '✏️', color: '#38bdf8' },
  INSTALL: { id: 'INSTALL', label: 'Installed on Machine', icon: '🧵', color: '#0284c7' },
  REMOVE: { id: 'REMOVE', label: 'Removed from Machine', icon: '📤', color: '#f59e0b' },
  INHOUSE_START: { id: 'INHOUSE_START', label: 'Started In-House Repair', icon: '🔧', color: '#f97316' },
  INHOUSE_COMPLETE: { id: 'INHOUSE_COMPLETE', label: 'Completed In-House Repair', icon: '✅', color: '#10b981' },
  SEND_EXTERNAL: { id: 'SEND_EXTERNAL', label: 'Sent to External Company', icon: '🚚', color: '#a855f7' },
  RECEIVE_EXTERNAL: { id: 'RECEIVE_EXTERNAL', label: 'Received from External Company', icon: '📥', color: '#14b8a6' },
  REPAIR_VERIFIED: { id: 'REPAIR_VERIFIED', label: 'Repair Verified & Accepted', icon: '✅', color: '#10b981' },
  REPAIR_REJECTED: { id: 'REPAIR_REJECTED', label: 'Repair Rejected (Not Solved)', icon: '❌', color: '#ef4444' },
  MARK_SCRAP: { id: 'MARK_SCRAP', label: 'Marked as Damaged / Scrap', icon: '❌', color: '#ef4444' }
};

export const DEFAULT_PERMISSION_TEMPLATES = {
  SUPER_ADMIN: {
    machines: ['VIEW', 'SEARCH', 'DETAILS', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
    transfers: ['VIEW', 'CREATE_REQUEST', 'EDIT_REQUEST', 'CANCEL_REQUEST', 'APPROVE', 'REJECT', 'DIRECT_TRANSFER', 'VIEW_HISTORY', 'EXPORT'],
    spare_parts: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'ADD_REPLACEMENT', 'EDIT_REPLACEMENT', 'DELETE_REPLACEMENT', 'VIEW_HISTORY'],
    machine_history: ['VIEW_LIFETIME', 'VIEW_TRANSFER_HISTORY', 'VIEW_SERVICE_HISTORY', 'VIEW_PARTS_HISTORY', 'ADD_SERVICE', 'EDIT_HISTORY', 'DELETE_HISTORY', 'EXPORT'],
    et_lab: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'DELETE', 'INSTALL', 'REMOVE', 'REPAIR_INHOUSE', 'SEND_EXTERNAL', 'RECEIVE_EXTERNAL', 'VIEW_HISTORY', 'CONFIG', 'EXPORT'],
    manpower: ['VIEW', 'SEARCH', 'DETAILS', 'ADD', 'EDIT', 'DELETE', 'TRANSFER', 'LEAVE_MANAGE', 'CUSTOM_FIELDS', 'IMPORT', 'EXPORT'],
    reports: ['VIEW_MACHINE_REPORT', 'VIEW_TRANSFER_REPORT', 'VIEW_PARTS_REPORT', 'VIEW_HISTORY_REPORT', 'EXPORT_MACHINE_REPORT', 'EXPORT_TRANSFER_REPORT', 'EXPORT_PARTS_REPORT', 'EXPORT_HISTORY_REPORT'],
    excel_import: ['MACHINE_IMPORT', 'MACHINE_EXPORT', 'PARTS_IMPORT', 'PARTS_EXPORT', 'TRANSFER_EXPORT', 'REPORT_EXPORT'],
    user_management: ['VIEW_USERS', 'ADD_USER', 'EDIT_USER', 'DEACTIVATE_USER', 'DELETE_USER', 'RESET_PASSWORD', 'ASSIGN_ROLE', 'MANAGE_PERMISSIONS'],
    audit_logs: ['VIEW_LOGS', 'EXPORT_LOGS'],
    document_library: ['VIEW', 'DOWNLOAD', 'ADD', 'EDIT', 'DELETE'],
    tools_management: ['VIEW', 'ALLOCATE', 'REPLACE', 'RETURN', 'MASTER_CONFIG', 'IMPORT', 'EXPORT', 'PRINT'],
    preventive_maintenance: ['VIEW', 'CREATE_SERVICE', 'EDIT', 'ASSIGN_MANPOWER', 'RESCHEDULE', 'DELETE', 'CONFIGURATION', 'NOTIFICATIONS']
  },
  ADMIN: {
    machines: ['VIEW', 'SEARCH', 'DETAILS', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
    transfers: ['VIEW', 'CREATE_REQUEST', 'EDIT_REQUEST', 'APPROVE', 'REJECT', 'DIRECT_TRANSFER', 'VIEW_HISTORY', 'EXPORT'],
    spare_parts: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'ADD_REPLACEMENT', 'EDIT_REPLACEMENT', 'VIEW_HISTORY'],
    machine_history: ['VIEW_LIFETIME', 'VIEW_TRANSFER_HISTORY', 'VIEW_SERVICE_HISTORY', 'VIEW_PARTS_HISTORY', 'ADD_SERVICE', 'EDIT_HISTORY', 'EXPORT'],
    et_lab: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'DELETE', 'INSTALL', 'REMOVE', 'REPAIR_INHOUSE', 'SEND_EXTERNAL', 'RECEIVE_EXTERNAL', 'VIEW_HISTORY', 'CONFIG', 'EXPORT'],
    manpower: ['VIEW', 'SEARCH', 'DETAILS', 'ADD', 'EDIT', 'DELETE', 'TRANSFER', 'LEAVE_MANAGE', 'CUSTOM_FIELDS', 'IMPORT', 'EXPORT'],
    reports: ['VIEW_MACHINE_REPORT', 'VIEW_TRANSFER_REPORT', 'VIEW_PARTS_REPORT', 'VIEW_HISTORY_REPORT', 'EXPORT_MACHINE_REPORT', 'EXPORT_TRANSFER_REPORT', 'EXPORT_PARTS_REPORT', 'EXPORT_HISTORY_REPORT'],
    excel_import: ['MACHINE_IMPORT', 'MACHINE_EXPORT', 'PARTS_IMPORT', 'PARTS_EXPORT', 'TRANSFER_EXPORT', 'REPORT_EXPORT'],
    user_management: ['VIEW_USERS', 'ADD_USER', 'EDIT_USER', 'RESET_PASSWORD'],
    admin_config: ['MACHINE_CONFIG', 'LOCATION_CONFIG', 'PARTS_CONFIG', 'TRANSFER_CONFIG', 'CUSTOM_FIELDS'],
    audit_logs: ['VIEW_LOGS', 'EXPORT_LOGS'],
    document_library: ['VIEW', 'DOWNLOAD', 'ADD', 'EDIT', 'DELETE'],
    tools_management: ['VIEW', 'ALLOCATE', 'REPLACE', 'RETURN', 'MASTER_CONFIG', 'IMPORT', 'EXPORT', 'PRINT'],
    preventive_maintenance: ['VIEW', 'CREATE_SERVICE', 'EDIT', 'ASSIGN_MANPOWER', 'RESCHEDULE', 'CONFIGURATION', 'NOTIFICATIONS']
  },
  MANAGER: {
    machines: ['VIEW', 'SEARCH', 'DETAILS', 'ADD', 'EDIT', 'EXPORT'],
    transfers: ['VIEW', 'CREATE_REQUEST', 'EDIT_REQUEST', 'APPROVE', 'REJECT', 'VIEW_HISTORY', 'EXPORT'],
    spare_parts: ['VIEW', 'SEARCH', 'ADD_REPLACEMENT', 'EDIT_REPLACEMENT', 'VIEW_HISTORY', 'EXPORT'],
    machine_history: ['VIEW_LIFETIME', 'VIEW_TRANSFER_HISTORY', 'VIEW_SERVICE_HISTORY', 'VIEW_PARTS_HISTORY', 'ADD_SERVICE', 'EXPORT'],
    et_lab: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'INSTALL', 'REMOVE', 'REPAIR_INHOUSE', 'SEND_EXTERNAL', 'RECEIVE_EXTERNAL', 'VIEW_HISTORY', 'EXPORT'],
    manpower: ['VIEW', 'SEARCH', 'DETAILS', 'ADD', 'EDIT', 'TRANSFER', 'LEAVE_MANAGE', 'EXPORT'],
    reports: ['VIEW_MACHINE_REPORT', 'VIEW_TRANSFER_REPORT', 'VIEW_PARTS_REPORT', 'VIEW_HISTORY_REPORT', 'EXPORT_MACHINE_REPORT', 'EXPORT_TRANSFER_REPORT', 'EXPORT_PARTS_REPORT', 'EXPORT_HISTORY_REPORT'],
    excel_import: ['MACHINE_EXPORT', 'TRANSFER_EXPORT', 'REPORT_EXPORT'],
    user_management: ['VIEW_USERS'],
    admin_config: [],
    audit_logs: ['VIEW_LOGS'],
    document_library: ['VIEW', 'DOWNLOAD', 'ADD'],
    tools_management: ['VIEW', 'ALLOCATE', 'REPLACE', 'RETURN', 'EXPORT', 'PRINT'],
    preventive_maintenance: ['VIEW', 'CREATE_SERVICE', 'ASSIGN_MANPOWER']
  },
  MAINTENANCE_USER: {
    machines: ['VIEW', 'SEARCH', 'DETAILS'],
    transfers: ['VIEW', 'CREATE_REQUEST', 'VIEW_HISTORY'],
    spare_parts: ['VIEW', 'SEARCH', 'ADD_REPLACEMENT', 'VIEW_HISTORY'],
    machine_history: ['VIEW_LIFETIME', 'VIEW_TRANSFER_HISTORY', 'VIEW_SERVICE_HISTORY', 'VIEW_PARTS_HISTORY', 'ADD_SERVICE'],
    et_lab: ['VIEW', 'SEARCH', 'INSTALL', 'REMOVE', 'REPAIR_INHOUSE', 'VIEW_HISTORY'],
    reports: ['VIEW_MACHINE_REPORT', 'VIEW_TRANSFER_REPORT', 'VIEW_PARTS_REPORT', 'EXPORT_MACHINE_REPORT'],
    excel_import: ['MACHINE_EXPORT'],
    user_management: [],
    admin_config: [],
    audit_logs: [],
    document_library: ['VIEW', 'DOWNLOAD'],
    tools_management: ['VIEW', 'ALLOCATE', 'REPLACE', 'PRINT'],
    preventive_maintenance: ['VIEW', 'CREATE_SERVICE', 'ASSIGN_MANPOWER']
  },
  STORE_USER: {
    machines: ['VIEW', 'SEARCH'],
    transfers: ['VIEW', 'VIEW_HISTORY'],
    spare_parts: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'IMPORT', 'EXPORT', 'ADD_REPLACEMENT', 'VIEW_HISTORY'],
    machine_history: ['VIEW_PARTS_HISTORY'],
    et_lab: ['VIEW', 'SEARCH', 'ADD', 'EDIT', 'VIEW_HISTORY', 'EXPORT'],
    reports: ['VIEW_PARTS_REPORT', 'EXPORT_PARTS_REPORT'],
    excel_import: ['PARTS_IMPORT', 'PARTS_EXPORT'],
    user_management: [],
    admin_config: [],
    audit_logs: [],
    document_library: ['VIEW', 'DOWNLOAD'],
    tools_management: ['VIEW', 'ALLOCATE', 'REPLACE', 'RETURN', 'MASTER_CONFIG', 'IMPORT', 'EXPORT', 'PRINT'],
    preventive_maintenance: ['VIEW']
  },
  VIEWER: {
    machines: ['VIEW', 'SEARCH', 'DETAILS'],
    transfers: ['VIEW', 'VIEW_HISTORY'],
    spare_parts: ['VIEW', 'SEARCH', 'VIEW_HISTORY'],
    machine_history: ['VIEW_LIFETIME', 'VIEW_TRANSFER_HISTORY', 'VIEW_SERVICE_HISTORY', 'VIEW_PARTS_HISTORY'],
    et_lab: ['VIEW', 'SEARCH', 'VIEW_HISTORY'],
    reports: ['VIEW_MACHINE_REPORT', 'VIEW_TRANSFER_REPORT', 'VIEW_PARTS_REPORT', 'VIEW_HISTORY_REPORT'],
    excel_import: [],
    user_management: [],
    admin_config: [],
    audit_logs: [],
    document_library: ['VIEW'],
    tools_management: ['VIEW', 'PRINT']
  },
  USER: {
    machines: ['VIEW', 'SEARCH', 'DETAILS', 'EXPORT'],
    transfers: ['VIEW', 'CREATE_REQUEST', 'VIEW_HISTORY', 'EXPORT'],
    spare_parts: ['VIEW', 'SEARCH', 'ADD_REPLACEMENT', 'VIEW_HISTORY'],
    machine_history: ['VIEW_LIFETIME', 'VIEW_TRANSFER_HISTORY', 'VIEW_SERVICE_HISTORY', 'VIEW_PARTS_HISTORY', 'ADD_SERVICE', 'EXPORT'],
    et_lab: ['VIEW', 'SEARCH', 'INSTALL', 'REMOVE', 'REPAIR_INHOUSE', 'SEND_EXTERNAL', 'RECEIVE_EXTERNAL', 'VIEW_HISTORY', 'EXPORT'],
    reports: ['VIEW_MACHINE_REPORT', 'VIEW_TRANSFER_REPORT', 'VIEW_PARTS_REPORT', 'EXPORT_MACHINE_REPORT', 'EXPORT_TRANSFER_REPORT'],
    excel_import: ['MACHINE_EXPORT', 'TRANSFER_EXPORT'],
    user_management: [],
    admin_config: [],
    audit_logs: [],
    document_library: ['VIEW', 'DOWNLOAD'],
    tools_management: ['VIEW', 'ALLOCATE', 'REPLACE', 'RETURN', 'EXPORT', 'PRINT']
  }
};

/**
 * Enterprise Pre-configured Permission Presets & Access Profiles
 */
export const DEFAULT_PERMISSION_PRESETS = [
  {
    id: 'preset_super_admin',
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Master system authority with full unrestricted 7-action access across all ERP modules and all factory units.',
    accessLevel: 'Full System Access',
    badgeColor: '#38bdf8',
    icon: '🛡️',
    isSystem: true,
    scope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      transfers: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      relocate: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      qr_codes: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      preventive_maintenance: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      machine_history: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      storage: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      spare_parts: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      tools_management: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      document_library: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      manpower: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      reports: ['VIEW', 'EXPORT'],
      user_management: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      master_data: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      transfer_workflows: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      excel_manager: ['VIEW', 'EDIT', 'EXPORT'],
      audit_logs: ['VIEW', 'EXPORT'],
      settings: ['VIEW', 'EDIT'],
      email_config: ['VIEW', 'EDIT'],
      homepage_management: ['VIEW', 'EDIT']
    }
  },
  {
    id: 'preset_admin',
    code: 'ADMIN',
    name: 'Admin',
    description: 'Central engineering & factory management with operational administration, master data, workflows, and user management.',
    accessLevel: 'Administrative Access',
    badgeColor: '#0ea5e9',
    icon: '👑',
    isSystem: true,
    scope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      transfers: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      relocate: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      qr_codes: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      preventive_maintenance: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'],
      machine_history: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      storage: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      spare_parts: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      tools_management: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      document_library: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'],
      manpower: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      reports: ['VIEW', 'EXPORT'],
      user_management: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      master_data: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'],
      transfer_workflows: ['VIEW', 'ADD', 'EDIT', 'DELETE'],
      excel_manager: ['VIEW', 'EDIT', 'EXPORT'],
      audit_logs: ['VIEW', 'EXPORT'],
      settings: ['VIEW'],
      email_config: ['VIEW', 'EDIT'],
      homepage_management: ['VIEW', 'EDIT']
    }
  },
  {
    id: 'preset_maintenance_manager',
    code: 'MAINTENANCE_MANAGER',
    name: 'Maintenance Manager',
    description: 'Head of maintenance department with full authority over machinery inventory, transfer approvals, PM schedules, and technical analytics.',
    accessLevel: 'Full Maintenance Access',
    badgeColor: '#f59e0b',
    icon: '💼',
    isSystem: true,
    scope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT', 'EXPORT', 'APPROVE'],
      transfers: ['VIEW', 'ADD', 'EDIT', 'EXPORT', 'APPROVE'],
      relocate: ['VIEW', 'ADD', 'EDIT', 'EXPORT', 'APPROVE'],
      qr_codes: ['VIEW', 'EXPORT'],
      preventive_maintenance: ['VIEW', 'ADD', 'EDIT', 'EXPORT', 'APPROVE'],
      machine_history: ['VIEW', 'ADD', 'EXPORT'],
      storage: ['VIEW', 'EXPORT'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      spare_parts: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      tools_management: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      document_library: ['VIEW', 'ADD', 'EXPORT'],
      manpower: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      reports: ['VIEW', 'EXPORT'],
      user_management: ['VIEW'],
      master_data: ['VIEW', 'EXPORT'],
      transfer_workflows: ['VIEW'],
      excel_manager: ['VIEW'],
      audit_logs: ['VIEW'],
      settings: ['VIEW'],
      email_config: ['VIEW'],
      homepage_management: ['VIEW']
    }
  },
  {
    id: 'preset_maintenance_user',
    code: 'MAINTENANCE_USER',
    name: 'Maintenance User',
    description: 'Field mechanical & electrical technicians for PM execution, machine servicing, ENT circuit repairs, and tool allocations.',
    accessLevel: 'Maintenance Module Access',
    badgeColor: '#a855f7',
    icon: '🛠️',
    isSystem: true,
    scope: { allGroups: false, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT'],
      transfers: ['VIEW', 'ADD'],
      relocate: ['VIEW', 'ADD'],
      qr_codes: ['VIEW', 'ADD'],
      preventive_maintenance: ['VIEW', 'ADD', 'EDIT'],
      machine_history: ['VIEW', 'ADD'],
      storage: ['VIEW'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD', 'EDIT'],
      spare_parts: ['VIEW', 'ADD', 'EDIT'],
      tools_management: ['VIEW', 'ADD', 'EDIT'],
      document_library: ['VIEW', 'ADD'],
      manpower: ['VIEW'],
      reports: ['VIEW', 'EXPORT'],
      user_management: [],
      master_data: ['VIEW'],
      transfer_workflows: [],
      excel_manager: [],
      audit_logs: [],
      settings: [],
      email_config: [],
      homepage_management: []
    }
  },
  {
    id: 'preset_maintenance_supervisor',
    code: 'MAINTENANCE_SUPERVISOR',
    name: 'Maintenance Supervisor',
    description: 'Floor maintenance supervisor managing technicians, inspecting breakdown service logs, allocating tools, and monitoring PM tasks.',
    accessLevel: 'Limited Maintenance Access',
    badgeColor: '#06b6d4',
    icon: '👷‍♂️',
    isSystem: true,
    scope: { allGroups: false, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      transfers: ['VIEW', 'ADD', 'EDIT'],
      relocate: ['VIEW', 'ADD', 'EDIT'],
      qr_codes: ['VIEW', 'EXPORT'],
      preventive_maintenance: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      machine_history: ['VIEW', 'ADD', 'EXPORT'],
      storage: ['VIEW'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD', 'EDIT'],
      spare_parts: ['VIEW', 'ADD', 'EDIT'],
      tools_management: ['VIEW', 'ADD', 'EDIT', 'EXPORT'],
      document_library: ['VIEW', 'ADD'],
      manpower: ['VIEW'],
      reports: ['VIEW', 'EXPORT'],
      user_management: [],
      master_data: ['VIEW'],
      transfer_workflows: [],
      excel_manager: [],
      audit_logs: [],
      settings: [],
      email_config: [],
      homepage_management: []
    }
  },
  {
    id: 'preset_contributor',
    code: 'CONTRIBUTOR',
    name: 'Contributor',
    description: 'Authorized staff to create and edit operational records without deletion or approval privileges.',
    accessLevel: 'Add & Edit Access',
    badgeColor: '#10b981',
    icon: '✍️',
    isSystem: true,
    scope: { allGroups: false, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT'],
      transfers: ['VIEW', 'ADD'],
      relocate: ['VIEW', 'ADD'],
      qr_codes: ['VIEW'],
      preventive_maintenance: ['VIEW', 'ADD', 'EDIT'],
      machine_history: ['VIEW', 'ADD'],
      storage: ['VIEW'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD', 'EDIT'],
      spare_parts: ['VIEW', 'ADD', 'EDIT'],
      tools_management: ['VIEW', 'ADD', 'EDIT'],
      document_library: ['VIEW', 'ADD'],
      manpower: ['VIEW'],
      reports: ['VIEW'],
      user_management: [],
      master_data: ['VIEW'],
      transfer_workflows: [],
      excel_manager: [],
      audit_logs: [],
      settings: [],
      email_config: [],
      homepage_management: []
    }
  },
  {
    id: 'preset_viewer',
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access for auditors, factory visitors, and general personnel without modification rights.',
    accessLevel: 'Read Only Access',
    badgeColor: '#64748b',
    icon: '👁️',
    isSystem: true,
    scope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW'],
      transfers: ['VIEW'],
      relocate: ['VIEW'],
      qr_codes: ['VIEW'],
      preventive_maintenance: ['VIEW'],
      machine_history: ['VIEW'],
      storage: ['VIEW'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW'],
      spare_parts: ['VIEW'],
      tools_management: ['VIEW'],
      document_library: ['VIEW'],
      manpower: ['VIEW'],
      reports: ['VIEW'],
      user_management: [],
      master_data: ['VIEW'],
      transfer_workflows: [],
      excel_manager: [],
      audit_logs: [],
      settings: [],
      email_config: [],
      homepage_management: []
    }
  },
  {
    id: 'preset_custom_access',
    code: 'CUSTOM_ACCESS',
    name: 'Custom Access',
    description: 'Manually configured preset template tailored for specialized cross-functional duties.',
    accessLevel: 'Manually Configured',
    badgeColor: '#ec4899',
    icon: '⚙️',
    isSystem: false,
    scope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
    permissions: {
      machines: ['VIEW', 'ADD', 'EDIT'],
      transfers: ['VIEW'],
      relocate: ['VIEW'],
      qr_codes: ['VIEW'],
      preventive_maintenance: ['VIEW', 'ADD'],
      machine_history: ['VIEW'],
      storage: ['VIEW'],
      dashboard: ['VIEW'],
      et_lab: ['VIEW', 'ADD'],
      spare_parts: ['VIEW'],
      tools_management: ['VIEW'],
      document_library: ['VIEW'],
      manpower: ['VIEW'],
      reports: ['VIEW'],
      user_management: [],
      master_data: ['VIEW'],
      transfer_workflows: [],
      excel_manager: [],
      audit_logs: [],
      settings: [],
      email_config: [],
      homepage_management: []
    }
  }
];

export const SERVICE_TYPES = {
  REPAIR: { id: 'REPAIR', label: 'Repair', icon: '🔧', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' },
  SERVICING: { id: 'SERVICING', label: 'Servicing', icon: '🛠️', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', borderColor: '#0ea5e9' },
  PREVENTIVE_MAINTENANCE: { id: 'PREVENTIVE_MAINTENANCE', label: 'Preventive Maintenance', icon: '🛡️', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' },
  BREAKDOWN: { id: 'BREAKDOWN', label: 'Breakdown', icon: '⚡', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' }
};

export const ACTIVITY_TYPES = {
  ADD_MACHINE: { id: 'ADD_MACHINE', label: 'Machine Registered', icon: '➕', color: '#10b981', category: 'LIFECYCLE' },
  EDIT_MACHINE: { id: 'EDIT_MACHINE', label: 'Machine Updated', icon: '✏️', color: '#38bdf8', category: 'ADMIN' },
  TRANSFER_MACHINE: { id: 'TRANSFER_MACHINE', label: 'Location Relocated', icon: '🔄', color: '#0ea5e9', category: 'TRANSFER' },
  LOCATION_CHANGE: { id: 'LOCATION_CHANGE', label: 'Location Changed', icon: '📍', color: '#0284c7', category: 'TRANSFER' },
  STATUS_CHANGE: { id: 'STATUS_CHANGE', label: 'Status Changed', icon: '⚡', color: '#f59e0b', category: 'STATUS' },
  SPARE_PART_REPLACEMENT: { id: 'SPARE_PART_REPLACEMENT', label: 'Spare Part Replaced', icon: '⚙️', color: '#10b981', category: 'MAINTENANCE' },
  MAINTENANCE_SERVICE: { id: 'MAINTENANCE_SERVICE', label: 'Service & Maintenance', icon: '🛠️', color: '#eab308', category: 'MAINTENANCE' },
  SERVICE_REPAIR: { id: 'SERVICE_REPAIR', label: 'Repair & Service Log', icon: '🔧', color: '#ef4444', category: 'MAINTENANCE' },
  EXCEL_IMPORT: { id: 'EXCEL_IMPORT', label: 'Excel Data Imported', icon: '📥', color: '#8b5cf6', category: 'IMPORT' },
  DELETE_MACHINE: { id: 'DELETE_MACHINE', label: 'Machine Deleted/Deactivated', icon: '🗑️', color: '#ef4444', category: 'ADMIN' },
  CONFIG_CHANGE: { id: 'CONFIG_CHANGE', label: 'Configuration Updated', icon: '🔧', color: '#64748b', category: 'ADMIN' }
};

export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
  SUPER_ADMIN: 'ADMIN'
};

export const PERMISSIONS = {
  VIEW: 'VIEW',
  ADD: 'ADD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  EXCEL_IMPORT: 'EXCEL_IMPORT',
  EXCEL_EXPORT: 'EXCEL_EXPORT',
  BULK_UPDATE: 'BULK_UPDATE',
  TEMPLATE_MGMT: 'TEMPLATE_MGMT',
  FIELD_MGMT: 'FIELD_MGMT',
  APPROVE: 'APPROVE',
  MASTER_DATA: 'MASTER_DATA',
  USER_MGMT: 'USER_MGMT',
  TRANSFER_REQUEST: 'TRANSFER_REQUEST',
  TRANSFER_APPROVE: 'TRANSFER_APPROVE',
  TRANSFER_EXECUTE: 'TRANSFER_EXECUTE',
  TRANSFER_CONFIG: 'TRANSFER_CONFIG'
};

export const MACHINE_STATUSES = [
  { id: 'ACTIVE', label: 'Active', color: '#10b981', bg: '#ecfdf5' },
  { id: 'MAINTENANCE', label: 'Under Maintenance', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'BREAKDOWN', label: 'Breakdown', color: '#ef4444', bg: '#fef2f2' },
  { id: 'IDLE', label: 'Idle / Standby', color: '#6366f1', bg: '#eef2ff' },
  { id: 'PENDING_APPROVAL', label: 'Pending Approval', color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'IN_TRANSFER', label: 'Transfer in Progress', color: '#0ea5e9', bg: '#f0f9ff' },
  { id: 'INACTIVE', label: 'Inactive', color: '#64748b', bg: '#f1f5f9' },
  { id: 'ARCHIVED', label: 'Archived', color: '#475569', bg: '#e2e8f0' }
];

export const APPROVAL_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REVISION_REQUESTED: 'REVISION_REQUESTED'
};

export const TRANSFER_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PARTIALLY_APPROVED: 'PARTIALLY_APPROVED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REVISION_REQUESTED: 'REVISION_REQUESTED'
};

export const APPROVER_TYPES = {
  ADMIN: 'ADMIN',
  MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
  SOURCE_LOCATION: 'SOURCE_LOCATION',
  DEST_LOCATION: 'DEST_LOCATION',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  ROLE: 'ROLE',
  SPECIFIC_USER: 'SPECIFIC_USER'
};

export const FIELD_TYPES = [
  { id: 'TEXT', label: 'Text' },
  { id: 'NUMBER', label: 'Number (Integer)' },
  { id: 'DECIMAL', label: 'Decimal Number' },
  { id: 'DATE', label: 'Date' },
  { id: 'DROPDOWN', label: 'Single Select Dropdown' },
  { id: 'MULTI_SELECT', label: 'Multi-Select Dropdown' },
  { id: 'CHECKBOX', label: 'Checkbox (True/False)' },
  { id: 'YES_NO', label: 'Yes / No' },
  { id: 'LONG_TEXT', label: 'Long Text / Textarea' }
];

export const DUPLICATE_POLICIES = {
  REJECT: 'REJECT',           // Block duplicate serials with error report
  SKIP: 'SKIP',               // Skip existing serials, import only new physical machines
  UPDATE_EXISTING: 'UPDATE_EXISTING' // Match by Serial Number/Asset ID and update fields (Bulk Update mode)
};

export const DEFAULT_SETTINGS = {
  requireApprovalForMaintenanceUsers: true,
  requireDeleteApproval: true,
  allowDuplicateSerialNumbers: false,
  defaultDuplicatePolicy: DUPLICATE_POLICIES.REJECT,
  companyName: 'Al-Muslim Group',
  departmentName: 'Central Maintenance & Mechanical Engineering Department',
  defaultRowsPerPage: 50,
  enableAutoBackup: true,
  theme: 'dark',
  // Unique Machine Serial Number Format Configuration: [Floor Short Code]-[Machine Number]
  serialFormatTemplate: '{FLOOR_CODE}-{NUMBER}',
  serialNumberPadding: 2, // 2 digits: 01, 02...
  enforceFloorPrefix: true,
  allowManualSerialOverride: true,
  // Report Signature Signatories Configuration (Dynamic Add/Edit/Remove list)
  signatures: [
    { id: 'sig-1', name: 'Engr. Motaher Hossain', title: 'Prepared By (Engineer)', enabled: true },
    { id: 'sig-2', name: 'Engr. Delwar Hossain', title: 'Verified By (AGM / Sr. AGM)', enabled: true },
    { id: 'sig-3', name: 'Mohammad Liton Miah', title: 'Approved By (GM)', enabled: true }
  ],
  reportSignatures: {},
  sig1Name: 'Engr. Motaher Hossain',
  sig1Title: 'Prepared By (Engineer)',
  showSig1: true,
  sig2Name: 'Engr. Delwar Hossain',
  sig2Title: 'Verified By (AGM / Sr. AGM)',
  showSig2: true,
  sig3Name: 'Mohammad Liton Miah',
  sig3Title: 'Approved By (GM)',
  showSig3: true,
  signatory1Name: 'Engr. Motaher Hossain',
  signatory1Title: 'Prepared By (Engineer)',
  signatory2Name: 'Engr. Delwar Hossain',
  signatory2Title: 'Verified By (AGM / Sr. AGM)',
  signatory3Name: 'Mohammad Liton Miah',
  signatory3Title: 'Approved By (GM)',
  showSignaturesOnPdf: true
};
