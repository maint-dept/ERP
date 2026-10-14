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

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Filtering & Search State
let searchQuery = '';
let cardSearchQuery = '';
let shouldRestoreSearchFocus = false;
let searchFocusCursorPos = 0;
let shouldRestoreCardSearchFocus = false;
let cardSearchFocusCursorPos = 0;
let permCardSearchQuery = '';
let permModuleFilterQuery = '';
let presetModuleFilterQuery = '';
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
let currentCalculatedTotalPages = 1;

// Multi-Selection State
let selectedAccountIds = new Set();
let isSelectAllFiltered = false;

// Modal & Sub-screen States
let activeModalType = null; // 'VIEW_DETAILS' | 'EDIT_ACCOUNT' | 'MANAGE_PERMS' | 'RESET_PASSWORD' | 'PASSWORD_RESULT' | 'CREDENTIAL_EXPORT_CONFIRM' | 'BULK_CONFIRM' | 'AUTO_CREATE_SUMMARY' | 'ADD_USER' | 'CREATE_EDIT_PRESET' | 'ASSIGN_USERS_TO_PRESET'
let targetAccount = null;
let targetUser = null;
let lastGeneratedPasswordData = null; // { username, plainPassword, isReset }
let autoCreateSummaryData = null; // { successful: [], failed: [] }
let summaryModalSearchQuery = '';
let addModalSelectedEmployee = null;
let addModalCardSearchQuery = '';
let isAddModalManualMode = false;
let quickCardFilter = 'ALL'; // 'ALL' | 'WITH_CARD' | 'ACTIVE' | 'INACTIVE' | 'MISSING_ACCOUNT' | 'TEMP_PASS'

// Permissions Matrix Editing State
let permissionTargetUserId = null;
let editingPermissions = {};
let editingScope = { allGroups: false, groupIds: [], allUnits: false, unitIds: [], allFloors: false, floorIds: [], allLines: false, lineIds: [] };

// Bulk Assignment Form State
let bulkSelectedUserIds = [];
let bulkTargetModulePerms = {};
let bulkAssignmentMode = 'ADD'; // 'ADD' | 'REPLACE'
let bulkPresetTemplateId = '';
let bulkApplyScope = false;
let bulkTargetScope = { allGroups: false, groupIds: [], allUnits: false, unitIds: [], allFloors: false, floorIds: [], allLines: false, lineIds: [] };

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
  const withCardCount = allAccounts.filter(a => a.cardNumber && a.cardNumber !== '—' && a.cardNumber.trim() !== '').length;

  // Master Data Options for Filters with Dynamic Hierarchy Cascading
  const allGroups = masterDataService.getGroups ? masterDataService.getGroups(true) : [];
  const allUnits = masterDataService.getUnits ? masterDataService.getUnits(filterGroup !== 'ALL' ? filterGroup : null, true) : [];
  const allFloors = masterDataService.getFloors ? masterDataService.getFloors(filterUnit !== 'ALL' ? filterUnit : null, filterGroup !== 'ALL' ? filterGroup : null, true) : [];
  const allLines = masterDataService.getLines ? masterDataService.getLines(filterFloor !== 'ALL' ? filterFloor : null, filterUnit !== 'ALL' ? filterUnit : null, filterGroup !== 'ALL' ? filterGroup : null, true) : [];

  // Auto-validate and self-heal filters if child option no longer exists in parent scope
  if (filterUnit !== 'ALL' && !allUnits.some(u => u.id === filterUnit)) filterUnit = 'ALL';
  if (filterFloor !== 'ALL' && !allFloors.some(f => f.id === filterFloor)) filterFloor = 'ALL';
  if (filterLine !== 'ALL' && !allLines.some(l => l.id === filterLine)) filterLine = 'ALL';

  const allDesignations = employeeService.getDistinctDesignations ? employeeService.getDistinctDesignations() : [];

  // Apply Filters to Accounts
  const filteredAccounts = allAccounts.filter(acc => {
    // Quick Card / Status Chip Filter
    if (quickCardFilter === 'WITH_CARD' && (!acc.cardNumber || acc.cardNumber === '—')) return false;
    if (quickCardFilter === 'ACTIVE' && (acc.accountStatus !== 'ACTIVE' || !acc.hasAccount)) return false;
    if (quickCardFilter === 'INACTIVE' && (acc.accountStatus !== 'INACTIVE' || !acc.hasAccount)) return false;
    if (quickCardFilter === 'MISSING_ACCOUNT' && acc.hasAccount) return false;
    if (quickCardFilter === 'TEMP_PASS' && (!acc.hasAccount || (acc.passwordStatus !== 'TEMPORARY' && acc.passwordStatus !== 'PENDING'))) return false;

    // Dedicated Card Search Option
    if (cardSearchQuery) {
      const matchCard = userAccessService.matchesCardNumber ? userAccessService.matchesCardNumber(acc.cardNumber, cardSearchQuery) : (acc.cardNumber || '').toLowerCase().includes(cardSearchQuery.toLowerCase());
      if (!matchCard) return false;
    }

    // 1. Text Search (Card Number, Name, Username, Designation, Group, Unit, Floor, Line)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchCard = userAccessService.matchesCardNumber ? userAccessService.matchesCardNumber(acc.cardNumber, searchQuery) : (acc.cardNumber || '').toLowerCase().includes(q);
      const matchName = (acc.employeeName || '').toLowerCase().includes(q);
      const matchUser = (acc.username || '').toLowerCase().includes(q);
      const matchDept = (acc.department || '').toLowerCase().includes(q);
      const matchDesig = (acc.designation || '').toLowerCase().includes(q);
      const matchGroup = (acc.groupName || '').toLowerCase().includes(q);
      const matchUnit = (acc.unitName || '').toLowerCase().includes(q);
      const matchFloor = (acc.floorName || '').toLowerCase().includes(q);
      const matchLine = (acc.lineName || '').toLowerCase().includes(q);
      if (!matchCard && !matchName && !matchUser && !matchDept && !matchDesig && !matchGroup && !matchUnit && !matchFloor && !matchLine) return false;
    }

    // 2. Location Filters (Matching ID or case-insensitive Name / Working Area)
    if (filterGroup !== 'ALL') {
      const selectedGroup = allGroups.find(g => g.id === filterGroup);
      const groupName = selectedGroup ? selectedGroup.name.toLowerCase() : '';
      const matchG = acc.groupId === filterGroup || (groupName && (acc.groupName || '').toLowerCase() === groupName);
      if (!matchG) return false;
    }

    if (filterUnit !== 'ALL') {
      const selectedUnit = allUnits.find(u => u.id === filterUnit);
      const unitName = selectedUnit ? selectedUnit.name.toLowerCase() : '';
      const matchU = acc.unitId === filterUnit || (unitName && (acc.unitName || '').toLowerCase() === unitName);
      if (!matchU) return false;
    }

    if (filterFloor !== 'ALL') {
      const selectedFloor = allFloors.find(f => f.id === filterFloor);
      const floorName = selectedFloor ? selectedFloor.name.toLowerCase() : '';
      const matchF = acc.floorId === filterFloor || (floorName && (acc.floorName || '').toLowerCase() === floorName);
      if (!matchF) return false;
    }

    if (filterLine !== 'ALL') {
      const selectedLine = allLines.find(l => l.id === filterLine);
      const lineName = selectedLine ? selectedLine.name.toLowerCase() : '';
      const accLineId = acc.lineId || '';
      const accLineName = (acc.lineName || '').toLowerCase();
      const accArea = (acc.workingArea || acc.linkedEmployee?.workingArea || '').toLowerCase();
      const matchL = accLineId === filterLine || 
                     (lineName && (accLineName === lineName || accArea === lineName || accArea.includes(lineName)));
      if (!matchL) return false;
    }

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
  currentCalculatedTotalPages = totalPages;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + rowsPerPage);

  // Sync Select All state
  const isPageAllSelected = paginatedAccounts.length > 0 && paginatedAccounts.every(a => selectedAccountIds.has(a.id));

  return `
    <div class="page-view uam-dashboard-page">
      
      <!-- =================================================================== -->
      <!-- FIXED TOP DECK: Header, KPI Summary, Navigation Tabs & Filters      -->
      <!-- =================================================================== -->
      <div class="uam-fixed-top-deck">
        
        <!-- 1. TOP HEADER & KPI SUMMARY DASHBOARD (Compact & High-Density) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(14, 165, 233, 0.05)); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 16px;">
            👥
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h1 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px;">
                User Access Management
              </h1>
              <span class="badge badge-active" style="font-size: 10px; padding: 1px 7px; font-weight: 700;">
                Enterprise Security Matrix
              </span>
              <span style="font-size: 11px; color: var(--text-muted);">
                • Centralized workforce accounts &amp; permissions
              </span>
            </div>
          </div>
        </div>

        <!-- Top Right Action Controls -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          ${isAdmin ? `
            ${pendingCreation > 0 ? `
              <button id="btn-auto-create-all-missing" class="btn btn-warning btn-xs" style="font-weight: 800; padding: 4px 10px; font-size: 11px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;" title="Auto-create linked accounts for all ${pendingCreation} manpower records currently without an account">
                <span>⚡</span> <span>Auto-Create Missing (${pendingCreation})</span>
              </button>
            ` : ''}
            <button id="btn-top-add-user" class="btn btn-primary btn-xs" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 5px 12px; font-size: 11.5px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; height: 28px;">
              <span>➕</span> <span>Add New User</span>
            </button>
          ` : ''}
          <button id="btn-refresh-uam" class="btn btn-secondary btn-xs" style="padding: 5px 10px; font-size: 11.5px; border-radius: 6px; height: 28px;" title="Refresh Accounts and Database">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- 2. High-Density Dashboard KPI Metrics Ribbon (Interactive) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px;">
        <!-- 1. Total Accounts -->
        <div class="uam-kpi-summary-card" data-action="TOTAL" style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-color); border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;" title="Click to view all accounts">
          <div>
            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">Total Accounts</div>
            <div style="font-size: 16px; font-weight: 900; color: #fff; line-height: 1.1; margin-top: 1px;">${totalAccounts}</div>
          </div>
          <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 13px;">👥</div>
        </div>

        <!-- 2. Active Accounts -->
        <div class="uam-kpi-summary-card" data-action="ACTIVE" style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-color); border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;" title="Click to filter active accounts">
          <div>
            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">Active Accounts</div>
            <div style="font-size: 16px; font-weight: 900; color: #34d399; line-height: 1.1; margin-top: 1px;">${activeAccounts}</div>
          </div>
          <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 13px;">🟢</div>
        </div>

        <!-- 3. Inactive Accounts -->
        <div class="uam-kpi-summary-card" data-action="INACTIVE" style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-color); border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;" title="Click to filter inactive accounts">
          <div>
            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">Inactive Accounts</div>
            <div style="font-size: 16px; font-weight: 900; color: #94a3b8; line-height: 1.1; margin-top: 1px;">${inactiveAccounts}</div>
          </div>
          <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(148, 163, 184, 0.12); color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 13px;">🔴</div>
        </div>

        <!-- 4. Accounts Pending Creation -->
        <div class="uam-kpi-summary-card" data-action="PENDING_CREATION" style="background: rgba(15, 23, 42, 0.65); border: 1px solid ${pendingCreation > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)'}; border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;" title="Click to filter manpower records missing user accounts">
          <div>
            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">Pending Creation</div>
            <div style="font-size: 16px; font-weight: 900; color: ${pendingCreation > 0 ? '#fbbf24' : '#fff'}; line-height: 1.1; margin-top: 1px;">${pendingCreation}</div>
          </div>
          <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(245, 158, 11, 0.12); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 13px;">⏳</div>
        </div>

        <!-- 5. Accounts Pending Password Setup -->
        <div class="uam-kpi-summary-card" data-action="PENDING_PASSWORD" style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-color); border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;" title="Click to filter accounts with temporary passwords">
          <div>
            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">Temp / Pending Pass</div>
            <div style="font-size: 16px; font-weight: 900; color: #c084fc; line-height: 1.1; margin-top: 1px;">${pendingPasswordSetup}</div>
          </div>
          <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(168, 85, 247, 0.12); color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 13px;">🔑</div>
        </div>

        <!-- 6. Users with Permissions -->
        <div class="uam-kpi-summary-card" data-action="CONFIGURED_ACCESS" style="background: rgba(15, 23, 42, 0.65); border: 1px solid var(--border-color); border-radius: 7px; padding: 5px 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;" title="Click to view Access Permissions">
          <div>
            <div style="font-size: 9.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">Configured Access</div>
            <div style="font-size: 16px; font-weight: 900; color: #38bdf8; line-height: 1.1; margin-top: 1px;">${usersWithPermissions}</div>
          </div>
          <div style="width: 26px; height: 26px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 13px;">🛡️</div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- 3. PRIMARY SUB-FEATURES NAVIGATION BAR                              -->
      <!-- =================================================================== -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; gap: 6px; flex-wrap: wrap;">
        <!-- Left: 6 Sub-features Switcher Tabs -->
        <div style="display: inline-flex; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 2px; gap: 2px; flex-wrap: wrap;">
          
          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="ACCOUNTS"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'ACCOUNTS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'ACCOUNTS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>👥 1. User Accounts</span>
            <span style="background: ${activeUserSection === 'ACCOUNTS' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(148, 163, 184, 0.15)'}; color: ${activeUserSection === 'ACCOUNTS' ? '#fff' : '#94a3b8'}; padding: 1px 6px; border-radius: 8px; font-size: 10px;">${totalAccounts}</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="PERMISSIONS"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'PERMISSIONS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PERMISSIONS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>🛡️ 2. Access Permissions</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="BULK_ASSIGN"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'BULK_ASSIGN' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'BULK_ASSIGN' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>⚡ 3. Bulk Access</span>
            ${selectedAccountIds.size > 0 ? `<span style="background: #f59e0b; color: #000; font-weight: 900; padding: 1px 6px; border-radius: 8px; font-size: 10px;">${selectedAccountIds.size}</span>` : ''}
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="PASSWORD_MGMT"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'PASSWORD_MGMT' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PASSWORD_MGMT' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>🔑 4. Passwords</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="EXPORT_ACCOUNTS"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'EXPORT_ACCOUNTS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'EXPORT_ACCOUNTS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>📥 5. Export</span>
          </button>

          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="ACTIVITY_LOGS"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'ACTIVITY_LOGS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'ACTIVITY_LOGS' ? '#fff' : 'var(--text-secondary)'};"
          >
            <span>📝 6. Logs</span>
          </button>

          <!-- 7. Preserved Presets Feature Tab -->
          <button 
            type="button" 
            class="tab-btn-uam" 
            data-tab="PRESETS"
            style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; background: ${activeUserSection === 'PRESETS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PRESETS' ? '#fff' : 'var(--text-muted)'};"
          >
            <span>⚙️ Presets (${presets.length})</span>
          </button>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- TAB 1: USER ACCOUNTS DASHBOARD                                      -->
      <!-- =================================================================== -->
      ${activeUserSection === 'ACCOUNTS' ? `
        <!-- Search and Multi-Filtering Command Bar (Compact 2-Row Design) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow-sm);">
          
          <!-- Row 1: Search Inputs + Quick Filter Chips + Counter & Clear -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 6px; flex: 1 1 480px; align-items: center; flex-wrap: wrap;">
              
              <!-- Card Search -->
              <div style="width: 155px; min-width: 140px; position: relative;">
                <span style="position: absolute; left: 8px; top: 6px; font-size: 12px; color: #38bdf8;">🪪</span>
                <input 
                  type="text" 
                  id="uam-card-search-input" 
                  class="form-control font-mono" 
                  placeholder="Card # (e.g. 05234)..." 
                  value="${cardSearchQuery}"
                  style="height: 28px; padding-left: 28px; font-size: 11.5px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.4); background: rgba(9, 14, 26, 0.7); width: 100%; box-sizing: border-box;"
                />
                ${cardSearchQuery ? `
                  <button id="btn-clear-uam-card-search" type="button" style="position: absolute; right: 6px; top: 5px; background: transparent; border: none; color: #38bdf8; cursor: pointer; font-size: 11px;" title="Clear Card Search">✕</button>
                ` : ''}
              </div>

              <!-- General Search -->
              <div style="flex: 1 1 200px; min-width: 170px; position: relative;">
                <span style="position: absolute; left: 8px; top: 6px; font-size: 12px; color: var(--text-muted);">🔍</span>
                <input 
                  type="text" 
                  id="uam-search-input" 
                  class="form-control" 
                  placeholder="Search by Name, Username, Department..." 
                  value="${searchQuery}"
                  style="height: 28px; padding-left: 26px; font-size: 11.5px; border-radius: 6px; width: 100%; box-sizing: border-box;"
                />
                ${searchQuery ? `
                  <button id="btn-clear-uam-search" type="button" style="position: absolute; right: 6px; top: 5px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 11px;" title="Clear Search">✕</button>
                ` : ''}
              </div>

              <!-- Inline Quick Filter Chips -->
              <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn-uam-quick-chip" data-filter="ALL" style="padding: 2px 8px; height: 26px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1px solid ${quickCardFilter === 'ALL' ? '#0284c7' : 'var(--border-color)'}; background: ${quickCardFilter === 'ALL' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)'}; color: ${quickCardFilter === 'ALL' ? '#38bdf8' : 'var(--text-secondary)'}; cursor: pointer;">
                  All (${allAccounts.length})
                </button>
                <button type="button" class="btn-uam-quick-chip" data-filter="WITH_CARD" style="padding: 2px 8px; height: 26px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1px solid ${quickCardFilter === 'WITH_CARD' ? '#0284c7' : 'var(--border-color)'}; background: ${quickCardFilter === 'WITH_CARD' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)'}; color: ${quickCardFilter === 'WITH_CARD' ? '#38bdf8' : 'var(--text-secondary)'}; cursor: pointer;">
                  🪪 Card (${withCardCount})
                </button>
                <button type="button" class="btn-uam-quick-chip" data-filter="ACTIVE" style="padding: 2px 8px; height: 26px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1px solid ${quickCardFilter === 'ACTIVE' ? '#10b981' : 'var(--border-color)'}; background: ${quickCardFilter === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)'}; color: ${quickCardFilter === 'ACTIVE' ? '#34d399' : 'var(--text-secondary)'}; cursor: pointer;">
                  🟢 Active (${activeAccounts})
                </button>
                <button type="button" class="btn-uam-quick-chip" data-filter="INACTIVE" style="padding: 2px 8px; height: 26px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1px solid ${quickCardFilter === 'INACTIVE' ? '#ef4444' : 'var(--border-color)'}; background: ${quickCardFilter === 'INACTIVE' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 23, 42, 0.6)'}; color: ${quickCardFilter === 'INACTIVE' ? '#f87171' : 'var(--text-secondary)'}; cursor: pointer;">
                  🔴 Inactive (${inactiveAccounts})
                </button>
                <button type="button" class="btn-uam-quick-chip" data-filter="MISSING_ACCOUNT" style="padding: 2px 8px; height: 26px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1px solid ${quickCardFilter === 'MISSING_ACCOUNT' ? '#f59e0b' : 'var(--border-color)'}; background: ${quickCardFilter === 'MISSING_ACCOUNT' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)'}; color: ${quickCardFilter === 'MISSING_ACCOUNT' ? '#fbbf24' : 'var(--text-secondary)'}; cursor: pointer;">
                  ⏳ Missing (${pendingCreation})
                </button>
                <button type="button" class="btn-uam-quick-chip" data-filter="TEMP_PASS" style="padding: 2px 8px; height: 26px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1px solid ${quickCardFilter === 'TEMP_PASS' ? '#a855f7' : 'var(--border-color)'}; background: ${quickCardFilter === 'TEMP_PASS' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(15, 23, 42, 0.6)'}; color: ${quickCardFilter === 'TEMP_PASS' ? '#c084fc' : 'var(--text-secondary)'}; cursor: pointer;">
                  🔑 Temp Pass (${pendingPasswordSetup})
                </button>
              </div>

            </div>

            <!-- Match counter & Reset -->
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
                Showing <strong>${paginatedAccounts.length}</strong> of <strong>${totalMatching}</strong>
              </span>
              ${(searchQuery || cardSearchQuery || quickCardFilter !== 'ALL' || filterGroup !== 'ALL' || filterUnit !== 'ALL' || filterFloor !== 'ALL' || filterLine !== 'ALL' || filterDesignation !== 'ALL' || filterStatus !== 'ALL' || filterAccountLink !== 'ALL' || filterPasswordStatus !== 'ALL') ? `
                <button id="btn-clear-all-filters" class="btn btn-ghost btn-xs" style="color: #f87171; font-weight: 700; border: 1px solid rgba(248, 113, 113, 0.3); border-radius: 5px; padding: 2px 6px; font-size: 10.5px;">
                  ✕ Clear All
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Row 2: Cascading Location Dropdowns + Attribute Filters -->
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <!-- Location Cascades (Connected Visual Hierarchy) -->
            <div style="display: flex; align-items: center; gap: 4px; background: rgba(9, 14, 26, 0.6); padding: 2px 4px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.2); flex-wrap: wrap;">
              <!-- Group -->
              <select id="uam-filter-group" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 140px; border-radius: 5px;" title="Filter by Enterprise Group">
                <option value="ALL" ${filterGroup === 'ALL' ? 'selected' : ''}>🏢 All Groups</option>
                ${allGroups.map(g => `<option value="${g.id}" ${filterGroup === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
              </select>

              <!-- Unit -->
              <select id="uam-filter-unit" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 150px; border-radius: 5px;" title="Filter by Manufacturing Unit">
                <option value="ALL" ${filterUnit === 'ALL' ? 'selected' : ''}>🏭 All Units</option>
                ${allUnits.map(u => `<option value="${u.id}" ${filterUnit === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
              </select>

              <!-- Floor -->
              <select id="uam-filter-floor" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 150px; border-radius: 5px;" title="Filter by Factory Floor">
                <option value="ALL" ${filterFloor === 'ALL' ? 'selected' : ''}>🏢 All Floors</option>
                ${allFloors.map(f => `<option value="${f.id}" ${filterFloor === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>

              <!-- Line -->
              <select id="uam-filter-line" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 140px; border-radius: 5px;" title="Filter by Production Line">
                <option value="ALL" ${filterLine === 'ALL' ? 'selected' : ''}>🧵 All Lines</option>
                ${allLines.map(l => `<option value="${l.id}" ${filterLine === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
              </select>
            </div>

            <!-- Attribute Filters -->
            <!-- Designation -->
            <select id="uam-filter-desig" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 150px; border-radius: 5px;">
              <option value="ALL" ${filterDesignation === 'ALL' ? 'selected' : ''}>💼 All Designations</option>
              ${allDesignations.map(d => `<option value="${d}" ${filterDesignation === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>

            <!-- Status -->
            <select id="uam-filter-status" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 115px; border-radius: 5px;">
              <option value="ALL" ${filterStatus === 'ALL' ? 'selected' : ''}>⚡ All Status</option>
              <option value="ACTIVE" ${filterStatus === 'ACTIVE' ? 'selected' : ''}>🟢 Active</option>
              <option value="INACTIVE" ${filterStatus === 'INACTIVE' ? 'selected' : ''}>🔴 Inactive</option>
            </select>

            <!-- Account Link Status -->
            <select id="uam-filter-account-link" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 135px; border-radius: 5px;">
              <option value="ALL" ${filterAccountLink === 'ALL' ? 'selected' : ''}>👤 All Accounts</option>
              <option value="LINKED" ${filterAccountLink === 'LINKED' ? 'selected' : ''}>✓ Account Created</option>
              <option value="NOT_CREATED" ${filterAccountLink === 'NOT_CREATED' ? 'selected' : ''}>⏳ Account Missing</option>
            </select>

            <!-- Password Status -->
            <select id="uam-filter-pass-status" class="filter-select" style="height: 27px; font-size: 11px; padding: 1px 6px; max-width: 140px; border-radius: 5px;">
              <option value="ALL" ${filterPasswordStatus === 'ALL' ? 'selected' : ''}>🔑 All Passwords</option>
              <option value="SETUP" ${filterPasswordStatus === 'SETUP' ? 'selected' : ''}>✅ Setup / Active</option>
              <option value="TEMPORARY" ${filterPasswordStatus === 'TEMPORARY' ? 'selected' : ''}>🟡 Temporary</option>
              <option value="PENDING" ${filterPasswordStatus === 'PENDING' ? 'selected' : ''}>⚪ Pending</option>
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
      ` : ''}
      </div> <!-- end .uam-fixed-top-deck -->

      <!-- =================================================================== -->
      <!-- TAB 1: USER ACCOUNTS DASHBOARD (Fixed Top Controls + Scroll Table)   -->
      <!-- =================================================================== -->
      ${activeUserSection === 'ACCOUNTS' ? `
        <div class="uam-tab-content-wrapper">
          <!-- User Accounts Table (Only this container scrolls vertically & horizontally) -->
          <div class="uam-table-scroll-container">
            <table class="user-management-table">
              <colgroup>
                <col style="width: 44px;">
                <col style="width: 120px;">
                <col style="width: 180px;">
                <col style="width: 135px;">
                <col style="width: 155px;">
                <col style="width: 130px;">
                <col style="width: 160px;">
                <col style="width: 95px;">
                <col style="width: 100px;">
                <col style="width: 95px;">
                <col style="width: 185px;">
                <col style="width: 115px;">
                <col style="width: 125px;">
                <col style="width: 160px;">
              </colgroup>
              <thead>
                <tr>
                  <th style="width: 44px; text-align: center; padding: 8px 4px;">
                    <input type="checkbox" id="chk-header-select-page" ${isPageAllSelected ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7; vertical-align: middle;" title="Select all on this page" />
                  </th>
                  <th style="width: 120px; text-align: center; padding: 8px 6px;">Card Number</th>
                  <th style="width: 180px; text-align: left; padding: 8px 10px;">Employee Name</th>
                  <th style="width: 135px; text-align: left; padding: 8px 10px;">Username</th>
                  <th style="width: 155px; text-align: left; padding: 8px 10px;">Designation</th>
                  <th style="width: 130px; text-align: left; padding: 8px 10px;">Group</th>
                  <th style="width: 160px; text-align: left; padding: 8px 10px;">Unit</th>
                  <th style="width: 95px; text-align: center; padding: 8px 6px;">Floor</th>
                  <th style="width: 100px; text-align: center; padding: 8px 6px;">Line</th>
                  <th style="width: 95px; text-align: center; padding: 8px 6px;">Status</th>
                  <th style="width: 185px; text-align: left; padding: 8px 10px;">Permissions Summary</th>
                  <th style="width: 115px; text-align: center; padding: 8px 6px;">Password</th>
                  <th style="width: 125px; text-align: center; padding: 8px 6px;">Last Login</th>
                  <th style="width: 160px; text-align: center; padding: 8px 8px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedAccounts.length === 0 ? `
                  <tr>
                    <td colspan="14" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
                      <div style="font-size: 36px; margin-bottom: 10px;">🔍</div>
                      <div style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px;">No Matching User Accounts Found</div>
                      <div style="font-size: 12.5px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 16px auto;">
                        No employee records match the active search query or filter criteria. Try clearing filters or use <strong>"Auto-Create Missing Accounts"</strong>.
                      </div>
                      <div style="display: inline-flex; gap: 8px;">
                        <button type="button" id="btn-empty-clear-filters" class="btn btn-secondary btn-sm" style="font-size: 12px; font-weight: 700;">
                          ✕ Clear All Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ` : paginatedAccounts.map(acc => {
                  const isSelected = selectedAccountIds.has(acc.id);
                  const hasAccount = acc.hasAccount;
                  const isUserActive = acc.accountStatus === 'ACTIVE';

                  return `
                    <tr style="background: ${isSelected ? 'rgba(2, 132, 199, 0.08)' : 'transparent'};">
                      <!-- Checkbox -->
                      <td style="text-align: center; width: 44px; padding: 6px 4px;">
                        ${hasAccount ? `
                          <input type="checkbox" class="chk-account-row" data-id="${acc.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7; vertical-align: middle;" />
                        ` : `
                          <span style="color: var(--text-muted); opacity: 0.3;">—</span>
                        `}
                      </td>
                      
                      <!-- Card Number (Interactive Badge) -->
                      <td style="text-align: center; width: 120px; padding: 6px 8px;">
                        <span class="badge uam-clickable-card-badge" data-card="${acc.cardNumber}" style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 11px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; transition: all 0.15s ease;" title="Click to filter by Card #${acc.cardNumber}">
                          <span>🪪</span> <span>#${acc.cardNumber}</span>
                        </span>
                      </td>

                      <!-- Employee Name -->
                      <td style="text-align: left; width: 180px; padding: 6px 10px;">
                        <div style="font-weight: 700; color: #fff; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.employeeName}">${acc.employeeName}</div>
                        <div style="font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.department || ''}">${acc.department || '—'}</div>
                      </td>

                      <!-- Username -->
                      <td style="text-align: left; width: 135px; padding: 6px 10px;">
                        ${hasAccount ? `
                          <span style="font-family: var(--font-mono); color: #cbd5e1; font-weight: 600; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 125px;" title="@${acc.username}">
                            @${acc.username}
                          </span>
                        ` : `
                          <span style="color: #f59e0b; font-size: 11px; font-weight: 700; white-space: nowrap;">No Account Yet</span>
                        `}
                      </td>

                      <!-- Designation -->
                      <td style="text-align: left; width: 155px; padding: 6px 10px;">
                        <div style="font-size: 11.5px; color: #e2e8f0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.designation}">
                          ${acc.designation}
                        </div>
                      </td>

                      <!-- Group -->
                      <td style="text-align: left; width: 130px; padding: 6px 10px;">
                        <div style="font-size: 11.5px; color: #cbd5e1; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.groupName || 'Al-Muslim Group'}">
                          ${acc.groupName || 'Al-Muslim Group'}
                        </div>
                      </td>

                      <!-- Unit -->
                      <td style="text-align: left; width: 160px; padding: 6px 10px;">
                        <div style="font-size: 11.5px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.unitName || '—'}">
                          ${acc.unitName || '—'}
                        </div>
                      </td>

                      <!-- Floor -->
                      <td style="text-align: center; width: 95px; padding: 6px 6px;">
                        <div style="font-size: 11.5px; color: #38bdf8; font-weight: 600; white-space: nowrap;">
                          ${acc.floorName || '—'}
                        </div>
                      </td>

                      <!-- Line -->
                      <td style="text-align: center; width: 100px; padding: 6px 6px;">
                        <div style="font-size: 11.5px; color: var(--text-secondary); white-space: nowrap;">
                          ${acc.lineName || '—'}
                        </div>
                      </td>

                      <!-- Status -->
                      <td style="text-align: center; width: 95px; padding: 6px 6px;">
                        ${hasAccount ? `
                          <span class="badge ${isUserActive ? 'badge-active' : 'badge-maint'}" style="font-size: 10px; padding: 2px 7px; font-weight: 700; white-space: nowrap;">
                            ${acc.accountStatus}
                          </span>
                        ` : `
                          <span class="badge badge-warning" style="font-size: 10px; padding: 2px 7px; font-weight: 700; white-space: nowrap;">PENDING</span>
                        `}
                      </td>

                      <!-- Permissions Summary & Location Scope -->
                      <td style="text-align: left; width: 185px; padding: 6px 10px;">
                        ${hasAccount ? `
                          <div style="display: flex; flex-direction: column; gap: 2px;">
                            <div style="display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; overflow: hidden;">
                              <span style="font-size: 11px; color: #e2e8f0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${acc.permissionsSummary}">${acc.permissionsSummary}</span>
                              ${acc.presetName ? `<span class="badge badge-info" style="font-size: 9px; padding: 1px 5px; flex-shrink: 0;">${acc.presetName}</span>` : ''}
                            </div>
                            <div style="font-size: 9.5px; color: #38bdf8; display: inline-flex; align-items: center; gap: 3px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Assigned Scope: ${userAccessService.formatScopeSummary(acc.assignedScope)}">
                              <span>📍</span> <span>${userAccessService.formatScopeSummary(acc.assignedScope)}</span>
                            </div>
                          </div>
                        ` : `
                          <span style="color: var(--text-muted); font-size: 11px;">Not Assigned</span>
                        `}
                      </td>

                      <!-- Password Status -->
                      <td style="text-align: center; width: 115px; padding: 6px 6px;">
                        ${hasAccount ? `
                          ${acc.passwordStatus === 'TEMPORARY' ? `
                            <span class="badge badge-warning" title="Initial temporary password generated. Eligible for export." style="font-size: 10px; padding: 2px 7px; cursor: help; white-space: nowrap;">🟡 Temporary</span>
                          ` : `
                            <span class="badge badge-active" title="Permanent password set" style="font-size: 10px; padding: 2px 7px; white-space: nowrap;">✅ Setup</span>
                          `}
                        ` : `
                          <span style="color: var(--text-muted); font-size: 11px;">—</span>
                        `}
                      </td>

                      <!-- Last Login -->
                      <td style="text-align: center; width: 125px; padding: 6px 6px; white-space: nowrap;">
                        <div style="font-size: 10.5px; color: var(--text-muted); white-space: nowrap;">
                          ${acc.lastLoginText}
                        </div>
                      </td>

                      <!-- Actions -->
                      <td style="text-align: center; width: 160px; padding: 6px 8px; white-space: nowrap;">
                        ${hasAccount ? `
                          <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                            <button class="btn btn-ghost btn-xs btn-row-view-details" data-id="${acc.id}" title="View Complete Details" style="padding: 2px 5px; font-size: 11px;">
                              👁️
                            </button>
                            <button class="btn btn-ghost btn-xs btn-row-manage-perms" data-id="${acc.id}" title="Manage Permissions" style="padding: 2px 5px; font-size: 11px; color: #38bdf8;">
                              🛡️
                            </button>
                            <button class="btn btn-ghost btn-xs btn-row-reset-pass" data-id="${acc.id}" title="Reset / Generate Password" style="padding: 2px 5px; font-size: 11px; color: #f59e0b;">
                              🔑
                            </button>
                            <button class="btn btn-ghost btn-xs btn-row-toggle-status" data-id="${acc.id}" data-status="${acc.accountStatus}" title="${isUserActive ? 'Deactivate Account' : 'Activate Account'}" style="padding: 2px 5px; font-size: 11px; color: ${isUserActive ? '#f87171' : '#34d399'};">
                              ${isUserActive ? '🔴' : '🟢'}
                            </button>
                            <button class="btn btn-ghost btn-xs btn-row-view-logs" data-id="${acc.id}" data-card="${acc.cardNumber}" title="View Activity Logs" style="padding: 2px 5px; font-size: 11px; color: #cbd5e1;">
                              📜
                            </button>
                          </div>
                        ` : `
                          <button class="btn btn-primary btn-xs btn-row-create-account" data-emp-id="${acc.manpowerId}" data-card="${acc.cardNumber}" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 3px 8px; font-size: 10.5px; border-radius: 6px; white-space: nowrap;">
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

          <!-- Pinned Bottom Pagination Bar (Always visible at bottom) -->
          <div class="uam-fixed-bottom-bar">
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
        </div>
      ` : `
        <div class="uam-subtab-scroll-panel">
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
        </div>
      `}

      <!-- Modals Layer for Dialogs -->
      <div id="uam-modal-layer">
        ${renderActiveModalHtml()}
      </div>

    </div>
  `;
}

// ---------------------------------------------------------------------------
// SUB-TAB RENDERERS & LOCATION-BASED ACCESS CONTROL
// ---------------------------------------------------------------------------

function pruneOrphanLocations(scopeObj) {
  // Prune floors if not allUnits and specific unitIds chosen
  if (!scopeObj.allUnits && Array.isArray(scopeObj.unitIds) && scopeObj.unitIds.length > 0) {
    const rawFloors = masterDataService.getFloors ? masterDataService.getFloors(null, null, true, true) : [];
    const validFloors = new Set(rawFloors.filter(f => scopeObj.unitIds.includes(f.unitId)).map(f => f.id));
    scopeObj.floorIds = (scopeObj.floorIds || []).filter(fid => validFloors.has(fid));
  } else if (!scopeObj.allUnits && (!scopeObj.unitIds || scopeObj.unitIds.length === 0) && !scopeObj.allGroups) {
    scopeObj.floorIds = [];
  }

  // Prune lines if not allFloors and specific floorIds chosen
  if (!scopeObj.allFloors && Array.isArray(scopeObj.floorIds) && scopeObj.floorIds.length > 0) {
    const rawLines = masterDataService.getLines ? masterDataService.getLines(null, null, null, true, true) : [];
    const validLines = new Set(rawLines.filter(l => scopeObj.floorIds.includes(l.floorId)).map(l => l.id));
    scopeObj.lineIds = (scopeObj.lineIds || []).filter(lid => validLines.has(lid));
  } else if (!scopeObj.allFloors && (!scopeObj.floorIds || scopeObj.floorIds.length === 0) && !scopeObj.allUnits && !scopeObj.allGroups) {
    scopeObj.lineIds = [];
  }
}

function renderLocationScopeSection(scope, pfx = 'perm-scope', isBulk = false) {
  const allGroups = masterDataService.getGroups ? masterDataService.getGroups(true) : [];
  
  // Dynamic Units based on selected Groups
  const rawUnits = masterDataService.getUnits ? masterDataService.getUnits(null, true, true) : [];
  let availableUnits = rawUnits;
  if (!scope.allGroups && Array.isArray(scope.groupIds) && scope.groupIds.length > 0) {
    availableUnits = rawUnits.filter(u => scope.groupIds.includes(u.groupId));
  }

  // Dynamic Floors based on selected Units
  const rawFloors = masterDataService.getFloors ? masterDataService.getFloors(null, null, true, true) : [];
  let availableFloors = [];
  if (scope.allUnits || scope.allGroups) {
    availableFloors = rawFloors;
  } else if (Array.isArray(scope.unitIds) && scope.unitIds.length > 0) {
    availableFloors = rawFloors.filter(f => scope.unitIds.includes(f.unitId));
  }

  // Dynamic Lines based on selected Floors
  const rawLines = masterDataService.getLines ? masterDataService.getLines(null, null, null, true, true) : [];
  let availableLines = [];
  if (scope.allFloors) {
    if (availableFloors.length > 0) {
      const floorIdsSet = new Set(availableFloors.map(f => f.id));
      availableLines = rawLines.filter(l => floorIdsSet.has(l.floorId));
    } else {
      availableLines = rawLines;
    }
  } else if (Array.isArray(scope.floorIds) && scope.floorIds.length > 0) {
    availableLines = rawLines.filter(l => scope.floorIds.includes(l.floorId));
  }

  const scopeSummary = userAccessService.formatScopeSummary(scope);
  const isGlobal = Boolean(scope.allGroups && scope.allUnits && scope.allFloors && scope.allLines);
  const isZero = !isGlobal && (!scope.allUnits && (!scope.unitIds || scope.unitIds.length === 0));

  return `
    <div style="background: rgba(15, 23, 42, 0.75); border: 1.5px solid ${isGlobal ? '#10b981' : isZero ? '#f59e0b' : '#38bdf8'}; border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
      
      <!-- Section Header & Status -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">📍</span>
            <span style="font-size: 13.5px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.5px;">
              Location-Based Access Scope (Unit, Floor &amp; Line Restrictions)
            </span>
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin: 3px 0 0 0;">
            Users are strictly restricted to assigned Units, Floors, and Lines. Super Admin and regular users follow explicitly assigned scope.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="badge" style="background: ${isGlobal ? 'rgba(16, 185, 129, 0.2)' : isZero ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.2)'}; color: ${isGlobal ? '#34d399' : isZero ? '#fbbf24' : '#38bdf8'}; border: 1px solid ${isGlobal ? 'rgba(16, 185, 129, 0.4)' : isZero ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.4)'}; font-size: 11px; font-weight: 800; padding: 4px 10px;">
            ${scopeSummary}
          </span>
          <button type="button" id="${pfx}-btn-global" class="btn btn-secondary btn-xs" style="color: #34d399; font-weight: 700; font-size: 11px;">
            🌐 All Locations (Factory-Wide)
          </button>
          <button type="button" id="${pfx}-btn-clear-all" class="btn btn-ghost btn-xs" style="color: #f87171; font-weight: 700; font-size: 11px;">
            ✕ Clear Scope (Zero Access)
          </button>
        </div>
      </div>

      <!-- 4 Cascading Columns: Group -> Unit -> Floor -> Line -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; background: rgba(9, 14, 26, 0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
        
        <!-- Column 1: Group -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 4px;">
            <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; color: #38bdf8; cursor: pointer;">
              <input type="checkbox" id="${pfx}-chk-all-groups" ${scope.allGroups ? 'checked' : ''} style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
              <span>🏢 All Groups</span>
            </label>
            <span style="font-size: 10px; color: var(--text-muted);">${allGroups.length} total</span>
          </div>

          <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px;">
            ${allGroups.map(g => {
              const isChecked = scope.allGroups || (Array.isArray(scope.groupIds) && scope.groupIds.includes(g.id));
              return `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${isChecked ? '#fff' : 'var(--text-secondary)'}; cursor: ${scope.allGroups ? 'not-allowed' : 'pointer'}; padding: 3px 6px; border-radius: 4px; background: ${isChecked ? 'rgba(56, 189, 248, 0.1)' : 'transparent'};">
                  <input type="checkbox" class="${pfx}-chk-group-item" data-id="${g.id}" ${isChecked ? 'checked' : ''} ${scope.allGroups ? 'disabled' : ''} style="cursor: pointer; accent-color: #0284c7; width: 13px; height: 13px;" />
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${g.name}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Column 2: Unit -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 4px;">
            <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; color: #38bdf8; cursor: pointer;">
              <input type="checkbox" id="${pfx}-chk-all-units" ${scope.allUnits ? 'checked' : ''} style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
              <span>🏭 All Units</span>
            </label>
            <span style="font-size: 10px; color: var(--text-muted);">${availableUnits.length} available</span>
          </div>

          <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px;">
            ${availableUnits.length === 0 ? `
              <div style="color: var(--text-muted); font-size: 11px; padding: 12px; text-align: center;">No units in selected group</div>
            ` : availableUnits.map(u => {
              const isChecked = scope.allUnits || (Array.isArray(scope.unitIds) && scope.unitIds.includes(u.id));
              return `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${isChecked ? '#fff' : 'var(--text-secondary)'}; cursor: ${scope.allUnits ? 'not-allowed' : 'pointer'}; padding: 3px 6px; border-radius: 4px; background: ${isChecked ? 'rgba(56, 189, 248, 0.1)' : 'transparent'};">
                  <input type="checkbox" class="${pfx}-chk-unit-item" data-id="${u.id}" ${isChecked ? 'checked' : ''} ${scope.allUnits ? 'disabled' : ''} style="cursor: pointer; accent-color: #0284c7; width: 13px; height: 13px;" />
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Column 3: Floor (Dynamic based on selected Unit) -->
        <div style="display: flex; flex-direction: column; gap: 6px; border-right: 1px solid rgba(255,255,255,0.06); padding-right: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 4px;">
            <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; color: #38bdf8; cursor: pointer;">
              <input type="checkbox" id="${pfx}-chk-all-floors" ${scope.allFloors ? 'checked' : ''} ${availableFloors.length === 0 ? 'disabled' : ''} style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
              <span>🏢 All Floors</span>
            </label>
            <span style="font-size: 10px; color: var(--text-muted);">${availableFloors.length} available</span>
          </div>

          <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px;">
            ${availableFloors.length === 0 ? `
              <div style="color: var(--text-muted); font-size: 11px; padding: 12px; text-align: center;">👈 Select Unit(s) first</div>
            ` : availableFloors.map(f => {
              const isChecked = scope.allFloors || (Array.isArray(scope.floorIds) && scope.floorIds.includes(f.id));
              return `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${isChecked ? '#fff' : 'var(--text-secondary)'}; cursor: ${scope.allFloors ? 'not-allowed' : 'pointer'}; padding: 3px 6px; border-radius: 4px; background: ${isChecked ? 'rgba(56, 189, 248, 0.1)' : 'transparent'};">
                  <input type="checkbox" class="${pfx}-chk-floor-item" data-id="${f.id}" ${isChecked ? 'checked' : ''} ${scope.allFloors ? 'disabled' : ''} style="cursor: pointer; accent-color: #0284c7; width: 13px; height: 13px;" />
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.name}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Column 4: Line (Dynamic based on selected Floor) -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 4px;">
            <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; color: #38bdf8; cursor: pointer;">
              <input type="checkbox" id="${pfx}-chk-all-lines" ${scope.allLines ? 'checked' : ''} ${availableLines.length === 0 ? 'disabled' : ''} style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
              <span>🧵 All Lines</span>
            </label>
            <span style="font-size: 10px; color: var(--text-muted);">${availableLines.length} available</span>
          </div>

          <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 4px;">
            ${availableLines.length === 0 ? `
              <div style="color: var(--text-muted); font-size: 11px; padding: 12px; text-align: center;">👈 Select Floor(s) first</div>
            ` : availableLines.map(l => {
              const isChecked = scope.allLines || (Array.isArray(scope.lineIds) && scope.lineIds.includes(l.id));
              return `
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${isChecked ? '#fff' : 'var(--text-secondary)'}; cursor: ${scope.allLines ? 'not-allowed' : 'pointer'}; padding: 3px 6px; border-radius: 4px; background: ${isChecked ? 'rgba(56, 189, 248, 0.1)' : 'transparent'};">
                  <input type="checkbox" class="${pfx}-chk-line-item" data-id="${l.id}" ${isChecked ? 'checked' : ''} ${scope.allLines ? 'disabled' : ''} style="cursor: pointer; accent-color: #0284c7; width: 13px; height: 13px;" />
                  <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.name}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

      </div>

    </div>
  `;
}

export function selectUserForPermissions(userId, clearSearch = false) {
  if (!userId) {
    permissionTargetUserId = null;
    editingPermissions = {};
    editingScope = { allGroups: false, groupIds: [], allUnits: false, unitIds: [], allFloors: false, floorIds: [], allLines: false, lineIds: [] };
    if (clearSearch) permCardSearchQuery = '';
    return;
  }

  const users = (typeof storage !== 'undefined' && storage.getTable) ? (storage.getTable(TABLE_NAMES.USERS) || []) : [];
  const target = users.find(u => u.id === userId);
  if (!target) return;

  permissionTargetUserId = target.id;
  editingPermissions = JSON.parse(JSON.stringify(target.permissions || {}));

  if (target.assignedScope) {
    editingScope = {
      allGroups: Boolean(target.assignedScope.allGroups),
      groupIds: Array.isArray(target.assignedScope.groupIds) ? [...target.assignedScope.groupIds] : [],
      allUnits: Boolean(target.assignedScope.allUnits),
      unitIds: Array.isArray(target.assignedScope.unitIds) ? [...target.assignedScope.unitIds] : [],
      allFloors: Boolean(target.assignedScope.allFloors),
      floorIds: Array.isArray(target.assignedScope.floorIds) ? [...target.assignedScope.floorIds] : [],
      allLines: Boolean(target.assignedScope.allLines),
      lineIds: Array.isArray(target.assignedScope.lineIds) ? [...target.assignedScope.lineIds] : []
    };
  } else {
    const isSuper = target.role === 'SUPER_ADMIN';
    editingScope = {
      allGroups: isSuper,
      groupIds: target.groupId ? [target.groupId] : [],
      allUnits: isSuper,
      unitIds: target.unitId ? [target.unitId] : [],
      allFloors: isSuper,
      floorIds: target.floorId ? [target.floorId] : [],
      allLines: isSuper,
      lineIds: target.lineId ? [target.lineId] : []
    };
  }

  if (clearSearch) {
    permCardSearchQuery = '';
  }
}

function renderIndividualPermissionsTab() {
  const users = (typeof storage !== 'undefined' && storage.getTable) ? (storage.getTable(TABLE_NAMES.USERS) || []) : [];

  if (users.length === 0) {
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 36px; text-align: center; color: var(--text-muted);">
        No user accounts available. Please add users or auto-create accounts from Manpower records.
      </div>
    `;
  }

  // Strictly follow explicitly selected user. NEVER auto-default to users[0]!
  const selectedUser = permissionTargetUserId ? (users.find(u => u.id === permissionTargetUserId) || null) : null;

  // If a user was selected, ensure permissions & scope are loaded
  if (selectedUser && (!editingPermissions || Object.keys(editingPermissions).length === 0 && !editingScope.allGroups && !editingScope.allUnits && (!editingScope.unitIds || editingScope.unitIds.length === 0))) {
    selectUserForPermissions(selectedUser.id);
  }

  const currentUserIndex = selectedUser ? users.findIndex(u => u.id === selectedUser.id) : -1;
  const prevUser = (selectedUser && currentUserIndex > 0) ? users[currentUserIndex - 1] : null;
  const nextUser = (selectedUser && currentUserIndex >= 0 && currentUserIndex < users.length - 1) ? users[currentUserIndex + 1] : null;

  const userPerms = editingPermissions || {};
  const presets = authService.getAllPresets ? authService.getAllPresets() : [];

  // Top Search & Account Switcher Bar (Rendered in both empty and active state)
  const renderTopControls = () => `
    <div style="background: rgba(15, 23, 42, 0.75); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
      
      <!-- Row 1: Active User Details & Quick Navigation (Visible only when an account is selected) -->
      ${selectedUser ? `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
              🛡️
            </div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 16px; font-weight: 800; color: #fff;">${escapeHtml(selectedUser.name)}</span>
                <button type="button" id="btn-perm-copy-card" class="badge" data-card="${selectedUser.cardNumber || selectedUser.employeeId || ''}" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-family: var(--font-mono); font-weight: 800; font-size: 12px; padding: 2px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Click to copy Card Number to clipboard">
                  <span>🪪</span> <span>#${selectedUser.cardNumber || selectedUser.employeeId || '—'}</span> <span>📋</span>
                </button>
                <span class="badge ${selectedUser.status === 'ACTIVE' ? 'badge-active' : 'badge-maint'}" style="font-size: 10.5px;">${selectedUser.status}</span>
                <span style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 6px;">
                  ${selectedUser.role}
                </span>
                <span style="background: rgba(255, 255, 255, 0.08); color: #94a3b8; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px;">
                  User ${currentUserIndex >= 0 ? currentUserIndex + 1 : 1} of ${users.length}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
                Username: <strong style="color: #cbd5e1;">@${selectedUser.username}</strong> • ${escapeHtml(selectedUser.designation || 'User')} (${escapeHtml(selectedUser.department || '—')}) • 📍 ${escapeHtml(selectedUser.unitName || 'Pacific Blue')} • ${escapeHtml(selectedUser.floorName || 'General Floor')}
              </div>
            </div>
          </div>

          <!-- Quick Prev / Next Card Navigation & Deselect User Button -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" id="btn-perm-prev-user" class="btn btn-secondary btn-xs" ${!prevUser ? 'disabled' : ''} style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px;" title="Previous Account">
              ◀ Prev Card
            </button>
            <button type="button" id="btn-perm-next-user" class="btn btn-secondary btn-xs" ${!nextUser ? 'disabled' : ''} style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; border-radius: 6px;" title="Next Account">
              Next Card ▶
            </button>
            <button type="button" class="btn btn-ghost btn-xs btn-perm-deselect-user" style="color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); font-weight: 700; padding: 5px 10px; font-size: 11.5px; border-radius: 6px;" title="Deselect user and return to account selector">
              ✕ Deselect User
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Row 2: Smart Interactive Live Search & Synchronized Account Selector -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
        
        <!-- Smart Search Container with Live Floating Dropdown -->
        <div style="flex: 1 1 420px; position: relative;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; white-space: nowrap; display: flex; align-items: center; gap: 5px;">
              ⚡ Smart Search:
            </span>
            <div style="position: relative; flex: 1;">
              <input 
                type="text" 
                id="inp-perm-smart-search" 
                class="form-control font-mono" 
                placeholder="Type Card # (e.g. 128426), Name, @username..." 
                value="${permCardSearchQuery || ''}"
                autocomplete="off"
                style="height: 36px; font-size: 12.5px; font-weight: 600; padding-left: 32px; padding-right: 32px; border-radius: 8px; border: 1.5px solid rgba(56, 189, 248, 0.45); background: rgba(9, 14, 26, 0.95); width: 100%; box-sizing: border-box; color: #fff;"
              />
              <span style="position: absolute; left: 10px; top: 9px; font-size: 14px; color: #38bdf8; pointer-events: none;">🔍</span>
              <button id="btn-clear-perm-smart-search" type="button" style="display: ${permCardSearchQuery ? 'block' : 'none'}; position: absolute; right: 10px; top: 8px; background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;" title="Clear Search">✕</button>
            </div>
          </div>

          <!-- Live Floating Autocomplete Dropdown Overlay -->
          <div id="perm-smart-search-dropdown" style="display: none; position: absolute; left: 110px; right: 0; top: 42px; max-height: 380px; overflow-y: auto; background: #0b1329; border: 1.5px solid #0284c7; border-radius: 8px; box-shadow: 0 12px 30px rgba(0,0,0,0.85); z-index: 1000; padding: 6px 0;">
          </div>
        </div>

        <!-- Synchronized Switcher Dropdown ("Or Select Account") -->
        <div style="display: flex; align-items: center; gap: 8px; flex: 1 1 300px; justify-content: flex-end;">
          <span style="font-size: 11.5px; color: var(--text-muted); white-space: nowrap;">Or Select Account:</span>
          <select id="uam-perm-user-switcher" class="filter-select" style="height: 36px; font-size: 12px; width: 100%; max-width: 320px; border-radius: 8px;">
            <option value="" ${!selectedUser ? 'selected' : ''}>-- Choose an Account (${users.length} Available) --</option>
            ${users.map(u => `
              <option value="${u.id}" ${selectedUser && u.id === selectedUser.id ? 'selected' : ''}>
                #${u.cardNumber || u.employeeId || '—'} - ${escapeHtml(u.name)} (${escapeHtml(u.designation || u.department || 'User')})
              </option>
            `).join('')}
          </select>
        </div>

      </div>

    </div>
  `;

  // If NO User is Selected: Show Sleek Guidance & Quick Account Picker
  if (!selectedUser) {
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-sm);">
        ${renderTopControls()}

        <div style="background: rgba(15, 23, 42, 0.65); border: 2px dashed rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); padding: 50px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 4px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(14, 165, 233, 0.08)); border: 1.5px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 30px;">
            🛡️
          </div>
          <div style="max-width: 520px;">
            <h3 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0 0 6px 0;">
              No User Account Selected
            </h3>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0; line-height: 1.5;">
              Use the <strong>Smart Search</strong> above (type Card #, Name, or Username) or pick an account from the dropdown list to view and configure their individual permissions and location access restrictions.
            </p>
          </div>

          <!-- Quick Account Suggestions -->
          <div style="margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Quick Select Accounts:</span>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: 720px;">
              ${users.slice(0, 6).map(u => `
                <button type="button" class="btn btn-secondary btn-xs btn-perm-quick-pick" data-id="${u.id}" style="font-size: 11px; padding: 5px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.3); cursor: pointer;">
                  <span style="color: #38bdf8; font-family: var(--font-mono); font-weight: 800;">#${u.cardNumber || u.employeeId || '—'}</span>
                  <span style="color: #fff; font-weight: 600;">${escapeHtml(u.name)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // When a user IS selected: Render full editor
  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-sm);">
      ${renderTopControls()}

      <!-- Action Toolbar (Select All, Deselect All, Load Preset, Reset Default, Quick Module Filter, Cancel, Save) -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: rgba(15, 23, 42, 0.6); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border-color);">
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-perm-select-all" class="btn btn-secondary btn-xs" style="color: #38bdf8; font-weight: 700;">
            ✓ Select All Permissions
          </button>
          <button id="btn-perm-deselect-all" class="btn btn-secondary btn-xs" style="color: var(--text-muted); font-weight: 700;">
            ✕ Deselect All
          </button>

          <!-- Load From Preset -->
          <div style="display: flex; align-items: center; gap: 6px; margin-left: 4px;">
            <span style="font-size: 11.5px; color: var(--text-muted);">Apply Preset:</span>
            <select id="uam-perm-load-preset" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px;">
              <option value="">Choose preset template...</option>
              ${presets.map(p => `<option value="${p.id}">${p.icon || '🛡️'} ${p.name}</option>`).join('')}
            </select>
          </div>

          <button id="btn-perm-reset-default" class="btn btn-ghost btn-xs" style="color: #f59e0b; font-weight: 700;">
            🔄 Reset Default
          </button>
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <!-- Quick Filter Modules -->
          <div style="position: relative;">
            <input 
              type="text" 
              id="inp-perm-module-filter" 
              class="form-control" 
              placeholder="🔍 Filter modules (e.g. System, Transfer)..." 
              value="${permModuleFilterQuery}"
              style="height: 28px; font-size: 11.5px; padding-left: 24px; width: 220px; border-radius: 6px;"
            />
            <span style="position: absolute; left: 7px; top: 5px; font-size: 11px; color: var(--text-muted);">🔍</span>
            ${permModuleFilterQuery ? `
              <button id="btn-clear-perm-module-filter" type="button" style="position: absolute; right: 5px; top: 4px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 11px;" title="Clear filter">✕</button>
            ` : ''}
          </div>

          <button id="btn-perm-cancel-changes" class="btn btn-secondary btn-sm" style="font-size: 12px;" title="Revert uncommitted changes to saved values">
            Cancel
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-perm-deselect-user" style="color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); font-size: 12px;" title="Deselect this user and return to account selector">
            ✕ Deselect
          </button>
          <button id="btn-perm-save-changes" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4); font-size: 12px; padding: 6px 16px;">
            💾 Save Permissions &amp; Location Scope
          </button>
        </div>
      </div>

      <!-- Location-Based Access Scope (Unit, Floor & Line Matrix) -->
      ${renderLocationScopeSection(editingScope, 'perm-scope', false)}

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
              <tr class="matrix-group-row" data-group="${group.group.toLowerCase()}" style="background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.25);">
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
                  <tr class="matrix-module-row" data-name="${mod.name.toLowerCase()}" data-group="${group.group.toLowerCase()}" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
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

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button type="button" id="btn-bulk-select-all" class="btn btn-secondary btn-xs" style="color: #38bdf8; font-weight: 700;">
              ✓ Select All
            </button>
            <button type="button" id="btn-bulk-deselect-all" class="btn btn-secondary btn-xs" style="color: var(--text-muted); font-weight: 700;">
              ✕ Deselect All
            </button>
            <span style="font-size: 11.5px; color: var(--text-muted); margin-left: 4px;">Quick Template:</span>
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

      <!-- Step 4: Location Access Scope for Target Accounts -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">
              Step 4: Location Access Scope (Unit, Floor &amp; Line Restrictions)
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
              Optionally assign uniform Unit, Floor, and Line location bounds to all selected users simultaneously.
            </div>
          </div>

          <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: #fff; cursor: pointer; background: rgba(56, 189, 248, 0.15); padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.35);">
            <input type="checkbox" id="chk-bulk-apply-scope" ${bulkApplyScope ? 'checked' : ''} style="cursor: pointer; accent-color: #0284c7; width: 15px; height: 15px;" />
            <span>Apply Location Scope in Bulk</span>
          </label>
        </div>

        ${bulkApplyScope ? renderLocationScopeSection(bulkTargetScope, 'bulk-scope', true) : `
          <div style="background: rgba(11, 19, 41, 0.6); border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 14px; text-align: center; color: var(--text-muted); font-size: 12px;">
            Existing location access scopes will remain untouched. Check <strong>"Apply Location Scope in Bulk"</strong> above to configure uniform Unit, Floor, and Line bounds across selected accounts.
          </div>
        `}
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
      const matchCard = userAccessService.matchesCardNumber ? userAccessService.matchesCardNumber(acc.cardNumber, passwordMgmtSearch) : (acc.cardNumber || '').toLowerCase().includes(q);
      if (!matchCard && !acc.employeeName.toLowerCase().includes(q) && !acc.username.toLowerCase().includes(q)) {
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

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-reset-factory-presets" class="btn btn-secondary btn-sm" style="font-size: 11.5px; color: #fbbf24; font-weight: 700;">
            🔄 Reset to Factory Presets
          </button>
          <button id="btn-create-new-preset-action" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 12px;">
            ➕ Create New Preset
          </button>
        </div>
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

            <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 11px; color: var(--text-muted);">Assigned Users: <strong style="color: #fff;">${p.assignedUsersCount || 0}</strong></span>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-secondary btn-xs btn-assign-preset-users" data-id="${p.id}" style="font-size: 11px; color: #a78bfa; font-weight: 600;">
                  👥 Assign Users
                </button>
                <button class="btn btn-secondary btn-xs btn-edit-preset-item" data-id="${p.id}" style="font-size: 11px; color: #38bdf8; font-weight: 700;">
                  Configure &rarr;
                </button>
              </div>
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
              <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px;">🎯 Assigned Location Access Scope</div>
              <div style="color: #38bdf8; font-weight: 700; font-size: 13px;">
                ${userAccessService.formatScopeSummary(acc.assignedScope)}
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
        <div class="modal-card" style="max-width: 450px; width: 92%; border-radius: 12px; background: #0b1329; border: 1.5px solid rgba(56, 189, 248, 0.35); box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85); overflow: hidden; padding: 0;">
          
          <!-- Header (Compact & Crisp) -->
          <div style="padding: 10px 16px; background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95)); border-bottom: 1px solid rgba(56, 189, 248, 0.2); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">🔑</div>
              <div>
                <h3 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #34d399; letter-spacing: -0.2px;">
                  ${data.isReset ? 'Password Reset Successful' : 'Initial Password Generated'}
                </h3>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: var(--text-muted);">
                  User Account: <span style="color: #38bdf8; font-family: var(--font-mono); font-weight: 700;">@${data.username}</span>
                </p>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px; padding: 2px 8px; color: var(--text-muted); cursor: pointer;" title="Close">✕</button>
          </div>

          <!-- Body (Compact & High-Tech) -->
          <div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
              A cryptographically secure password has been generated and hashed for this workforce account:
            </div>

            <!-- Password Card with Quick Copy -->
            <div style="background: #070d1e; border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; box-shadow: inset 0 2px 6px rgba(0,0,0,0.6);">
              <span id="txt-generated-password" style="font-family: var(--font-mono); font-size: 16px; font-weight: 900; color: #38bdf8; letter-spacing: 1.2px; user-select: all; word-break: break-all;">
                ${data.plainPassword}
              </span>
              <button id="btn-copy-generated-pass" class="btn btn-primary btn-xs" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); height: 28px; padding: 0 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; white-space: nowrap; flex-shrink: 0;">
                📋 Copy
              </button>
            </div>

            <!-- Security Notice -->
            <div style="font-size: 11px; color: #fbbf24; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; padding: 8px 12px; line-height: 1.4; display: flex; align-items: flex-start; gap: 8px;">
              <span style="font-size: 13px;">⚠️</span>
              <div>
                <strong>Security Notice:</strong> Plaintext credentials are not stored in the database. Please copy and share this password with the authorized user immediately.
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 23, 42, 0.95); padding: 9px 18px;">
            <button class="btn btn-primary btn-sm btn-close-uam-modal" style="font-weight: 700; height: 30px; padding: 0 16px; border-radius: 6px;">Done</button>
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

  // 4. Auto-Create Summary Modal (With Live Card Search, Direct Excel Export & Copy)
  if (activeModalType === 'AUTO_CREATE_SUMMARY' && autoCreateSummaryData) {
    const data = autoCreateSummaryData;
    const successfulList = data.successful || [];
    const failedList = data.failed || [];
    
    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 760px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; padding: 22px;">
          
          <!-- Header -->
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(52, 211, 153, 0.4); display: flex; align-items: center; justify-content: center; font-size: 22px; color: #34d399;">
                ⚡
              </div>
              <div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">Auto-Create Accounts Summary</h3>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                  <span style="color: #34d399; font-weight: 700;">${successfulList.length} accounts created</span> &bull; 
                  <span style="color: ${failedList.length > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 700;">${failedList.length} failed</span> &bull; 
                  <span>Temporary passwords generated</span>
                </p>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 18px; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">✕</button>
          </div>

          <!-- Body Container -->
          <div style="overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px;">
            
            <!-- Quick Stat Banner & Actions -->
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div style="font-size: 12.5px; color: #cbd5e1;">
                Generated <strong>${successfulList.length}</strong> logins synced with Manpower cards. Export credentials now for safe distribution.
              </div>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button type="button" id="btn-summary-export-excel" class="btn btn-success btn-xs" style="font-weight: 800; padding: 6px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; background: #059669;" title="Download complete credentials spreadsheet in 1 worksheet">
                  <span>📥</span> <span>Download Accounts Excel (.xlsx)</span>
                </button>
                <button type="button" id="btn-summary-copy-all" class="btn btn-secondary btn-xs" style="font-weight: 700; padding: 6px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;" title="Copy all generated usernames">
                  <span>📋</span> <span>Copy Usernames</span>
                </button>
              </div>
            </div>

            <!-- Card Search & Filter Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
              <div style="flex: 1 1 260px; position: relative;">
                <span style="position: absolute; left: 11px; top: 9px; font-size: 14px; color: #38bdf8;">🪪</span>
                <input 
                  type="text" 
                  id="inp-uam-summary-search" 
                  class="form-control" 
                  placeholder="Card search (e.g. AMG-0000083), Employee Name, or Username..." 
                  style="height: 36px; padding-left: 36px; font-size: 12.5px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(15, 23, 42, 0.95); width: 100%; box-sizing: border-box;"
                />
              </div>
              <div id="uam-summary-match-count" style="font-size: 12px; color: #94a3b8; font-weight: 600;">
                Showing ${successfulList.length} of ${successfulList.length} accounts
              </div>
            </div>

            <!-- List of Created Accounts with Elevated Card Rows -->
            ${successfulList.length > 0 ? `
              <div id="uam-summary-accounts-container" style="background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: 10px; padding: 8px; max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                ${successfulList.map(s => `
                  <div class="uam-summary-account-row" data-search="${((s.cardNumber || '') + ' ' + (s.name || '') + ' ' + (s.username || '') + ' ' + (s.designation || '') + ' ' + (s.floor || '')).toLowerCase()}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); gap: 10px; transition: all 0.15s ease;">
                    
                    <!-- Left: Card Badge & Name/Designation -->
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                      <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 800; padding: 3px 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 11.5px; border: 1px solid rgba(56, 189, 248, 0.3); white-space: nowrap;">
                        🪪 #${s.cardNumber || '—'}
                      </span>
                      <div style="min-width: 0;">
                        <div style="font-weight: 700; color: #fff; font-size: 13px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${s.name}</div>
                        <div style="font-size: 11px; color: #94a3b8; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                          ${s.designation || 'Staff'} ${s.floor && s.floor !== '—' ? `&bull; ${s.floor}` : ''}
                        </div>
                      </div>
                    </div>

                    <!-- Right: Username & Copy Password -->
                    <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                      <span style="font-family: var(--font-mono); color: #38bdf8; font-weight: 700; font-size: 12px; background: rgba(56, 189, 248, 0.1); padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(56, 189, 248, 0.25);">
                        @${s.username}
                      </span>
                      <button type="button" class="btn btn-ghost btn-xs btn-copy-summary-pass" data-pass="${s.initialPassword || userAccessService.getTemporaryCredential(s.userId) || ''}" data-user="${s.username}" style="color: #c084fc; font-size: 11px; font-weight: 700; padding: 3px 8px; border: 1px solid rgba(192, 132, 252, 0.3); border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;" title="Copy initial password for @${s.username}">
                        <span>📋</span> <span>Copy Pass</span>
                      </button>
                    </div>

                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12.5px;">
                No accounts were created in this operation.
              </div>
            `}

            <!-- Failed Records (if any) -->
            ${failedList.length > 0 ? `
              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; border-radius: 8px; padding: 12px 14px; font-size: 12px;">
                <div style="font-weight: 800; color: #f87171; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <span>⚠️</span> <span>Failed Records (${failedList.length}):</span>
                </div>
                <div style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                  ${failedList.map(f => `
                    <div style="color: #fca5a5; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04); display: flex; justify-content: space-between;">
                      <span>#${f.cardNumber} - ${f.name}</span>
                      <span style="font-size: 11px; color: #ef4444;">${f.error}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

          </div>

          <!-- Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 14px; flex-wrap: wrap; gap: 10px;">
            <div style="font-size: 11.5px; color: var(--text-muted);">
              All generated accounts are marked as <strong>Active</strong> with temporary passwords.
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-primary btn-sm btn-close-uam-modal" style="font-weight: 800; padding: 7px 20px; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #0369a1);">
                ✓ Done (View Accounts)
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // 5. Add New User Modal (Smart Card Search & Autocomplete)
  if (activeModalType === 'ADD_USER') {
    const activeEmployees = employeeService.getActiveEmployees ? employeeService.getActiveEmployees() : [];
    const presets = authService.getAllPresets ? authService.getAllPresets() : [];
    const allUsers = storage.getTable(TABLE_NAMES.USERS) || [];

    // Map existing users by card/employeeId
    const usersByCard = new Map();
    allUsers.forEach(u => {
      if (u.cardNumber) usersByCard.set(String(u.cardNumber).trim().toLowerCase(), u);
      if (u.employeeId) usersByCard.set(String(u.employeeId).trim().toLowerCase(), u);
      if (u.manpowerId) usersByCard.set(u.manpowerId, u);
    });

    const isEmpSelected = Boolean(addModalSelectedEmployee);
    const selEmp = addModalSelectedEmployee;
    const hasExistingUser = selEmp ? usersByCard.get(String(selEmp.cardNumber || '').trim().toLowerCase()) : null;

    // Default form values
    const valName = selEmp ? selEmp.name : '';
    const valCard = selEmp ? (selEmp.cardNumber || '') : '';
    const valUsername = selEmp ? userAccessService.generateUsernameForEmployee(selEmp) : '';
    const valEmail = selEmp ? (selEmp.email || `${valUsername || 'user'}@al-muslim.com`) : '';
    const valPreset = selEmp ? userAccessService.resolveDefaultPresetForEmployee(selEmp) : null;
    const valPresetId = valPreset ? valPreset.id : (presets[0] ? presets[0].id : '');
    const valPass = userAccessService.generateSecurePassword(14);

    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 650px; width: 95%; max-height: 92vh; display: flex; flex-direction: column; padding: 22px;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(14, 165, 233, 0.1)); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 22px; color: #38bdf8;">
                ➕
              </div>
              <div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">Add New User Account</h3>
                <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                  Quick-search employee card to auto-populate login credentials or create custom login
                </p>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 18px; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">✕</button>
          </div>

          <!-- Scrollable Form Container -->
          <div style="overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Mode Switcher: Link Card vs Manual -->
            <div style="display: flex; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: 8px; padding: 3px; gap: 4px;">
              <button 
                type="button" 
                id="btn-add-mode-card"
                class="btn btn-xs" 
                style="flex: 1; padding: 7px; font-size: 12px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${!isAddModalManualMode ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${!isAddModalManualMode ? '#fff' : 'var(--text-muted)'};"
              >
                <span>🪪 Link from Manpower Card</span>
              </button>
              <button 
                type="button" 
                id="btn-add-mode-manual"
                class="btn btn-xs" 
                style="flex: 1; padding: 7px; font-size: 12px; font-weight: 800; border-radius: 6px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; background: ${isAddModalManualMode ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${isAddModalManualMode ? '#fff' : 'var(--text-muted)'};"
              >
                <span>✍️ Standalone Account (No Card)</span>
              </button>
            </div>

            <form id="form-uam-add-user" style="display: flex; flex-direction: column; gap: 14px;">
              
              <!-- CARD SEARCH / SELECTION SECTION -->
              ${!isAddModalManualMode ? `
                <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid ${isEmpSelected ? '#0284c7' : 'rgba(56, 189, 248, 0.4)'}; border-radius: 10px; padding: 12px 14px;">
                  ${isEmpSelected ? `
                    <!-- Selected Employee Banner -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                      <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(2, 132, 199, 0.25); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                          🪪
                        </div>
                        <div style="min-width: 0;">
                          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 13px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 5px;">
                              #${selEmp.cardNumber}
                            </span>
                            <strong style="font-size: 14px; color: #fff;">${selEmp.name}</strong>
                            ${hasExistingUser ? `
                              <span class="badge badge-warning" style="font-size: 10px;">⚠️ Has user (@${hasExistingUser.username})</span>
                            ` : `
                              <span class="badge badge-active" style="font-size: 10px;">✨ Ready to Link</span>
                            `}
                          </div>
                          <div style="font-size: 11.5px; color: #94a3b8; margin-top: 3px;">
                            ${selEmp.designation || 'Staff'} &bull; ${selEmp.department || 'Maintenance'} ${selEmp.floorName ? `&bull; ${selEmp.floorName}` : ''}
                          </div>
                        </div>
                      </div>

                      <button type="button" id="btn-add-user-clear-emp" class="btn btn-ghost btn-xs" style="color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); padding: 5px 12px; border-radius: 6px; font-weight: 700;" title="Search a different employee card">
                        ✕ Change Card
                      </button>
                    </div>
                  ` : `
                    <!-- Live Card Search Autocomplete Input -->
                    <div style="position: relative;">
                      <label style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: #38bdf8; margin-bottom: 6px;">
                        <span>🔍 Search Employee Card (Card # or Name) *</span>
                        <span style="font-size: 11px; font-weight: normal; color: var(--text-muted);">${activeEmployees.length} employees available</span>
                      </label>
                      
                      <div style="position: relative;">
                        <span style="position: absolute; left: 12px; top: 10px; font-size: 14px; color: #38bdf8;">🪪</span>
                        <input 
                          type="text" 
                          id="inp-add-user-card-search" 
                          class="form-control" 
                          placeholder="Type Card # (e.g. AMG-0000083 or 083) or Name to search..." 
                          value="${addModalCardSearchQuery}"
                          autocomplete="off" 
                          style="height: 38px; padding-left: 36px; padding-right: 30px; font-size: 13px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.4); background: rgba(15, 23, 42, 0.95); width: 100%; box-sizing: border-box;"
                          autofocus
                        />
                        ${addModalCardSearchQuery ? `
                          <button type="button" id="btn-clear-add-card-search" style="position: absolute; right: 8px; top: 8px; background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 14px;">✕</button>
                        ` : ''}
                      </div>

                      <!-- Autocomplete Suggestions List -->
                      <div id="uam-add-user-suggestions" style="display: none; max-height: 200px; overflow-y: auto; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; background: #0f172a; box-shadow: 0 10px 30px rgba(0,0,0,0.6); margin-top: 6px; padding: 4px;">
                      </div>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- FORM FIELDS: 2 COLUMN GRID -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Full Name *</label>
                  <input type="text" id="inp-add-user-name" class="form-control" required value="${valName}" placeholder="e.g. Md. Liton Miah" style="height: 36px; font-size: 12.5px; border-radius: 6px;" />
                </div>

                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Card ID / Employee ID</label>
                  <input type="text" id="inp-add-user-card" class="form-control" value="${valCard}" placeholder="e.g. AMG-0000005" style="height: 36px; font-size: 12.5px; border-radius: 6px;" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Username *</label>
                  <input type="text" id="inp-add-user-username" class="form-control" required value="${valUsername}" placeholder="e.g. amg0000005" style="height: 36px; font-size: 12.5px; border-radius: 6px;" />
                </div>

                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Email Address</label>
                  <input type="email" id="inp-add-user-email" class="form-control" value="${valEmail}" placeholder="user@al-muslim.com" style="height: 36px; font-size: 12.5px; border-radius: 6px;" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Initial Password *</label>
                  <div style="display: flex; gap: 6px;">
                    <input type="text" id="inp-add-user-password" class="form-control font-mono" required value="${valPass}" style="height: 36px; font-size: 12.5px; border-radius: 6px;" />
                    <button type="button" id="btn-add-user-toggle-pass-visibility" class="btn btn-secondary btn-xs" style="padding: 0 9px; font-size: 13px;" title="Toggle Password Masking">
                      👁️
                    </button>
                    <button type="button" id="btn-add-user-copy-pass" class="btn btn-secondary btn-xs" style="padding: 0 9px; font-size: 13px; font-weight: 700; color: #c084fc;" title="Copy Password">
                      📋
                    </button>
                    <button type="button" id="btn-add-user-generate-pass" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #38bdf8; padding: 0 10px;" title="Generate new random secure password">
                      🎲
                    </button>
                  </div>
                </div>

                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Permission Preset</label>
                  <select id="sel-add-user-preset" class="filter-select" style="height: 36px; font-size: 12px; border-radius: 6px;">
                    <option value="" ${!valPresetId ? 'selected' : ''}>🔒 No Access (Default Zero Permissions)</option>
                    ${presets.map(p => `
                      <option value="${p.id}" ${p.id === valPresetId ? 'selected' : ''}>
                        ${p.icon || '🛡️'} ${p.name}
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 6px;">
                <button type="button" class="btn btn-secondary btn-sm btn-close-uam-modal">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 7px 18px; border-radius: 8px;">
                  ➕ Create User Account
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    `;
  }

  // 6. Create / Configure Permission Preset Modal
  if (activeModalType === 'CREATE_EDIT_PRESET' && editingPreset) {
    const isEdit = Boolean(editingPreset.id);
    const p = editingPreset;
    const isSystem = Boolean(p.isSystem);
    const presetPerms = p.permissions || {};
    const availableIcons = ['🛡️', '👑', '💼', '👷', '🔧', '👁️', '🔬', '⚡', '🗄️', '📊', '📋', '👥', '⚙️', '📦'];

    const totalAvailableActions = PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).reduce((sum, m) => sum + m.actions.length, 0);
    const totalActiveActions = PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).reduce((sum, m) => {
      const acts = presetPerms[m.id] || [];
      return sum + (Array.isArray(acts) ? acts.length : 0);
    }, 0);

    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 1040px; width: 96%; height: 92vh; max-height: 94vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; background: #0b1329; border: 1.5px solid rgba(56, 189, 248, 0.35); box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85); border-radius: 12px;">
          
          <!-- Modal Header (Compact & User-Friendly) -->
          <div style="padding: 10px 18px; border-bottom: 1px solid rgba(56, 189, 248, 0.2); background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95)); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px; line-height: 1;">${p.icon || '🛡️'}</span>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">
                  ${isEdit ? `Configure Permission Preset: <span style="color: #38bdf8;">${p.name}</span>` : 'Create New Permission Preset'}
                </h3>
                <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: ${isSystem ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)'}; color: ${isSystem ? '#38bdf8' : '#c084fc'}; border: 1px solid ${isSystem ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}; font-weight: 700;">
                  ${isSystem ? 'Built-in System Profile' : 'Custom Enterprise Profile'}
                </span>
                ${isEdit ? `
                  <span style="font-size: 10.5px; padding: 2px 8px; border-radius: 999px; background: rgba(148, 163, 184, 0.12); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.25); font-weight: 600;">
                    👥 ${p.assignedUsersCount || 0} Assigned User${(p.assignedUsersCount || 0) === 1 ? '' : 's'}
                  </span>
                ` : ''}
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 16px; border-radius: 6px; padding: 2px 8px; color: var(--text-muted); cursor: pointer;" title="Close Modal">✕</button>
          </div>

          <!-- Compact Metadata Panel (Ultra-Compact 2 Rows: Saves 120px+ Vertical Space) -->
          <div style="padding: 8px 18px; background: rgba(15, 23, 42, 0.65); border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0;">
            <div style="display: grid; grid-template-columns: 2fr 1.2fr 1.2fr 1fr; gap: 10px; margin-bottom: 6px;">
              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 2px;">
                  Preset Name <span style="color: #ef4444;">*</span>
                </label>
                <input type="text" id="inp-preset-modal-name" class="form-control" value="${p.name || ''}" placeholder="e.g. Maintenance Supervisor" required style="height: 29px; font-size: 12px; padding: 4px 8px; border-radius: 6px;" />
              </div>

              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 2px;">
                  Code Identifier
                </label>
                <input type="text" id="inp-preset-modal-code" class="form-control font-mono" value="${p.code || ''}" placeholder="AUTO-GENERATED" ${isSystem ? 'disabled' : ''} style="height: 29px; font-size: 11.5px; padding: 4px 8px; border-radius: 6px; ${isSystem ? 'opacity: 0.65; cursor: not-allowed; background: rgba(15, 23, 42, 0.5);' : ''}" title="${isSystem ? 'Built-in System Preset code cannot be modified' : 'Unique system code'}" />
              </div>

              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 2px;">
                  Access Level Tag
                </label>
                <input type="text" id="inp-preset-modal-level" class="form-control" value="${p.accessLevel || 'Configured Access'}" placeholder="e.g. Full Maintenance Access" style="height: 29px; font-size: 12px; padding: 4px 8px; border-radius: 6px;" />
              </div>

              <div>
                <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 2px;">
                  Display Icon
                </label>
                <select id="sel-preset-modal-icon" class="filter-select" style="height: 29px; font-size: 12.5px; padding: 2px 6px; border-radius: 6px; width: 100%;">
                  ${availableIcons.map(ic => `<option value="${ic}" ${ic === (p.icon || '🛡️') ? 'selected' : ''}>${ic} Icon</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="inp-preset-modal-desc" style="font-size: 11px; font-weight: 700; color: #94a3b8; white-space: nowrap; margin: 0;">
                Description &amp; Scope:
              </label>
              <input type="text" id="inp-preset-modal-desc" class="form-control" value="${p.description || ''}" placeholder="Brief overview of operational scope, authority, and permissions..." style="height: 27px; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; flex: 1;" />
            </div>
          </div>

          <!-- Permissions Matrix Section (Primary Focus of Modal with Dedicated Internal Scroll) -->
          <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 8px 18px 6px 18px; overflow: hidden;">
            
            <!-- Matrix Header & Quick Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; flex-shrink: 0; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                  Granular Permissions Matrix
                </span>
                <span style="font-size: 11px; color: var(--text-muted);">(7 actions across ERP modules)</span>
                <span id="lbl-preset-modal-active-count" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">
                  ${totalActiveActions} / ${totalAvailableActions} Actions Granted
                </span>
              </div>

              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <div style="position: relative;">
                  <input 
                    type="text" 
                    id="inp-preset-modal-module-filter" 
                    class="form-control" 
                    placeholder="🔍 Filter modules..." 
                    value="${presetModuleFilterQuery}"
                    style="height: 28px; font-size: 11.5px; padding-left: 24px; width: 180px; border-radius: 6px;"
                  />
                  <span style="position: absolute; left: 7px; top: 5px; font-size: 11px; color: var(--text-muted); pointer-events: none;">🔍</span>
                </div>
                <button type="button" id="btn-preset-modal-select-all" class="btn btn-secondary btn-xs" style="color: #38bdf8; font-weight: 700; height: 28px; padding: 0 10px; border-radius: 6px;">
                  ✓ Select All Permissions
                </button>
                <button type="button" id="btn-preset-modal-deselect-all" class="btn btn-secondary btn-xs" style="color: var(--text-muted); font-weight: 700; height: 28px; padding: 0 10px; border-radius: 6px;">
                  ✕ Deselect All
                </button>
              </div>
            </div>

            <!-- Granular Permissions Table (Internal Scroll with Sticky Header) -->
            <div style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: auto; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; background: #070d1e;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed;">
                <thead style="position: sticky; top: 0; z-index: 20;">
                  <tr style="background: #0f172a; border-bottom: 2px solid #38bdf8; color: #cbd5e1; text-transform: uppercase; font-size: 11px;">
                    <th style="padding: 8px 12px; text-align: left; width: 260px; position: sticky; top: 0; background: #0f172a;">Module / Feature</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #34d399; position: sticky; top: 0; background: #0f172a;">View</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #38bdf8; position: sticky; top: 0; background: #0f172a;">Add</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #fbbf24; position: sticky; top: 0; background: #0f172a;">Edit</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #f87171; position: sticky; top: 0; background: #0f172a;">Delete</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #c084fc; position: sticky; top: 0; background: #0f172a;">Import</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #818cf8; position: sticky; top: 0; background: #0f172a;">Export</th>
                    <th style="padding: 8px 4px; text-align: center; width: 56px; color: #f472b6; position: sticky; top: 0; background: #0f172a;">Approve</th>
                    <th style="padding: 8px 6px; text-align: center; width: 72px; position: sticky; top: 0; background: #0f172a;">Quick</th>
                  </tr>
                </thead>
                <tbody>
                  ${PERMISSION_CONFIG_MODULES.map(group => `
                    <tr class="preset-modal-group-row" data-group="${group.group.toLowerCase()}" style="background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.25);">
                      <td colspan="9" style="padding: 6px 12px; font-weight: 800; font-size: 11px; color: #38bdf8; letter-spacing: 0.5px;">
                        ${group.group}
                      </td>
                    </tr>
                    ${group.modules.map(mod => {
                      const acts = presetPerms[mod.id] || [];
                      const hasV = acts.includes('VIEW');
                      const hasA = acts.includes('ADD');
                      const hasE = acts.includes('EDIT');
                      const hasD = acts.includes('DELETE');
                      const hasI = acts.includes('IMPORT');
                      const hasX = acts.includes('EXPORT');
                      const hasP = acts.includes('APPROVE');
                      const activeCount = acts.length;
                      const totalPossible = mod.actions.length;

                      return `
                        <tr class="preset-modal-module-row" data-name="${mod.name.toLowerCase()}" data-group="${group.group.toLowerCase()}" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(56, 189, 248, 0.06)'" onmouseout="this.style.background='transparent'">
                          <td style="padding: 6px 12px; font-weight: 600; color: #f8fafc;">
                            ${mod.name}
                            <span id="lbl-preset-row-count-${mod.id}" style="font-size: 10px; color: ${activeCount === totalPossible ? '#34d399' : activeCount > 0 ? '#38bdf8' : 'var(--text-muted)'}; margin-left: 6px; font-weight: 600;">
                              (${activeCount}/${totalPossible})
                            </span>
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="VIEW" ${hasV ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            ${mod.actions.includes('ADD') ? `
                              <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="ADD" ${hasA ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #0284c7;" />
                            ` : '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            ${mod.actions.includes('EDIT') ? `
                              <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="EDIT" ${hasE ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #f59e0b;" />
                            ` : '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            ${mod.actions.includes('DELETE') ? `
                              <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="DELETE" ${hasD ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #ef4444;" />
                            ` : '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            ${mod.actions.includes('IMPORT') ? `
                              <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="IMPORT" ${hasI ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #c084fc;" />
                            ` : '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            ${mod.actions.includes('EXPORT') ? `
                              <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="EXPORT" ${hasX ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #818cf8;" />
                            ` : '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            ${mod.actions.includes('APPROVE') ? `
                              <input type="checkbox" class="chk-preset-modal-perm" data-mod="${mod.id}" data-act="APPROVE" ${hasP ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #f472b6;" />
                            ` : '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 4px;">
                            <button type="button" class="btn btn-ghost btn-xs btn-preset-modal-toggle-row" data-mod="${mod.id}" style="font-size: 10px; padding: 2px 7px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px;">
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

            <!-- Cascade Update Option (Compact) -->
            ${isEdit ? `
              <div style="margin-top: 6px; flex-shrink: 0;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; cursor: pointer; color: #fbbf24; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 6px; padding: 5px 12px; margin: 0;">
                  <input type="checkbox" id="chk-preset-apply-to-assigned" ${applyToAssignedUsers ? 'checked' : ''} style="width: 14px; height: 14px; accent-color: #f59e0b; cursor: pointer;" />
                  <span><strong>Cascade Update:</strong> Apply modified permissions immediately to all currently assigned users (${p.assignedUsersCount || 0} account${(p.assignedUsersCount || 0) === 1 ? '' : 's'})</span>
                </label>
              </div>
            ` : ''}

          </div>

          <!-- Modal Footer (Fixed at Bottom) -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 23, 42, 0.95); padding: 9px 18px; flex-shrink: 0; gap: 10px;">
            <div>
              ${isEdit && !isSystem ? `
                <button type="button" id="btn-preset-modal-delete" class="btn btn-ghost btn-sm" style="color: #ef4444; font-weight: 700; font-size: 12px; padding: 4px 10px;">
                  🗑️ Delete Preset
                </button>
              ` : ''}
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm btn-close-uam-modal" style="font-size: 12px; height: 32px; padding: 0 14px; border-radius: 6px;">Cancel</button>
              <button type="button" id="btn-preset-modal-save" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 12px; height: 32px; padding: 0 18px; border-radius: 6px;">
                💾 Save Preset &amp; Permissions
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // 7. Assign Users to Preset Modal
  if (activeModalType === 'ASSIGN_USERS_TO_PRESET' && targetPreset) {
    const p = targetPreset;
    const allUsers = (storage.getTable(TABLE_NAMES.USERS) || []).filter(u => u.status === 'ACTIVE');

    return `
      <div class="modal-overlay active" id="modal-uam-overlay">
        <div class="modal-card" style="max-width: 760px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; padding: 22px;">
          
          <!-- Header -->
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">${p.icon || '👥'}</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">
                  Assign Users to Preset: ${p.name}
                </h3>
                <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">
                  Select workforce accounts to inherit this access profile and permissions
                </p>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm btn-close-uam-modal" style="font-size: 18px; border-radius: 8px;">✕</button>
          </div>

          <!-- Controls Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 0 0 12px 0; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
            <div style="flex: 1; min-width: 200px;">
              <input type="text" id="inp-assign-preset-search" class="form-control" placeholder="Search by name, card #, or username..." style="height: 32px; font-size: 12px;" />
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" id="btn-assign-preset-select-all" class="btn btn-secondary btn-xs" style="color: #38bdf8; font-weight: 700;">
                Select All
              </button>
              <button type="button" id="btn-assign-preset-deselect-all" class="btn btn-secondary btn-xs" style="color: var(--text-muted); font-weight: 700;">
                Deselect All
              </button>
            </div>
          </div>

          <!-- User Checkbox List -->
          <div id="assign-preset-user-list" style="overflow-y: auto; padding: 10px 4px 10px 0; display: flex; flex-direction: column; gap: 6px; flex: 1;">
            ${allUsers.map(u => {
              const isChecked = selectedUserIdsForPreset.includes(u.id);
              const cardStr = u.cardNumber || u.employeeId || '—';
              return `
                <label class="assign-preset-user-item" data-search="${(u.name + ' ' + cardStr + ' ' + u.username + ' ' + (u.department || '')).toLowerCase()}" style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid ${isChecked ? '#0284c7' : 'rgba(255,255,255,0.07)'}; border-radius: 6px; padding: 8px 12px; cursor: pointer;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" class="chk-assign-preset-user" data-uid="${u.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7;" />
                    <div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-family: var(--font-mono); font-size: 11.5px; color: #38bdf8; font-weight: 700;">#${cardStr}</span>
                        <strong style="font-size: 12.5px; color: #fff;">${u.name}</strong>
                        <span style="font-size: 11px; color: #94a3b8; font-family: var(--font-mono);">@${u.username}</span>
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        ${u.designation || 'Staff'} &bull; ${u.department || 'Maintenance'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span class="badge ${u.presetId === p.id ? 'badge-active' : 'badge-info'}" style="font-size: 9.5px;">
                      ${u.presetName || 'No Access'}
                    </span>
                  </div>
                </label>
              `;
            }).join('')}
          </div>

          <!-- Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px; flex-shrink: 0;">
            <div style="font-size: 12px; color: var(--text-muted);">
              Selected: <strong id="assign-preset-selected-count" style="color: #38bdf8;">${selectedUserIdsForPreset.length}</strong> users
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm btn-close-uam-modal" style="font-size: 12px;">Cancel</button>
              <button type="button" id="btn-save-preset-user-assignments" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 12px; padding: 6px 18px;">
                💾 Save Assignments
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  return '';
}

// ---------------------------------------------------------------------------
// LOCATION SCOPE EVENT BINDING HELPER
// ---------------------------------------------------------------------------

function bindLocationScopeEvents(root, scopeObj, pfx, onChange) {
  // Global preset button
  const btnGlobal = root.querySelector(`#${pfx}-btn-global`);
  if (btnGlobal) {
    btnGlobal.addEventListener('click', () => {
      scopeObj.allGroups = true;
      scopeObj.groupIds = [];
      scopeObj.allUnits = true;
      scopeObj.unitIds = [];
      scopeObj.allFloors = true;
      scopeObj.floorIds = [];
      scopeObj.allLines = true;
      scopeObj.lineIds = [];
      onChange();
    });
  }

  // Clear all button
  const btnClearAll = root.querySelector(`#${pfx}-btn-clear-all`);
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      scopeObj.allGroups = false;
      scopeObj.groupIds = [];
      scopeObj.allUnits = false;
      scopeObj.unitIds = [];
      scopeObj.allFloors = false;
      scopeObj.floorIds = [];
      scopeObj.allLines = false;
      scopeObj.lineIds = [];
      onChange();
    });
  }

  // All Groups toggle
  const chkAllGroups = root.querySelector(`#${pfx}-chk-all-groups`);
  if (chkAllGroups) {
    chkAllGroups.addEventListener('change', (e) => {
      scopeObj.allGroups = e.target.checked;
      if (e.target.checked) {
        scopeObj.groupIds = [];
      }
      onChange();
    });
  }

  // Group item checkboxes
  root.querySelectorAll(`.${pfx}-chk-group-item`).forEach(cb => {
    cb.addEventListener('change', (e) => {
      const gid = cb.getAttribute('data-id');
      if (!Array.isArray(scopeObj.groupIds)) scopeObj.groupIds = [];
      if (e.target.checked) {
        if (!scopeObj.groupIds.includes(gid)) scopeObj.groupIds.push(gid);
      } else {
        scopeObj.groupIds = scopeObj.groupIds.filter(g => g !== gid);
      }
      // Prune units that don't belong to selected groups
      if (!scopeObj.allGroups && scopeObj.groupIds.length > 0) {
        const validUnits = masterDataService.getUnits ? masterDataService.getUnits(null, true, true).filter(u => scopeObj.groupIds.includes(u.groupId)) : [];
        const validUnitIds = new Set(validUnits.map(u => u.id));
        scopeObj.unitIds = (scopeObj.unitIds || []).filter(uid => validUnitIds.has(uid));
      }
      pruneOrphanLocations(scopeObj);
      onChange();
    });
  });

  // All Units toggle
  const chkAllUnits = root.querySelector(`#${pfx}-chk-all-units`);
  if (chkAllUnits) {
    chkAllUnits.addEventListener('change', (e) => {
      scopeObj.allUnits = e.target.checked;
      if (e.target.checked) {
        scopeObj.unitIds = [];
      }
      onChange();
    });
  }

  // Unit item checkboxes
  root.querySelectorAll(`.${pfx}-chk-unit-item`).forEach(cb => {
    cb.addEventListener('change', (e) => {
      const uid = cb.getAttribute('data-id');
      if (!Array.isArray(scopeObj.unitIds)) scopeObj.unitIds = [];
      if (e.target.checked) {
        if (!scopeObj.unitIds.includes(uid)) scopeObj.unitIds.push(uid);
      } else {
        scopeObj.unitIds = scopeObj.unitIds.filter(u => u !== uid);
      }
      pruneOrphanLocations(scopeObj);
      onChange();
    });
  });

  // All Floors toggle
  const chkAllFloors = root.querySelector(`#${pfx}-chk-all-floors`);
  if (chkAllFloors) {
    chkAllFloors.addEventListener('change', (e) => {
      scopeObj.allFloors = e.target.checked;
      if (e.target.checked) {
        scopeObj.floorIds = [];
      }
      onChange();
    });
  }

  // Floor item checkboxes
  root.querySelectorAll(`.${pfx}-chk-floor-item`).forEach(cb => {
    cb.addEventListener('change', (e) => {
      const fid = cb.getAttribute('data-id');
      if (!Array.isArray(scopeObj.floorIds)) scopeObj.floorIds = [];
      if (e.target.checked) {
        if (!scopeObj.floorIds.includes(fid)) scopeObj.floorIds.push(fid);
      } else {
        scopeObj.floorIds = scopeObj.floorIds.filter(f => f !== fid);
      }
      pruneOrphanLocations(scopeObj);
      onChange();
    });
  });

  // All Lines toggle
  const chkAllLines = root.querySelector(`#${pfx}-chk-all-lines`);
  if (chkAllLines) {
    chkAllLines.addEventListener('change', (e) => {
      scopeObj.allLines = e.target.checked;
      if (e.target.checked) {
        scopeObj.lineIds = [];
      }
      onChange();
    });
  }

  // Line item checkboxes
  root.querySelectorAll(`.${pfx}-chk-line-item`).forEach(cb => {
    cb.addEventListener('change', (e) => {
      const lid = cb.getAttribute('data-id');
      if (!Array.isArray(scopeObj.lineIds)) scopeObj.lineIds = [];
      if (e.target.checked) {
        if (!scopeObj.lineIds.includes(lid)) scopeObj.lineIds.push(lid);
      } else {
        scopeObj.lineIds = scopeObj.lineIds.filter(l => l !== lid);
      }
      onChange();
    });
  });
}

// ---------------------------------------------------------------------------
// EVENT BINDINGS FOR USER ACCESS MANAGEMENT
// ---------------------------------------------------------------------------

export function initUserManagementEvents() {
  const root = document.getElementById('main-view-container');
  if (!root) return;
  root.style.overflow = 'hidden';

  const reRender = () => {
    if (typeof window.app !== 'undefined' && typeof window.app.renderMainContent === 'function') {
      window.app.renderMainContent(true, false, 'users');
    }
  };

  // Restore Search Focus and Cursor Position if reRender was triggered by typing
  if (shouldRestoreSearchFocus) {
    shouldRestoreSearchFocus = false;
    const restoredSearchInp = document.getElementById('uam-search-input');
    if (restoredSearchInp) {
      restoredSearchInp.focus();
      try {
        restoredSearchInp.setSelectionRange(searchFocusCursorPos, searchFocusCursorPos);
      } catch (_) {}
    }
  }

  // Restore Card Search Focus and Cursor Position
  if (shouldRestoreCardSearchFocus) {
    shouldRestoreCardSearchFocus = false;
    const restoredCardSearchInp = document.getElementById('uam-card-search-input');
    if (restoredCardSearchInp) {
      restoredCardSearchInp.focus();
      try {
        restoredCardSearchInp.setSelectionRange(cardSearchFocusCursorPos, cardSearchFocusCursorPos);
      } catch (_) {}
    }
  }

  // Automatic Manpower Sync: if any registered employees are missing user accounts, auto-sync silently
  const allAccountsSnapshot = userAccessService.getAllAccountsWithManpower();
  const unlinkedCount = allAccountsSnapshot.filter(a => !a.hasAccount).length;
  if (unlinkedCount > 0 && !window._uamAutoSyncing) {
    window._uamAutoSyncing = true;
    setTimeout(async () => {
      try {
        const syncRes = await userAccessService.syncAllManpowerAccounts();
        if (syncRes && syncRes.newAccountsCount > 0) {
          notificationService.success(`Auto-Sync: Created accounts for ${syncRes.newAccountsCount} Manpower employees (Zero Default Access).`);
          reRender();
        }
      } catch (err) {
        console.error('[Auto-Sync Background Error]', err);
      } finally {
        window._uamAutoSyncing = false;
      }
    }, 150);
  }

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
  // Dedicated Card Search Option
  const cardSearchInp = document.getElementById('uam-card-search-input');
  if (cardSearchInp) {
    let debounceTimer;
    cardSearchInp.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value;
      const curPos = e.target.selectionStart || val.length;
      debounceTimer = setTimeout(() => {
        cardSearchQuery = val;
        currentPage = 1;
        shouldRestoreCardSearchFocus = true;
        cardSearchFocusCursorPos = curPos;
        reRender();
      }, 200);
    });
    cardSearchInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cardSearchQuery = e.target.value;
        currentPage = 1;
        reRender();
      }
    });
  }

  const btnClearCardSearch = document.getElementById('btn-clear-uam-card-search');
  if (btnClearCardSearch) {
    btnClearCardSearch.addEventListener('click', () => {
      cardSearchQuery = '';
      currentPage = 1;
      reRender();
    });
  }

  // General Text Search
  const searchInp = document.getElementById('uam-search-input');
  if (searchInp) {
    let debounceTimer;
    searchInp.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value;
      const curPos = e.target.selectionStart || val.length;
      debounceTimer = setTimeout(() => {
        searchQuery = val;
        currentPage = 1;
        shouldRestoreSearchFocus = true;
        searchFocusCursorPos = curPos;
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

  const elGroup = document.getElementById('uam-filter-group');
  if (elGroup) {
    elGroup.addEventListener('change', (e) => {
      filterGroup = e.target.value;
      filterUnit = 'ALL';
      filterFloor = 'ALL';
      filterLine = 'ALL';
      currentPage = 1;
      reRender();
    });
  }

  const elUnit = document.getElementById('uam-filter-unit');
  if (elUnit) {
    elUnit.addEventListener('change', (e) => {
      filterUnit = e.target.value;
      if (filterUnit !== 'ALL' && filterGroup === 'ALL') {
        const uObj = masterDataService.getUnitById ? masterDataService.getUnitById(filterUnit) : null;
        if (uObj?.groupId) filterGroup = uObj.groupId;
      }
      filterFloor = 'ALL';
      filterLine = 'ALL';
      currentPage = 1;
      reRender();
    });
  }

  const elFloor = document.getElementById('uam-filter-floor');
  if (elFloor) {
    elFloor.addEventListener('change', (e) => {
      filterFloor = e.target.value;
      if (filterFloor !== 'ALL') {
        const fObj = masterDataService.getFloorById ? masterDataService.getFloorById(filterFloor) : null;
        if (fObj?.unitId && filterUnit === 'ALL') {
          filterUnit = fObj.unitId;
          const uObj = masterDataService.getUnitById ? masterDataService.getUnitById(fObj.unitId) : null;
          if (uObj?.groupId && filterGroup === 'ALL') filterGroup = uObj.groupId;
        }
      }
      filterLine = 'ALL';
      currentPage = 1;
      reRender();
    });
  }

  const elLine = document.getElementById('uam-filter-line');
  if (elLine) {
    elLine.addEventListener('change', (e) => {
      filterLine = e.target.value;
      if (filterLine !== 'ALL') {
        const lObj = masterDataService.getLineById ? masterDataService.getLineById(filterLine) : null;
        if (lObj?.floorId && filterFloor === 'ALL') {
          filterFloor = lObj.floorId;
          const fObj = masterDataService.getFloorById ? masterDataService.getFloorById(lObj.floorId) : null;
          if (fObj?.unitId && filterUnit === 'ALL') {
            filterUnit = fObj.unitId;
            const uObj = masterDataService.getUnitById ? masterDataService.getUnitById(fObj.unitId) : null;
            if (uObj?.groupId && filterGroup === 'ALL') filterGroup = uObj.groupId;
          }
        }
      }
      currentPage = 1;
      reRender();
    });
  }

  bindFilter('uam-filter-desig', val => filterDesignation = val);
  bindFilter('uam-filter-status', val => filterStatus = val);
  bindFilter('uam-filter-account-link', val => filterAccountLink = val);
  bindFilter('uam-filter-pass-status', val => filterPasswordStatus = val);

  const btnClearAllFilters = document.getElementById('btn-clear-all-filters');
  if (btnClearAllFilters) {
    btnClearAllFilters.addEventListener('click', () => {
      searchQuery = '';
      cardSearchQuery = '';
      quickCardFilter = 'ALL';
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

  // Quick Filter Chips (All, With Card #, Active, Inactive, Missing, Temp Pass)
  root.querySelectorAll('.btn-uam-quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      quickCardFilter = btn.getAttribute('data-filter') || 'ALL';
      currentPage = 1;
      reRender();
    });
  });

  // KPI Summary Cards Click Handlers
  root.querySelectorAll('.uam-kpi-summary-card').forEach(card => {
    card.addEventListener('click', () => {
      const act = card.getAttribute('data-action');
      if (act === 'TOTAL') {
        quickCardFilter = 'ALL';
        searchQuery = '';
        filterStatus = 'ALL';
        filterAccountLink = 'ALL';
        filterPasswordStatus = 'ALL';
      } else if (act === 'ACTIVE') {
        quickCardFilter = 'ACTIVE';
      } else if (act === 'INACTIVE') {
        quickCardFilter = 'INACTIVE';
      } else if (act === 'PENDING_CREATION') {
        quickCardFilter = 'MISSING_ACCOUNT';
      } else if (act === 'PENDING_PASSWORD') {
        quickCardFilter = 'TEMP_PASS';
      } else if (act === 'CONFIGURED_ACCESS') {
        activeUserSection = 'PERMISSIONS';
        if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_access_section', 'PERMISSIONS');
      }
      currentPage = 1;
      reRender();
    });
  });

  // Clickable Card Badge in Table Rows (Filter by that specific Card #)
  root.querySelectorAll('.uam-clickable-card-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardNum = badge.getAttribute('data-card');
      if (cardNum && cardNum !== '—') {
        searchQuery = cardNum;
        currentPage = 1;
        reRender();
        notificationService.info(`Filtered accounts by Card #${cardNum}`);
      }
    });
  });

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
  if (btnNext) btnNext.addEventListener('click', () => { if (currentPage < currentCalculatedTotalPages) { currentPage++; reRender(); } });
  if (btnLast) btnLast.addEventListener('click', () => {
    currentPage = currentCalculatedTotalPages;
    reRender();
  });

  const btnEmptyClear = document.getElementById('btn-empty-clear-filters');
  if (btnEmptyClear) {
    btnEmptyClear.addEventListener('click', () => {
      searchQuery = '';
      cardSearchQuery = '';
      quickCardFilter = 'ALL';
      filterGroup = 'ALL';
      filterUnit = 'ALL';
      filterFloor = 'ALL';
      filterLine = 'ALL';
      filterDesignation = 'ALL';
      filterStatus = 'ALL';
      filterAccountLink = 'ALL';
      filterPasswordStatus = 'ALL';
      currentPage = 1;
      reRender();
    });
  }

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
      selectUserForPermissions(id, true);
      activeUserSection = 'PERMISSIONS';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('al_muslim_user_access_section', 'PERMISSIONS');
      }
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
      if (confirm('Scan all registered Manpower records and automatically generate unique User Accounts with ZERO default permissions for any missing accounts?')) {
        btnAutoCreateAll.disabled = true;
        btnAutoCreateAll.innerText = 'Syncing & Generating...';
        try {
          const res = await userAccessService.syncAllManpowerAccounts();
          if (res && res.success) {
            notificationService.success(`Auto-created ${res.newAccountsCount} missing user accounts with ZERO default access! Verified ${res.totalEmployees} Manpower records.`);
            reRender();
          } else {
            throw new Error(res?.error || 'Sync process failed');
          }
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
      addModalSelectedEmployee = null;
      addModalCardSearchQuery = '';
      isAddModalManualMode = false;
      reRender();
    });
  }

  // Top Action: Manual Refresh Sync
  const btnRefresh = document.getElementById('btn-refresh-uam');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.disabled = true;
      const originalHtml = btnRefresh.innerHTML;
      btnRefresh.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">🔄</span> Syncing...`;
      notificationService.info('Synchronizing Manpower database and user access records...');
      try {
        if (typeof storage.syncWithServerDatabase === 'function') {
          await storage.syncWithServerDatabase();
        }
        const res = await userAccessService.syncAllManpowerAccounts();
        if (res && res.success) {
          if (res.newAccountsCount > 0) {
            notificationService.success(`Sync Succeeded: Auto-created ${res.newAccountsCount} new user accounts for Manpower employees! (Zero Default Permissions)`);
          } else {
            notificationService.success(`Sync Complete: All ${res.totalEmployees || 'registered'} Manpower employees & user accounts are fully in sync.`);
          }
          reRender();
        } else {
          throw new Error(res?.error || 'Database synchronization returned an unsuccessful response.');
        }
      } catch (err) {
        console.error('[User Access Sync Error]', err);
        notificationService.error(`Sync Failed: ${err.message || 'Unknown network/database error'}. Please check your connection and retry.`);
      } finally {
        btnRefresh.disabled = false;
        btnRefresh.innerHTML = originalHtml;
      }
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
  // Copy Card Number to Clipboard
  const btnPermCopyCard = document.getElementById('btn-perm-copy-card');
  if (btnPermCopyCard) {
    btnPermCopyCard.addEventListener('click', () => {
      const card = btnPermCopyCard.getAttribute('data-card');
      if (card && card !== '—') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(card);
        }
        notificationService.info(`Copied Card #${card} to clipboard!`);
      }
    });
  }

  // Previous & Next Card Navigation
  const btnPermPrevUser = document.getElementById('btn-perm-prev-user');
  if (btnPermPrevUser) {
    btnPermPrevUser.addEventListener('click', () => {
      const users = (typeof storage !== 'undefined' && storage.getTable) ? (storage.getTable(TABLE_NAMES.USERS) || []) : [];
      const cIdx = users.findIndex(u => u.id === permissionTargetUserId);
      if (cIdx > 0) {
        selectUserForPermissions(users[cIdx - 1].id, true);
        reRender();
        notificationService.info(`Switched to Card #${users[cIdx - 1].cardNumber || users[cIdx - 1].employeeId} (${users[cIdx - 1].name})`);
      }
    });
  }

  const btnPermNextUser = document.getElementById('btn-perm-next-user');
  if (btnPermNextUser) {
    btnPermNextUser.addEventListener('click', () => {
      const users = (typeof storage !== 'undefined' && storage.getTable) ? (storage.getTable(TABLE_NAMES.USERS) || []) : [];
      const cIdx = users.findIndex(u => u.id === permissionTargetUserId);
      if (cIdx >= 0 && cIdx < users.length - 1) {
        selectUserForPermissions(users[cIdx + 1].id, true);
        reRender();
        notificationService.info(`Switched to Card #${users[cIdx + 1].cardNumber || users[cIdx + 1].employeeId} (${users[cIdx + 1].name})`);
      }
    });
  }

  // Quick Pick Account Chips in Tab 2 Empty State
  root.querySelectorAll('.btn-perm-quick-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectUserForPermissions(id, true);
        reRender();
        const u = storage.getItem(TABLE_NAMES.USERS, id);
        if (u) {
          notificationService.success(`Loaded permissions & location scope for ${u.name} (Card #${u.cardNumber || u.employeeId})`);
        }
      }
    });
  });

  // Deselect User Buttons (Header Banner and Toolbar)
  root.querySelectorAll('.btn-perm-deselect-user').forEach(btn => {
    btn.addEventListener('click', () => {
      selectUserForPermissions(null, true);
      notificationService.info('Account deselected. Please search or select an account.');
      reRender();
    });
  });

  // Smart Autocomplete Live Search for Tab 2
  const smartSearchInp = document.getElementById('inp-perm-smart-search');
  const smartSearchDropdown = document.getElementById('perm-smart-search-dropdown');
  const btnClearSmartSearch = document.getElementById('btn-clear-perm-smart-search');

  if (smartSearchInp && smartSearchDropdown) {
    let smartDebounce;

    const renderSmartResults = (query) => {
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        smartSearchDropdown.style.display = 'none';
        smartSearchDropdown.innerHTML = '';
        if (btnClearSmartSearch) btnClearSmartSearch.style.display = 'none';
        return;
      }

      if (btnClearSmartSearch) btnClearSmartSearch.style.display = 'block';

      const users = (typeof storage !== 'undefined' && storage.getTable) ? (storage.getTable(TABLE_NAMES.USERS) || []) : [];
      const matches = users.filter(u => {
        const card = (u.cardNumber || u.employeeId || '').toLowerCase();
        const name = (u.name || '').toLowerCase();
        const uname = (u.username || '').toLowerCase();
        const desig = (u.designation || '').toLowerCase();
        const dept = (u.department || '').toLowerCase();
        const unit = (u.unitName || '').toLowerCase();
        const floor = (u.floorName || '').toLowerCase();
        const line = (u.lineName || '').toLowerCase();
        return card.includes(q) || name.includes(q) || uname.includes(q) || desig.includes(q) || dept.includes(q) || unit.includes(q) || floor.includes(q) || line.includes(q);
      }).slice(0, 10);

      if (matches.length === 0) {
        smartSearchDropdown.innerHTML = `
          <div style="padding: 14px 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
            No accounts found matching "<strong>${escapeHtml(q)}</strong>"
          </div>
        `;
        smartSearchDropdown.style.display = 'block';
        return;
      }

      smartSearchDropdown.innerHTML = matches.map(u => {
        const cardNum = u.cardNumber || u.employeeId || '—';
        const modCount = Object.values(u.permissions || {}).filter(acts => Array.isArray(acts) && acts.length > 0).length;
        const isActive = u.status === 'ACTIVE';

        return `
          <div class="perm-smart-result-item" data-id="${u.id}" style="padding: 9px 14px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; transition: all 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-family: var(--font-mono); font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">
                🪪 #${cardNum}
              </span>
              <div style="min-width: 0;">
                <div style="font-size: 12.5px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(u.name)} <span style="font-size: 11px; font-weight: 400; color: #94a3b8;">(@${u.username})</span>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
                  ${escapeHtml(u.designation || 'User')} (${escapeHtml(u.department || '—')}) • 📍 ${escapeHtml(u.unitName || '—')}
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <span class="badge ${isActive ? 'badge-active' : 'badge-maint'}" style="font-size: 9.5px; padding: 1px 5px;">${u.status}</span>
              <span style="font-size: 10.5px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                ${modCount > 0 ? `${modCount} Modules` : 'No Perms'}
              </span>
            </div>
          </div>
        `;
      }).join('');

      smartSearchDropdown.style.display = 'block';

      // Attach hover & click events to each result item
      smartSearchDropdown.querySelectorAll('.perm-smart-result-item').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.background = 'rgba(2, 132, 199, 0.25)');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-id');
          if (id) {
            selectUserForPermissions(id, true);
            smartSearchDropdown.style.display = 'none';
            reRender();
            const target = storage.getItem(TABLE_NAMES.USERS, id);
            if (target) {
              notificationService.success(`Loaded permissions & location scope for ${target.name} (Card #${target.cardNumber || target.employeeId})`);
            }
          }
        });
      });
    };

    smartSearchInp.addEventListener('input', (e) => {
      clearTimeout(smartDebounce);
      const val = e.target.value;
      permCardSearchQuery = val;
      smartDebounce = setTimeout(() => {
        renderSmartResults(val);
      }, 100);
    });

    smartSearchInp.addEventListener('focus', () => {
      if (smartSearchInp.value.trim()) {
        renderSmartResults(smartSearchInp.value);
      }
    });

    smartSearchInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstItem = smartSearchDropdown.querySelector('.perm-smart-result-item');
        if (firstItem) {
          firstItem.click();
        } else if (smartSearchInp.value.trim()) {
          const q = smartSearchInp.value.trim().toLowerCase();
          const users = (typeof storage !== 'undefined' && storage.getTable) ? (storage.getTable(TABLE_NAMES.USERS) || []) : [];
          const matched = users.find(u => {
            const card = (u.cardNumber || u.employeeId || '').toLowerCase();
            return card === q || card.includes(q) || (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
          });
          if (matched) {
            selectUserForPermissions(matched.id, true);
            smartSearchDropdown.style.display = 'none';
            reRender();
            notificationService.success(`Loaded permissions & location scope for ${matched.name} (Card #${matched.cardNumber || matched.employeeId})`);
          } else {
            notificationService.warning(`No account found matching "${smartSearchInp.value}"`);
          }
        }
      } else if (e.key === 'Escape') {
        smartSearchDropdown.style.display = 'none';
      }
    });

    if (btnClearSmartSearch) {
      btnClearSmartSearch.addEventListener('click', () => {
        smartSearchInp.value = '';
        permCardSearchQuery = '';
        smartSearchDropdown.style.display = 'none';
        btnClearSmartSearch.style.display = 'none';
        smartSearchInp.focus();
      });
    }

    // Close smart search dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (smartSearchInp && smartSearchDropdown) {
        if (!smartSearchInp.contains(e.target) && !smartSearchDropdown.contains(e.target)) {
          smartSearchDropdown.style.display = 'none';
        }
      }
    });
  }

  // Synchronized User Switcher Dropdown ("Or Select Account")
  const userSwitcher = document.getElementById('uam-perm-user-switcher');
  if (userSwitcher) {
    userSwitcher.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        selectUserForPermissions(val, true);
        const u = storage.getItem(TABLE_NAMES.USERS, val);
        if (u) {
          notificationService.success(`Switched to ${u.name} (Card #${u.cardNumber || u.employeeId})`);
        }
      } else {
        selectUserForPermissions(null, true);
        notificationService.info('Account deselected. Please search or select an account.');
      }
      reRender();
    });
  }

  // Tab 2 Module Search Filter
  const inpPermModuleFilter = document.getElementById('inp-perm-module-filter');
  if (inpPermModuleFilter) {
    inpPermModuleFilter.addEventListener('input', (e) => {
      const q = (e.target.value || '').toLowerCase().trim();
      permModuleFilterQuery = q;
      root.querySelectorAll('.matrix-module-row').forEach(row => {
        const modName = row.getAttribute('data-name') || '';
        const groupName = row.getAttribute('data-group') || '';
        if (!q || modName.includes(q) || groupName.includes(q)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
  }

  const btnClearPermModFilter = document.getElementById('btn-clear-perm-module-filter');
  if (btnClearPermModFilter) {
    btnClearPermModFilter.addEventListener('click', () => {
      permModuleFilterQuery = '';
      reRender();
    });
  }

  // Preset Modal Module Filter
  const inpPresetModFilter = document.getElementById('inp-preset-modal-module-filter');
  if (inpPresetModFilter) {
    inpPresetModFilter.addEventListener('input', (e) => {
      const q = (e.target.value || '').toLowerCase().trim();
      presetModuleFilterQuery = q;
      const modal = document.getElementById('modal-uam-overlay');
      if (modal) {
        const groupHasVisible = {};
        modal.querySelectorAll('.preset-modal-module-row').forEach(row => {
          const modName = (row.getAttribute('data-name') || '').toLowerCase();
          const groupName = (row.getAttribute('data-group') || '').toLowerCase();
          const isMatch = !q || modName.includes(q) || groupName.includes(q);
          row.style.display = isMatch ? '' : 'none';
          if (isMatch) groupHasVisible[groupName] = true;
        });
        modal.querySelectorAll('.preset-modal-group-row').forEach(row => {
          const groupName = (row.getAttribute('data-group') || '').toLowerCase();
          row.style.display = (!q || groupHasVisible[groupName]) ? '' : 'none';
        });
      }
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

  const btnPermCancel = document.getElementById('btn-perm-cancel-changes');
  if (btnPermCancel) {
    btnPermCancel.addEventListener('click', () => {
      if (permissionTargetUserId) {
        selectUserForPermissions(permissionTargetUserId);
        notificationService.info('Permissions and location scope changes were reverted to saved values.');
        reRender();
      }
    });
  }

  // Bind location scope controls for Individual Permissions Tab
  bindLocationScopeEvents(root, editingScope, 'perm-scope', reRender);

  const btnPermSave = document.getElementById('btn-perm-save-changes');
  if (btnPermSave) {
    btnPermSave.addEventListener('click', async () => {
      if (!permissionTargetUserId) {
        notificationService.warning('Please select a user account first.');
        return;
      }
      btnPermSave.disabled = true;
      btnPermSave.innerText = 'Saving...';
      try {
        await authService.updateUserPermissions(permissionTargetUserId, editingPermissions, 'CUSTOM', 'Custom Access', editingScope);
        notificationService.success('Individual access permissions and location scope saved successfully!');
        selectUserForPermissions(permissionTargetUserId);
        reRender();
      } catch (err) {
        notificationService.error('Save failed: ' + err.message);
        btnPermSave.disabled = false;
        btnPermSave.innerText = '💾 Save Permissions & Location Scope';
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

  const btnBulkSelectAll = document.getElementById('btn-bulk-select-all');
  if (btnBulkSelectAll) {
    btnBulkSelectAll.addEventListener('click', () => {
      PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).forEach(m => {
        bulkTargetModulePerms[m.id] = [...m.actions];
      });
      reRender();
    });
  }

  const btnBulkDeselectAll = document.getElementById('btn-bulk-deselect-all');
  if (btnBulkDeselectAll) {
    btnBulkDeselectAll.addEventListener('click', () => {
      bulkTargetModulePerms = {};
      reRender();
    });
  }

  const btnBulkCancel = document.getElementById('btn-cancel-bulk-assign');
  if (btnBulkCancel) {
    btnBulkCancel.addEventListener('click', () => {
      bulkTargetModulePerms = {};
      activeUserSection = 'ACCOUNTS';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('al_muslim_user_access_section', 'ACCOUNTS');
      }
      notificationService.info('Bulk assignment cancelled.');
      reRender();
    });
  }

  const chkBulkApplyScope = root.querySelector('#chk-bulk-apply-scope');
  if (chkBulkApplyScope) {
    chkBulkApplyScope.addEventListener('change', (e) => {
      bulkApplyScope = e.target.checked;
      reRender();
    });
  }

  // Bind location scope controls for Bulk Assignment Tab if enabled
  if (bulkApplyScope) {
    bindLocationScopeEvents(root, bulkTargetScope, 'bulk-scope', reRender);
  }

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
        const res = await userAccessService.bulkAssignPermissions(
          targetIds, 
          bulkTargetModulePerms, 
          bulkAssignmentMode,
          bulkApplyScope ? bulkTargetScope : null
        );
        const scopeNote = bulkApplyScope ? ' and location scope' : '';
        notificationService.success(
          `Bulk permissions${scopeNote} applied successfully in [${res.mode}] mode to ${res.successful.length} accounts!`
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
      addModalSelectedEmployee = null;
      addModalCardSearchQuery = '';
      isAddModalManualMode = false;
      summaryModalSearchQuery = '';
      reRender();
    });
  });

  // Auto-Create Summary Modal: Live Card/Name/Username Search
  const inpSummarySearch = document.getElementById('inp-uam-summary-search');
  if (inpSummarySearch) {
    inpSummarySearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const rows = root.querySelectorAll('.uam-summary-account-row');
      let visibleCount = 0;
      rows.forEach(row => {
        const text = row.getAttribute('data-search') || '';
        if (!q || text.includes(q)) {
          row.style.display = 'flex';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });
      const countEl = document.getElementById('uam-summary-match-count');
      if (countEl) countEl.innerText = `Showing ${visibleCount} of ${rows.length} accounts`;
    });
  }

  // Auto-Create Summary Modal: Direct Excel Export (1 Worksheet)
  const btnSummaryExport = document.getElementById('btn-summary-export-excel');
  if (btnSummaryExport && autoCreateSummaryData) {
    btnSummaryExport.addEventListener('click', () => {
      if (!window.XLSX) {
        notificationService.error('Excel library is initializing. Please wait a moment.');
        return;
      }
      const list = autoCreateSummaryData.successful || [];
      if (list.length === 0) {
        notificationService.info('No successful accounts to export.');
        return;
      }
      const exportRows = list.map((acc, idx) => ({
        'SL': idx + 1,
        'Card Number': acc.cardNumber || '—',
        'Employee Name': acc.name || '',
        'Username': acc.username || '',
        'Initial Password': acc.initialPassword || userAccessService.getTemporaryCredential(acc.userId) || '—',
        'Designation': acc.designation || 'Staff',
        'Department': acc.department || 'Maintenance',
        'Floor': acc.floor || '—',
        'Created Date': new Date().toLocaleDateString(),
        'Account Status': 'ACTIVE',
        'Password Status': 'TEMPORARY (Must Change)'
      }));
      const ws = window.XLSX.utils.json_to_sheet(exportRows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Auto_Created_Accounts');
      window.XLSX.writeFile(wb, `Al_Muslim_Auto_Created_Accounts_${new Date().toISOString().slice(0, 10)}.xlsx`);
      notificationService.success(`Exported ${exportRows.length} accounts to single-sheet Excel!`);
    });
  }

  // Auto-Create Summary Modal: Copy All Usernames
  const btnSummaryCopyAll = document.getElementById('btn-summary-copy-all');
  if (btnSummaryCopyAll && autoCreateSummaryData) {
    btnSummaryCopyAll.addEventListener('click', () => {
      const list = (autoCreateSummaryData.successful || []).map(s => `@${s.username}`).join(', ');
      if (list && navigator.clipboard) {
        navigator.clipboard.writeText(list);
        btnSummaryCopyAll.innerText = '✓ Copied All!';
        setTimeout(() => { if (btnSummaryCopyAll) btnSummaryCopyAll.innerText = '📋 Copy Usernames'; }, 2000);
        notificationService.success(`Copied ${autoCreateSummaryData.successful.length} usernames!`);
      }
    });
  }

  // Auto-Create Summary Modal: Copy Individual Password
  root.querySelectorAll('.btn-copy-summary-pass').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pass = btn.getAttribute('data-pass');
      const user = btn.getAttribute('data-user');
      if (pass && navigator.clipboard) {
        navigator.clipboard.writeText(pass);
        const origText = btn.innerHTML;
        btn.innerHTML = '<span>✓</span> <span>Copied</span>';
        setTimeout(() => { btn.innerHTML = origText; }, 1500);
        notificationService.success(`Copied password for @${user}!`);
      }
    });
  });

  // Add User Modal: Mode Toggle (Card vs Manual)
  const btnAddModeCard = document.getElementById('btn-add-mode-card');
  if (btnAddModeCard) {
    btnAddModeCard.addEventListener('click', () => {
      isAddModalManualMode = false;
      reRender();
    });
  }

  const btnAddModeManual = document.getElementById('btn-add-mode-manual');
  if (btnAddModeManual) {
    btnAddModeManual.addEventListener('click', () => {
      isAddModalManualMode = true;
      reRender();
    });
  }

  // Add User Modal: Clear Selected Employee
  const btnAddUserClearEmp = document.getElementById('btn-add-user-clear-emp');
  if (btnAddUserClearEmp) {
    btnAddUserClearEmp.addEventListener('click', () => {
      addModalSelectedEmployee = null;
      addModalCardSearchQuery = '';
      reRender();
    });
  }

  // Add User Modal: Card Search Autocomplete
  const inpAddCardSearch = document.getElementById('inp-add-user-card-search');
  const suggestionsBox = document.getElementById('uam-add-user-suggestions');
  if (inpAddCardSearch && suggestionsBox) {
    const activeEmployees = employeeService.getActiveEmployees ? employeeService.getActiveEmployees() : [];
    const allUsers = storage.getTable(TABLE_NAMES.USERS) || [];
    const userCardMap = new Map();
    allUsers.forEach(u => {
      if (u.cardNumber) userCardMap.set(String(u.cardNumber).trim().toLowerCase(), u);
      if (u.employeeId) userCardMap.set(String(u.employeeId).trim().toLowerCase(), u);
      if (u.manpowerId) userCardMap.set(u.manpowerId, u);
    });

    const updateSuggestions = (query) => {
      const q = (query || '').trim().toLowerCase();
      const filtered = activeEmployees.filter(e => {
        if (!q) return true;
        const matchCard = userAccessService.matchesCardNumber ? userAccessService.matchesCardNumber(e.cardNumber, q) : (e.cardNumber || '').toLowerCase().includes(q);
        const n = String(e.name || '').toLowerCase();
        const d = String(e.designation || '').toLowerCase();
        const dept = String(e.department || '').toLowerCase();
        return matchCard || n.includes(q) || d.includes(q) || dept.includes(q);
      }).slice(0, 10);

      if (filtered.length === 0) {
        suggestionsBox.innerHTML = `
          <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 12px;">
            No manpower employees match "<strong>${query}</strong>".
          </div>
        `;
        suggestionsBox.style.display = 'block';
        return;
      }

      suggestionsBox.innerHTML = filtered.map(e => {
        const cleanCard = String(e.cardNumber || '').trim().toLowerCase();
        const hasUser = userCardMap.get(cleanCard) || userCardMap.get(e.id);
        return `
          <div class="uam-emp-suggestion-item" data-id="${e.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <span style="font-family: var(--font-mono); font-weight: 800; font-size: 12px; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 5px; white-space: nowrap;">
                🪪 #${e.cardNumber}
              </span>
              <div style="min-width: 0;">
                <div style="font-weight: 700; font-size: 13px; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${e.name}</div>
                <div style="font-size: 11px; color: #94a3b8; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${e.designation || 'Staff'} • ${e.department || 'Maintenance'} ${e.floorName ? `• ${e.floorName}` : ''}
                </div>
              </div>
            </div>
            <div style="white-space: nowrap;">
              ${hasUser ? `<span class="badge badge-warning" style="font-size: 9.5px;">⚠️ Has Account (@${hasUser.username})</span>` : `<span class="badge badge-active" style="font-size: 9.5px;">✨ Ready to Link</span>`}
            </div>
          </div>
        `;
      }).join('');

      suggestionsBox.style.display = 'block';

      // Bind selection clicks
      suggestionsBox.querySelectorAll('.uam-emp-suggestion-item').forEach(item => {
        item.addEventListener('mouseenter', () => { item.style.background = 'rgba(2, 132, 199, 0.25)'; });
        item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
        item.addEventListener('click', () => {
          const empId = item.getAttribute('data-id');
          const emp = activeEmployees.find(e => e.id === empId);
          if (emp) {
            addModalSelectedEmployee = emp;
            addModalCardSearchQuery = '';
            suggestionsBox.style.display = 'none';
            reRender();
          }
        });
      });
    };

    inpAddCardSearch.addEventListener('input', (e) => {
      addModalCardSearchQuery = e.target.value;
      updateSuggestions(addModalCardSearchQuery);
    });

    inpAddCardSearch.addEventListener('focus', () => {
      updateSuggestions(inpAddCardSearch.value);
    });

    const btnClearAddSearch = document.getElementById('btn-clear-add-card-search');
    if (btnClearAddSearch) {
      btnClearAddSearch.addEventListener('click', () => {
        inpAddCardSearch.value = '';
        addModalCardSearchQuery = '';
        updateSuggestions('');
        inpAddCardSearch.focus();
      });
    }
  }

  // Password visibility toggle in Add User Modal
  const btnTogglePass = document.getElementById('btn-add-user-toggle-pass-visibility');
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const passInp = document.getElementById('inp-add-user-password');
      if (passInp) {
        if (passInp.type === 'password') {
          passInp.type = 'text';
          btnTogglePass.innerText = '🔒';
        } else {
          passInp.type = 'password';
          btnTogglePass.innerText = '👁️';
        }
      }
    });
  }

  // Copy password in Add User Modal
  const btnCopyAddPass = document.getElementById('btn-add-user-copy-pass');
  if (btnCopyAddPass) {
    btnCopyAddPass.addEventListener('click', () => {
      const passInp = document.getElementById('inp-add-user-password');
      if (passInp && passInp.value && navigator.clipboard) {
        navigator.clipboard.writeText(passInp.value);
        btnCopyAddPass.innerText = '✓';
        setTimeout(() => { if (btnCopyAddPass) btnCopyAddPass.innerText = '📋'; }, 1500);
        notificationService.success('Copied password to clipboard!');
      }
    });
  }

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

  // Add User Form Submission (Handles Card Link & Manual Modes)
  const formAddUser = document.getElementById('form-uam-add-user');
  if (formAddUser) {
    const btnGenPass = document.getElementById('btn-add-user-generate-pass');
    if (btnGenPass) {
      btnGenPass.addEventListener('click', () => {
        const passInp = document.getElementById('inp-add-user-password');
        if (passInp) passInp.value = userAccessService.generateSecurePassword(14);
      });
    }

    formAddUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = formAddUser.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Creating Account...'; }

      const name = document.getElementById('inp-add-user-name')?.value?.trim();
      const card = document.getElementById('inp-add-user-card')?.value?.trim();
      const username = document.getElementById('inp-add-user-username')?.value?.trim();
      const email = document.getElementById('inp-add-user-email')?.value?.trim() || `${username}@al-muslim.com`;
      const password = document.getElementById('inp-add-user-password')?.value?.trim();
      const presetId = document.getElementById('sel-add-user-preset')?.value;

      try {
        if (!username) throw new Error('Username is required.');
        if (!password) throw new Error('Password is required.');

        let createdUser = null;

        if (addModalSelectedEmployee && !isAddModalManualMode) {
          const preset = presetId ? (authService.getPresetById ? authService.getPresetById(presetId) : null) : null;
          const res = await userAccessService.createAccountForEmployee(addModalSelectedEmployee, {
            username,
            password,
            preset
          });
          createdUser = res.user || res;
        } else {
          createdUser = await authService.createUser({
            name,
            username,
            password,
            email,
            employeeId: card,
            presetId
          });
          userAccessService.setTemporaryCredential(createdUser.id, password);
        }

        activeModalType = null;
        addModalSelectedEmployee = null;
        addModalCardSearchQuery = '';
        isAddModalManualMode = false;
        notificationService.success(`User account @${createdUser.username} registered successfully!`);
        reRender();
      } catch (err) {
        notificationService.error('Failed to create user: ' + err.message);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = '➕ Create User Account'; }
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

  // 13. Preset Actions & Modals
  root.querySelectorAll('.btn-edit-preset-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-id');
      const preset = authService.getPresetById ? authService.getPresetById(pid) : null;
      if (!preset) {
        notificationService.error('Preset profile not found.');
        return;
      }
      editingPreset = JSON.parse(JSON.stringify(preset));
      if (!editingPreset.permissions) editingPreset.permissions = {};
      applyToAssignedUsers = true;
      activeModalType = 'CREATE_EDIT_PRESET';
      reRender();
    });
  });

  const btnCreatePreset = document.getElementById('btn-create-new-preset-action');
  if (btnCreatePreset) {
    btnCreatePreset.addEventListener('click', () => {
      editingPreset = {
        id: '',
        code: '',
        name: '',
        description: '',
        icon: '🛡️',
        badgeColor: '#0ea5e9',
        accessLevel: 'Custom Access',
        permissions: {},
        isSystem: false,
        assignedUsersCount: 0
      };
      applyToAssignedUsers = false;
      activeModalType = 'CREATE_EDIT_PRESET';
      reRender();
    });
  }

  const btnResetFactory = document.getElementById('btn-reset-factory-presets');
  if (btnResetFactory) {
    btnResetFactory.addEventListener('click', async () => {
      const confirmReset = confirm('Are you sure you want to restore standard factory presets? Built-in presets will reset to factory defaults.');
      if (!confirmReset) return;
      try {
        await authService.resetToDefaultPresets();
        notificationService.success('Standard factory presets restored successfully!');
        reRender();
      } catch (err) {
        notificationService.error('Reset failed: ' + err.message);
      }
    });
  }

  root.querySelectorAll('.btn-assign-preset-users').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-id');
      const preset = authService.getPresetById ? authService.getPresetById(pid) : null;
      if (!preset) {
        notificationService.error('Preset not found.');
        return;
      }
      targetPreset = preset;
      const allUsers = storage.getTable(TABLE_NAMES.USERS) || [];
      selectedUserIdsForPreset = allUsers
        .filter(u => u.presetId === preset.id || u.presetId === preset.code)
        .map(u => u.id);
      activeModalType = 'ASSIGN_USERS_TO_PRESET';
      reRender();
    });
  });

  // Modal: CREATE_EDIT_PRESET Handlers
  const syncPresetModalInputs = () => {
    if (!editingPreset) return;
    const nameEl = document.getElementById('inp-preset-modal-name');
    const codeEl = document.getElementById('inp-preset-modal-code');
    const iconEl = document.getElementById('sel-preset-modal-icon');
    const levelEl = document.getElementById('inp-preset-modal-level');
    const descEl = document.getElementById('inp-preset-modal-desc');
    if (nameEl) editingPreset.name = nameEl.value;
    if (codeEl && !editingPreset.isSystem) editingPreset.code = codeEl.value;
    if (iconEl) editingPreset.icon = iconEl.value;
    if (levelEl) editingPreset.accessLevel = levelEl.value;
    if (descEl) editingPreset.description = descEl.value;
  };

  const inpPresetName = document.getElementById('inp-preset-modal-name');
  if (inpPresetName) inpPresetName.addEventListener('input', (e) => { if (editingPreset) editingPreset.name = e.target.value; });
  const inpPresetCode = document.getElementById('inp-preset-modal-code');
  if (inpPresetCode) inpPresetCode.addEventListener('input', (e) => { if (editingPreset && !editingPreset.isSystem) editingPreset.code = e.target.value; });
  const selPresetIcon = document.getElementById('sel-preset-modal-icon');
  if (selPresetIcon) selPresetIcon.addEventListener('change', (e) => { if (editingPreset) editingPreset.icon = e.target.value; });
  const inpPresetLevel = document.getElementById('inp-preset-modal-level');
  if (inpPresetLevel) inpPresetLevel.addEventListener('input', (e) => { if (editingPreset) editingPreset.accessLevel = e.target.value; });
  const inpPresetDesc = document.getElementById('inp-preset-modal-desc');
  if (inpPresetDesc) inpPresetDesc.addEventListener('input', (e) => { if (editingPreset) editingPreset.description = e.target.value; });

  const updatePresetCounters = () => {
    if (!editingPreset) return;
    const perms = editingPreset.permissions || {};
    let totalActive = 0;
    let totalAll = 0;
    PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).forEach(m => {
      const acts = perms[m.id] || [];
      totalActive += acts.length;
      totalAll += m.actions.length;
      const countEl = document.getElementById(`lbl-preset-row-count-${m.id}`);
      if (countEl) {
        countEl.textContent = `(${acts.length}/${m.actions.length})`;
        countEl.style.color = acts.length === m.actions.length ? '#34d399' : acts.length > 0 ? '#38bdf8' : 'var(--text-muted)';
      }
    });
    const totalCountEl = document.getElementById('lbl-preset-modal-active-count');
    if (totalCountEl) {
      totalCountEl.textContent = `${totalActive} / ${totalAll} Actions Granted`;
    }
  };

  root.querySelectorAll('.chk-preset-modal-perm').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (!editingPreset) return;
      if (!editingPreset.permissions) editingPreset.permissions = {};
      const mod = cb.getAttribute('data-mod');
      const act = cb.getAttribute('data-act');
      if (!editingPreset.permissions[mod]) editingPreset.permissions[mod] = [];
      if (e.target.checked) {
        if (!editingPreset.permissions[mod].includes(act)) {
          editingPreset.permissions[mod].push(act);
        }
      } else {
        editingPreset.permissions[mod] = editingPreset.permissions[mod].filter(a => a !== act);
      }
      updatePresetCounters();
    });
  });

  root.querySelectorAll('.btn-preset-modal-toggle-row').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editingPreset) return;
      syncPresetModalInputs();
      if (!editingPreset.permissions) editingPreset.permissions = {};
      const mod = btn.getAttribute('data-mod');
      const moduleDef = PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).find(m => m.id === mod);
      if (!moduleDef) return;

      const current = editingPreset.permissions[mod] || [];
      if (current.length === moduleDef.actions.length) {
        editingPreset.permissions[mod] = [];
      } else {
        editingPreset.permissions[mod] = [...moduleDef.actions];
      }
      reRender();
    });
  });

  const btnPresetSelectAll = document.getElementById('btn-preset-modal-select-all');
  if (btnPresetSelectAll) {
    btnPresetSelectAll.addEventListener('click', () => {
      if (!editingPreset) return;
      syncPresetModalInputs();
      editingPreset.permissions = {};
      PERMISSION_CONFIG_MODULES.flatMap(g => g.modules).forEach(m => {
        editingPreset.permissions[m.id] = [...m.actions];
      });
      reRender();
    });
  }

  const btnPresetDeselectAll = document.getElementById('btn-preset-modal-deselect-all');
  if (btnPresetDeselectAll) {
    btnPresetDeselectAll.addEventListener('click', () => {
      if (!editingPreset) return;
      syncPresetModalInputs();
      editingPreset.permissions = {};
      reRender();
    });
  }

  const chkApplyAssigned = document.getElementById('chk-preset-apply-to-assigned');
  if (chkApplyAssigned) {
    chkApplyAssigned.addEventListener('change', (e) => {
      applyToAssignedUsers = e.target.checked;
    });
  }

  const btnPresetSave = document.getElementById('btn-preset-modal-save');
  if (btnPresetSave) {
    btnPresetSave.addEventListener('click', async () => {
      if (!editingPreset) return;
      const name = document.getElementById('inp-preset-modal-name')?.value?.trim();
      const code = document.getElementById('inp-preset-modal-code')?.value?.trim();
      const icon = document.getElementById('sel-preset-modal-icon')?.value;
      const accessLevel = document.getElementById('inp-preset-modal-level')?.value?.trim() || 'Configured Access';
      const description = document.getElementById('inp-preset-modal-desc')?.value?.trim() || '';

      if (!name) {
        notificationService.error('Preset Name is required.');
        return;
      }

      btnPresetSave.disabled = true;
      btnPresetSave.innerText = 'Saving...';

      try {
        if (editingPreset.id) {
          await authService.updatePreset(editingPreset.id, {
            name,
            code: code || editingPreset.code,
            icon,
            accessLevel,
            description,
            permissions: editingPreset.permissions || {}
          }, applyToAssignedUsers);
          notificationService.success(`Permission Preset "${name}" updated successfully!`);
        } else {
          await authService.createPreset({
            name,
            code: code || name.toUpperCase().replace(/\s+/g, '_'),
            icon,
            accessLevel,
            description,
            permissions: editingPreset.permissions || {}
          });
          notificationService.success(`New Permission Preset "${name}" created successfully!`);
        }
        activeModalType = null;
        editingPreset = null;
        reRender();
      } catch (err) {
        notificationService.error('Failed to save preset: ' + err.message);
        btnPresetSave.disabled = false;
        btnPresetSave.innerText = '💾 Save Preset & Permissions';
      }
    });
  }

  const btnPresetDelete = document.getElementById('btn-preset-modal-delete');
  if (btnPresetDelete) {
    btnPresetDelete.addEventListener('click', async () => {
      if (!editingPreset || !editingPreset.id) return;
      const confirmDel = confirm(`Are you sure you want to permanently delete preset "${editingPreset.name}"?`);
      if (!confirmDel) return;
      try {
        await authService.deletePreset(editingPreset.id);
        notificationService.success(`Preset "${editingPreset.name}" deleted.`);
        activeModalType = null;
        editingPreset = null;
        reRender();
      } catch (err) {
        notificationService.error('Failed to delete preset: ' + err.message);
      }
    });
  }

  // Modal: ASSIGN_USERS_TO_PRESET Handlers
  const inpAssignSearch = document.getElementById('inp-assign-preset-search');
  if (inpAssignSearch) {
    inpAssignSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      root.querySelectorAll('.assign-preset-user-item').forEach(item => {
        const text = item.getAttribute('data-search') || '';
        item.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
      });
    });
  }

  root.querySelectorAll('.chk-assign-preset-user').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const uid = cb.getAttribute('data-uid');
      if (e.target.checked) {
        if (!selectedUserIdsForPreset.includes(uid)) selectedUserIdsForPreset.push(uid);
      } else {
        selectedUserIdsForPreset = selectedUserIdsForPreset.filter(id => id !== uid);
      }
      const countEl = document.getElementById('assign-preset-selected-count');
      if (countEl) countEl.innerText = selectedUserIdsForPreset.length;
    });
  });

  const btnAssignSelectAll = document.getElementById('btn-assign-preset-select-all');
  if (btnAssignSelectAll) {
    btnAssignSelectAll.addEventListener('click', () => {
      root.querySelectorAll('.assign-preset-user-item').forEach(item => {
        if (item.style.display !== 'none') {
          const cb = item.querySelector('.chk-assign-preset-user');
          if (cb) {
            cb.checked = true;
            const uid = cb.getAttribute('data-uid');
            if (!selectedUserIdsForPreset.includes(uid)) selectedUserIdsForPreset.push(uid);
          }
        }
      });
      const countEl = document.getElementById('assign-preset-selected-count');
      if (countEl) countEl.innerText = selectedUserIdsForPreset.length;
    });
  }

  const btnAssignDeselectAll = document.getElementById('btn-assign-preset-deselect-all');
  if (btnAssignDeselectAll) {
    btnAssignDeselectAll.addEventListener('click', () => {
      root.querySelectorAll('.chk-assign-preset-user').forEach(cb => {
        cb.checked = false;
      });
      selectedUserIdsForPreset = [];
      const countEl = document.getElementById('assign-preset-selected-count');
      if (countEl) countEl.innerText = 0;
    });
  }

  const btnSaveAssignments = document.getElementById('btn-save-preset-user-assignments');
  if (btnSaveAssignments) {
    btnSaveAssignments.addEventListener('click', async () => {
      if (!targetPreset) return;
      btnSaveAssignments.disabled = true;
      btnSaveAssignments.innerText = 'Applying...';
      try {
        await authService.assignPresetToUsers(selectedUserIdsForPreset, targetPreset.id, true);
        notificationService.success(`Assigned preset "${targetPreset.name}" to ${selectedUserIdsForPreset.length} users!`);
        activeModalType = null;
        targetPreset = null;
        reRender();
      } catch (err) {
        notificationService.error('Failed to assign preset: ' + err.message);
        btnSaveAssignments.disabled = false;
        btnSaveAssignments.innerText = '💾 Save Assignments';
      }
    });
  }
}
