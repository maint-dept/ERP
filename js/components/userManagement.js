/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * User Access Management & Workforce Permissions Component (Admin Panel)
 * 
 * Sub-Features:
 * 1. User Accounts Dashboard (with Manpower auto-links, search, multi-filters, pagination, bulk selection)
 * 2. Individual Access Permissions Matrix (granular 7-action control across all ERP modules)
 * 3. Bulk Access Assignment (Additive Mode A & Replacement Mode B with confirmation)
 * 4. Password Management Dashboard (secure 14-char random generation, salted hashing, reset)
 * 5. Single-Worksheet Excel Export (Standard Account Export & Elevated Credential Export)
 * 6. Access & Password Activity Logs (audit trail without secret exposure)
 * 7. Permission Presets & Access Profiles (Retained and enhanced)
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, DEFAULT_PERMISSION_TEMPLATES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { cryptoService } from '../services/cryptoService.js';
import { userAccessService } from '../services/userAccessService.js';
import { masterDataService } from '../services/masterDataService.js';
import { employeeService } from '../services/employeeService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

// Active Sub-feature Section
// 'ACCOUNTS' | 'PERMISSIONS' | 'BULK_ASSIGN' | 'PASSWORD_MGMT' | 'EXPORT_ACCOUNTS' | 'ACTIVITY_LOGS' | 'PRESETS'
let activeUserSection = (typeof localStorage !== 'undefined' && localStorage.getItem('al_muslim_user_access_section')) || 'ACCOUNTS';

// Filtering & Search State
let searchQuery = '';
let filterGroup = 'ALL';
let filterUnit = 'ALL';
let filterFloor = 'ALL';
let filterLine = 'ALL';
let filterDesignation = 'ALL';
let filterStatus = 'ALL'; // 'ALL' | 'ACTIVE' | 'INACTIVE'
let filterAccountLink = 'ALL'; // 'ALL' | 'LINKED' | 'NOT_CREATED'
let filterPasswordStatus = 'ALL'; // 'ALL' | 'SETUP' | 'TEMPORARY' | 'PENDING'
let filterPreset = 'ALL';

// Pagination State
let currentPage = 1;
let rowsPerPage = 20;

// Multi-Selection State
let selectedAccountIds = new Set();
let isSelectAllFiltered = false;

// Modal & Sub-screen States
let activeModalType = null; // 'VIEW_DETAILS' | 'EDIT_ACCOUNT' | 'MANAGE_PERMS' | 'RESET_PASSWORD' | 'PASSWORD_RESULT' | 'CREDENTIAL_EXPORT_CONFIRM' | 'BULK_CONFIRM' | 'AUTO_CREATE_SUMMARY' | 'ADD_USER' | 'CREATE_EDIT_PRESET' | 'ASSIGN_USERS_TO_PRESET'
let targetAccount = null;
let targetUser = null;
let lastGeneratedPasswordData = null; // { username, plainPassword, isReset }
let autoCreateSummaryData = null; // { successful: [], failed: [] }

// Permissions Matrix Editing State
let permissionTargetUserId = null;
let editingPermissions = {};
let editingScope = { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] };

// Bulk Assignment Form State
let bulkSelectedUserIds = [];
let bulkTargetModulePerms = {};
let bulkAssignmentMode = 'ADD'; // 'ADD' | 'REPLACE'
let bulkPresetTemplateId = '';

// Password Management Filter
let passwordMgmtSearch = '';
let passwordMgmtFloor = 'ALL';
let passwordMgmtStatus = 'ALL';

// Export Accounts State
let exportScope = 'ALL'; // 'ALL' | 'FLOOR' | 'GROUP' | 'UNIT' | 'LINE' | 'SELECTED' | 'FILTERED'
let exportTargetFloorId = '';
let exportTargetGroupId = '';
let exportTargetUnitId = '';
let exportTargetLineId = '';

// Activity Logs Filter State
let logActionFilter = 'ALL';
let logSearchQuery = '';

// Presets View State
let presetViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('al_muslim_preset_view_mode')) || 'CARDS';
let targetPreset = null;
let editingPreset = null;
let applyToAssignedUsers = true;
let syncScopeOnPresetAssign = true;
let selectedUserIdsForPreset = [];

// Granular 7-Action Permissions Modules Definition across actual ERP routes
export const PERMISSION_CONFIG_MODULES = [
  {
    group: '🏭 Machine Operations & Core Machinery',
    modules: [
      { id: 'machines', name: 'Machine Inventory', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'transfers', name: 'Machine Transfers', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'relocate', name: 'Relocate & Verify', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'qr_codes', name: 'QR Codes & Labels', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'preventive_maintenance', name: 'Preventive Maintenance', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'needle_operations', name: 'Needle Flow', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'parts_trace', name: 'Parts Trace', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'machine_history', name: 'Machine Lifetime (Passport)', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'dashboard', name: 'Dashboard & KPI Overview', actions: ['VIEW'] }
    ]
  },
  {
    group: '🔬 Specialized Technical Departments',
    modules: [
      { id: 'storage', name: 'Master Storage & Warehouse Rules', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'et_lab', name: 'ENT Lab Management', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'spare_parts', name: 'Spare Parts History & Catalog', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'tools_management', name: 'Tools & Equipment Management', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'document_library', name: 'Document & Technical Library', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] }
    ]
  },
  {
    group: '👥 Workforce & Analytics',
    modules: [
      { id: 'manpower', name: 'Manpower Management', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'reports', name: 'Reports & Analytics Hub', actions: ['VIEW', 'EXPORT'] }
    ]
  },
  {
    group: '⚙️ Administration & Master Data',
    modules: [
      { id: 'user_management', name: 'User Access Management', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'master_data', name: 'Plant Hierarchy & Master Data', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'transfer_workflows', name: 'Transfer Workflows Builder', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE'] },
      { id: 'excel_manager', name: 'Excel Import / Export Center', actions: ['VIEW', 'EDIT', 'EXPORT'] },
      { id: 'audit_logs', name: 'Activity Logs & Audit Trail', actions: ['VIEW', 'EXPORT'] },
      { id: 'settings', name: 'System Settings', actions: ['VIEW', 'EDIT'] },
      { id: 'email_config', name: 'Email Configuration', actions: ['VIEW', 'EDIT'] },
      { id: 'homepage_management', name: 'Home Page Management', actions: ['VIEW', 'EDIT'] }
    ]
  }
];

export function renderUserManagement() {
  const currentUser = authService.getCurrentUser();
  const isAdmin = authService.isAdmin();
  const isSuperAdmin = authService.isSuperAdmin();

  // Load all accounts merged with Manpower data
  const allAccounts = userAccessService.getAllAccountsWithManpower();
  const presets = authService.getAllPresets ? authService.getAllPresets() : [];

  // Summary Metrics (Section 14)
  const totalAccounts = allAccounts.filter(a => a.hasAccount).length;
  const activeAccounts = allAccounts.filter(a => a.hasAccount && a.accountStatus === 'ACTIVE').length;
  const inactiveAccounts = allAccounts.filter(a => a.hasAccount && a.accountStatus === 'INACTIVE').length;
  const pendingCreation = allAccounts.filter(a => !a.hasAccount).length;
  const pendingPasswordSetup = allAccounts.filter(a => a.hasAccount && (a.passwordStatus === 'TEMPORARY' || a.passwordStatus === 'PENDING')).length;
  const usersWithPermissions = allAccounts.filter(a => a.hasAccount && a.totalModules > 0).length;

  // Master Data Options for Filters
  const allGroups = masterDataService.getGroups ? masterDataService.getGroups(true) : [];
  const allUnits = masterDataService.getUnits ? masterDataService.getUnits(filterGroup !== 'ALL' ? filterGroup : null, true) : [];
  const allFloors = masterDataService.getFloors ? masterDataService.getFloors(filterUnit !== 'ALL' ? filterUnit : null, null, true) : [];
  const allLines = masterDataService.getLines ? masterDataService.getLines(filterFloor !== 'ALL' ? filterFloor : null, null, null, true) : [];
  const allDesignations = employeeService.getDistinctDesignations ? employeeService.getDistinctDesignations() : [];

  // Apply Filters to Accounts
  const filteredAccounts = allAccounts.filter(acc => {
    // 1. Text Search (Card Number, Name, Username)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchCard = (acc.cardNumber || '').toLowerCase().includes(q);
      const matchName = (acc.employeeName || '').toLowerCase().includes(q);
      const matchUser = (acc.username || '').toLowerCase().includes(q);
      const matchDept = (acc.department || '').toLowerCase().includes(q);
      if (!matchCard && !matchName && !matchUser && !matchDept) return false;
    }

    // 2. Location Filters
    if (filterGroup !== 'ALL' && acc.groupId !== filterGroup) return false;
    if (filterUnit !== 'ALL' && acc.unitId !== filterUnit) return false;
    if (filterFloor !== 'ALL' && acc.floorId !== filterFloor) return false;
    if (filterLine !== 'ALL' && acc.lineId !== filterLine) return false;

    // 3. Designation Filter
    if (filterDesignation !== 'ALL' && (acc.designation || '').toLowerCase() !== filterDesignation.toLowerCase()) return false;

    // 4. Status Filter
    if (filterStatus !== 'ALL' && acc.accountStatus !== filterStatus) return false;

    // 5. Account Created / Not Created Filter
    if (filterAccountLink === 'LINKED' && !acc.hasAccount) return false;
    if (filterAccountLink === 'NOT_CREATED' && acc.hasAccount) return false;

    // 6. Password Status Filter
    if (filterPasswordStatus !== 'ALL') {
      if (filterPasswordStatus === 'SETUP' && acc.passwordStatus !== 'SETUP') return false;
      if (filterPasswordStatus === 'TEMPORARY' && acc.passwordStatus !== 'TEMPORARY') return false;
      if (filterPasswordStatus === 'PENDING' && acc.passwordStatus !== 'PENDING') return false;
    }

    return true;
  });

  // Calculate Pagination
  const totalMatching = filteredAccounts.length;
  const totalPages = Math.max(1, Math.ceil(totalMatching / rowsPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + rowsPerPage);

  // Sync Select All state
  const isPageAllSelected = paginatedAccounts.length > 0 && paginatedAccounts.every(a => selectedAccountIds.has(a.id));

  return `
    <div class="page-view" style="gap: 14px; max-width: 1440px; margin: 0 auto; width: 100%; min-height: 100%; padding-bottom: 60px; box-sizing: border-box;">
      
      <!-- =================================================================== -->
      <!-- 1. TOP HEADER & KPI SUMMARY DASHBOARD (Section 14)                 -->
      <!-- =================================================================== -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(14, 165, 233, 0.05)); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            👥
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h1 style="font-size: 19px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px;">
                User Access Management
              </h1>
              <span class="badge badge-active" style="font-size: 10.5px; padding: 2px 8px; font-weight: 700;">
                Enterprise Security Matrix
              </span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
              Centralized workforce accounts, automated Manpower synchronization, granular feature permissions, and secure credential exports.
            </div>
          </div>
        </div>

        <!-- Top Right Action Controls -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${isAdmin ? `
            ${pendingCreation > 0 ? `
              <button id="btn-auto-create-all-missing" class="btn btn-warning" style="font-weight: 800; padding: 7px 14px; font-size: 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(245, 158, 11, 0.25);" title="Auto-create linked accounts for all ${pendingCreation} manpower records currently without an account">
                <span>⚡</span> <span>Auto-Create Missing Accounts (${pendingCreation})</span>
              </button>
            ` : ''}
            <button id="btn-top-add-user" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 7px 15px; font-size: 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);">
              <span>➕</span> <span>Add New User</span>
            </button>
          ` : ''}
          <button id="btn-refresh-uam" class="btn btn-secondary" style="padding: 7px 12px; font-size: 12px; border-radius: 8px;" title="Refresh Accounts and Database">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- 6 Dashboard Summary Cards (Section 14) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px;">
        <!-- 1. Total Accounts -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Total Accounts</div>
            <div style="font-size: 22px; font-weight: 900; color: #fff; margin-top: 2px;">${totalAccounts}</div>
          </div>
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 18px;">👥</div>
        </div>

        <!-- 2. Active Accounts -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Active Accounts</div>
            <div style="font-size: 22px; font-weight: 900; color: #34d399; margin-top: 2px;">${activeAccounts}</div>
          </div>
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 18px;">🟢</div>
        </div>

        <!-- 3. Inactive Accounts -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Inactive Accounts</div>
            <div style="font-size: 22px; font-weight: 900; color: #94a3b8; margin-top: 2px;">${inactiveAccounts}</div>
          </div>
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(148, 163, 184, 0.12); color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 18px;">🔴</div>
        </div>

        <!-- 4. Accounts Pending Creation -->
        <div style="background: var(--bg-surface); border: 1px solid ${pendingCreation > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Pending Creation</div>
            <div style="font-size: 22px; font-weight: 900; color: ${pendingCreation > 0 ? '#fbbf24' : '#fff'}; margin-top: 2px;">${pendingCreation}</div>
          </div>
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(245, 158, 11, 0.12); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 18px;">⏳</div>
        </div>

        <!-- 5. Accounts Pending Password Setup -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Temporary / Pending Pass</div>
            <div style="font-size: 22px; font-weight: 900; color: #c084fc; margin-top: 2px;">${pendingPasswordSetup}</div>
          </div>
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(168, 85, 247, 0.12); color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 18px;">🔑</div>
        </div>

        <!-- 6. Users with Permissions -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Configured Access</div>
            <div style="font-size: 22px; font-weight: 900; color: #38bdf8; margin-top: 2px;">${usersWithPermissions}</div>
          </div>
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 18px;">🛡️</div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- 2. PRIMARY SUB-FEATURES NAVIGATION BAR (Section 1)                 -->
      <!-- =================================================================== -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; gap: 8px; flex-wrap: wrap;">
        <!-- Left: 6 Sub-features Switcher Tabs -->
        <div style="display: inline-flex; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 10px; padding: 3px; gap: 3px; flex-wrap: wrap;">
          
          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="ACCOUNTS"
            style="padding: 7px 15px; font-size: 12.5px; font-weight: 800; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'ACCOUNTS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'ACCOUNTS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>👥 1. User Accounts</span>
            <span style="background: ${activeUserSection === 'ACCOUNTS' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(148, 163, 184, 0.15)'}; color: ${activeUserSection === 'ACCOUNTS' ? '#fff' : '#94a3b8'}; padding: 1px 7px; border-radius: 10px; font-size: 10.5px;">${totalAccounts}</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="PERMISSIONS"
            style="padding: 7px 15px; font-size: 12.5px; font-weight: 800; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'PERMISSIONS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PERMISSIONS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>🛡️ 2. Access Permissions</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="BULK_ASSIGN"
            style="padding: 7px 15px; font-size: 12.5px; font-weight: 800; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'BULK_ASSIGN' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'BULK_ASSIGN' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>⚡ 3. Bulk Access Assignment</span>
            ${selectedAccountIds.size > 0 ? `<span style="background: #f59e0b; color: #000; font-weight: 900; padding: 1px 7px; border-radius: 10px; font-size: 10.5px;">${selectedAccountIds.size}</span>` : ''}
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="PASSWORD_MGMT"
            style="padding: 7px 15px; font-size: 12.5px; font-weight: 800; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'PASSWORD_MGMT' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PASSWORD_MGMT' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>🔑 4. Password Management</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="EXPORT_ACCOUNTS"
            style="padding: 7px 15px; font-size: 12.5px; font-weight: 800; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'EXPORT_ACCOUNTS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'EXPORT_ACCOUNTS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>📥 5. Export Accounts</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="ACTIVITY_LOGS"
            style="padding: 7px 15px; font-size: 12.5px; font-weight: 800; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'ACTIVITY_LOGS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'ACTIVITY_LOGS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>📝 6. Access Activity Logs</span>
          </button>

          <!-- 7. Preserved Presets Feature Tab -->
          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="PRESETS"
            style="padding: 7px 14px; font-size: 12px; font-weight: 700; border-radius: 7px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; background: ${activeUserSection === 'PRESETS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PRESETS' ? '#fff' : 'var(--text-muted)'};"
          >
            <span>⚙️ Presets (${presets.length})</span>
          </button>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- TAB 1: USER ACCOUNTS DASHBOARD (Section 3 & 4)                      -->
      <!-- =================================================================== -->
      ${activeUserSection === 'ACCOUNTS' ? `
        <!-- Search and Multi-Filtering Command Bar (Section 4) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-sm);">
          
          <!-- Top Row: Text Search + Quick Reset -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1 1 280px; position: relative;">
              <span style="position: absolute; left: 10px; top: 8px; font-size: 14px; color: var(--text-muted);">🔍</span>
              <input 
                type="text" 
                id="uam-search-input" 
                class="form-control" 
                placeholder="Search by Card Number, Employee Name, Username, Department..." 
                value="${searchQuery}"
                style="height: 34px; padding-left: 32px; font-size: 12.5px; border-radius: 6px; width: 100%; box-sizing: border-box;"
              />
              ${searchQuery ? `
                <button id="btn-clear-uam-search" type="button" style="position: absolute; right: 8px; top: 6px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px;">✕</button>
              ` : ''}
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; color: var(--text-muted);">
                Showing <strong>${paginatedAccounts.length}</strong> of <strong>${totalMatching}</strong> matching records
              </span>
              ${(searchQuery || filterGroup !== 'ALL' || filterUnit !== 'ALL' || filterFloor !== 'ALL' || filterLine !== 'ALL' || filterDesignation !== 'ALL' || filterStatus !== 'ALL' || filterAccountLink !== 'ALL' || filterPasswordStatus !== 'ALL') ? `
                <button id="btn-clear-all-filters" class="btn btn-ghost btn-xs" style="color: #f87171; font-weight: 700; border: 1px solid rgba(248, 113, 113, 0.3); border-radius: 6px; padding: 4px 8px;">
                  ✕ Clear Filters
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Bottom Row: Multi-Dropdown Filters (Group, Unit, Floor, Line, Desig, Status, Account Link, Pass Status) -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Group -->
            <select id="uam-filter-group" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 150px;">
              <option value="ALL" ${filterGroup === 'ALL' ? 'selected' : ''}>🏢 All Groups</option>
              ${allGroups.map(g => `<option value="${g.id}" ${filterGroup === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>

            <!-- Unit -->
            <select id="uam-filter-unit" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 160px;">
              <option value="ALL" ${filterUnit === 'ALL' ? 'selected' : ''}>🏭 All Units</option>
              ${allUnits.map(u => `<option value="${u.id}" ${filterUnit === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>

            <!-- Floor -->
            <select id="uam-filter-floor" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 160px;">
              <option value="ALL" ${filterFloor === 'ALL' ? 'selected' : ''}>🏢 All Floors</option>
              ${allFloors.map(f => `<option value="${f.id}" ${filterFloor === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>

            <!-- Line -->
            <select id="uam-filter-line" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 150px;">
              <option value="ALL" ${filterLine === 'ALL' ? 'selected' : ''}>🧵 All Lines</option>
              ${allLines.map(l => `<option value="${l.id}" ${filterLine === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>

            <!-- Designation -->
            <select id="uam-filter-desig" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 170px;">
              <option value="ALL" ${filterDesignation === 'ALL' ? 'selected' : ''}>💼 All Designations</option>
              ${allDesignations.map(d => `<option value="${d}" ${filterDesignation === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>

            <!-- Account Status -->
            <select id="uam-filter-status" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 130px;">
              <option value="ALL" ${filterStatus === 'ALL' ? 'selected' : ''}>⚡ All Status</option>
              <option value="ACTIVE" ${filterStatus === 'ACTIVE' ? 'selected' : ''}>🟢 Active</option>
              <option value="INACTIVE" ${filterStatus === 'INACTIVE' ? 'selected' : ''}>🔴 Inactive</option>
            </select>

            <!-- Account Link Status -->
            <select id="uam-filter-account-link" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 150px;">
              <option value="ALL" ${filterAccountLink === 'ALL' ? 'selected' : ''}>👤 All Accounts</option>
              <option value="LINKED" ${filterAccountLink === 'LINKED' ? 'selected' : ''}>✓ User Account Created</option>
              <option value="NOT_CREATED" ${filterAccountLink === 'NOT_CREATED' ? 'selected' : ''}>⏳ Account Missing</option>
            </select>

            <!-- Password Status -->
            <select id="uam-filter-pass-status" class="filter-select" style="height: 32px; font-size: 11.5px; padding: 2px 8px; max-width: 160px;">
              <option value="ALL" ${filterPasswordStatus === 'ALL' ? 'selected' : ''}>🔑 All Passwords</option>
              <option value="SETUP" ${filterPasswordStatus === 'SETUP' ? 'selected' : ''}>✅ Setup / Active</option>
              <option value="TEMPORARY" ${filterPasswordStatus === 'TEMPORARY' ? 'selected' : ''}>🟡 Temporary Initial</option>
              <option value="PENDING" ${filterPasswordStatus === 'PENDING' ? 'selected' : ''}>⚪ Pending Setup</option>
            </select>
          </div>
        </div>

        <!-- Cross-Page Bulk Selection Action Bar -->
        ${selectedAccountIds.size > 0 ? `
          <div style="background: rgba(2, 132, 199, 0.15); border: 1px solid #0284c7; border-radius: var(--radius-md); padding: 9px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #fff;">
              <span style="font-weight: 800; color: #38bdf8; font-size: 14px;">
                ✓ ${isSelectAllFiltered ? totalMatching : selectedAccountIds.size} Accounts Selected
              </span>
              ${!isSelectAllFiltered && totalMatching > selectedAccountIds.size ? `
                <a href="javascript:void(0)" id="btn-select-all-filtered-cross-page" style="color: #facc15; font-weight: 700; text-decoration: underline;">
                  Select all ${totalMatching} matching accounts across all pages
                </a>
              ` : ''}
              ${isSelectAllFiltered ? `
                <span style="color: #facc15; font-size: 11.5px; font-weight: 700;">(All matching filtered accounts selected)</span>
              ` : ''}
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button id="btn-bulk-jump-assign" class="btn btn-primary btn-xs" style="background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700;">
                ⚡ Bulk Assign Permissions
              </button>
              <button id="btn-bulk-reset-passwords-action" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);">
                🔑 Bulk Reset Passwords
              </button>
              <button id="btn-bulk-activate-action" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #34d399; border-color: rgba(52, 211, 153, 0.4);">
                🟢 Activate
              </button>
              <button id="btn-bulk-deactivate-action" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #f87171; border-color: rgba(248, 113, 113, 0.4);">
                🔴 Deactivate
              </button>
              <button id="btn-bulk-export-selected" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #38bdf8;">
                📥 Export Selected
              </button>
              <button id="btn-deselect-all-accounts" class="btn btn-ghost btn-xs" style="color: var(--text-muted);">
                ✕ Deselect All
              </button>
            </div>
          </div>
        ` : ''}

        <!-- User Accounts Table (Section 3) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow-x: auto; width: 100%;">
          <table class="user-management-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="width: 38px; text-align: center; padding: 10px 8px;">
                  <input type="checkbox" id="chk-header-select-page" ${isPageAllSelected ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7;" title="Select all on this page" />
                </th>
                <th style="min-width: 110px; padding: 10px 12px;">Card Number</th>
                <th style="min-width: 160px; padding: 10px 12px;">Employee Name</th>
                <th style="min-width: 120px; padding: 10px 12px;">Username</th>
                <th style="min-width: 140px; padding: 10px 12px;">Designation</th>
                <th style="min-width: 110px; padding: 10px 10px;">Unit</th>
                <th style="min-width: 110px; padding: 10px 10px;">Floor</th>
                <th style="min-width: 100px; padding: 10px 10px;">Line</th>
                <th style="min-width: 90px; text-align: center; padding: 10px 8px;">Status</th>
                <th style="min-width: 150px; padding: 10px 12px;">Permissions Summary</th>
                <th style="min-width: 110px; text-align: center; padding: 10px 8px;">Password</th>
                <th style="min-width: 120px; padding: 10px 10px;">Last Login</th>
                <th style="min-width: 160px; text-align: center; padding: 10px 12px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${paginatedAccounts.length === 0 ? `
                <tr>
                  <td colspan="13" style="text-align: center; padding: 36px; color: var(--text-muted); font-size: 13px;">
                    No accounts match the specified filters. Try clearing filters or use <strong>"Auto-Create Missing Accounts"</strong>.
                  </td>
                </tr>
              ` : paginatedAccounts.map(acc => {
                const isSelected = selectedAccountIds.has(acc.id);
                const hasAccount = acc.hasAccount;
                const isUserActive = acc.accountStatus === 'ACTIVE';

                return `
                  <tr style="background: ${isSelected ? 'rgba(2, 132, 199, 0.08)' : 'transparent'};">
                    <td style="text-align: center; padding: 9px 8px;">
                      ${hasAccount ? `
                        <input type="checkbox" class="chk-account-row" data-id="${acc.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7;" />
                      ` : `
                        <span style="color: var(--text-muted); opacity: 0.3;">—</span>
                      `}
                    </td>
                    
                    <!-- Card Number -->
                    <td style="padding: 9px 12px;">
                      <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 12.5px;">
                        #${acc.cardNumber}
                      </span>
                    </td>

                    <!-- Employee Name -->
                    <td style="padding: 9px 12px;">
                      <div style="font-weight: 700; color: #fff; font-size: 13px;">${acc.employeeName}</div>
                      <div style="font-size: 10.5px; color: var(--text-muted);">${acc.department}</div>
                    </td>

                    <!-- Username -->
                    <td style="padding: 9px 12px;">
                      ${hasAccount ? `
                        <span style="font-family: var(--font-mono); color: #cbd5e1; font-weight: 600; font-size: 12px;">
                          @${acc.username}
                        </span>
                      ` : `
                        <span style="color: #f59e0b; font-size: 11.5px; font-weight: 700;">No Account Yet</span>
                      `}
                    </td>

                    <!-- Designation -->
                    <td style="padding: 9px 12px; font-size: 12px; color: #e2e8f0;">
                      ${acc.designation}
                    </td>

                    <!-- Unit -->
                    <td style="padding: 9px 10px; font-size: 11.5px; color: var(--text-secondary);">
                      ${acc.unitName}
                    </td>

                    <!-- Floor -->
                    <td style="padding: 9px 10px; font-size: 11.5px; color: #38bdf8;">
                      ${acc.floorName}
                    </td>

                    <!-- Line -->
                    <td style="padding: 9px 10px; font-size: 11.5px; color: var(--text-secondary);">
                      ${acc.lineName}
                    </td>

                    <!-- Status -->
                    <td style="text-align: center; padding: 9px 8px;">
                      ${hasAccount ? `
                        <span class="badge ${isUserActive ? 'badge-active' : 'badge-maint'}" style="font-size: 10px;">
                          ${acc.accountStatus}
                        </span>
                      ` : `
                        <span class="badge badge-warning" style="font-size: 10px;">PENDING</span>
                      `}
                    </td>

                    <!-- Permissions Summary -->
                    <td style="padding: 9px 12px;">
                      ${hasAccount ? `
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="font-size: 11.5px; color: #e2e8f0; font-weight: 600;">${acc.permissionsSummary}</span>
                          ${acc.presetName ? `<span class="badge badge-info" style="font-size: 9.5px; padding: 1px 5px;">${acc.presetName}</span>` : ''}
                        </div>
                      ` : `
                        <span style="color: var(--text-muted); font-size: 11px;">Not Assigned</span>
                      `}
                    </td>

                    <!-- Password Status -->
                    <td style="text-align: center; padding: 9px 8px;">
                      ${hasAccount ? `
                        ${acc.passwordStatus === 'TEMPORARY' ? `
                          <span class="badge badge-warning" title="Initial temporary password generated. Eligible for export." style="font-size: 10px; cursor: help;">🟡 Temporary</span>
                        ` : `
                          <span class="badge badge-active" title="Permanent password set" style="font-size: 10px;">✅ Setup</span>
                        `}
                      ` : `
                        <span style="color: var(--text-muted); font-size: 11px;">—</span>
                      `}
                    </td>

                    <!-- Last Login -->
                    <td style="padding: 9px 10px; font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                      ${acc.lastLoginText}
                    </td>

                    <!-- Actions -->
                    <td style="text-align: center; padding: 9px 12px; white-space: nowrap;">
                      ${hasAccount ? `
                        <div style="display: inline-flex; gap: 5px; align-items: center;">
                          <button class="btn btn-ghost btn-xs btn-row-view-details" data-id="${acc.id}" title="View Complete Details" style="padding: 3px 6px; font-size: 11px;">
                            👁️
                          </button>
                          <button class="btn btn-ghost btn-xs btn-row-manage-perms" data-id="${acc.id}" title="Manage Permissions" style="padding: 3px 6px; font-size: 11px; color: #38bdf8;">
                            🛡️
                          </button>
                          <button class="btn btn-ghost btn-xs btn-row-reset-pass" data-id="${acc.id}" title="Reset / Generate Password" style="padding: 3px 6px; font-size: 11px; color: #f59e0b;">
                            🔑
                          </button>
                          <button class="btn btn-ghost btn-xs btn-row-toggle-status" data-id="${acc.id}" data-status="${acc.accountStatus}" title="${isUserActive ? 'Deactivate Account' : 'Activate Account'}" style="padding: 3px 6px; font-size: 11px; color: ${isUserActive ? '#f87171' : '#34d399'};">
                            ${isUserActive ? '🔴' : '🟢'}
                          </button>
                          <button class="btn btn-ghost btn-xs btn-row-view-logs" data-id="${acc.id}" data-card="${acc.cardNumber}" title="View Activity Logs" style="padding: 3px 6px; font-size: 11px; color: #cbd5e1;">
                            📜
                          </button>
                        </div>
                      ` : `
                        <button class="btn btn-primary btn-xs btn-row-create-account" data-emp-id="${acc.manpowerId}" data-card="${acc.cardNumber}" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 4px 10px; font-size: 11px; border-radius: 6px;">
                          ➕ Create Account
                        </button>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 8px 4px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted);">
            <span>Rows per page:</span>
            <select id="uam-page-size" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; width: 65px;">
              <option value="15" ${rowsPerPage === 15 ? 'selected' : ''}>15</option>
              <option value="20" ${rowsPerPage === 20 ? 'selected' : ''}>20</option>
              <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
            </select>
            <span>Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong> (${totalMatching} items)</span>
          </div>

          <div style="display: flex; gap: 6px; align-items: center;">
            <button id="btn-page-first" class="btn btn-secondary btn-xs" ${currentPage === 1 ? 'disabled' : ''} style="padding: 4px 8px;">⏮ First</button>
            <button id="btn-page-prev" class="btn btn-secondary btn-xs" ${currentPage === 1 ? 'disabled' : ''} style="padding: 4px 8px;">◀ Prev</button>
            <span style="font-size: 12px; font-weight: 700; color: #fff; padding: 0 6px;">${currentPage}</span>
            <button id="btn-page-next" class="btn btn-secondary btn-xs" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px;">Next ▶</button>
            <button id="btn-page-last" class="btn btn-secondary btn-xs" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 4px 8px;">Last ⏭</button>
          </div>
        </div>
      ` : ''}

      <!-- =================================================================== -->
      <!-- TAB 2: INDIVIDUAL ACCESS PERMISSIONS MATRIX (Section 5)             -->
      <!-- =================================================================== -->
      ${activeUserSection === 'PERMISSIONS' ? renderIndividualPermissionsTab() : ''}

      <!-- =================================================================== -->
      <!-- TAB 3: BULK ACCESS ASSIGNMENT (Section 6)                           -->
      <!-- =================================================================== -->
      ${activeUserSection === 'BULK_ASSIGN' ? renderBulkAssignmentTab() : ''}

      <!-- =================================================================== -->
      <!-- TAB 4: PASSWORD MANAGEMENT DASHBOARD (Section 7 & 8)                -->
      <!-- =================================================================== -->
      ${activeUserSection === 'PASSWORD_MGMT' ? renderPasswordManagementTab() : ''}

      <!-- =================================================================== -->
      <!-- TAB 5: BULK EXCEL EXPORT FOR ALL FLOORS (Section 9 & 10)            -->
      <!-- =================================================================== -->
      ${activeUserSection === 'EXPORT_ACCOUNTS' ? renderExportAccountsTab() : ''}

      <!-- =================================================================== -->
      <!-- TAB 6: ACCESS & PASSWORD ACTIVITY LOGS (Section 13)                 -->
      <!-- =================================================================== -->
      ${activeUserSection === 'ACTIVITY_LOGS' ? renderActivityLogsTab() : ''}

      <!-- =================================================================== -->
      <!-- TAB 7: PERMISSION PRESETS & ACCESS PROFILES (Preserved)             -->
      <!-- =================================================================== -->
      ${activeUserSection === 'PRESETS' ? renderPresetsTab() : ''}

      <!-- Modals Layer for Dialogs -->
      <div id="uam-modal-layer">
        ${renderActiveModalHtml()}
      </div>

    </div>
  `;
}

// ---------------------------------------------------------------------------
// SUB-TAB RENDERERS
// ---------------------------------------------------------------------------

function renderIndividualPermissionsTab() {
  const users = storage.getTable(TABLE_NAMES.USERS) || [];
  const selectedUser = permissionTargetUserId ? users.find(u => u.id === permissionTargetUserId) : (users[0] || null);

  if (!selectedUser) {
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 36px; text-align: center; color: var(--text-muted);">
        No user accounts available. Please add users or auto-create accounts from Manpower records.
      </div>
    `;
  }

  // Load editing permissions for selected user if not initialized
  if (!permissionTargetUserId || permissionTargetUserId !== selectedUser.id) {
    permissionTargetUserId = selectedUser.id;
    editingPermissions = JSON.parse(JSON.stringify(selectedUser.permissions || {}));
  }

  const userPerms = editingPermissions || {};
  const presets = authService.getAllPresets ? authService.getAllPresets() : [];

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-sm);">
      
      <!-- Top Target User Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            🛡️
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px; font-weight: 800; color: #fff;">${selectedUser.name}</span>
              <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 12.5px;">#${selectedUser.cardNumber || selectedUser.employeeId}</span>
              <span class="badge ${selectedUser.status === 'ACTIVE' ? 'badge-active' : 'badge-maint'}" style="font-size: 10px;">${selectedUser.status}</span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
              Username: <strong>@${selectedUser.username}</strong> • ${selectedUser.designation} (${selectedUser.department}) • 📍 ${selectedUser.floorName || 'General Floor'}
            </div>
          </div>
        </div>

        <!-- User Quick Switcher Dropdown -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12px; color: var(--text-muted);">Switch Account:</span>
          <select id="uam-perm-user-switcher" class="filter-select" style="height: 32px; font-size: 12px; max-width: 240px;">
            ${users.map(u => `
              <option value="${u.id}" ${u.id === selectedUser.id ? 'selected' : ''}>
                ${u.name} (#${u.cardNumber || u.employeeId || '—'})
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Action Toolbar (Select All, Deselect All, Load Preset, Reset Default, Save) -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: rgba(15, 23, 42, 0.6); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-perm-select-all" class="btn btn-secondary btn-xs" style="color: #38bdf8; font-weight: 700;">
            ✓ Select All Permissions
          </button>
          <button id="btn-perm-deselect-all" class="btn btn-secondary btn-xs" style="color: var(--text-muted); font-weight: 700;">
            ✕ Deselect All
          </button>

          <!-- Load From Preset -->
          <div style="display: flex; align-items: center; gap: 6px; margin-left: 8px;">
            <span style="font-size: 11.5px; color: var(--text-muted);">Apply Preset:</span>
            <select id="uam-perm-load-preset" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px;">
              <option value="">Choose preset template...</option>
              ${presets.map(p => `<option value="${p.id}">${p.icon || '🛡️'} ${p.name}</option>`).join('')}
            </select>
          </div>

          <button id="btn-perm-reset-default" class="btn btn-ghost btn-xs" style="color: #f59e0b; font-weight: 700; margin-left: 4px;">
            🔄 Reset to Default
          </button>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="btn-perm-cancel-changes" class="btn btn-secondary btn-sm" style="font-size: 12px;">
            Cancel
          </button>
          <button id="btn-perm-save-changes" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4); font-size: 12px; padding: 6px 16px;">
            💾 Save Permissions
          </button>
        </div>
      </div>

      <!-- Granular 7-Action Permissions Matrix Table -->
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow-x: auto; background: #0b1329;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #0f172a; border-bottom: 2px solid #38bdf8; color: #cbd5e1; text-transform: uppercase; font-size: 11px;">
              <th style="padding: 10px 14px; text-align: left; width: 260px;">Module / Feature</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #34d399;">View</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #38bdf8;">Add</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #fbbf24;">Edit</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #f87171;">Delete</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #c084fc;">Import</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #818cf8;">Export</th>
              <th style="padding: 10px 6px; text-align: center; width: 68px; color: #f472b6;">Approve</th>
              <th style="padding: 10px 8px; text-align: center; width: 75px;">Quick</th>
            </tr>
          </thead>
          <tbody>
            ${PERMISSION_CONFIG_MODULES.map(group => `
              <tr style="background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.25);">
                <td colspan="9" style="padding: 8px 14px; font-weight: 800; font-size: 12px; color: #38bdf8; letter-spacing: 0.5px;">
                  ${group.group}
                </td>
              </tr>
              ${group.modules.map(mod => {
                const modPerms = userPerms[mod.id] || [];
                const hasView = modPerms.includes('VIEW');
                const hasAdd = modPerms.includes('ADD');
                const hasEdit = modPerms.includes('EDIT');
                const hasDelete = modPerms.includes('DELETE');
                const hasImport = modPerms.includes('IMPORT');
                const hasExport = modPerms.includes('EXPORT');
                const hasApprove = modPerms.includes('APPROVE');

                return `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 8px 14px; font-weight: 600; color: #f8fafc;">
                      ${mod.name}
                    </td>
                    
                    <td style="text-align: center; padding: 6px;">
                      <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="VIEW" ${hasView ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #10b981;" />
                    </td>

                    <td style="text-align: center; padding: 6px;">
                      ${mod.actions.includes('ADD') ? `
                        <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="ADD" ${hasAdd ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7;" />
                      ` : '<span style="color: var(--text-muted); opacity: 0.25;">—</span>'}
                    </td>

                    <td style="text-align: center; padding: 6px;">
                      ${mod.actions.includes('EDIT') ? `
                        <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="EDIT" ${hasEdit ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #f59e0b;" />
                      ` : '<span style="color: var(--text-muted); opacity: 0.25;">—</span>'}
                    </td>

                    <td style="text-align: center; padding: 6px;">
                      ${mod.actions.includes('DELETE') ? `
                        <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="DELETE" ${hasDelete ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #ef4444;" />
                      ` : '<span style="color: var(--text-muted); opacity: 0.25;">—</span>'}
                    </td>

                    <td style="text-align: center; padding: 6px;">
                      ${mod.actions.includes('IMPORT') ? `
                        <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="IMPORT" ${hasImport ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #a855f7;" />
                      ` : '<span style="color: var(--text-muted); opacity: 0.25;">—</span>'}
                    </td>

                    <td style="text-align: center; padding: 6px;">
                      ${mod.actions.includes('EXPORT') ? `
                        <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="EXPORT" ${hasExport ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #6366f1;" />
                      ` : '<span style="color: var(--text-muted); opacity: 0.25;">—</span>'}
                    </td>

                    <td style="text-align: center; padding: 6px;">
                      ${mod.actions.includes('APPROVE') ? `
                        <input type="checkbox" class="chk-matrix-perm" data-mod="${mod.id}" data-act="APPROVE" ${hasApprove ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #ec4899;" />
                      ` : '<span style="color: var(--text-muted); opacity: 0.25;">—</span>'}
                    </td>

                    <td style="text-align: center; padding: 6px 8px;">
                      <button type="button" class="btn btn-ghost btn-xs btn-matrix-toggle-row" data-mod="${mod.id}" style="font-size: 10px; padding: 2px 6px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">
                        Toggle
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

function renderBulkAssignmentTab() {
  const users = storage.getTable(TABLE_NAMES.USERS) || [];
  const presets = authService.getAllPresets ? authService.getAllPresets() : [];

  // Default target users to selected ones or all
  const targetIds = selectedAccountIds.size > 0 ? Array.from(selectedAccountIds) : [];

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 18px; box-shadow: var(--shadow-sm);">
      
      <div>
        <h2 style="font-size: 17px; font-weight: 800; color: #fff; margin: 0;">
          ⚡ Bulk Access Assignment
        </h2>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
          Assign identical permission privileges across multiple accounts simultaneously across Floors, Units, or Designations.
        </p>
      </div>

      <!-- Step 1: Target Users Count & Selector -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">
            Step 1: Target Accounts
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #fff; margin-top: 2px;">
            ${targetIds.length > 0 ? `
              <span style="color: #34d399;">✓ ${targetIds.length} Target Accounts Selected</span>
            ` : `
              <span style="color: #f59e0b;">⚠️ No accounts selected yet from User Accounts tab.</span>
            `}
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="btn-bulk-select-all-active" class="btn btn-secondary btn-xs" style="font-weight: 700; font-size: 11.5px;">
            Select All Active Users (${users.filter(u => u.status === 'ACTIVE').length})
          </button>
          <button id="btn-bulk-return-to-accounts" class="btn btn-ghost btn-xs" style="color: #38bdf8; font-weight: 700;">
            👥 Pick from Accounts List &rarr;
          </button>
        </div>
      </div>

      <!-- Step 2: Choose Assignment Mode (Add vs Replace) -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 18px;">
        <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px;">
          Step 2: Choose Assignment Mode
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; background: ${bulkAssignmentMode === 'ADD' ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}; border: 1.5px solid ${bulkAssignmentMode === 'ADD' ? '#38bdf8' : 'var(--border-color)'}; padding: 12px 14px; border-radius: 8px;">
            <input type="radio" name="bulk-mode" value="ADD" ${bulkAssignmentMode === 'ADD' ? 'checked' : ''} style="margin-top: 3px; accent-color: #0284c7;" />
            <div>
              <div style="font-weight: 800; color: #38bdf8; font-size: 13px;">Mode A: Add Permissions (Additive)</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                Adds selected permissions without revoking any existing permissions already granted to the users. Safe and non-destructive.
              </div>
            </div>
          </label>

          <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; background: ${bulkAssignmentMode === 'REPLACE' ? 'rgba(239, 68, 68, 0.15)' : 'transparent'}; border: 1.5px solid ${bulkAssignmentMode === 'REPLACE' ? '#ef4444' : 'var(--border-color)'}; padding: 12px 14px; border-radius: 8px;">
            <input type="radio" name="bulk-mode" value="REPLACE" ${bulkAssignmentMode === 'REPLACE' ? 'checked' : ''} style="margin-top: 3px; accent-color: #ef4444;" />
            <div>
              <div style="font-weight: 800; color: #f87171; font-size: 13px;">Mode B: Replace Permissions (Overwrite)</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                Completely replaces all existing permissions with the new selected set. Requires an explicit confirmation dialog before execution.
              </div>
            </div>
          </label>
        </div>
      </div>

      <!-- Step 3: Choose Permission Template or Granular Permissions -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
          <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">
            Step 3: Select Privileges to Apply
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11.5px; color: var(--text-muted);">Quick Template:</span>
            <select id="uam-bulk-template-preset" class="filter-select" style="height: 28px; font-size: 11.5px;">
              <option value="">Select preset template...</option>
              ${presets.map(p => `<option value="${p.id}">${p.icon || '🛡️'} ${p.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Module Checkboxes Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
          ${PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).map(mod => {
            const currentActs = bulkTargetModulePerms[mod.id] || [];
            const hasAny = currentActs.length > 0;
            return `
              <div style="background: rgba(11, 19, 41, 0.8); border: 1px solid ${hasAny ? '#0284c7' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 8px 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-weight: 700; color: #fff; font-size: 12px;">${mod.name}</span>
                  <button type="button" class="btn btn-ghost btn-xs btn-bulk-toggle-module" data-mod="${mod.id}" style="font-size: 10px; padding: 1px 5px; color: #38bdf8;">
                    ${hasAny ? 'Clear' : 'All'}
                  </button>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${mod.actions.map(act => {
                    const isChecked = currentActs.includes(act);
                    return `
                      <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; color: ${isChecked ? '#38bdf8' : 'var(--text-muted)'}; cursor: pointer;">
                        <input type="checkbox" class="chk-bulk-mod-act" data-mod="${mod.id}" data-act="${act}" ${isChecked ? 'checked' : ''} style="cursor: pointer; accent-color: #0284c7; width: 13px; height: 13px;" />
                        <span>${act}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Execution Button Bar -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px;">
        <button id="btn-cancel-bulk-assign" class="btn btn-secondary" style="font-size: 12px;">
          Cancel
        </button>
        <button id="btn-execute-bulk-assign" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4); padding: 8px 22px; font-size: 13px;">
          🚀 Confirm &amp; Apply Bulk Permissions
        </button>
      </div>

    </div>
  `;
}

function renderPasswordManagementTab() {
  const allAccounts = userAccessService.getAllAccountsWithManpower().filter(a => a.hasAccount);
  const allFloors = masterDataService.getFloors ? masterDataService.getFloors(null, null, true) : [];

  const filtered = allAccounts.filter(acc => {
    if (passwordMgmtSearch) {
      const q = passwordMgmtSearch.toLowerCase().trim();
      if (!acc.cardNumber.toLowerCase().includes(q) && !acc.employeeName.toLowerCase().includes(q) && !acc.username.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (passwordMgmtFloor !== 'ALL' && acc.floorId !== passwordMgmtFloor) return false;
    if (passwordMgmtStatus !== 'ALL') {
      if (passwordMgmtStatus === 'TEMPORARY' && acc.passwordStatus !== 'TEMPORARY') return false;
      if (passwordMgmtStatus === 'SETUP' && acc.passwordStatus !== 'SETUP') return false;
    }
    return true;
  });

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-sm);">
      
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 17px; font-weight: 800; color: #fff; margin: 0;">
            🔑 Password Management Dashboard
          </h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
            Generate cryptographically secure 14-character initial passwords, trigger authorized resets, and prepare accounts for credential export.
          </p>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-bulk-gen-initial-pass" class="btn btn-warning btn-sm" style="font-weight: 700; font-size: 12px;">
            ⚡ Bulk Generate Initial Passwords
          </button>
          <button id="btn-jump-to-export-credentials" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #38bdf8; font-size: 12px;">
            🔐 Export Eligible Credentials &rarr;
          </button>
        </div>
      </div>

      <!-- Filters Row -->
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.6); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);">
        <input 
          type="text" 
          id="inp-pass-mgmt-search" 
          class="form-control" 
          placeholder="Search by Card #, Name, or Username..." 
          value="${passwordMgmtSearch}"
          style="height: 32px; font-size: 12px; max-width: 280px;"
        />

        <select id="sel-pass-mgmt-floor" class="filter-select" style="height: 32px; font-size: 12px; max-width: 180px;">
          <option value="ALL">🏢 All Floors</option>
          ${allFloors.map(f => `<option value="${f.id}" ${passwordMgmtFloor === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select>

        <select id="sel-pass-mgmt-status" class="filter-select" style="height: 32px; font-size: 12px; max-width: 180px;">
          <option value="ALL">🔑 All Password Status</option>
          <option value="TEMPORARY" ${passwordMgmtStatus === 'TEMPORARY' ? 'selected' : ''}>🟡 Temporary Initial Passwords</option>
          <option value="SETUP" ${passwordMgmtStatus === 'SETUP' ? 'selected' : ''}>✅ Setup / Active Passwords</option>
        </select>

        <span style="font-size: 12px; color: var(--text-muted); margin-left: auto;">
          Showing <strong>${filtered.length}</strong> accounts
        </span>
      </div>

      <!-- Password Accounts Table (Section 8) -->
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow-x: auto;">
        <table class="user-management-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 10px 12px;">Card Number</th>
              <th style="padding: 10px 12px;">Employee Name</th>
              <th style="padding: 10px 12px;">Username</th>
              <th style="padding: 10px 10px;">Unit</th>
              <th style="padding: 10px 10px;">Floor</th>
              <th style="padding: 10px 8px; text-align: center;">Account Status</th>
              <th style="padding: 10px 8px; text-align: center;">Password Status</th>
              <th style="padding: 10px 12px;">Last Password Reset</th>
              <th style="padding: 10px 12px;">Last Login</th>
              <th style="padding: 10px 12px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align: center; padding: 28px; color: var(--text-muted); font-size: 13px;">
                  No accounts found matching filters.
                </td>
              </tr>
            ` : filtered.map(acc => `
              <tr>
                <td style="padding: 9px 12px; font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">
                  #${acc.cardNumber}
                </td>
                <td style="padding: 9px 12px; font-weight: 700; color: #fff;">
                  ${acc.employeeName}
                </td>
                <td style="padding: 9px 12px; font-family: var(--font-mono); color: #cbd5e1;">
                  @${acc.username}
                </td>
                <td style="padding: 9px 10px; font-size: 11.5px; color: var(--text-secondary);">
                  ${acc.unitName}
                </td>
                <td style="padding: 9px 10px; font-size: 11.5px; color: #38bdf8;">
                  ${acc.floorName}
                </td>
                <td style="text-align: center; padding: 9px 8px;">
                  <span class="badge ${acc.accountStatus === 'ACTIVE' ? 'badge-active' : 'badge-maint'}" style="font-size: 10px;">
                    ${acc.accountStatus}
                  </span>
                </td>
                <td style="text-align: center; padding: 9px 8px;">
                  ${acc.passwordStatus === 'TEMPORARY' ? `
                    <span class="badge badge-warning" style="font-size: 10px;">🟡 Temporary</span>
                  ` : `
                    <span class="badge badge-active" style="font-size: 10px;">✅ Setup</span>
                  `}
                </td>
                <td style="padding: 9px 12px; font-size: 11px; color: var(--text-muted);">
                  ${acc.lastPasswordReset ? new Date(acc.lastPasswordReset).toLocaleString() : 'Never'}
                </td>
                <td style="padding: 9px 12px; font-size: 11px; color: var(--text-muted);">
                  ${acc.lastLoginText}
                </td>
                <td style="text-align: center; padding: 9px 12px;">
                  <div style="display: inline-flex; gap: 6px;">
                    <button class="btn btn-secondary btn-xs btn-pass-gen-reset" data-id="${acc.id}" data-is-reset="${acc.passwordStatus === 'SETUP'}" style="font-weight: 700; font-size: 11px; color: #38bdf8;">
                      ${acc.passwordStatus === 'TEMPORARY' ? '⚡ Re-generate' : '🔄 Reset Password'}
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

function renderExportAccountsTab() {
  const allAccounts = userAccessService.getAllAccountsWithManpower();
  const allFloors = masterDataService.getFloors ? masterDataService.getFloors(null, null, true) : [];
  const allGroups = masterDataService.getGroups ? masterDataService.getGroups(true) : [];
  const allUnits = masterDataService.getUnits ? masterDataService.getUnits(null, true) : [];
  const allLines = masterDataService.getLines ? masterDataService.getLines(null, null, null, true) : [];

  // Filter accounts according to exportScope
  const eligibleAccounts = allAccounts.filter(acc => {
    if (exportScope === 'SELECTED') {
      return selectedAccountIds.has(acc.id);
    }
    if (exportScope === 'FLOOR' && exportTargetFloorId) {
      return acc.floorId === exportTargetFloorId;
    }
    if (exportScope === 'GROUP' && exportTargetGroupId) {
      return acc.groupId === exportTargetGroupId;
    }
    if (exportScope === 'UNIT' && exportTargetUnitId) {
      return acc.unitId === exportTargetUnitId;
    }
    if (exportScope === 'LINE' && exportTargetLineId) {
      return acc.lineId === exportTargetLineId;
    }
    return true; // ALL or ALL_FLOORS
  });

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 20px; box-shadow: var(--shadow-sm);">
      
      <div>
        <h2 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0;">
          📥 Bulk Excel Export for All Floors (Section 9 & 10)
        </h2>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
          Export user accounts and workforce registries for all factory floors or specific organizational units into <strong>EXACTLY ONE Excel worksheet</strong>.
        </p>
      </div>

      <!-- Scope Selector Radio Cards -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
        <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 12px;">
          1. Select Export Scope
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
          
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 12px; border-radius: 6px; background: ${exportScope === 'ALL' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${exportScope === 'ALL' ? '#38bdf8' : 'var(--border-color)'};">
            <input type="radio" name="export-scope" value="ALL" ${exportScope === 'ALL' ? 'checked' : ''} style="accent-color: #0284c7;" />
            <span style="font-weight: 700; color: #fff; font-size: 12.5px;">🌐 Export All Accounts (${allAccounts.length})</span>
          </label>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 12px; border-radius: 6px; background: ${exportScope === 'ALL_FLOORS' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${exportScope === 'ALL_FLOORS' ? '#38bdf8' : 'var(--border-color)'};">
            <input type="radio" name="export-scope" value="ALL_FLOORS" ${exportScope === 'ALL_FLOORS' ? 'checked' : ''} style="accent-color: #0284c7;" />
            <span style="font-weight: 700; color: #fff; font-size: 12.5px;">🏢 Export All Floors (${allFloors.length} Floors)</span>
          </label>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 12px; border-radius: 6px; background: ${exportScope === 'FLOOR' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${exportScope === 'FLOOR' ? '#38bdf8' : 'var(--border-color)'};">
            <input type="radio" name="export-scope" value="FLOOR" ${exportScope === 'FLOOR' ? 'checked' : ''} style="accent-color: #0284c7;" />
            <span style="font-weight: 700; color: #fff; font-size: 12.5px;">📍 Export Specific Floor...</span>
          </label>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 12px; border-radius: 6px; background: ${exportScope === 'UNIT' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${exportScope === 'UNIT' ? '#38bdf8' : 'var(--border-color)'};">
            <input type="radio" name="export-scope" value="UNIT" ${exportScope === 'UNIT' ? 'checked' : ''} style="accent-color: #0284c7;" />
            <span style="font-weight: 700; color: #fff; font-size: 12.5px;">🏭 Export Specific Unit...</span>
          </label>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 12px; border-radius: 6px; background: ${exportScope === 'SELECTED' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${exportScope === 'SELECTED' ? '#38bdf8' : 'var(--border-color)'};">
            <input type="radio" name="export-scope" value="SELECTED" ${exportScope === 'SELECTED' ? 'checked' : ''} style="accent-color: #0284c7;" />
            <span style="font-weight: 700; color: #fff; font-size: 12.5px;">✓ Selected Users (${selectedAccountIds.size})</span>
          </label>

        </div>

        <!-- Conditional Scoped Dropdowns -->
        ${exportScope === 'FLOOR' ? `
          <div style="margin-top: 14px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 12px; color: var(--text-muted);">Choose Floor:</span>
            <select id="uam-export-select-floor" class="filter-select" style="height: 32px; font-size: 12px; max-width: 260px;">
              <option value="">Select factory floor...</option>
              ${allFloors.map(f => `<option value="${f.id}" ${exportTargetFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        ${exportScope === 'UNIT' ? `
          <div style="margin-top: 14px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 12px; color: var(--text-muted);">Choose Unit:</span>
            <select id="uam-export-select-unit" class="filter-select" style="height: 32px; font-size: 12px; max-width: 260px;">
              <option value="">Select factory unit...</option>
              ${allUnits.map(u => `<option value="${u.id}" ${exportTargetUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      <!-- Scope Match Counter -->
      <div style="background: rgba(2, 132, 199, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 12px; color: var(--text-muted);">Matching Export Records:</span>
          <span style="font-size: 18px; font-weight: 900; color: #38bdf8; margin-left: 8px;">${eligibleAccounts.length} Accounts</span>
        </div>
        <span style="font-size: 11.5px; color: #34d399; font-weight: 700;">✓ Formatted into exactly ONE Excel worksheet</span>
      </div>

      <!-- Two Export Action Panels: Standard vs Elevated Credential -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        
        <!-- Standard Account Export Panel -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
              <span>📄</span> <span>Standard Account Export</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
              Exports official workforce roster with Card Numbers, Names, Usernames, Designations, Units, Floors, and Permissions Summary.
              <br><strong style="color: #34d399;">🔒 Security Guaranteed: Plaintext passwords are NEVER included.</strong>
            </div>
          </div>

          <button id="btn-do-standard-export" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 10px; font-size: 13px;" ${eligibleAccounts.length === 0 ? 'disabled' : ''}>
            📥 Download Standard Excel (.xlsx)
          </button>
        </div>

        <!-- Elevated Security Credential Export Panel (Section 10) -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #f59e0b; display: flex; align-items: center; gap: 6px;">
              <span>🔐</span> <span>Confidential Credential Export</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
              Authorized export for distributing newly created or reset initial passwords.
              <br><strong style="color: #f87171;">⚠️ Elevated Verification Required:</strong> Super Admin password re-authentication is enforced. Plaintext passwords are not retained on server.
            </div>
          </div>

          <button id="btn-open-credential-export-modal" class="btn btn-warning" style="font-weight: 800; padding: 10px; font-size: 13px;" ${eligibleAccounts.length === 0 ? 'disabled' : ''}>
            🔐 Export Credentials (Admin Verified)
          </button>
        </div>

      </div>

    </div>
  `;
}

function renderActivityLogsTab() {
  const logs = userAccessService.getUserAccessLogs({ action: logActionFilter, query: logSearchQuery });

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-sm);">
      
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 17px; font-weight: 800; color: #fff; margin: 0;">
            📝 Access &amp; Password Activity Logs (Section 13)
          </h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
            Immutable audit trail of user creations, password generation, bulk permission assignments, and credential exports.
          </p>
        </div>

        <button id="btn-export-uam-logs" class="btn btn-secondary btn-sm" style="font-size: 12px; color: #38bdf8;">
          📥 Export Logs to Excel
        </button>
      </div>

      <!-- Filter Controls Bar -->
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.6); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color);">
        <input 
          type="text" 
          id="inp-uam-log-search" 
          class="form-control" 
          placeholder="Filter logs by Card #, User, Admin, or Details..." 
          value="${logSearchQuery}"
          style="height: 32px; font-size: 12px; max-width: 320px;"
        />

        <select id="sel-uam-log-action" class="filter-select" style="height: 32px; font-size: 12px; max-width: 240px;">
          <option value="ALL">⚡ All Action Categories</option>
          <option value="USER_ACCOUNT_AUTO_CREATED" ${logActionFilter === 'USER_ACCOUNT_AUTO_CREATED' ? 'selected' : ''}>User Account Auto-Created</option>
          <option value="MANPOWER_ACCOUNT_SYNC" ${logActionFilter === 'MANPOWER_ACCOUNT_SYNC' ? 'selected' : ''}>Manpower Sync Event</option>
          <option value="USER_PERMISSIONS_OVERRIDDEN" ${logActionFilter === 'USER_PERMISSIONS_OVERRIDDEN' ? 'selected' : ''}>Individual Permission Override</option>
          <option value="BULK_PERMISSIONS_ADDED" ${logActionFilter === 'BULK_PERMISSIONS_ADDED' ? 'selected' : ''}>Bulk Permissions Added</option>
          <option value="BULK_PERMISSIONS_REPLACED" ${logActionFilter === 'BULK_PERMISSIONS_REPLACED' ? 'selected' : ''}>Bulk Permissions Replaced</option>
          <option value="PASSWORD_GENERATED_INITIAL" ${logActionFilter === 'PASSWORD_GENERATED_INITIAL' ? 'selected' : ''}>Initial Password Generated</option>
          <option value="PASSWORD_RESET_ADMIN" ${logActionFilter === 'PASSWORD_RESET_ADMIN' ? 'selected' : ''}>Password Reset by Admin</option>
          <option value="ACCOUNT_EXPORT" ${logActionFilter === 'ACCOUNT_EXPORT' ? 'selected' : ''}>Account Export</option>
          <option value="CREDENTIAL_EXPORT_CONFIDENTIAL" ${logActionFilter === 'CREDENTIAL_EXPORT_CONFIDENTIAL' ? 'selected' : ''}>Confidential Credential Export</option>
        </select>

        <span style="font-size: 12px; color: var(--text-muted); margin-left: auto;">
          Showing <strong>${logs.length}</strong> activity log entries
        </span>
      </div>

      <!-- Activity Logs Table -->
      <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow-x: auto;">
        <table class="user-management-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 10px 14px; width: 160px;">Timestamp</th>
              <th style="padding: 10px 12px; width: 180px;">Action Event</th>
              <th style="padding: 10px 12px; width: 140px;">Admin / Actor</th>
              <th style="padding: 10px 12px; width: 140px;">Target User / ID</th>
              <th style="padding: 10px 8px; text-align: center; width: 80px;">Status</th>
              <th style="padding: 10px 14px;">Audit Details (Safe, No Secrets)</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; padding: 28px; color: var(--text-muted); font-size: 13px;">
                  No activity logs found.
                </td>
              </tr>
            ` : logs.slice(0, 50).map(l => {
              const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString() : '—';
              const isDanger = (l.action || '').includes('DELETE') || (l.action || '').includes('REPLACE');
              const isWarning = (l.action || '').includes('PASSWORD') || (l.action || '').includes('EXPORT');

              return `
                <tr>
                  <td style="padding: 9px 14px; font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                    ${dateStr}
                  </td>
                  <td style="padding: 9px 12px;">
                    <span class="badge ${isDanger ? 'badge-danger' : (isWarning ? 'badge-warning' : 'badge-active')}" style="font-size: 10px;">
                      ${l.action}
                    </span>
                  </td>
                  <td style="padding: 9px 12px; font-weight: 600; color: #fff; font-size: 12px;">
                    @${l.username || 'admin'}
                  </td>
                  <td style="padding: 9px 12px; font-family: var(--font-mono); font-size: 11.5px; color: #38bdf8;">
                    ${l.entityId || '—'}
                  </td>
                  <td style="text-align: center; padding: 9px 8px;">
                    <span class="badge badge-active" style="font-size: 9.5px;">SUCCESS</span>
                  </td>
                  <td style="padding: 9px 14px; font-size: 12px; color: #cbd5e1; line-height: 1.4;">
                    ${l.details || '—'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

function renderPresetsTab() {
  const presets = authService.getAllPresets ? authService.getAllPresets() : [];
  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-sm);">
      
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 17px; font-weight: 800; color: #fff; margin: 0;">
            ⚙️ Permission Presets &amp; Role Templates
          </h2>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
            Standardized access profiles (Super Admin, Maintenance Manager, Maintenance User, Supervisor, Contributor, Viewer)
          </p>
        </div>

        <button id="btn-create-new-preset-action" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 12px;">
          ➕ Create New Preset
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px;">
        ${presets.map(p => `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 22px;">${p.icon || '🛡️'}</div>
                <span class="badge ${p.isSystem ? 'badge-info' : 'badge-active'}" style="font-size: 9.5px;">
                  ${p.isSystem ? 'System Preset' : 'Custom Preset'}
                </span>
              </div>
              <div style="font-size: 15px; font-weight: 800; color: #fff; margin-top: 8px;">${p.name}</div>
              <div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-top: 2px;">${p.accessLevel || 'Configured Access'}</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">${p.description}</div>
            </div>

            <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: var(--text-muted);">Assigned Users: <strong style="color: #fff;">${p.assignedUsersCount || 0}</strong></span>
              <button class="btn btn-secondary btn-xs btn-edit-preset-item" data-id="${p.id}" style="font-size: 11px; color: #38bdf8;">
                Configure &rarr;
              </button>
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;
}

// ---------------------------------------------------------------------------
// MODALS HTML RENDERER
// ---------------------------------------------------------------------------

function renderActiveModalHtml() {
  if (!activeModalType) return '';

  // 1. View Details Modal
  if (activeModalType === 'VIEW_DETAILS' && targetAccount) {
    const acc = targetAccount;
    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 640px;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">👤</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">User &amp; Manpower Account Details</h3>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">#${acc.cardNumber} • @${acc.username}</p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px;">✕</button>
          </div>

          <div style="padding: 16px 0; display: flex; flex-direction: column; gap: 14px; font-size: 12.5px;">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div><strong style="color: var(--text-muted);">Card ID:</strong> <span style="font-family: var(--font-mono); color: #38bdf8; font-weight: 800;">#${acc.cardNumber}</span></div>
              <div><strong style="color: var(--text-muted);">Employee Name:</strong> <span style="color: #fff; font-weight: 700;">${acc.employeeName}</span></div>
              <div><strong style="color: var(--text-muted);">Username:</strong> <span style="color: #cbd5e1; font-family: var(--font-mono);">@${acc.username}</span></div>
              <div><strong style="color: var(--text-muted);">Designation:</strong> <span style="color: #fff;">${acc.designation}</span></div>
              <div><strong style="color: var(--text-muted);">Department:</strong> <span style="color: #fff;">${acc.department}</span></div>
              <div><strong style="color: var(--text-muted);">Account Status:</strong> <span class="badge ${acc.accountStatus === 'ACTIVE' ? 'badge-active' : 'badge-maint'}" style="font-size: 10px;">${acc.accountStatus}</span></div>
              <div><strong style="color: var(--text-muted);">Password Status:</strong> <span class="badge ${acc.passwordStatus === 'TEMPORARY' ? 'badge-warning' : 'badge-active'}" style="font-size: 10px;">${acc.passwordStatus}</span></div>
              <div><strong style="color: var(--text-muted);">Profile Preset:</strong> <span style="color: #38bdf8;">${acc.presetName || 'Standard User'}</span></div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px;">📍 Factory Location Placement</div>
              <div style="color: #fff; font-weight: 600;">
                ${acc.groupName} &rarr; ${acc.unitName} &rarr; ${acc.floorName} &rarr; ${acc.lineName}
              </div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.6); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 11px; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 6px;">🛡️ Configured Permissions (${acc.permissionsSummary})</div>
              <div style="font-size: 11.5px; color: #cbd5e1;">
                Granted access to ${acc.totalModules} ERP modules with ${acc.totalActions} specific operation actions.
              </div>
            </div>

          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <button class="btn btn-secondary btn-sm btn-close-uam-modal">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Password Result Modal (Displays generated/reset password once with copy button)
  if (activeModalType === 'PASSWORD_RESULT' && lastGeneratedPasswordData) {
    const data = lastGeneratedPasswordData;
    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">🔑</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #34d399;">
                  ${data.isReset ? 'Password Successfully Reset' : 'Initial Password Generated'}
                </h3>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">
                  User Account: <strong>@${data.username}</strong>
                </p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px;">✕</button>
          </div>

          <div style="padding: 20px 0; display: flex; flex-direction: column; gap: 14px;">
            <div style="font-size: 12.5px; color: #cbd5e1;">
              A unique, cryptographically secure 14-character password has been generated and hashed:
            </div>

            <div style="background: #0f172a; border: 2px dashed #0284c7; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
              <span id="txt-generated-password" style="font-family: var(--font-mono); font-size: 18px; font-weight: 900; color: #38bdf8; letter-spacing: 1px;">
                ${data.plainPassword}
              </span>
              <button id="btn-copy-generated-pass" class="btn btn-primary btn-xs" style="font-weight: 700; background: #0284c7;">
                📋 Copy
              </button>
            </div>

            <div style="font-size: 11.5px; color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 10px 12px; line-height: 1.4;">
              ⚠️ <strong>Security Notice:</strong> Plaintext passwords are not stored in the database or logs. This password is temporarily cached in memory for authorized export and distribution.
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <button class="btn btn-primary btn-sm btn-close-uam-modal" style="font-weight: 700;">Done</button>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Elevated Credential Export Challenge Modal (Section 10)
  if (activeModalType === 'CREDENTIAL_EXPORT_CONFIRM') {
    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 520px; border: 2px solid #f59e0b;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">🔐</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #f59e0b;">Confidential Credential Export Authorization</h3>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Elevated Security Challenge</p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px;">✕</button>
          </div>

          <form id="form-credential-export-auth" style="padding: 16px 0; display: flex; flex-direction: column; gap: 14px;">
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #fca5a5; line-height: 1.4;">
              ⚠️ <strong>CRITICAL SECURITY WARNING:</strong>
              <br>The file you are about to export contains active login credentials. You are strictly responsible for its confidentiality. Never send this file via unencrypted channels or store on public shared drives.
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                Confirm Administrator Password *
              </label>
              <input 
                type="password" 
                id="inp-admin-reauth-pass" 
                class="form-control" 
                placeholder="Enter your current login password to verify identity..." 
                required 
                style="height: 36px; font-size: 13px;"
              />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
              <button type="button" class="btn btn-secondary btn-sm btn-close-uam-modal">Cancel</button>
              <button type="submit" class="btn btn-warning btn-sm" style="font-weight: 800; padding: 7px 18px;">
                🔐 Verify &amp; Download Credentials (.xlsx)
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 4. Auto-Create Summary Modal
  if (activeModalType === 'AUTO_CREATE_SUMMARY' && autoCreateSummaryData) {
    const data = autoCreateSummaryData;
    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 580px;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">⚡</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #34d399;">Auto-Create Accounts Summary</h3>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">${data.successful.length} created, ${data.failed.length} failed</p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px;">✕</button>
          </div>

          <div style="padding: 16px 0; display: flex; flex-direction: column; gap: 12px; max-height: 420px; overflow-y: auto;">
            <div style="font-size: 12.5px; color: #cbd5e1;">
              Automatically created <strong>${data.successful.length}</strong> new user accounts linked to Manpower records with secure initial passwords.
            </div>

            ${data.successful.length > 0 ? `
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid #10b981; border-radius: 8px; padding: 10px 14px; font-size: 12px; max-height: 180px; overflow-y: auto;">
                <div style="font-weight: 800; color: #34d399; margin-bottom: 6px;">Created Accounts:</div>
                ${data.successful.map(s => `
                  <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: #fff;">#${s.cardNumber} - ${s.name}</span>
                    <span style="font-family: var(--font-mono); color: #38bdf8;">@${s.username}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${data.failed.length > 0 ? `
              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; border-radius: 8px; padding: 10px 14px; font-size: 12px;">
                <div style="font-weight: 800; color: #f87171; margin-bottom: 6px;">Failed Records:</div>
                ${data.failed.map(f => `
                  <div style="color: #fca5a5; padding: 2px 0;">#${f.cardNumber} (${f.name}): ${f.error}</div>
                `).join('')}
              </div>
            ` : ''}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <button class="btn btn-primary btn-sm btn-close-uam-modal" style="font-weight: 700;">OK</button>
          </div>
        </div>
      </div>
    `;
  }

  // 5. Add New User Modal (Standard)
  if (activeModalType === 'ADD_USER') {
    const activeEmployees = employeeService.getActiveEmployees ? employeeService.getActiveEmployees() : [];
    const presets = authService.getAllPresets ? authService.getAllPresets() : [];

    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 600px;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">➕</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">Add New User Account</h3>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">Create user login or link to Manpower employee</p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px;">✕</button>
          </div>

          <form id="form-uam-add-user" style="padding: 16px 0; display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Quick Manpower Autocomplete Link -->
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #38bdf8;">
                Link to Manpower Record (Optional Auto-fill)
              </label>
              <select id="sel-add-user-emp-pick" class="filter-select" style="height: 34px; font-size: 12px;">
                <option value="">-- Choose employee to auto-fill particulars --</option>
                ${activeEmployees.map(e => `<option value="${e.id}" data-card="${e.cardNumber}" data-name="${e.name}" data-desig="${e.designation}" data-dept="${e.department}" data-phone="${e.phone || ''}">${e.cardNumber} - ${e.name} (${e.designation})</option>`).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Full Name *</label>
                <input type="text" id="inp-add-user-name" class="form-control" required style="height: 34px; font-size: 12.5px;" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Card ID / Employee ID</label>
                <input type="text" id="inp-add-user-card" class="form-control" style="height: 34px; font-size: 12.5px;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Username *</label>
                <input type="text" id="inp-add-user-username" class="form-control" required placeholder="e.g. motaher, amg1042" style="height: 34px; font-size: 12.5px;" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Email Address</label>
                <input type="email" id="inp-add-user-email" class="form-control" placeholder="user@al-muslim.com" style="height: 34px; font-size: 12.5px;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Initial Password *</label>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="inp-add-user-password" class="form-control font-mono" required style="height: 34px; font-size: 12.5px;" />
                  <button type="button" id="btn-add-user-generate-pass" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #38bdf8;" title="Generate random secure password">
                    🎲 Random
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Permission Preset</label>
                <select id="sel-add-user-preset" class="filter-select" style="height: 34px; font-size: 12px;">
                  ${presets.map(p => `<option value="${p.id}">${p.icon || '🛡️'} ${p.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 6px;">
              <button type="button" class="btn btn-secondary btn-sm btn-close-uam-modal">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1);">
                ➕ Create User Account
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  return '';
}

// ---------------------------------------------------------------------------
// EVENT BINDINGS FOR USER ACCESS MANAGEMENT
// ---------------------------------------------------------------------------

export function initUserManagementEvents() {
  const root = document.getElementById('main-view-container');
  if (!root) return;

  const reRender = () => {
    if (typeof window.app !== 'undefined' && typeof window.app.renderMainContent === 'function') {
      window.app.renderMainContent(true, false, 'users');
    }
  };

  // 1. Sub-features Navigation Switcher
  root.querySelectorAll('.tab-btn-uam').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        activeUserSection = tab;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('al_muslim_user_access_section', tab);
        }
        reRender();
      }
    });
  });

  // 2. Search & Filter Input Listeners (Tab 1: User Accounts)
  const searchInp = document.getElementById('uam-search-input');
  if (searchInp) {
    let debounceTimer;
    searchInp.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value;
        currentPage = 1;
        reRender();
      }, 250);
    });
  }

  const btnClearSearch = document.getElementById('btn-clear-uam-search');
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      searchQuery = '';
      currentPage = 1;
      reRender();
    });
  }

  const bindFilter = (id, setter) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        setter(e.target.value);
        currentPage = 1;
        reRender();
      });
    }
  };

  bindFilter('uam-filter-group', val => filterGroup = val);
  bindFilter('uam-filter-unit', val => filterUnit = val);
  bindFilter('uam-filter-floor', val => filterFloor = val);
  bindFilter('uam-filter-line', val => filterLine = val);
  bindFilter('uam-filter-desig', val => filterDesignation = val);
  bindFilter('uam-filter-status', val => filterStatus = val);
  bindFilter('uam-filter-account-link', val => filterAccountLink = val);
  bindFilter('uam-filter-pass-status', val => filterPasswordStatus = val);

  const btnClearAllFilters = document.getElementById('btn-clear-all-filters');
  if (btnClearAllFilters) {
    btnClearAllFilters.addEventListener('click', () => {
      searchQuery = '';
      filterGroup = 'ALL';
      filterUnit = 'ALL';
      filterFloor = 'ALL';
      filterLine = 'ALL';
      filterDesignation = 'ALL';
      filterStatus = 'ALL';
      filterAccountLink = 'ALL';
      filterPasswordStatus = 'ALL';
      currentPage = 1;
      selectedAccountIds.clear();
      isSelectAllFiltered = false;
      reRender();
    });
  }

  // 3. Multi-Selection Checkbox Handlers
  const chkHeaderPage = document.getElementById('chk-header-select-page');
  if (chkHeaderPage) {
    chkHeaderPage.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const rowCheckboxes = root.querySelectorAll('.chk-account-row');
      rowCheckboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        if (isChecked) selectedAccountIds.add(id);
        else selectedAccountIds.delete(id);
      });
      isSelectAllFiltered = false;
      reRender();
    });
  }

  root.querySelectorAll('.chk-account-row').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = cb.getAttribute('data-id');
      if (e.target.checked) selectedAccountIds.add(id);
      else {
        selectedAccountIds.delete(id);
        isSelectAllFiltered = false;
      }
      reRender();
    });
  });

  const btnSelectAllCrossPage = document.getElementById('btn-select-all-filtered-cross-page');
  if (btnSelectAllCrossPage) {
    btnSelectAllCrossPage.addEventListener('click', () => {
      isSelectAllFiltered = true;
      const allAccounts = userAccessService.getAllAccountsWithManpower();
      allAccounts.forEach(a => {
        if (a.hasAccount) selectedAccountIds.add(a.id);
      });
      reRender();
    });
  }

  const btnDeselectAll = document.getElementById('btn-deselect-all-accounts');
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      selectedAccountIds.clear();
      isSelectAllFiltered = false;
      reRender();
    });
  }

  // 4. Pagination Event Handlers
  const pageSizeSel = document.getElementById('uam-page-size');
  if (pageSizeSel) {
    pageSizeSel.addEventListener('change', (e) => {
      rowsPerPage = parseInt(e.target.value, 10) || 20;
      currentPage = 1;
      reRender();
    });
  }

  const btnFirst = document.getElementById('btn-page-first');
  const btnPrev = document.getElementById('btn-page-prev');
  const btnNext = document.getElementById('btn-page-next');
  const btnLast = document.getElementById('btn-page-last');

  if (btnFirst) btnFirst.addEventListener('click', () => { currentPage = 1; reRender(); });
  if (btnPrev) btnPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; reRender(); } });
  if (btnNext) btnNext.addEventListener('click', () => { currentPage++; reRender(); });
  if (btnLast) btnLast.addEventListener('click', () => {
    const totalMatching = userAccessService.getAllAccountsWithManpower().length;
    currentPage = Math.ceil(totalMatching / rowsPerPage) || 1;
    reRender();
  });

  // 5. Row Action Listeners
  root.querySelectorAll('.btn-row-view-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const all = userAccessService.getAllAccountsWithManpower();
      targetAccount = all.find(a => a.id === id) || null;
      if (targetAccount) {
        activeModalType = 'VIEW_DETAILS';
        reRender();
      }
    });
  });

  root.querySelectorAll('.btn-row-manage-perms').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      permissionTargetUserId = id;
      activeUserSection = 'PERMISSIONS';
      reRender();
    });
  });

  root.querySelectorAll('.btn-row-reset-pass').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to generate a new secure password for this user?')) {
        try {
          const res = await userAccessService.generateOrResetPassword(id, true);
          lastGeneratedPasswordData = res;
          activeModalType = 'PASSWORD_RESULT';
          reRender();
          notificationService.success(`Generated new password for @${res.username}`);
        } catch (e) {
          notificationService.error('Password reset failed: ' + e.message);
        }
      }
    });
  });

  root.querySelectorAll('.btn-row-toggle-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const currentStat = btn.getAttribute('data-status');
      const actionText = currentStat === 'ACTIVE' ? 'deactivate' : 'activate';
      if (confirm(`Are you sure you want to ${actionText} this user account?`)) {
        try {
          await authService.toggleUserStatus(id);
          notificationService.success(`User account status updated`);
          reRender();
        } catch (e) {
          notificationService.error('Failed to change user status: ' + e.message);
        }
      }
    });
  });

  root.querySelectorAll('.btn-row-view-logs').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.getAttribute('data-card');
      logSearchQuery = card || '';
      activeUserSection = 'ACTIVITY_LOGS';
      reRender();
    });
  });

  // Row Action: Create Missing Account for Manpower
  root.querySelectorAll('.btn-row-create-account').forEach(btn => {
    btn.addEventListener('click', async () => {
      const empId = btn.getAttribute('data-emp-id');
      const card = btn.getAttribute('data-card');
      btn.disabled = true;
      btn.innerText = 'Creating...';
      try {
        const emp = employeeService.getEmployeeById(empId) || employeeService.getEmployeeByCardNumber(card);
        if (!emp) throw new Error('Employee record not found.');
        const res = await userAccessService.createAccountForEmployee(emp);
        lastGeneratedPasswordData = {
          username: res.user.username,
          plainPassword: res.initialPasswordPlain,
          isReset: false
        };
        activeModalType = 'PASSWORD_RESULT';
        notificationService.success(`Created account @${res.user.username} for #${emp.cardNumber}`);
        reRender();
      } catch (err) {
        notificationService.error('Failed to create account: ' + err.message);
        btn.disabled = false;
        btn.innerText = '➕ Create Account';
      }
    });
  });

  // Top Action: Auto-Create Missing Accounts for All
  const btnAutoCreateAll = document.getElementById('btn-auto-create-all-missing');
  if (btnAutoCreateAll) {
    btnAutoCreateAll.addEventListener('click', async () => {
      if (confirm('Scan all registered Manpower records and automatically generate unique User Accounts with secure initial passwords for any missing accounts?')) {
        btnAutoCreateAll.disabled = true;
        btnAutoCreateAll.innerText = 'Processing...';
        try {
          const res = await userAccessService.autoCreateMissingAccountsForAll();
          autoCreateSummaryData = res;
          activeModalType = 'AUTO_CREATE_SUMMARY';
          notificationService.success(`Auto-created ${res.successful.length} missing user accounts!`);
          reRender();
        } catch (err) {
          notificationService.error('Auto-creation failed: ' + err.message);
        } finally {
          btnAutoCreateAll.disabled = false;
        }
      }
    });
  }

  // Top Action: Add New User
  const btnTopAddUser = document.getElementById('btn-top-add-user');
  if (btnTopAddUser) {
    btnTopAddUser.addEventListener('click', () => {
      activeModalType = 'ADD_USER';
      reRender();
    });
  }

  const btnRefresh = document.getElementById('btn-refresh-uam');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      notificationService.info('Refreshing User Access Matrix...');
      reRender();
    });
  }

  // 6. Bulk Action Toolbar Buttons (From Selection Bar)
  const btnBulkJumpAssign = document.getElementById('btn-bulk-jump-assign');
  if (btnBulkJumpAssign) {
    btnBulkJumpAssign.addEventListener('click', () => {
      activeUserSection = 'BULK_ASSIGN';
      reRender();
    });
  }

  const btnBulkResetPass = document.getElementById('btn-bulk-reset-passwords-action');
  if (btnBulkResetPass) {
    btnBulkResetPass.addEventListener('click', async () => {
      const count = selectedAccountIds.size;
      if (confirm(`Are you sure you want to bulk reset passwords for ${count} selected accounts? Unique 14-character passwords will be generated and stored.`)) {
        try {
          const res = await userAccessService.bulkGenerateOrResetPasswords(Array.from(selectedAccountIds), true);
          notificationService.success(`Reset passwords for ${res.successful.length} accounts!`);
          activeUserSection = 'PASSWORD_MGMT';
          reRender();
        } catch (e) {
          notificationService.error('Bulk password reset failed: ' + e.message);
        }
      }
    });
  }

  const btnBulkActivate = document.getElementById('btn-bulk-activate-action');
  if (btnBulkActivate) {
    btnBulkActivate.addEventListener('click', async () => {
      try {
        for (const uid of selectedAccountIds) {
          await authService.updateUser(uid, { status: 'ACTIVE' });
        }
        notificationService.success(`Activated ${selectedAccountIds.size} accounts!`);
        reRender();
      } catch (e) {
        notificationService.error('Bulk activation notice: ' + e.message);
      }
    });
  }

  const btnBulkDeactivate = document.getElementById('btn-bulk-deactivate-action');
  if (btnBulkDeactivate) {
    btnBulkDeactivate.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to deactivate ${selectedAccountIds.size} accounts? They will not be able to log in.`)) {
        try {
          for (const uid of selectedAccountIds) {
            await authService.updateUser(uid, { status: 'INACTIVE' });
          }
          notificationService.success(`Deactivated ${selectedAccountIds.size} accounts!`);
          reRender();
        } catch (e) {
          notificationService.error('Bulk deactivation notice: ' + e.message);
        }
      }
    });
  }

  const btnBulkExportSel = document.getElementById('btn-bulk-export-selected');
  if (btnBulkExportSel) {
    btnBulkExportSel.addEventListener('click', () => {
      exportScope = 'SELECTED';
      activeUserSection = 'EXPORT_ACCOUNTS';
      reRender();
    });
  }

  // 7. Individual Access Permissions Matrix Handlers (Tab 2)
  const userSwitcher = document.getElementById('uam-perm-user-switcher');
  if (userSwitcher) {
    userSwitcher.addEventListener('change', (e) => {
      permissionTargetUserId = e.target.value;
      const target = authService.getUserById ? authService.getUserById(permissionTargetUserId) : null;
      editingPermissions = JSON.parse(JSON.stringify(target?.permissions || {}));
      reRender();
    });
  }

  const btnPermSelectAll = document.getElementById('btn-perm-select-all');
  if (btnPermSelectAll) {
    btnPermSelectAll.addEventListener('click', () => {
      PERMISSION_CONFIG_MODULES.forEach(g => {
        g.modules.forEach(m => {
          editingPermissions[m.id] = [...m.actions];
        });
      });
      reRender();
    });
  }

  const btnPermDeselectAll = document.getElementById('btn-perm-deselect-all');
  if (btnPermDeselectAll) {
    btnPermDeselectAll.addEventListener('click', () => {
      editingPermissions = {};
      reRender();
    });
  }

  const selLoadPreset = document.getElementById('uam-perm-load-preset');
  if (selLoadPreset) {
    selLoadPreset.addEventListener('change', (e) => {
      const pid = e.target.value;
      if (!pid) return;
      const preset = authService.getPresetById ? authService.getPresetById(pid) : null;
      if (preset && preset.permissions) {
        editingPermissions = JSON.parse(JSON.stringify(preset.permissions));
        reRender();
        notificationService.info(`Applied template from preset "${preset.name}"`);
      }
    });
  }

  const btnPermResetDefault = document.getElementById('btn-perm-reset-default');
  if (btnPermResetDefault) {
    btnPermResetDefault.addEventListener('click', () => {
      if (confirm('Reset permissions to standard default maintenance user template?')) {
        editingPermissions = JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.USER || {}));
        reRender();
      }
    });
  }

  // Checkbox toggle in Permissions Matrix
  root.querySelectorAll('.chk-matrix-perm').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const mod = cb.getAttribute('data-mod');
      const act = cb.getAttribute('data-act');
      if (!editingPermissions[mod]) editingPermissions[mod] = [];

      if (e.target.checked) {
        if (!editingPermissions[mod].includes(act)) editingPermissions[mod].push(act);
      } else {
        editingPermissions[mod] = editingPermissions[mod].filter(a => a !== act);
      }
    });
  });

  root.querySelectorAll('.btn-matrix-toggle-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const mod = btn.getAttribute('data-mod');
      const moduleDef = PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).find(m => m.id === mod);
      if (!moduleDef) return;

      const current = editingPermissions[mod] || [];
      if (current.length === moduleDef.actions.length) {
        editingPermissions[mod] = [];
      } else {
        editingPermissions[mod] = [...moduleDef.actions];
      }
      reRender();
    });
  });

  const btnPermSave = document.getElementById('btn-perm-save-changes');
  if (btnPermSave) {
    btnPermSave.addEventListener('click', async () => {
      btnPermSave.disabled = true;
      btnPermSave.innerText = 'Saving...';
      try {
        await authService.updateUserPermissions(permissionTargetUserId, editingPermissions, 'CUSTOM', 'Custom Access');
        notificationService.success('Individual access permissions saved successfully!');
        reRender();
      } catch (err) {
        notificationService.error('Save failed: ' + err.message);
        btnPermSave.disabled = false;
        btnPermSave.innerText = '💾 Save Permissions';
      }
    });
  }

  // 8. Bulk Assignment Handlers (Tab 3)
  root.querySelectorAll('input[name="bulk-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      bulkAssignmentMode = e.target.value;
      reRender();
    });
  });

  const btnBulkSelectAllActive = document.getElementById('btn-bulk-select-all-active');
  if (btnBulkSelectAllActive) {
    btnBulkSelectAllActive.addEventListener('click', () => {
      const users = storage.getTable(TABLE_NAMES.USERS) || [];
      users.filter(u => u.status === 'ACTIVE').forEach(u => selectedAccountIds.add(u.id));
      reRender();
    });
  }

  const btnBulkReturnToAccs = document.getElementById('btn-bulk-return-to-accounts');
  if (btnBulkReturnToAccs) {
    btnBulkReturnToAccs.addEventListener('click', () => {
      activeUserSection = 'ACCOUNTS';
      reRender();
    });
  }

  const selBulkTemplatePreset = document.getElementById('uam-bulk-template-preset');
  if (selBulkTemplatePreset) {
    selBulkTemplatePreset.addEventListener('change', (e) => {
      const pid = e.target.value;
      if (!pid) return;
      const preset = authService.getPresetById ? authService.getPresetById(pid) : null;
      if (preset && preset.permissions) {
        bulkTargetModulePerms = JSON.parse(JSON.stringify(preset.permissions));
        reRender();
        notificationService.info(`Loaded bulk template from "${preset.name}"`);
      }
    });
  }

  root.querySelectorAll('.chk-bulk-mod-act').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const mod = cb.getAttribute('data-mod');
      const act = cb.getAttribute('data-act');
      if (!bulkTargetModulePerms[mod]) bulkTargetModulePerms[mod] = [];
      if (e.target.checked) {
        if (!bulkTargetModulePerms[mod].includes(act)) bulkTargetModulePerms[mod].push(act);
      } else {
        bulkTargetModulePerms[mod] = bulkTargetModulePerms[mod].filter(a => a !== act);
      }
    });
  });

  root.querySelectorAll('.btn-bulk-toggle-module').forEach(btn => {
    btn.addEventListener('click', () => {
      const mod = btn.getAttribute('data-mod');
      const moduleDef = PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).find(m => m.id === mod);
      if (!moduleDef) return;
      const cur = bulkTargetModulePerms[mod] || [];
      if (cur.length === moduleDef.actions.length) {
        bulkTargetModulePerms[mod] = [];
      } else {
        bulkTargetModulePerms[mod] = [...moduleDef.actions];
      }
      reRender();
    });
  });

  const btnExecuteBulk = document.getElementById('btn-execute-bulk-assign');
  if (btnExecuteBulk) {
    btnExecuteBulk.addEventListener('click', async () => {
      const targetIds = Array.from(selectedAccountIds);
      if (targetIds.length === 0) {
        alert('Please select at least one account from User Accounts tab before applying bulk permissions.');
        activeUserSection = 'ACCOUNTS';
        reRender();
        return;
      }

      const modKeys = Object.keys(bulkTargetModulePerms).filter(k => (bulkTargetModulePerms[k] || []).length > 0);
      if (modKeys.length === 0) {
        alert('Please select at least one module privilege to assign in Step 3.');
        return;
      }

      if (bulkAssignmentMode === 'REPLACE') {
        const confirmReplace = confirm(
          `⚠️ WARNING: Mode B (Replace Permissions) will overwrite all existing custom permissions for ${targetIds.length} users with the selected set. Are you sure you wish to proceed?`
        );
        if (!confirmReplace) return;
      }

      btnExecuteBulk.disabled = true;
      btnExecuteBulk.innerText = 'Applying Updates...';

      try {
        const res = await userAccessService.bulkAssignPermissions(targetIds, bulkTargetModulePerms, bulkAssignmentMode);
        notificationService.success(
          `Bulk permissions applied successfully in [${res.mode}] mode to ${res.successful.length} accounts!`
        );
        activeUserSection = 'ACCOUNTS';
        selectedAccountIds.clear();
        reRender();
      } catch (err) {
        notificationService.error('Bulk assignment failed: ' + err.message);
        btnExecuteBulk.disabled = false;
        btnExecuteBulk.innerText = '🚀 Confirm & Apply Bulk Permissions';
      }
    });
  }

  // 9. Password Management Handlers (Tab 4)
  const passSearchInp = document.getElementById('inp-pass-mgmt-search');
  if (passSearchInp) {
    passSearchInp.addEventListener('input', (e) => {
      passwordMgmtSearch = e.target.value;
      reRender();
    });
  }

  const passFloorSel = document.getElementById('sel-pass-mgmt-floor');
  if (passFloorSel) {
    passFloorSel.addEventListener('change', (e) => {
      passwordMgmtFloor = e.target.value;
      reRender();
    });
  }

  const passStatusSel = document.getElementById('sel-pass-mgmt-status');
  if (passStatusSel) {
    passStatusSel.addEventListener('change', (e) => {
      passwordMgmtStatus = e.target.value;
      reRender();
    });
  }

  root.querySelectorAll('.btn-pass-gen-reset').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const isReset = btn.getAttribute('data-is-reset') === 'true';
      if (confirm(`Generate secure 14-character ${isReset ? 'reset password' : 'initial password'} for this user?`)) {
        try {
          const res = await userAccessService.generateOrResetPassword(id, isReset);
          lastGeneratedPasswordData = res;
          activeModalType = 'PASSWORD_RESULT';
          reRender();
        } catch (e) {
          notificationService.error('Password operation failed: ' + e.message);
        }
      }
    });
  });

  const btnBulkGenInitial = document.getElementById('btn-bulk-gen-initial-pass');
  if (btnBulkGenInitial) {
    btnBulkGenInitial.addEventListener('click', async () => {
      const allAccounts = userAccessService.getAllAccountsWithManpower().filter(a => a.hasAccount && a.passwordStatus === 'TEMPORARY');
      if (allAccounts.length === 0) {
        alert('All existing user accounts already have passwords setup.');
        return;
      }
      if (confirm(`Generate secure initial passwords for ${allAccounts.length} eligible accounts?`)) {
        try {
          const res = await userAccessService.bulkGenerateOrResetPasswords(allAccounts.map(a => a.id), false);
          notificationService.success(`Generated initial passwords for ${res.successful.length} accounts.`);
          reRender();
        } catch (e) {
          notificationService.error('Bulk generation failed: ' + e.message);
        }
      }
    });
  }

  const btnJumpToExportCreds = document.getElementById('btn-jump-to-export-credentials');
  if (btnJumpToExportCreds) {
    btnJumpToExportCreds.addEventListener('click', () => {
      activeUserSection = 'EXPORT_ACCOUNTS';
      reRender();
    });
  }

  // 10. Single-Worksheet Excel Export Handlers (Tab 5)
  root.querySelectorAll('input[name="export-scope"]').forEach(r => {
    r.addEventListener('change', (e) => {
      exportScope = e.target.value;
      reRender();
    });
  });

  const selExpFloor = document.getElementById('uam-export-select-floor');
  if (selExpFloor) {
    selExpFloor.addEventListener('change', (e) => {
      exportTargetFloorId = e.target.value;
      reRender();
    });
  }

  const selExpUnit = document.getElementById('uam-export-select-unit');
  if (selExpUnit) {
    selExpUnit.addEventListener('change', (e) => {
      exportTargetUnitId = e.target.value;
      reRender();
    });
  }

  // Standard Single-Worksheet Export
  const btnStandardExport = document.getElementById('btn-do-standard-export');
  if (btnStandardExport) {
    btnStandardExport.addEventListener('click', async () => {
      btnStandardExport.disabled = true;
      btnStandardExport.innerText = 'Generating Excel...';
      try {
        const allAccounts = userAccessService.getAllAccountsWithManpower();
        const eligible = allAccounts.filter(acc => {
          if (exportScope === 'SELECTED') return selectedAccountIds.has(acc.id);
          if (exportScope === 'FLOOR' && exportTargetFloorId) return acc.floorId === exportTargetFloorId;
          if (exportScope === 'UNIT' && exportTargetUnitId) return acc.unitId === exportTargetUnitId;
          return true;
        });

        const res = await userAccessService.exportAccountsToExcel(eligible, exportScope);
        notificationService.success(`Downloaded ${res.filename} (${res.count} records, 1 worksheet)!`);
      } catch (err) {
        notificationService.error('Export failed: ' + err.message);
      } finally {
        btnStandardExport.disabled = false;
        btnStandardExport.innerText = '📥 Download Standard Excel (.xlsx)';
      }
    });
  }

  // Elevated Confidential Credential Export Button
  const btnOpenCredModal = document.getElementById('btn-open-credential-export-modal');
  if (btnOpenCredModal) {
    btnOpenCredModal.addEventListener('click', () => {
      activeModalType = 'CREDENTIAL_EXPORT_CONFIRM';
      reRender();
    });
  }

  // 11. Modal Event Handlers
  root.querySelectorAll('.btn-close-uam-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      activeModalType = null;
      reRender();
    });
  });

  const btnCopyPass = document.getElementById('btn-copy-generated-pass');
  if (btnCopyPass) {
    btnCopyPass.addEventListener('click', () => {
      const txt = document.getElementById('txt-generated-password')?.innerText?.trim();
      if (txt && navigator.clipboard) {
        navigator.clipboard.writeText(txt);
        btnCopyPass.innerText = '✓ Copied!';
        setTimeout(() => { if (btnCopyPass) btnCopyPass.innerText = '📋 Copy'; }, 2000);
      }
    });
  }

  const formCredExport = document.getElementById('form-credential-export-auth');
  if (formCredExport) {
    formCredExport.addEventListener('submit', async (e) => {
      e.preventDefault();
      const adminPass = document.getElementById('inp-admin-reauth-pass')?.value;
      const submitBtn = formCredExport.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Verifying & Generating...'; }

      try {
        const allAccounts = userAccessService.getAllAccountsWithManpower();
        const eligible = allAccounts.filter(acc => {
          if (exportScope === 'SELECTED') return selectedAccountIds.has(acc.id);
          if (exportScope === 'FLOOR' && exportTargetFloorId) return acc.floorId === exportTargetFloorId;
          if (exportScope === 'UNIT' && exportTargetUnitId) return acc.unitId === exportTargetUnitId;
          return true;
        });

        const res = await userAccessService.exportCredentialsToExcel(eligible, adminPass, exportScope);
        activeModalType = null;
        notificationService.success(`Downloaded confidential credentials: ${res.filename} (${res.count} records, 1 worksheet)!`);
        reRender();
      } catch (err) {
        notificationService.error('Verification failed: ' + err.message);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '🔐 Verify & Download Credentials (.xlsx)'; }
      }
    });
  }

  // Add User Form Submission
  const formAddUser = document.getElementById('form-uam-add-user');
  if (formAddUser) {
    const selEmpPick = document.getElementById('sel-add-user-emp-pick');
    if (selEmpPick) {
      selEmpPick.addEventListener('change', (e) => {
        const opt = selEmpPick.options[selEmpPick.selectedIndex];
        if (opt && opt.value) {
          const inpName = document.getElementById('inp-add-user-name');
          const inpCard = document.getElementById('inp-add-user-card');
          const inpUser = document.getElementById('inp-add-user-username');
          const inpEmail = document.getElementById('inp-add-user-email');

          if (inpName) inpName.value = opt.getAttribute('data-name') || '';
          if (inpCard) inpCard.value = opt.getAttribute('data-card') || '';
          const cleanCard = (opt.getAttribute('data-card') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (inpUser) inpUser.value = cleanCard ? `emp${cleanCard}` : '';
          if (inpEmail) inpEmail.value = `${cleanCard || 'emp'}@al-muslim.com`;
        }
      });
    }

    const btnGenPass = document.getElementById('btn-add-user-generate-pass');
    if (btnGenPass) {
      btnGenPass.addEventListener('click', () => {
        const passInp = document.getElementById('inp-add-user-password');
        if (passInp) passInp.value = userAccessService.generateSecurePassword(14);
      });
    }

    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('inp-add-user-name')?.value?.trim();
      const card = document.getElementById('inp-add-user-card')?.value?.trim();
      const username = document.getElementById('inp-add-user-username')?.value?.trim();
      const email = document.getElementById('inp-add-user-email')?.value?.trim() || `${username}@al-muslim.com`;
      const password = document.getElementById('inp-add-user-password')?.value?.trim();
      const presetId = document.getElementById('sel-add-user-preset')?.value;

      try {
        const newUser = await authService.createUser({
          name,
          username,
          password,
          email,
          employeeId: card,
          presetId
        });

        // Store initial password in temporary elevated cache
        userAccessService.setTemporaryCredential(newUser.id, password);

        activeModalType = null;
        notificationService.success(`User account @${newUser.username} registered successfully!`);
        reRender();
      } catch (err) {
        notificationService.error('Failed to create user: ' + err.message);
      }
    });
  }

  // 12. Activity Logs Filter Listeners (Tab 6)
  const logSearchInp = document.getElementById('inp-uam-log-search');
  if (logSearchInp) {
    logSearchInp.addEventListener('input', (e) => {
      logSearchQuery = e.target.value;
      reRender();
    });
  }

  const logActSel = document.getElementById('sel-uam-log-action');
  if (logActSel) {
    logActSel.addEventListener('change', (e) => {
      logActionFilter = e.target.value;
      reRender();
    });
  }

  const btnExportLogs = document.getElementById('btn-export-uam-logs');
  if (btnExportLogs) {
    btnExportLogs.addEventListener('click', () => {
      if (!window.XLSX) { alert('Excel library is loading...'); return; }
      const logs = userAccessService.getUserAccessLogs({ action: logActionFilter, query: logSearchQuery });
      const rows = logs.map(l => ({
        Timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString() : '',
        Action: l.action,
        Admin: l.username,
        Target: l.entityId,
        Details: l.details
      }));
      const ws = window.XLSX.utils.json_to_sheet(rows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Access_Activity_Logs');
      window.XLSX.writeFile(wb, `Al_Muslim_ERP_Access_Logs_${Date.now()}.xlsx`);
      notificationService.success('Exported activity logs to single-sheet Excel!');
    });
  }

  // 13. Preset Actions
  const btnCreatePreset = document.getElementById('btn-create-new-preset-action');
  if (btnCreatePreset) {
    btnCreatePreset.addEventListener('click', () => {
      const name = prompt('Enter a name for the new Permission Preset:');
      if (name && name.trim()) {
        authService.createPreset({ name: name.trim() })
          .then(p => {
            notificationService.success(`Created preset "${p.name}"`);
            reRender();
          })
          .catch(e => notificationService.error('Preset creation failed: ' + e.message));
      }
    });
  }
}
