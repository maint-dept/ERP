/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * User Management & Individual Permission Matrix Component (Admin Panel)
 * 
 * Simple, clean, and user-friendly interface for user administration and granular permissions.
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, DEFAULT_PERMISSION_TEMPLATES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { cryptoService } from '../services/cryptoService.js';
import { emailService } from '../services/emailService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

import { masterDataService } from '../services/masterDataService.js';
import { employeeService } from '../services/employeeService.js';

let searchQuery = '';
let roleFilter = 'ALL'; // 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'USER'
let statusFilter = 'ALL'; // 'ALL' | 'ACTIVE' | 'INACTIVE'
let presetFilter = 'ALL'; // 'ALL' | presetId
let activeUserSection = (typeof localStorage !== 'undefined' && localStorage.getItem('al_muslim_user_mgmt_section')) || 'USERS'; // 'USERS' | 'PRESETS'
let presetViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('al_muslim_preset_view_mode')) || 'CARDS'; // 'CARDS' | 'TABLE'

// Modal state
let activeModalType = null; // 'ADD_USER' | 'EDIT_USER' | 'USER_PERMISSIONS' | 'RESET_PASSWORD' | 'CREATE_EDIT_PRESET' | 'ASSIGN_USERS_TO_PRESET' | 'USER_QUICK_PRESET'
let activeModalTab = 'PERMISSIONS'; // 'PERMISSIONS' | 'LOCATION_SCOPE'
let targetUser = null;
let targetPreset = null;
let editingPreset = null;
let editingPermissions = {};
let editingScope = { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] };
let applyToAssignedUsers = true;
let syncScopeOnPresetAssign = true;
let selectedUserIdsForPreset = [];

// Granular 7-Action Permissions Modules Definition
export const PERMISSION_CONFIG_MODULES = [
  {
    group: '🏭 Core Machinery & Operations',
    modules: [
      { id: 'machines', name: 'Machine Inventory & Catalog', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'transfers', name: 'Machine Movement & Transfers', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'relocate', name: 'Relocate & Physical Verification', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'qr_codes', name: 'QR Codes & Stickers / Labels', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'preventive_maintenance', name: 'Preventive Maintenance (PM)', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'] },
      { id: 'machine_history', name: 'Machine History & Lifecycles', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'storage', name: 'Storage & Warehouse Rules', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'dashboard', name: 'Dashboard Overview', actions: ['VIEW'] }
    ]
  },
  {
    group: '🔬 Specialized Technical Departments (Individual User Access)',
    modules: [
      { id: 'et_lab', name: 'ENT Lab Management', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'spare_parts', name: 'ENT Spare Parts Catalog & Configuration', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
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
    group: '⚙️ Administration & Security',
    modules: [
      { id: 'user_management', name: 'User Management & Permissions', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'EXPORT'] },
      { id: 'master_data', name: 'Plant Hierarchy & Master Data', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT'] },
      { id: 'transfer_workflows', name: 'Transfer Workflows Builder', actions: ['VIEW', 'ADD', 'EDIT', 'DELETE'] },
      { id: 'excel_manager', name: 'Excel Structure & Templates', actions: ['VIEW', 'EDIT', 'EXPORT'] },
      { id: 'audit_logs', name: 'Activity Logs & Audit Trail', actions: ['VIEW', 'EXPORT'] },
      { id: 'settings', name: 'System Settings', actions: ['VIEW', 'EDIT'] },
      { id: 'email_config', name: 'Email Configuration', actions: ['VIEW', 'EDIT'] },
      { id: 'homepage_management', name: 'Home Page Management', actions: ['VIEW', 'EDIT'] }
    ]
  }
];

export function renderUserManagement() {
  const users = authService.getAllUsers();
  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = authService.isSuperAdmin();
  const isAdmin = authService.isAdmin();

  const presets = authService.getAllPresets();

  // Filter users
  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'ALL') {
      const uRole = (u.role || '').toUpperCase();
      if (roleFilter === 'SUPER_ADMIN' && uRole !== 'SUPER_ADMIN') return false;
      if (roleFilter === 'ADMIN' && (uRole !== 'ADMIN' || uRole === 'SUPER_ADMIN')) return false;
      if (roleFilter === 'USER' && (uRole.includes('ADMIN') || uRole.includes('SUPER'))) return false;
    }
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
    if (presetFilter !== 'ALL') {
      const userPresetId = u.presetId || (
        ((u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin') ? 'preset_super_admin' :
        ((u.role || '').toUpperCase() === 'ADMIN' ? 'preset_admin' : 'preset_maintenance_user')
      );
      if (userPresetId !== presetFilter) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchUsername = u.username?.toLowerCase().includes(q);
      const matchDept = u.department?.toLowerCase().includes(q);
      const matchPreset = u.presetName?.toLowerCase().includes(q);
      const matchEmpId = u.employeeId?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchUsername && !matchDept && !matchPreset && !matchEmpId) return false;
    }
    return true;
  });

  // Calculate quick stats
  const totalCount = users.length;
  const superAdminCount = users.filter(u => (u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin').length;
  const adminCount = users.filter(u => (u.role || '').toUpperCase() === 'ADMIN' && u.username !== 'superadmin').length;
  const standardUserCount = totalCount - superAdminCount - adminCount;
  const activeCount = users.filter(u => u.status === 'ACTIVE').length;

  return `
    <div class="page-view" style="gap: 14px; max-width: 1350px; margin: 0 auto; width: 100%; min-height: 100%; padding-bottom: 60px; box-sizing: border-box;">
      
      <!-- 1. Top Command Bar (Compact, Modern & Integrated Stats) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            👥
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h1 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px;">
                User Management &amp; Permissions
              </h1>
              <!-- Inline compact KPI stats pill strip (Fit Screen friendly) -->
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 20px; padding: 2px 10px; font-size: 11px;">
                <span style="color: var(--text-muted);">Users: <strong style="color: #fff;">${totalCount}</strong></span>
                <span style="color: rgba(255,255,255,0.2);">&bull;</span>
                <span style="color: var(--text-muted);">Admins: <strong style="color: #38bdf8;">${superAdminCount + adminCount}</strong></span>
                <span style="color: rgba(255,255,255,0.2);">&bull;</span>
                <span style="color: var(--text-muted);">Standard: <strong style="color: #a78bfa;">${standardUserCount}</strong></span>
                <span style="color: rgba(255,255,255,0.2);">&bull;</span>
                <span style="color: var(--text-muted);">Presets: <strong style="color: #34d399;">${presets.length}</strong></span>
              </div>
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
              Manage system users, login credentials, 7-action granular permissions, and factory location scopes.
            </div>
          </div>
        </div>

        <!-- Top Right Action Buttons -->
        <div style="display: flex; gap: 8px; align-items: center;">
          ${isAdmin ? `
            <button id="btn-reset-default-presets-top" class="btn btn-secondary" style="font-weight: 700; color: #f59e0b; border-color: rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.12); padding: 7px 13px; font-size: 12px; border-radius: 7px;">
              🔄 Reset Default Presets
            </button>
            <button id="btn-open-create-preset-modal-top" class="btn btn-secondary" style="font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(14, 165, 233, 0.12); padding: 7px 14px; font-size: 12.5px; border-radius: 7px;">
              🛡️ + Create Preset
            </button>
            <button id="btn-open-add-user-modal" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 7px 16px; font-size: 12.5px; border-radius: 7px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);">
              ➕ Add New User
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 2. Segmented Navigation Bar (100% Fit Screen Navigation) -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; gap: 12px; flex-wrap: wrap;">
        <!-- Left: Segmented Switcher -->
        <div style="display: inline-flex; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 10px; padding: 3px; gap: 4px;">
          <button 
            type="button" 
            id="tab-btn-users" 
            class="btn btn-sm" 
            style="padding: 7px 20px; font-size: 13px; font-weight: 800; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; background: ${activeUserSection === 'USERS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'USERS' ? '#fff' : 'var(--text-secondary)'}; box-shadow: ${activeUserSection === 'USERS' ? '0 2px 8px rgba(2, 132, 199, 0.4)' : 'none'};"
          >
            <span>👥 User Accounts</span>
            <span style="background: ${activeUserSection === 'USERS' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(148, 163, 184, 0.15)'}; color: ${activeUserSection === 'USERS' ? '#fff' : '#94a3b8'}; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 800;">
              ${totalCount}
            </span>
          </button>

          <button 
            type="button" 
            id="tab-btn-presets" 
            class="btn btn-sm" 
            style="padding: 7px 20px; font-size: 13px; font-weight: 800; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; background: ${activeUserSection === 'PRESETS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${activeUserSection === 'PRESETS' ? '#fff' : 'var(--text-secondary)'}; box-shadow: ${activeUserSection === 'PRESETS' ? '0 2px 8px rgba(2, 132, 199, 0.4)' : 'none'};"
          >
            <span>🛡️ Permission Presets &amp; Profiles</span>
            <span style="background: ${activeUserSection === 'PRESETS' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(14, 165, 233, 0.2)'}; color: ${activeUserSection === 'PRESETS' ? '#fff' : '#38bdf8'}; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 800;">
              ${presets.length}
            </span>
          </button>
        </div>

        <!-- Right: Helpful Section Status / Quick Jump Link -->
        <div style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
          ${activeUserSection === 'USERS' ? `
            <span>Access Profiles: <a href="javascript:void(0)" id="link-jump-to-presets" style="color: #38bdf8; font-weight: 700; text-decoration: none;">Configure Permission Presets &rarr;</a></span>
          ` : `
            <span>Switch: <a href="javascript:void(0)" id="link-jump-to-users" style="color: #38bdf8; font-weight: 700; text-decoration: none;">&larr; View User Accounts (${totalCount})</a></span>
          `}
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- TAB CONTENT A: USER ACCOUNTS TAB (100% FIT SCREEN WORKSPACE)   -->
      <!-- ============================================================== -->
      ${activeUserSection === 'USERS' ? `
        <!-- Sleek 1-Line Quick Preset Filter Pills Ribbon -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;">
            ⚡ Quick Filter:
          </div>

          <!-- All Users Pill -->
          <button 
            type="button" 
            class="btn-pill-filter-preset" 
            data-id="ALL"
            style="padding: 3px 11px; font-size: 11.5px; font-weight: 700; border-radius: 20px; border: 1px solid ${presetFilter === 'ALL' ? '#38bdf8' : 'var(--border-color)'}; background: ${presetFilter === 'ALL' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)'}; color: ${presetFilter === 'ALL' ? '#fff' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.15s ease;"
          >
            All Users (${totalCount})
          </button>

          <!-- 8 Presets Filter Pills -->
          ${presets.map(p => {
            const pCount = users.filter(u => {
              if (u.presetId) return u.presetId === p.id || u.presetId === p.code;
              if (p.code === 'SUPER_ADMIN') return (u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin';
              if (p.code === 'ADMIN') return (u.role || '').toUpperCase() === 'ADMIN' && u.username !== 'superadmin';
              if (p.code === 'MAINTENANCE_USER') return (u.role || '').toUpperCase() === 'USER';
              return false;
            }).length;
            const isSelected = presetFilter === p.id || presetFilter === p.code;
            return `
              <button 
                type="button" 
                class="btn-pill-filter-preset" 
                data-id="${p.id}"
                title="${p.name}: ${p.accessLevel || ''}"
                style="padding: 3px 10px; font-size: 11.5px; font-weight: 700; border-radius: 20px; border: 1px solid ${isSelected ? '#38bdf8' : 'var(--border-color)'}; background: ${isSelected ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)'}; color: ${isSelected ? '#38bdf8' : 'var(--text-secondary)'}; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px;"
              >
                <span>${p.icon || '🛡️'}</span>
                <span>${p.name}</span>
                <span style="background: ${isSelected ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.08)'}; color: ${isSelected ? '#fff' : '#94a3b8'}; padding: 0 6px; border-radius: 10px; font-size: 10px;">${pCount}</span>
              </button>
            `;
          }).join('')}

          <button 
            type="button" 
            id="btn-goto-presets-mgmt" 
            style="margin-left: auto; padding: 3px 12px; font-size: 11.5px; font-weight: 700; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(14, 165, 233, 0.12); color: #38bdf8; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;"
            title="Switch to dedicated Presets & Profiles tab"
          >
            ⚙️ Manage All Profiles &rarr;
          </button>
        </div>

        <!-- Search & Filter Controls -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: var(--shadow-sm);">
          <div class="filter-search-wrap" style="flex: 1 1 260px; min-width: 220px; position: relative;">
            <span class="filter-search-icon">🔍</span>
            <input 
              type="text" 
              id="user-search-input" 
              class="filter-search-input" 
              placeholder="Search user by name, email, username, dept..." 
              value="${searchQuery}"
              style="font-size: 12.5px; height: 34px; padding-left: 34px; padding-right: ${searchQuery ? '34px' : '12px'};"
            />
            <div class="filter-search-actions">
              ${searchQuery ? `
                <button id="btn-clear-user-search" type="button" class="filter-search-btn" style="height: 24px; width: 24px; font-size: 12px; color: var(--text-muted);" title="Clear Search">✕</button>
              ` : ''}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
              <span>Profile:</span>
              <select id="user-preset-filter" class="filter-select" style="height: 34px; font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--bg-card); color: #fff; border: 1px solid var(--border-color);">
                <option value="ALL" ${presetFilter === 'ALL' ? 'selected' : ''}>All Profiles</option>
                ${presets.map(p => `
                  <option value="${p.id}" ${presetFilter === p.id ? 'selected' : ''}>${p.icon || '🛡️'} ${p.name}</option>
                `).join('')}
                <option value="CUSTOM" ${presetFilter === 'CUSTOM' ? 'selected' : ''}>👤 Custom User</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
              <span>Role:</span>
              <select id="user-role-filter" class="filter-select" style="height: 34px; font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--bg-card); color: #fff; border: 1px solid var(--border-color);">
                <option value="ALL" ${roleFilter === 'ALL' ? 'selected' : ''}>All Roles</option>
                <option value="SUPER_ADMIN" ${roleFilter === 'SUPER_ADMIN' ? 'selected' : ''}>Super Admin</option>
                <option value="ADMIN" ${roleFilter === 'ADMIN' ? 'selected' : ''}>Admin</option>
                <option value="USER" ${roleFilter === 'USER' ? 'selected' : ''}>Standard User</option>
              </select>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
              <span>Status:</span>
              <select id="user-status-filter" class="filter-select" style="height: 34px; font-size: 12px; padding: 2px 10px; border-radius: 6px; background: var(--bg-card); color: #fff; border: 1px solid var(--border-color);">
                <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>All Status</option>
                <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>🟢 Active</option>
                <option value="INACTIVE" ${statusFilter === 'INACTIVE' ? 'selected' : ''}>🔴 Inactive</option>
              </select>
            </div>

            ${(roleFilter !== 'ALL' || statusFilter !== 'ALL' || presetFilter !== 'ALL' || searchQuery) ? `
              <button type="button" id="btn-clear-user-filters" class="btn btn-ghost btn-xs" style="color: #f87171; font-weight: 700; font-size: 11.5px; padding: 6px 10px; border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 6px;">
                ✕ Reset
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Users Data Table (100% Fit Screen Layout) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); width: 100%; overflow-x: auto;">
          <table class="user-management-table" style="margin: 0; width: 100% !important; min-width: 0 !important; border-collapse: collapse; table-layout: auto;">
            <thead>
              <tr>
                <th style="width: 36px; text-align: center; padding: 11px 6px;">#</th>
                <th style="width: 28%; min-width: 190px; padding: 11px 14px;">User Profile</th>
                <th style="width: 16%; min-width: 120px; text-align: center; padding: 11px 8px;">Role &amp; Preset</th>
                <th style="width: 27%; min-width: 180px; padding: 11px 14px;">Access &amp; Scope</th>
                <th style="width: 29%; min-width: 230px; text-align: center; padding: 11px 10px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredUsers.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 36px; color: var(--text-muted); font-size: 13px;">
                    No users match current filters. Click <strong>"✕ Reset Filters"</strong> or <strong>"➕ Add New User"</strong>.
                  </td>
                </tr>
              ` : filteredUsers.map((u, idx) => {
                const uRole = (u.role || '').toUpperCase();
                const isSuper = uRole === 'SUPER_ADMIN' || u.username === 'superadmin';
                const isAdminRole = uRole === 'ADMIN';
                const isSelf = currentUser?.id === u.id;

                // Action authorization checks for badges
                const uPerms = u.permissions || {};
                const hasRead = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && (arr.includes('VIEW') || arr.includes('READ')));
                const hasAdd = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && arr.includes('ADD'));
                const hasEdit = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && arr.includes('EDIT'));
                const hasDelete = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && arr.includes('DELETE'));
                const hasImport = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && arr.includes('IMPORT'));
                const hasExport = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && arr.includes('EXPORT'));
                const hasApprove = isSuper || Object.values(uPerms).some(arr => Array.isArray(arr) && arr.includes('APPROVE'));

                // Location Scope info
                const scope = u.assignedScope;
                const isGlobalScope = isSuper || !scope || scope.allGroups;
                const unitCount = scope?.unitIds?.length || 0;
                const floorCount = scope?.floorIds?.length || 0;
                const lineCount = scope?.lineIds?.length || 0;

                return `
                  <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                    <td style="text-align: center; color: var(--text-muted); font-size: 12px; font-weight: 700;">${idx + 1}</td>
                    
                    <!-- User Profile -->
                    <td style="padding: 10px 14px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="user-avatar-circle" style="width: 34px; height: 34px; font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1.5px solid rgba(56, 189, 248, 0.5);">
                          ${u.name?.charAt(0) || 'U'}
                        </div>
                        <div style="min-width: 0;">
                          <div style="font-weight: 800; color: #fff; font-size: 13.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span>${u.name}</span>
                            ${u.employeeId ? `<span class="badge" style="font-size: 9.5px; padding: 1px 6px; background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;" title="Linked Manpower Card Number">🪪 ${u.employeeId}</span>` : ''}
                            ${isSelf ? '<span class="badge" style="font-size: 9.5px; padding: 1px 6px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;">YOU</span>' : ''}
                          </div>
                          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 1px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                            ${u.designation ? `<span style="color: #cbd5e1;">${u.designation}</span>` : ''}
                            ${u.department ? `<span style="color: var(--text-muted); font-size: 11px;">• ${u.department}</span>` : ''}
                            <span style="font-family: var(--font-mono); color: #38bdf8; font-weight: 600;">@${u.username}</span>
                            ${u.email ? `<span style="color: var(--text-muted);">(${u.email})</span>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Role & Preset & Status -->
                    <td style="text-align: center; padding: 10px 8px;">
                      <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <span class="badge ${isSuper ? 'badge-maint' : (isAdminRole ? 'badge-active' : 'badge-idle')}" style="font-size: 11px; padding: 3px 8px; font-weight: 700;">
                          ${isSuper ? '🛡️ Super Admin' : (isAdminRole ? '👑 Admin' : '👤 User')}
                        </span>
                        <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 10px; padding: 2px 7px; font-weight: 700;" title="Permission Preset">
                          🛡️ ${u.presetName || (isSuper ? 'Super Admin' : (isAdminRole ? 'Admin' : 'Maintenance User'))}
                        </span>
                        <span class="badge ${u.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}" style="font-size: 9.5px; padding: 1px 6px;">
                          ${u.status === 'ACTIVE' ? '🟢 Active' : '🔴 Inactive'}
                        </span>
                      </div>
                    </td>

                    <!-- Access Rights & Scope -->
                    <td style="padding: 10px 14px;">
                      ${isSuper ? `
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 11px; padding: 2px 8px; font-weight: 700; width: fit-content;">
                            🛡️ Full 7-Action Master Access
                          </span>
                          <div style="font-size: 11px; color: #38bdf8; display: flex; align-items: center; gap: 4px; font-weight: 600;">
                            🌐 All Factory Locations &amp; Lines
                          </div>
                        </div>
                      ` : `
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                          <div style="display: flex; gap: 3px; flex-wrap: wrap; align-items: center;">
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasRead ? 'background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Read ${hasRead ? '✓' : '✕'}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasAdd ? 'background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Add ${hasAdd ? '✓' : '✕'}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasEdit ? 'background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Edit ${hasEdit ? '✓' : '✕'}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasDelete ? 'background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Del ${hasDelete ? '✓' : '✕'}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasImport ? 'background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Imp ${hasImport ? '✓' : '✕'}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasExport ? 'background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Exp ${hasExport ? '✓' : '✕'}</span>
                            <span class="badge" style="font-size: 10px; padding: 1px 5px; ${hasApprove ? 'background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.35);' : 'background: rgba(148, 163, 184, 0.1); color: var(--text-muted); opacity: 0.5;'}">Appr ${hasApprove ? '✓' : '✕'}</span>
                          </div>
                          <div style="font-size: 11.5px;">
                            ${isGlobalScope ? `
                              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10.5px; padding: 2px 7px;">
                                🌐 All Locations
                              </span>
                            ` : (unitCount === 0 && floorCount === 0 && lineCount === 0) ? `
                              <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 10.5px; padding: 2px 7px;">
                                ⚠️ No Scope Assigned
                              </span>
                            ` : `
                              <span class="badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); font-size: 10.5px; padding: 2px 7px; font-weight: 700;">
                                📍 ${unitCount} Unit, ${floorCount} Floor, ${lineCount} Line
                              </span>
                            `}
                          </div>
                        </div>
                      `}
                    </td>

                    <!-- Quick Actions -->
                    <td style="text-align: center; padding: 10px 8px;">
                      <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
                        
                        <!-- Primary Rights Group -->
                        <div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">
                          <!-- 1. Permissions Button -->
                          <button 
                            class="btn btn-primary btn-xs btn-action-user-perms" 
                            data-id="${u.id}" 
                            title="Configure 7 Actions (Read, Add, Edit, Delete, Import, Export, Approve)"
                            style="padding: 4px 9px; font-size: 11.5px; background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700; border-radius: 5px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3); display: inline-flex; align-items: center; gap: 4px;"
                          >
                            <span>🔐</span> Permissions
                          </button>

                          <!-- 2. Location Scope Button -->
                          <button 
                            class="btn btn-secondary btn-xs btn-action-user-scope" 
                            data-id="${u.id}" 
                            title="Configure Location Scope (Unit, Floor, Line)"
                            style="padding: 4px 8px; font-size: 11.5px; color: #facc15; border-color: rgba(250, 204, 21, 0.4); background: rgba(234, 179, 8, 0.12); font-weight: 700; border-radius: 5px; display: inline-flex; align-items: center; gap: 3px;"
                          >
                            <span>📍</span> Scope
                          </button>

                          <!-- 2b. Assign Preset Button -->
                          <button 
                            class="btn btn-secondary btn-xs btn-action-user-preset" 
                            data-id="${u.id}" 
                            title="Assign Permission Preset / Access Profile"
                            style="padding: 4px 8px; font-size: 11.5px; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(14, 165, 233, 0.12); font-weight: 700; border-radius: 5px; display: inline-flex; align-items: center; gap: 3px;"
                          >
                            <span>🛡️</span> Preset
                          </button>
                        </div>

                        <!-- Account Management Icon Group -->
                        <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                          <!-- 3. Edit User Details -->
                          <button 
                            class="btn btn-secondary btn-xs btn-action-edit-user" 
                            data-id="${u.id}" 
                            title="Edit User Profile"
                            style="padding: 3px 8px; font-size: 11px; border-radius: 5px; display: inline-flex; align-items: center; gap: 3px;"
                          >
                            ✏️ Edit
                          </button>

                          <!-- 4. Reset Password -->
                          <button 
                            class="btn btn-secondary btn-xs btn-action-reset-pwd" 
                            data-id="${u.id}" 
                            title="Reset User Password"
                            style="padding: 3px 7px; font-size: 11px; color: #fbbf24; border-color: rgba(251, 191, 36, 0.3); border-radius: 5px;"
                          >
                            🔑 Pass
                          </button>

                          <!-- 5. Activate / Deactivate Toggle -->
                          ${!isSuper ? `
                            <button 
                              class="btn btn-secondary btn-xs btn-action-toggle-status" 
                              data-id="${u.id}" 
                              title="${u.status === 'ACTIVE' ? 'Deactivate User Account' : 'Activate User Account'}"
                              style="padding: 3px 7px; font-size: 11px; color: ${u.status === 'ACTIVE' ? '#f87171' : '#34d399'}; border-color: ${u.status === 'ACTIVE' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(52, 211, 153, 0.3)'}; border-radius: 5px;"
                            >
                              ${u.status === 'ACTIVE' ? '🚫 Deactivate' : '🟢 Activate'}
                            </button>
                          ` : ''}

                          <!-- 6. Delete User -->
                          ${!isSuper && !isSelf ? `
                            <button 
                              class="btn btn-ghost btn-xs btn-action-delete-user" 
                              data-id="${u.id}" 
                              title="Delete User Account"
                              style="padding: 3px 6px; font-size: 11px; color: #f87171; border-radius: 5px;"
                            >
                              🗑️
                            </button>
                          ` : ''}
                        </div>

                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <!-- ====================================================================== -->
        <!-- TAB CONTENT B: PERMISSION PRESETS & ACCESS PROFILES (DEDICATED HUB)   -->
        <!-- ====================================================================== -->
        <div id="permission-presets-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: visible; margin-bottom: 24px;">
          <!-- Header Toolbar for Presets -->
          <div style="padding: 14px 20px; background: rgba(15, 23, 42, 0.7); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🛡️
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
                    Factory Permission Presets &amp; Profiles
                  </h2>
                  <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 11px; font-weight: 700;">
                    ${presets.length} Presets Available
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                  Pre-configured security profiles with 7-action granular rights across all 22 modules and factory location scopes.
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <!-- View Mode Switcher -->
              <div style="display: inline-flex; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: 7px; padding: 2px;">
                <button 
                  type="button" 
                  id="btn-preset-view-cards" 
                  class="btn btn-xs" 
                  style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; border-radius: 5px; border: none; background: ${presetViewMode === 'CARDS' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${presetViewMode === 'CARDS' ? '#fff' : 'var(--text-muted)'}; cursor: pointer;"
                >
                  🎴 Profile Cards
                </button>
                <button 
                  type="button" 
                  id="btn-preset-view-table" 
                  class="btn btn-xs" 
                  style="padding: 5px 12px; font-size: 11.5px; font-weight: 700; border-radius: 5px; border: none; background: ${presetViewMode === 'TABLE' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent'}; color: ${presetViewMode === 'TABLE' ? '#fff' : 'var(--text-muted)'}; cursor: pointer;"
                >
                  📋 Table View
                </button>
              </div>

              ${isAdmin ? `
                <button 
                  type="button" 
                  id="btn-reset-default-presets" 
                  class="btn btn-secondary btn-xs" 
                  style="font-weight: 700; color: #f59e0b; border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.12); padding: 6px 12px; border-radius: 6px; cursor: pointer;" 
                  title="Restore factory default permission presets"
                >
                  🔄 Reset Default Presets
                </button>
                <button 
                  type="button" 
                  id="btn-open-create-preset-modal" 
                  class="btn btn-primary btn-xs" 
                  style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 6px 14px; font-size: 12px; border-radius: 6px;"
                >
                  ➕ Create Preset
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Presets Content (Cards or Table) -->
          ${presetViewMode === 'CARDS' ? `
            <div style="padding: 16px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 14px; background: rgba(11, 17, 33, 0.5);">
              ${presets.map(p => {
                const assignedUsers = users.filter(u => {
                  if (u.presetId) return u.presetId === p.id || u.presetId === p.code;
                  if (p.code === 'SUPER_ADMIN') return (u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin';
                  if (p.code === 'ADMIN') return (u.role || '').toUpperCase() === 'ADMIN' && u.username !== 'superadmin';
                  if (p.code === 'MAINTENANCE_USER') return (u.role || '').toUpperCase() === 'USER';
                  return false;
                });

                const isGlobalScope = !p.scope || p.scope.allGroups;
                const isFiltered = presetFilter === p.id || presetFilter === p.code;
                const activeModuleCount = Object.keys(p.permissions || {}).filter(k => Array.isArray(p.permissions[k]) && p.permissions[k].length > 0).length;

                return `
                  <div class="preset-card ${isFiltered ? 'preset-card-active' : ''}" 
                       style="background: ${isFiltered ? 'rgba(14, 165, 233, 0.12)' : 'rgba(15, 23, 42, 0.75)'}; 
                              border: 1.5px solid ${isFiltered ? '#38bdf8' : 'var(--border-color)'}; 
                              border-radius: var(--radius-lg); 
                              padding: 16px 18px; 
                              display: flex; 
                              flex-direction: column; 
                              justify-content: space-between; 
                              gap: 12px; 
                              position: relative; 
                              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25); 
                              transition: all 0.2s ease;">
                    
                    <div>
                      <!-- Top Card Header -->
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <div style="width: 40px; height: 40px; border-radius: 10px; background: ${p.badgeColor ? p.badgeColor + '20' : 'rgba(56, 189, 248, 0.15)'}; border: 1px solid ${p.badgeColor ? p.badgeColor + '40' : 'rgba(56, 189, 248, 0.3)'}; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
                            ${p.icon || '🛡️'}
                          </div>
                          <div>
                            <div style="font-size: 14.5px; font-weight: 800; color: #fff; line-height: 1.2;">
                              ${p.name}
                            </div>
                            <div style="display: flex; gap: 5px; margin-top: 4px; align-items: center; flex-wrap: wrap;">
                              <span class="badge" style="font-size: 10px; padding: 2px 7px; background: ${p.badgeColor ? p.badgeColor + '25' : 'rgba(56, 189, 248, 0.15)'}; color: ${p.badgeColor || '#38bdf8'}; border: 1px solid ${p.badgeColor ? p.badgeColor + '40' : 'rgba(56, 189, 248, 0.3)'}; font-weight: 700;">
                                ${p.accessLevel || 'Standard Access'}
                              </span>
                              ${!p.isSystem ? '<span class="badge" style="font-size: 9px; padding: 1px 5px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">CUSTOM</span>' : ''}
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Description -->
                      <div style="font-size: 11.5px; color: var(--text-secondary); margin: 10px 0 6px 0; line-height: 1.4; min-height: 32px;">
                        ${p.description || 'Pre-configured access profile for factory personnel.'}
                      </div>

                      <!-- Status & Scope Chips -->
                      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                        <span style="font-size: 10.5px; font-weight: 700; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 6px; padding: 3px 8px; color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px;">
                          📊 ${activeModuleCount} Modules Active
                        </span>
                        <span style="font-size: 10.5px; font-weight: 600; background: ${isGlobalScope ? 'rgba(56, 189, 248, 0.12)' : 'rgba(234, 179, 8, 0.12)'}; border: 1px solid ${isGlobalScope ? 'rgba(56, 189, 248, 0.3)' : 'rgba(234, 179, 8, 0.3)'}; border-radius: 6px; padding: 3px 8px; color: ${isGlobalScope ? '#38bdf8' : '#facc15'}; display: inline-flex; align-items: center; gap: 4px;">
                          ${isGlobalScope ? '🌐 All Locations' : `📍 ${p.scope?.unitIds?.length || 0} Units`}
                        </span>
                        <span class="btn-card-filter-preset" data-id="${p.id}" style="font-size: 10.5px; font-weight: 700; background: ${assignedUsers.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)'}; border: 1px solid ${assignedUsers.length > 0 ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'}; border-radius: 6px; padding: 3px 8px; color: ${assignedUsers.length > 0 ? '#34d399' : 'var(--text-muted)'}; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;" title="Click to view & filter assigned users in User Accounts">
                          👥 ${assignedUsers.length} User${assignedUsers.length === 1 ? '' : 's'} &rarr;
                        </span>
                      </div>
                    </div>

                    <!-- Card Action Bar -->
                    <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                      <div style="display: flex; gap: 6px;">
                        <button 
                          type="button" 
                          class="btn btn-secondary btn-xs btn-preset-edit" 
                          data-id="${p.id}" 
                          title="Configure permissions, module access, and scope" 
                          style="font-weight: 800; font-size: 11.5px; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(14, 165, 233, 0.15); padding: 5px 12px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;"
                        >
                          ⚙️ Config
                        </button>
                        <button 
                          type="button" 
                          class="btn btn-secondary btn-xs btn-preset-quick-assign" 
                          data-id="${p.id}" 
                          title="Assign users to this profile" 
                          style="font-weight: 700; font-size: 11.5px; padding: 5px 9px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;"
                        >
                          👥 Assign
                        </button>
                      </div>

                      <div style="display: flex; gap: 4px;">
                        <button 
                          type="button" 
                          class="btn btn-ghost btn-xs btn-preset-duplicate" 
                          data-id="${p.id}" 
                          title="Duplicate this preset" 
                          style="padding: 5px 7px; font-size: 12px; color: #a78bfa; border-radius: 6px;"
                        >
                          📋
                        </button>
                        ${!p.isSystem ? `
                          <button 
                            type="button" 
                            class="btn btn-ghost btn-xs btn-preset-delete" 
                            data-id="${p.id}" 
                            title="Delete custom preset" 
                            style="padding: 5px 7px; font-size: 12px; color: #f87171; border-radius: 6px;"
                          >
                            🗑️
                          </button>
                        ` : ''}
                      </div>
                    </div>

                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <!-- Presets Table View -->
            <div style="overflow-x: auto; width: 100%;">
              <table class="user-management-table" style="margin: 0; width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(15, 23, 42, 0.4);">
                    <th style="padding: 12px 18px; font-size: 11.5px; width: 28%; text-align: left;">Preset Name</th>
                    <th style="padding: 12px 14px; font-size: 11.5px; text-align: center; width: 15%;">Users</th>
                    <th style="padding: 12px 16px; font-size: 11.5px; width: 20%;">Access Level</th>
                    <th style="padding: 12px 16px; font-size: 11.5px; width: 17%;">Scope</th>
                    <th style="padding: 12px 16px; font-size: 11.5px; text-align: center; width: 20%;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${presets.map(p => {
                    const assignedUsers = users.filter(u => {
                      if (u.presetId) return u.presetId === p.id || u.presetId === p.code;
                      if (p.code === 'SUPER_ADMIN') return (u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin';
                      if (p.code === 'ADMIN') return (u.role || '').toUpperCase() === 'ADMIN' && u.username !== 'superadmin';
                      if (p.code === 'MAINTENANCE_USER') return (u.role || '').toUpperCase() === 'USER';
                      return false;
                    });

                    const isGlobalScope = !p.scope || p.scope.allGroups;
                    const unitCount = p.scope?.unitIds?.length || 0;

                    return `
                      <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                        <!-- Preset Name -->
                        <td style="padding: 12px 18px;">
                          <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                              ${p.icon || '🛡️'}
                            </div>
                            <div>
                              <div style="font-weight: 800; color: #fff; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
                                <span>${p.name}</span>
                                ${!p.isSystem ? '<span class="badge" style="font-size: 9px; padding: 1px 5px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 700;">CUSTOM</span>' : ''}
                              </div>
                              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                                ${p.description || ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <!-- Users -->
                        <td style="text-align: center; padding: 12px 14px;">
                          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <button type="button" class="btn-card-filter-preset" data-id="${p.id}" class="badge" style="background: ${assignedUsers.length > 0 ? 'rgba(56, 189, 248, 0.18)' : 'rgba(148, 163, 184, 0.1)'}; color: ${assignedUsers.length > 0 ? '#38bdf8' : 'var(--text-muted)'}; font-weight: 800; font-size: 12px; padding: 3px 10px; border: 1px solid ${assignedUsers.length > 0 ? 'rgba(56, 189, 248, 0.35)' : 'transparent'}; border-radius: 6px; cursor: pointer;" title="View users in User Accounts">
                              👥 ${assignedUsers.length} &rarr;
                            </button>
                          </div>
                        </td>

                        <!-- Access Level -->
                        <td style="padding: 12px 16px;">
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span class="badge" style="background: ${p.badgeColor ? p.badgeColor + '25' : 'rgba(56, 189, 248, 0.15)'}; color: ${p.badgeColor || '#38bdf8'}; border: 1px solid ${p.badgeColor ? p.badgeColor + '50' : 'rgba(56, 189, 248, 0.35)'}; font-size: 11px; padding: 2px 8px; font-weight: 700; width: fit-content;">
                              ${p.accessLevel || 'Access Profile'}
                            </span>
                          </div>
                        </td>

                        <!-- Scope -->
                        <td style="padding: 12px 16px;">
                          ${isGlobalScope ? `
                            <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; padding: 2px 8px; font-weight: 600;">
                              🌐 All Locations
                            </span>
                          ` : `
                            <span class="badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); font-size: 11px; padding: 2px 8px; font-weight: 700;">
                              📍 ${unitCount > 0 ? `${unitCount} Unit(s)` : 'Selected Units'}
                            </span>
                          `}
                        </td>

                        <!-- Actions -->
                        <td style="text-align: center; padding: 12px 16px;">
                          <div style="display: flex; gap: 6px; justify-content: center; align-items: center; flex-wrap: wrap;">
                            <button 
                              class="btn btn-secondary btn-xs btn-preset-edit" 
                              data-id="${p.id}" 
                              title="Configure permissions and scope" 
                              style="padding: 5px 10px; font-size: 11.5px; font-weight: 800; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(14, 165, 233, 0.15); border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;"
                            >
                              ⚙️ Config
                            </button>

                            <button 
                              class="btn btn-secondary btn-xs btn-preset-quick-assign" 
                              data-id="${p.id}" 
                              title="Assign users to this preset" 
                              style="padding: 5px 9px; font-size: 11.5px; font-weight: 700; border-radius: 6px;"
                            >
                              👥 Assign
                            </button>

                            <button 
                              class="btn btn-ghost btn-xs btn-preset-duplicate" 
                              data-id="${p.id}" 
                              title="Duplicate this preset" 
                              style="padding: 5px 7px; font-size: 11.5px; color: #a78bfa; border-radius: 6px;"
                            >
                              📋
                            </button>

                            ${!p.isSystem ? `
                              <button 
                                class="btn btn-ghost btn-xs btn-preset-delete" 
                                data-id="${p.id}" 
                                title="Delete custom preset" 
                                style="padding: 5px 7px; font-size: 11.5px; color: #f87171; border-radius: 6px;"
                              >
                                🗑️
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `}

      <!-- Modals Container (Isolated Layer for Zero Screen Jump) -->
      <div id="user-modal-layer">
        ${renderActiveModalHtml()}
      </div>

    </div>
  `;
}

function renderActiveModalHtml() {
  if (!activeModalType) return '';

  // 1. ADD NEW USER MODAL
  if (activeModalType === 'ADD_USER') {
    const activeEmployees = (typeof employeeService !== 'undefined' ? employeeService.getAllEmployees({ status: 'ACTIVE' }) : (storage.getTable(TABLE_NAMES.EMPLOYEES) || []))
      .filter(e => e && e.status !== 'INACTIVE' && e.status !== 'TERMINATED');
    activeEmployees.sort((a, b) => String(a.cardNumber || '').localeCompare(String(b.cardNumber || ''), undefined, { numeric: true }));

    const allExistingUsers = authService.getAllUsers() || [];
    const registeredCardSet = new Set(
      allExistingUsers.map(u => String(u.employeeId || '').trim().toLowerCase()).filter(Boolean)
    );

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 550px; max-width: 95vw; max-height: 92vh; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">➕</span>
              <div>
                <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">Add New User</h2>
                <div style="font-size: 11.5px; color: #e0f2fe;">Assign from Manpower or create custom login account</div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <!-- Add User Form -->
          <form id="form-add-new-user" style="padding: 22px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; min-height: 0;">
            
            <!-- Hidden Fields for Linked Employee Metadata -->
            <input type="hidden" id="add-user-emp-id" value="" />
            <input type="hidden" id="add-user-emp-dept" value="" />
            <input type="hidden" id="add-user-emp-desig" value="" />
            <input type="hidden" id="add-user-emp-phone" value="" />
            <input type="hidden" id="add-user-emp-unit" value="" />

            <!-- ========================================== -->
            <!-- ⚡ 1-CLICK ASSIGN FROM MANPOWER DATA       -->
            <!-- ========================================== -->
            <div style="background: linear-gradient(145deg, rgba(14, 165, 233, 0.12), rgba(2, 132, 199, 0.04)); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 10px; padding: 13px 15px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 7px;">
                  <span style="font-size: 16px; filter: drop-shadow(0 2px 4px rgba(56, 189, 248, 0.5));">⚡</span>
                  <span style="font-size: 12.5px; font-weight: 800; color: #38bdf8; letter-spacing: 0.3px;">
                    Assign from Manpower (কার্ড নাম্বার দিয়ে এসাইন)
                  </span>
                </div>
                <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 10px; font-weight: 700;">
                  1-Click Auto Fill
                </span>
              </div>

              <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 9px; line-height: 1.35;">
                কার্ড নাম্বার লিখুন বা তালিকা থেকে সিলেক্ট করুন — নাম, ইমেইল, ইউজারনেম, পদবী ও লোকেশন স্বয়ংক্রিয়ভাবে পূরণ হয়ে যাবে।
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Datalist Autocomplete Search -->
                <div style="position: relative;">
                  <input 
                    type="text" 
                    id="add-user-emp-card-input" 
                    list="manpower-employees-datalist" 
                    class="form-control" 
                    placeholder="🔍 কার্ড নাম্বার বা নাম লিখুন (e.g. 1001 বা AMG...)" 
                    autocomplete="off"
                    style="font-size: 13px; padding-left: 36px; padding-right: 32px; background: rgba(15, 23, 42, 0.9); border-color: rgba(56, 189, 248, 0.45); font-weight: 600; color: #fff;"
                  />
                  <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; opacity: 0.7; pointer-events: none;">🪪</span>
                  <button 
                    type="button" 
                    id="btn-clear-emp-card" 
                    title="Clear Selection"
                    style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 2px 6px; display: none;"
                  >✕</button>
                </div>

                <!-- Select Dropdown List -->
                <select 
                  id="add-user-emp-card-select" 
                  class="form-control" 
                  style="font-size: 12px; background: rgba(15, 23, 42, 0.85); border-color: rgba(148, 163, 184, 0.25); color: #cbd5e1;"
                >
                  <option value="">-- অথবা ড্রপডাউন তালিকা থেকে বেছে নিন (${activeEmployees.length} জন কর্মী) --</option>
                  ${activeEmployees.map(emp => {
                    const cardClean = String(emp.cardNumber || '').trim().toLowerCase();
                    const isRegistered = cardClean && registeredCardSet.has(cardClean);
                    return `<option value="${emp.cardNumber}">
                      [${emp.cardNumber}] ${emp.name} — ${emp.designation || 'Staff'} (${emp.unitName || 'Plant'})${isRegistered ? ' ⚠️ (User Exists)' : ''}
                    </option>`;
                  }).join('')}
                </select>
              </div>

              <!-- Datalist Entries -->
              <datalist id="manpower-employees-datalist">
                ${activeEmployees.map(emp => `
                  <option value="${emp.cardNumber}">${emp.name} — ${emp.designation || 'Staff'} (${emp.unitName || 'Plant'})</option>
                `).join('')}
              </datalist>

              <!-- Live Selected Employee Preview Card -->
              <div id="manpower-assigned-preview" style="display: none; margin-top: 10px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 10px 12px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;" id="preview-emp-avatar">
                      M
                    </div>
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span id="preview-emp-name" style="font-weight: 800; font-size: 13.5px; color: #fff;"></span>
                        <span id="preview-emp-card" class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 11px; font-weight: 700; padding: 1px 6px;"></span>
                        <span id="preview-emp-reg-warn" class="badge" style="display: none; background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px; font-weight: 700; padding: 1px 6px;">⚠️ Already Has Account</span>
                      </div>
                      <div id="preview-emp-meta" style="font-size: 11.5px; color: #cbd5e1; margin-top: 2px;"></div>
                    </div>
                  </div>
                  <span class="badge" style="background: rgba(16, 185, 129, 0.25); color: #34d399; font-size: 10px; font-weight: 700; flex-shrink: 0;">
                    ✓ Linked
                  </span>
                </div>
              </div>
            </div>

            <!-- Full Name -->
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                Full Name <span class="req">*</span>
              </label>
              <input 
                type="text" 
                id="add-user-fullname" 
                class="form-control" 
                placeholder="e.g. Md. Rafiqul Islam" 
                required 
                style="font-size: 13px;"
              />
            </div>

            <!-- Email & Username -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Email Address <span class="req">*</span>
                </label>
                <input 
                  type="email" 
                  id="add-user-email" 
                  class="form-control" 
                  placeholder="e.g. rafiq@al-muslim.com" 
                  required 
                  style="font-size: 13px;"
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Username
                </label>
                <input 
                  type="text" 
                  id="add-user-username" 
                  class="form-control" 
                  placeholder="e.g. rafiq (auto-generated if empty)" 
                  style="font-size: 13px; font-family: var(--font-mono);"
                />
              </div>
            </div>

            <!-- Password with 1-Click Generator -->
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff; margin: 0;">
                  Password <span class="req">*</span>
                </label>
                <button 
                  type="button" 
                  id="btn-generate-add-password" 
                  class="btn btn-ghost btn-xs" 
                  style="font-size: 11px; padding: 2px 8px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(14, 165, 233, 0.12); border-radius: 5px; font-weight: 700;"
                  title="Generate easy secure password"
                >
                  🎲 Auto-Generate Password
                </button>
              </div>
              <div style="position: relative;">
                <input 
                  type="password" 
                  id="add-user-password" 
                  class="form-control" 
                  placeholder="Minimum 4 characters (e.g. Pass@1234)" 
                  required 
                  minlength="4"
                  style="font-size: 13px; padding-right: 36px;"
                />
                <span id="btn-toggle-add-pwd" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.7; font-size: 14px;" title="Toggle Visibility">👁️</span>
              </div>
              <div style="font-size: 11px; color: #34d399; margin-top: 3px;">🔒 Passwords are cryptographically salted and hashed.</div>
            </div>

            <!-- Permission Preset / Access Profile -->
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                Permission Preset / Access Profile <span class="req">*</span>
              </label>
              <select id="add-user-preset" class="form-control" style="font-size: 13px; font-weight: 600;">
                ${authService.getAllPresets().map(p => `
                  <option value="${p.id}" ${p.code === 'MAINTENANCE_USER' ? 'selected' : ''}>
                    ${p.icon || '🛡️'} ${p.name} — ${p.accessLevel || p.description}
                  </option>
                `).join('')}
              </select>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
                Pre-configures all 7-action permissions and factory location scopes automatically.
              </div>
            </div>

            <!-- Role & Status -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Role <span class="req">*</span>
                </label>
                <select id="add-user-role" class="form-control" required style="font-size: 13px;">
                  <option value="USER" selected>👤 User (Standard)</option>
                  <option value="ADMIN">👑 Admin (Management Access)</option>
                  <option value="SUPER_ADMIN">🛡️ Super Admin (Full Unrestricted)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Status <span class="req">*</span>
                </label>
                <select id="add-user-status" class="form-control" required style="font-size: 13px;">
                  <option value="ACTIVE" selected>🟢 Active</option>
                  <option value="INACTIVE">🔴 Inactive</option>
                </select>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-modal" class="btn btn-secondary btn-sm" style="font-weight: 600;">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 20px;">
                💾 Save User
              </button>
            </div>

          </form>

        </div>
      </div>
    `;
  }

  // 2. EDIT USER MODAL
  if (activeModalType === 'EDIT_USER' && targetUser) {
    const isSuper = (targetUser.role || '').toUpperCase() === 'SUPER_ADMIN' || targetUser.username === 'superadmin';
    const isAdmin = (targetUser.role || '').toUpperCase() === 'ADMIN';

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 520px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">✏️</span>
              <div>
                <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">Edit User: ${targetUser.name}</h2>
                <div style="font-size: 11.5px; color: #e0f2fe;">Update profile credentials and role</div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <!-- Edit User Form -->
          <form id="form-edit-user" style="padding: 24px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; flex: 1; min-height: 0;">
            
            ${targetUser.employeeId ? `
              <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 10px 14px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 9px;">
                  <span style="font-size: 16px;">🪪</span>
                  <div>
                    <span style="color: #38bdf8; font-weight: 700;">Linked Manpower Card:</span> 
                    <strong style="color: #fff; margin-left: 4px;">${targetUser.employeeId}</strong>
                    ${targetUser.designation ? `<span style="color: #cbd5e1; margin-left: 6px;">(${targetUser.designation})</span>` : ''}
                    ${targetUser.department ? `<span style="color: var(--text-muted); margin-left: 4px;">• ${targetUser.department}</span>` : ''}
                  </div>
                </div>
                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 10px; font-weight: 700;">✓ Synced</span>
              </div>
            ` : ''}

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                Full Name <span class="req">*</span>
              </label>
              <input 
                type="text" 
                id="edit-user-fullname" 
                class="form-control" 
                value="${targetUser.name || ''}" 
                required 
                style="font-size: 13px;"
              />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Email Address <span class="req">*</span>
                </label>
                <input 
                  type="email" 
                  id="edit-user-email" 
                  class="form-control" 
                  value="${targetUser.email || ''}" 
                  required 
                  style="font-size: 13px;"
                />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Username <span class="req">*</span>
                </label>
                <input 
                  type="text" 
                  id="edit-user-username" 
                  class="form-control" 
                  value="${targetUser.username || ''}" 
                  required 
                  minlength="3"
                  maxlength="30"
                  placeholder="e.g. admin or custom_user"
                  style="font-size: 13px; font-family: var(--font-mono); font-weight: 700; color: #38bdf8;"
                />
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 3px;">Unique login username (3-30 letters, numbers, _, -)</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                Permission Preset / Access Profile
              </label>
              <select id="edit-user-preset" class="form-control" style="font-size: 13px; font-weight: 600;">
                ${authService.getAllPresets().map(p => `
                  <option value="${p.id}" ${(targetUser.presetId === p.id || targetUser.presetId === p.code) ? 'selected' : ''}>
                    ${p.icon || '🛡️'} ${p.name} — ${p.accessLevel || p.description}
                  </option>
                `).join('')}
                <option value="CUSTOM" ${targetUser.presetId === 'CUSTOM' ? 'selected' : ''}>👤 Custom User (Individual Permissions)</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Role <span class="req">*</span>
                </label>
                <select id="edit-user-role" class="form-control" required style="font-size: 13px;" ${targetUser.username === 'superadmin' ? 'disabled' : ''}>
                  <option value="USER" ${!isSuper && !isAdmin ? 'selected' : ''}>👤 User (Standard)</option>
                  <option value="ADMIN" ${isAdmin ? 'selected' : ''}>👑 Admin (Management Access)</option>
                  <option value="SUPER_ADMIN" ${isSuper ? 'selected' : ''}>🛡️ Super Admin (Full Access)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                  Status <span class="req">*</span>
                </label>
                <select id="edit-user-status" class="form-control" required style="font-size: 13px;" ${targetUser.username === 'superadmin' ? 'disabled' : ''}>
                  <option value="ACTIVE" ${targetUser.status === 'ACTIVE' ? 'selected' : ''}>🟢 Active</option>
                  <option value="INACTIVE" ${targetUser.status === 'INACTIVE' ? 'selected' : ''}>🔴 Inactive</option>
                </select>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-modal" class="btn btn-secondary btn-sm" style="font-weight: 600;">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 20px;">
                💾 Save Changes
              </button>
            </div>

          </form>

        </div>
      </div>
    `;
  }

  // 3. DEDICATED PERMISSION & LOCATION SCOPE MODAL (7-ACTION CHECKBOX MATRIX + UNIT/FLOOR/LINE DATA ACCESS SCOPING)
  if (activeModalType === 'USER_PERMISSIONS' && targetUser) {
    const userPerms = editingPermissions || targetUser.permissions || {};
    const isSuper = (targetUser.role || '').toUpperCase() === 'SUPER_ADMIN' || targetUser.username === 'superadmin';
    const currentScope = editingScope || targetUser.assignedScope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] };

    // Master data for location scope selection
    const allUnits = masterDataService.getAllUnits();
    const selectedUnitIds = currentScope.unitIds || [];
    const allFloors = masterDataService.getAllFloors();
    const selectedFloorIds = currentScope.floorIds || [];
    const allLines = masterDataService.getAllLines();
    const selectedLineIds = currentScope.lineIds || [];

    // Floors belonging to selected units (or all if none explicitly selected)
    const availableFloors = selectedUnitIds.length > 0
      ? allFloors.filter(f => selectedUnitIds.includes(f.unitId))
      : allFloors;

    // Lines belonging to selected floors
    const availableLines = selectedFloorIds.length > 0
      ? allLines.filter(l => selectedFloorIds.includes(l.floorId))
      : (selectedUnitIds.length > 0
          ? allLines.filter(l => availableFloors.some(f => f.id === l.floorId))
          : allLines);

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 1040px; max-width: 96vw; height: 90vh; max-height: 920px; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8); display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
          
          <!-- Modal Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">🛡️</span>
              <div>
                <h2 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
                  User Access Control: ${targetUser.name}
                </h2>
                <div style="font-size: 11px; color: #e0f2fe; display: flex; gap: 8px; align-items: center; margin-top: 1px;">
                  <span>ID: <strong style="font-family: var(--font-mono);">@${targetUser.username}</strong></span>
                  <span>&bull;</span>
                  <span>Role: <strong>${targetUser.role}</strong></span>
                  <span>&bull;</span>
                  <span>Status: <strong>${targetUser.status}</strong></span>
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <!-- Tab Navigation Bar -->
          <div style="display: flex; gap: 8px; background: rgba(15, 23, 42, 0.95); padding: 6px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
            <button 
              type="button" 
              id="tab-btn-perms" 
              class="btn ${activeModalTab === 'PERMISSIONS' ? 'btn-primary' : 'btn-ghost'}" 
              style="font-weight: 700; font-size: 12px; padding: 6px 16px; border-radius: var(--radius-md); ${activeModalTab === 'PERMISSIONS' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;' : 'color: var(--text-secondary);'}"
            >
              🔐 1. Permission Matrix (7 Actions)
            </button>
            <button 
              type="button" 
              id="tab-btn-scope" 
              class="btn ${activeModalTab === 'LOCATION_SCOPE' ? 'btn-primary' : 'btn-ghost'}" 
              style="font-weight: 700; font-size: 12px; padding: 6px 16px; border-radius: var(--radius-md); ${activeModalTab === 'LOCATION_SCOPE' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;' : 'color: var(--text-secondary);'}"
            >
              📍 2. Plant &amp; Line Scope (Unit, Floor, Line)
            </button>
          </div>

          <!-- TAB 1: 7-ACTION PERMISSION MATRIX -->
          <div id="user-tab-panel-perms" style="display: ${activeModalTab === 'PERMISSIONS' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
            <!-- Quick Action Preset Toolbar -->
            <div style="background: rgba(15, 23, 42, 0.85); padding: 8px 20px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
              
              <!-- 1. Quick Presets -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                  <span>⚡ Quick Presets:</span>
                </div>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                  <button type="button" id="btn-perm-select-all" class="btn btn-secondary btn-xs" style="font-weight: 700; font-size: 11px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 3px 8px;">
                    🌟 All (✓)
                  </button>
                  <button type="button" id="btn-perm-preset-admin" class="btn btn-ghost btn-xs" style="color: #38bdf8; font-weight: 700; font-size: 11px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.08); padding: 3px 8px;">
                    👑 Full Admin
                  </button>
                  <button type="button" id="btn-perm-preset-approver" class="btn btn-ghost btn-xs" style="color: #f472b6; font-weight: 700; font-size: 11px; border: 1px solid rgba(244, 114, 182, 0.3); background: rgba(244, 114, 182, 0.08); padding: 3px 8px;">
                    🛡️ Approver
                  </button>
                  <button type="button" id="btn-perm-preset-operator" class="btn btn-ghost btn-xs" style="color: #a78bfa; font-weight: 700; font-size: 11px; border: 1px solid rgba(167, 139, 250, 0.3); background: rgba(167, 139, 250, 0.08); padding: 3px 8px;">
                    📝 Operator
                  </button>
                  <button type="button" id="btn-perm-preset-viewonly" class="btn btn-ghost btn-xs" style="color: #34d399; font-weight: 700; font-size: 11px; border: 1px solid rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.08); padding: 3px 8px;">
                    👁️ View Only
                  </button>
                  <button type="button" id="btn-perm-clear-all" class="btn btn-secondary btn-xs" style="font-weight: 700; font-size: 11px; color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); padding: 3px 8px;">
                    ⬜ Clear All
                  </button>
                </div>
              </div>

              <!-- 2. Master 7-Action Global Toggles -->
              <div style="background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-md); padding: 4px 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <div style="font-size: 11px; font-weight: 700; color: #7dd3fc; display: flex; align-items: center; gap: 4px;">
                  <span>🌐 Global Action Toggles:</span>
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 400;">(Apply to all modules)</span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-VIEW" style="cursor: pointer; accent-color: #10b981; width: 14px; height: 14px;" />
                    <span>Read</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.35); color: #38bdf8; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-ADD" style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
                    <span>Add</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-EDIT" style="cursor: pointer; accent-color: #f59e0b; width: 14px; height: 14px;" />
                    <span>Edit</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-DELETE" style="cursor: pointer; accent-color: #ef4444; width: 14px; height: 14px;" />
                    <span>Delete</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-IMPORT" style="cursor: pointer; accent-color: #a855f7; width: 14px; height: 14px;" />
                    <span>Import</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); color: #818cf8; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-EXPORT" style="cursor: pointer; accent-color: #6366f1; width: 14px; height: 14px;" />
                    <span>Export</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.35); color: #f472b6; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-APPROVE" style="cursor: pointer; accent-color: #ec4899; width: 14px; height: 14px;" />
                    <span>Approve</span>
                  </label>
                </div>
              </div>

            </div>

            ${isSuper ? `
              <div style="padding: 6px 20px; background: rgba(56, 189, 248, 0.1); border-bottom: 1px solid rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 11px; display: flex; align-items: center; gap: 8px;">
                <span>🛡️</span>
                <span><strong>Super Admin Account:</strong> This account has unrestricted 100% master authority across all system modules and actions.</span>
              </div>
            ` : ''}

            <!-- Scrollable Permission Checkbox Matrix with 7 action columns (Zero top padding) -->
            <div class="permissions-matrix-scroll-wrap" style="overflow-y: auto; flex: 1; min-height: 0; padding: 0; background: #0b1329;">
              <form id="form-user-permissions">
                <table class="permissions-matrix-table" style="margin: 0; width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; table-layout: fixed !important;">
                  <thead>
                    <tr>
                      <th style="width: 250px; text-align: left; padding-left: 16px;">Module Name</th>
                      <th style="width: 66px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #34d399; font-weight: 800; text-transform: uppercase;">Read</div>
                        <input type="checkbox" id="col-toggle-VIEW" class="col-header-toggle" title="Toggle Read for all modules" style="cursor: pointer; accent-color: #10b981; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 66px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #38bdf8; font-weight: 800; text-transform: uppercase;">Add</div>
                        <input type="checkbox" id="col-toggle-ADD" class="col-header-toggle" title="Toggle Add for all modules" style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 66px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #fbbf24; font-weight: 800; text-transform: uppercase;">Edit</div>
                        <input type="checkbox" id="col-toggle-EDIT" class="col-header-toggle" title="Toggle Edit for all modules" style="cursor: pointer; accent-color: #f59e0b; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 66px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #f87171; font-weight: 800; text-transform: uppercase;">Delete</div>
                        <input type="checkbox" id="col-toggle-DELETE" class="col-header-toggle" title="Toggle Delete for all modules" style="cursor: pointer; accent-color: #ef4444; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 66px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #c084fc; font-weight: 800; text-transform: uppercase;">Import</div>
                        <input type="checkbox" id="col-toggle-IMPORT" class="col-header-toggle" title="Toggle Import for all modules" style="cursor: pointer; accent-color: #a855f7; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 66px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #818cf8; font-weight: 800; text-transform: uppercase;">Export</div>
                        <input type="checkbox" id="col-toggle-EXPORT" class="col-header-toggle" title="Toggle Export for all modules" style="cursor: pointer; accent-color: #6366f1; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 68px; text-align: center;">
                        <div style="font-size: 10.5px; margin-bottom: 2px; color: #f472b6; font-weight: 800; text-transform: uppercase;">Approve</div>
                        <input type="checkbox" id="col-toggle-APPROVE" class="col-header-toggle" title="Toggle Approve for all modules" style="cursor: pointer; accent-color: #ec4899; width: 14px; height: 14px;" />
                      </th>
                      <th style="width: 68px; text-align: center;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${PERMISSION_CONFIG_MODULES.map(group => `
                      <tr class="module-group-header">
                        <td colspan="9" style="background: #142036 !important; color: #38bdf8 !important; font-weight: 800; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.6px; padding: 7px 16px !important; border-top: 1px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.25); border-left: 3px solid #0284c7 !important;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 13px;">📁</span>
                            <span>${group.group}</span>
                          </div>
                        </td>
                      </tr>
                      ${group.modules.map(mod => {
                        const modActions = userPerms[mod.id] || [];
                        const hasView = modActions.includes('VIEW') || modActions.includes('READ') || modActions.some(a => a.startsWith('VIEW'));
                        const hasAdd = modActions.includes('ADD') || modActions.some(a => a === 'ADD' || a.startsWith('ADD_') || a === 'CREATE_REQUEST' || a === 'ALLOCATE');
                        const hasEdit = modActions.includes('EDIT') || modActions.some(a => a === 'EDIT' || a.startsWith('EDIT_') || a === 'MASTER_CONFIG' || a === 'REPLACE');
                        const hasDelete = modActions.includes('DELETE') || modActions.some(a => a === 'DELETE' || a.startsWith('DELETE_') || a === 'CANCEL_REQUEST');
                        const hasImport = modActions.includes('IMPORT') || modActions.some(a => a === 'IMPORT' || a.includes('IMPORT'));
                        const hasExport = modActions.includes('EXPORT') || modActions.some(a => a === 'EXPORT' || a.includes('EXPORT'));
                        const hasApprove = modActions.includes('APPROVE') || modActions.some(a => a === 'APPROVE' || a.includes('APPROVE') || a === 'COMPLETE_SESSION');

                        const supportsAdd = mod.actions.includes('ADD');
                        const supportsEdit = mod.actions.includes('EDIT');
                        const supportsDelete = mod.actions.includes('DELETE');
                        const supportsImport = mod.actions.includes('IMPORT');
                        const supportsExport = mod.actions.includes('EXPORT');
                        const supportsApprove = mod.actions.includes('APPROVE');

                        return `
                          <tr class="module-row" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: transparent;">
                            <td style="font-weight: 600; font-size: 12px; color: #f8fafc; padding: 7px 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mod.name}">
                              ${mod.name}
                            </td>
                            
                            <!-- 1. Read (View) -->
                            <td style="text-align: center; padding: 5px 2px;">
                              <input 
                                type="checkbox" 
                                class="chk-perm-action" 
                                data-module="${mod.id}" 
                                data-action="VIEW" 
                                ${hasView ? 'checked' : ''} 
                                style="width: 16px; height: 16px; cursor: pointer; accent-color: #10b981;"
                              />
                            </td>

                            <!-- 2. Add -->
                            <td style="text-align: center; padding: 5px 2px;">
                              ${supportsAdd ? `
                                <input 
                                  type="checkbox" 
                                  class="chk-perm-action" 
                                  data-module="${mod.id}" 
                                  data-action="ADD" 
                                  ${hasAdd ? 'checked' : ''} 
                                  style="width: 16px; height: 16px; cursor: pointer; accent-color: #0284c7;"
                                />
                              ` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                            </td>

                            <!-- 3. Edit -->
                            <td style="text-align: center; padding: 5px 2px;">
                              ${supportsEdit ? `
                                <input 
                                  type="checkbox" 
                                  class="chk-perm-action" 
                                  data-module="${mod.id}" 
                                  data-action="EDIT" 
                                  ${hasEdit ? 'checked' : ''} 
                                  style="width: 16px; height: 16px; cursor: pointer; accent-color: #f59e0b;"
                                />
                              ` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                            </td>

                            <!-- 4. Delete -->
                            <td style="text-align: center; padding: 5px 2px;">
                              ${supportsDelete ? `
                                <input 
                                  type="checkbox" 
                                  class="chk-perm-action" 
                                  data-module="${mod.id}" 
                                  data-action="DELETE" 
                                  ${hasDelete ? 'checked' : ''} 
                                  style="width: 16px; height: 16px; cursor: pointer; accent-color: #ef4444;"
                                />
                              ` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                            </td>

                            <!-- 5. Import -->
                            <td style="text-align: center; padding: 5px 2px;">
                              ${supportsImport ? `
                                <input 
                                  type="checkbox" 
                                  class="chk-perm-action" 
                                  data-module="${mod.id}" 
                                  data-action="IMPORT" 
                                  ${hasImport ? 'checked' : ''} 
                                  style="width: 16px; height: 16px; cursor: pointer; accent-color: #a855f7;"
                                />
                              ` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                            </td>

                            <!-- 6. Export -->
                            <td style="text-align: center; padding: 5px 2px;">
                              ${supportsExport ? `
                                <input 
                                  type="checkbox" 
                                  class="chk-perm-action" 
                                  data-module="${mod.id}" 
                                  data-action="EXPORT" 
                                  ${hasExport ? 'checked' : ''} 
                                  style="width: 16px; height: 16px; cursor: pointer; accent-color: #6366f1;"
                                />
                              ` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                            </td>

                            <!-- 7. Approve -->
                            <td style="text-align: center; padding: 5px 2px;">
                              ${supportsApprove ? `
                                <input 
                                  type="checkbox" 
                                  class="chk-perm-action" 
                                  data-module="${mod.id}" 
                                  data-action="APPROVE" 
                                  ${hasApprove ? 'checked' : ''} 
                                  style="width: 16px; height: 16px; cursor: pointer; accent-color: #ec4899;"
                                />
                              ` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                            </td>

                            <!-- Row Quick Toggle -->
                            <td style="text-align: center; padding: 5px 4px;">
                              <button 
                                type="button" 
                                class="btn btn-ghost btn-xs btn-perm-toggle-row" 
                                data-module="${mod.id}"
                                title="Toggle all supported actions for ${mod.name}"
                                style="font-size: 10px; padding: 2px 6px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px; background: rgba(56, 189, 248, 0.05);"
                              >
                                Toggle
                              </button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    `).join('')}
                  </tbody>
                </table>
              </form>
            </div>

            <!-- Footer Actions -->
            <div style="background: var(--bg-surface); padding: 12px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
              <button type="button" class="btn btn-secondary btn-cancel-user-modal" style="font-weight: 600;">Cancel</button>
              <button type="button" id="btn-save-user-perms" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 24px;">
                💾 Save Permissions
              </button>
            </div>
          </div>

          <!-- TAB 2: LOCATION-BASED DATA ACCESS SCOPING -->
          <div id="user-tab-panel-scope" style="display: ${activeModalTab === 'LOCATION_SCOPE' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
            <div style="padding: 16px 24px; overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px;">
              
              <!-- Scope Mode Selector Card -->
              <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 20px;">
                <div style="font-size: 13.5px; font-weight: 800; color: #fff; margin-bottom: 4px;">
                  📍 Data Access Scope Mode
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                  Configure which factory units, floors, and lines this user is authorized to access:
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <label id="scope-mode-all-card" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; color: #fff; background: ${currentScope.allGroups ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.4)'}; border: 1.5px solid ${currentScope.allGroups ? '#38bdf8' : 'var(--border-color)'}; padding: 12px 16px; border-radius: var(--radius-md);">
                    <input type="radio" name="scope-mode" id="scope-mode-all" value="ALL" ${currentScope.allGroups ? 'checked' : ''} style="cursor: pointer; accent-color: #38bdf8; margin-top: 3px;" />
                    <div>
                      <div style="font-weight: 700; font-size: 13px; color: #38bdf8;">🌐 All Locations (Unrestricted Global Access)</div>
                      <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">User has full unrestricted access across all units, floors, and lines in the enterprise.</div>
                    </div>
                  </label>

                  <label id="scope-mode-restricted-card" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; color: #fff; background: ${!currentScope.allGroups ? 'rgba(234, 179, 8, 0.15)' : 'rgba(15, 23, 42, 0.4)'}; border: 1.5px solid ${!currentScope.allGroups ? '#facc15' : 'var(--border-color)'}; padding: 12px 16px; border-radius: var(--radius-md);">
                    <input type="radio" name="scope-mode" id="scope-mode-restricted" value="RESTRICTED" ${!currentScope.allGroups ? 'checked' : ''} style="cursor: pointer; accent-color: #facc15; margin-top: 3px;" />
                    <div>
                      <div style="font-weight: 700; font-size: 13px; color: #facc15;">📍 Restricted Scope (Assigned Plants &amp; Lines Only)</div>
                      <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">User can only view and manage machines strictly scoped to selected Units, Floors, or Lines.</div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Live Summary Box -->
              <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px;">
                  <span style="font-weight: 700; color: #fff;">📌 Live Scope Status:</span>
                  <div id="scope-live-status-container">
                    ${currentScope.allGroups ? `
                      <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700;">🌐 Unrestricted Global Access (All Locations)</span>
                    ` : `
                      <span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #facc15; font-weight: 700;">
                        📍 ${selectedUnitIds.length} Unit(s) &bull; ${selectedFloorIds.length} Floor(s) &bull; ${selectedLineIds.length} Line(s)
                      </span>
                    `}
                  </div>
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">
                  Equipment outside authorized locations will not be visible or accessible to this account.
                </div>
              </div>

              <!-- 3-Panel Granular Selection Area (Visible when restricted) -->
              <div id="scope-granular-panels" style="display: ${currentScope.allGroups ? 'none' : 'grid'}; grid-template-columns: 1fr 1fr 1fr; gap: 14px; flex: 1; min-height: 280px;">
                
                <!-- Panel 1: Units / Factories -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                  <div style="padding: 10px 14px; background: rgba(2, 132, 199, 0.15); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #38bdf8;">
                      🏭 1. Factory Units (${allUnits.length})
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" id="btn-scope-all-units" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #38bdf8;">All</button>
                      <button type="button" id="btn-scope-clear-units" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: var(--text-muted);">Clear</button>
                    </div>
                  </div>
                  <div id="scope-units-scroll-list" style="padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    ${allUnits.length === 0 ? `
                      <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">No Units Found</div>
                    ` : allUnits.map(unt => {
                      const isChecked = selectedUnitIds.includes(unt.id);
                      return `
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.3)' : 'transparent'};">
                          <input 
                            type="checkbox" 
                            class="chk-scope-unit" 
                            data-id="${unt.id}" 
                            ${isChecked ? 'checked' : ''} 
                            style="width: 15px; height: 15px; cursor: pointer; accent-color: #0284c7;"
                          />
                          <span style="font-weight: 600;">${unt.name}</span>
                          ${unt.code ? `<span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); margin-left: auto;">[${unt.code}]</span>` : ''}
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Panel 2: Floors -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                  <div style="padding: 10px 14px; background: rgba(2, 132, 199, 0.15); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #38bdf8;">
                      🏢 2. Plant Floors (<span id="scope-floors-count">${availableFloors.length}</span>)
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" id="btn-scope-all-floors" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #38bdf8;">All</button>
                      <button type="button" id="btn-scope-clear-floors" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: var(--text-muted);">Clear</button>
                    </div>
                  </div>
                  <div id="scope-floors-scroll-list" style="padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    ${allFloors.length === 0 ? `
                      <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">
                        No floors found
                      </div>
                    ` : allFloors.map(flr => {
                      const isChecked = selectedFloorIds.includes(flr.id);
                      const isVisible = selectedUnitIds.length === 0 || selectedUnitIds.includes(flr.unitId);
                      const parentUnit = allUnits.find(u => u.id === flr.unitId);
                      return `
                        <label class="scope-floor-item" data-id="${flr.id}" data-unit="${flr.unitId}" style="display: ${isVisible ? 'flex' : 'none'}; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.3)' : 'transparent'};">
                          <input 
                            type="checkbox" 
                            class="chk-scope-floor" 
                            data-id="${flr.id}" 
                            data-unit="${flr.unitId}" 
                            ${isChecked ? 'checked' : ''} 
                            style="width: 15px; height: 15px; cursor: pointer; accent-color: #0284c7;"
                          />
                          <span style="font-weight: 600;">${flr.name}</span>
                          ${parentUnit ? `<span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">(${parentUnit.name})</span>` : ''}
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Panel 3: Lines -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                  <div style="padding: 10px 14px; background: rgba(2, 132, 199, 0.15); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #38bdf8;">
                      🧵 3. Production Lines (<span id="scope-lines-count">${availableLines.length}</span>)
                    </div>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" id="btn-scope-all-lines" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #38bdf8;">All</button>
                      <button type="button" id="btn-scope-clear-lines" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: var(--text-muted);">Clear</button>
                    </div>
                  </div>
                  <div id="scope-lines-scroll-list" style="padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    ${allLines.length === 0 ? `
                      <div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px;">
                        No lines found
                      </div>
                    ` : allLines.map(lin => {
                      const isChecked = selectedLineIds.includes(lin.id);
                      const parentFloor = allFloors.find(f => f.id === lin.floorId);
                      const parentUnitId = parentFloor ? parentFloor.unitId : '';
                      const isVisible = selectedFloorIds.length > 0 ? selectedFloorIds.includes(lin.floorId) : (selectedUnitIds.length === 0 || selectedUnitIds.includes(parentUnitId));
                      return `
                        <label class="scope-line-item" data-id="${lin.id}" data-floor="${lin.floorId}" data-unit="${parentUnitId}" style="display: ${isVisible ? 'flex' : 'none'}; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.3)' : 'transparent'};">
                          <input 
                            type="checkbox" 
                            class="chk-scope-line" 
                            data-id="${lin.id}" 
                            data-floor="${lin.floorId}" 
                            ${isChecked ? 'checked' : ''} 
                            style="width: 15px; height: 15px; cursor: pointer; accent-color: #0284c7;"
                          />
                          <span style="font-weight: 600;">${lin.name}</span>
                          ${parentFloor ? `<span style="font-size: 10px; color: var(--text-muted); margin-left: auto;">(${parentFloor.name})</span>` : ''}
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>

              </div>

            </div>

            <!-- Footer Actions -->
            <div style="background: var(--bg-surface); padding: 12px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
              <button type="button" class="btn btn-secondary btn-cancel-user-modal" style="font-weight: 600;">Cancel</button>
              <button type="button" id="btn-save-user-scope" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 24px;">
                💾 Save Location Scope
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // 4. RESET PASSWORD MODAL
  if (activeModalType === 'RESET_PASSWORD' && targetUser) {
    const isConfigured = emailService.isEmailConfigured();

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 480px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(251, 191, 36, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
          
          <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">🔑</span>
              <div>
                <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">Reset Password</h2>
                <div style="font-size: 11.5px; color: #fef3c7;">For account: ${targetUser.name} (${targetUser.email || targetUser.username})</div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <form id="form-reset-password" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                New Password <span class="req">*</span>
              </label>
              <div style="position: relative;">
                <input 
                  type="password" 
                  id="reset-new-password" 
                  class="form-control" 
                  placeholder="Minimum 4 characters" 
                  required 
                  minlength="4"
                  style="font-size: 13px; padding-right: 36px;"
                />
                <span id="btn-toggle-reset-pwd" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; opacity: 0.7; font-size: 14px;" title="Toggle Visibility">👁️</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">
                Confirm New Password <span class="req">*</span>
              </label>
              <input 
                type="password" 
                id="reset-confirm-password" 
                class="form-control" 
                placeholder="Re-enter new password" 
                required 
                minlength="4"
                style="font-size: 13px;"
              />
            </div>

            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <input type="checkbox" id="chk-send-reset-email" ${isConfigured ? 'checked' : 'disabled'} style="width: 16px; height: 16px;" />
              <label for="chk-send-reset-email" style="font-size: 12px; color: ${isConfigured ? '#fff' : 'var(--text-muted)'}; cursor: ${isConfigured ? 'pointer' : 'not-allowed'};">
                Send password reset confirmation email to ${targetUser.email || 'user'}
              </label>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-modal" class="btn btn-secondary btn-sm" style="font-weight: 600;">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #d97706, #b45309); padding: 8px 20px;">
                🔑 Update Password
              </button>
            </div>

          </form>

        </div>
      </div>
    `;
  }
  // 4. CREATE OR EDIT PRESET MODAL
  if (activeModalType === 'CREATE_EDIT_PRESET') {
    const isNew = !targetPreset;
    const allUsers = authService.getAllUsers();
    const assignedUsers = targetPreset ? allUsers.filter(u => u.presetId === targetPreset.id || u.presetId === targetPreset.code) : [];
    const currentPerms = editingPermissions || {};
    const currentScope = editingScope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] };

    // Master data for location scope selection
    const allUnits = masterDataService.getAllUnits();
    const selectedUnitIds = currentScope.unitIds || [];
    const allFloors = masterDataService.getAllFloors();
    const selectedFloorIds = currentScope.floorIds || [];
    const allLines = masterDataService.getAllLines();
    const selectedLineIds = currentScope.lineIds || [];
    
    const availableFloors = selectedUnitIds.length > 0
      ? allFloors.filter(f => selectedUnitIds.includes(f.unitId))
      : allFloors;

    const availableLines = selectedFloorIds.length > 0
      ? allLines.filter(l => selectedFloorIds.includes(l.floorId))
      : (selectedUnitIds.length > 0
          ? allLines.filter(l => availableFloors.some(f => f.id === l.floorId))
          : allLines);

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 1040px; max-width: 96vw; height: 90vh; max-height: 920px; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8); display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
          
          <!-- Modal Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">${targetPreset?.icon || '🛡️'}</span>
              <div>
                <h2 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
                  ${isNew ? 'Create Permission Preset / Access Profile' : `Edit Preset Profile: ${targetPreset.name}`}
                </h2>
                <div style="font-size: 11px; color: #e0f2fe; margin-top: 1px;">
                  ${isNew ? 'Configure standard permissions and factory scope profile' : `Code: [${targetPreset.code || targetPreset.id}] &bull; ${assignedUsers.length} Assigned User(s)`}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <!-- Preset Profile Metadata Fields (Compact & Clean) -->
          <div style="padding: 10px 20px; background: rgba(15, 23, 42, 0.75); border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
            <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; gap: 10px;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 3px;">
                  Preset Name <span class="req" style="color: #f87171;">*</span>
                </label>
                <input 
                  type="text" 
                  id="preset-name-input" 
                  class="form-control" 
                  value="${targetPreset?.name || ''}" 
                  placeholder="e.g. Maintenance User, Line Supervisor..." 
                  required 
                  style="font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 3px;">
                  Access Level Title
                </label>
                <input 
                  type="text" 
                  id="preset-access-level-input" 
                  class="form-control" 
                  value="${targetPreset?.accessLevel || 'Module Access'}" 
                  placeholder="e.g. Full Access, Read Only..." 
                  style="font-size: 12.5px; height: 34px; padding: 6px 10px;"
                />
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 3px;">
                  Icon
                </label>
                <select id="preset-icon-input" class="form-control" style="font-size: 12.5px; height: 34px; padding: 4px 8px;">
                  <option value="🛡️" ${targetPreset?.icon === '🛡️' ? 'selected' : ''}>🛡️ Shield</option>
                  <option value="👑" ${targetPreset?.icon === '👑' ? 'selected' : ''}>👑 Crown</option>
                  <option value="⚙️" ${targetPreset?.icon === '⚙️' ? 'selected' : ''}>⚙️ Gear</option>
                  <option value="✏️" ${targetPreset?.icon === '✏️' ? 'selected' : ''}>✏️ Pencil</option>
                  <option value="👁️" ${targetPreset?.icon === '👁️' ? 'selected' : ''}>👁️ Eye</option>
                  <option value="🔬" ${targetPreset?.icon === '🔬' ? 'selected' : ''}>🔬 Microscope</option>
                  <option value="🏭" ${targetPreset?.icon === '🏭' ? 'selected' : ''}>🏭 Factory</option>
                  <option value="💼" ${targetPreset?.icon === '💼' ? 'selected' : ''}>💼 Briefcase</option>
                </select>
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11px; font-weight: 700; color: #e2e8f0; margin-bottom: 3px;">
                  Color Theme
                </label>
                <select id="preset-badge-color-input" class="form-control" style="font-size: 12.5px; height: 34px; padding: 4px 8px;">
                  <option value="#0ea5e9" ${targetPreset?.badgeColor === '#0ea5e9' ? 'selected' : ''}>🔵 Blue</option>
                  <option value="#38bdf8" ${targetPreset?.badgeColor === '#38bdf8' ? 'selected' : ''}>🔷 Cyan</option>
                  <option value="#34d399" ${targetPreset?.badgeColor === '#34d399' ? 'selected' : ''}>🟢 Emerald</option>
                  <option value="#fbbf24" ${targetPreset?.badgeColor === '#fbbf24' ? 'selected' : ''}>🟡 Amber</option>
                  <option value="#a78bfa" ${targetPreset?.badgeColor === '#a78bfa' ? 'selected' : ''}>🟣 Purple</option>
                  <option value="#f87171" ${targetPreset?.badgeColor === '#f87171' ? 'selected' : ''}>🔴 Rose</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin: 0;">
              <input 
                type="text" 
                id="preset-description-input" 
                class="form-control" 
                value="${targetPreset?.description || ''}" 
                placeholder="Description / Purpose: brief explanation of what this access profile allows..." 
                style="font-size: 12px; height: 32px; padding: 4px 10px;"
              />
            </div>
          </div>

          <!-- Tab Navigation Bar -->
          <div style="display: flex; gap: 8px; background: rgba(15, 23, 42, 0.95); padding: 6px 20px; border-bottom: 1px solid var(--border-color); flex-shrink: 0;">
            <button 
              type="button" 
              id="tab-btn-perms" 
              class="btn ${activeModalTab === 'PERMISSIONS' ? 'btn-primary' : 'btn-ghost'}" 
              style="font-weight: 700; font-size: 12px; padding: 6px 16px; border-radius: var(--radius-md); ${activeModalTab === 'PERMISSIONS' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;' : 'color: var(--text-secondary);'}"
            >
              🔐 1. Module Permissions Matrix (7 Actions)
            </button>
            <button 
              type="button" 
              id="tab-btn-scope" 
              class="btn ${activeModalTab === 'LOCATION_SCOPE' ? 'btn-primary' : 'btn-ghost'}" 
              style="font-weight: 700; font-size: 12px; padding: 6px 16px; border-radius: var(--radius-md); ${activeModalTab === 'LOCATION_SCOPE' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;' : 'color: var(--text-secondary);'}"
            >
              📍 2. Default Factory Location Scope
            </button>
          </div>

          <!-- TAB 1: 7-ACTION PERMISSION MATRIX -->
          <div id="preset-tab-panel-perms" style="display: ${activeModalTab === 'PERMISSIONS' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
            <div style="background: rgba(15, 23, 42, 0.85); padding: 8px 20px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
              
              <!-- Quick Action Presets -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                  <span>⚡ Quick Presets:</span>
                </div>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                  <button type="button" id="btn-perm-select-all" class="btn btn-secondary btn-xs" style="font-weight: 700; font-size: 11px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 3px 8px;">
                    🌟 All (✓)
                  </button>
                  <button type="button" id="btn-perm-preset-admin" class="btn btn-ghost btn-xs" style="color: #38bdf8; font-weight: 700; font-size: 11px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.08); padding: 3px 8px;">
                    👑 Full Master
                  </button>
                  <button type="button" id="btn-perm-preset-approver" class="btn btn-ghost btn-xs" style="color: #f472b6; font-weight: 700; font-size: 11px; border: 1px solid rgba(244, 114, 182, 0.3); background: rgba(244, 114, 182, 0.08); padding: 3px 8px;">
                    🛡️ Approver
                  </button>
                  <button type="button" id="btn-perm-preset-operator" class="btn btn-ghost btn-xs" style="color: #a78bfa; font-weight: 700; font-size: 11px; border: 1px solid rgba(167, 139, 250, 0.3); background: rgba(167, 139, 250, 0.08); padding: 3px 8px;">
                    📝 Add / Edit
                  </button>
                  <button type="button" id="btn-perm-preset-viewonly" class="btn btn-ghost btn-xs" style="color: #34d399; font-weight: 700; font-size: 11px; border: 1px solid rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.08); padding: 3px 8px;">
                    👁️ View Only
                  </button>
                  <button type="button" id="btn-perm-clear-all" class="btn btn-secondary btn-xs" style="font-weight: 700; font-size: 11px; color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); padding: 3px 8px;">
                    ⬜ Clear All
                  </button>
                </div>
              </div>

              <!-- Master 7-Action Global Toggles -->
              <div style="background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-md); padding: 4px 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <div style="font-size: 11px; font-weight: 700; color: #7dd3fc; display: flex; align-items: center; gap: 4px;">
                  <span>🌐 Global Action Toggles:</span>
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 400;">(Apply to all modules)</span>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-VIEW" style="cursor: pointer; accent-color: #10b981; width: 14px; height: 14px;" />
                    <span>Read</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.35); color: #38bdf8; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-ADD" style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
                    <span>Add</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-EDIT" style="cursor: pointer; accent-color: #f59e0b; width: 14px; height: 14px;" />
                    <span>Edit</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-DELETE" style="cursor: pointer; accent-color: #ef4444; width: 14px; height: 14px;" />
                    <span>Delete</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-IMPORT" style="cursor: pointer; accent-color: #a855f7; width: 14px; height: 14px;" />
                    <span>Import</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); color: #818cf8; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-EXPORT" style="cursor: pointer; accent-color: #6366f1; width: 14px; height: 14px;" />
                    <span>Export</span>
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 7px; border-radius: 4px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.35); color: #f472b6; font-weight: 700;">
                    <input type="checkbox" id="master-toggle-APPROVE" style="cursor: pointer; accent-color: #ec4899; width: 14px; height: 14px;" />
                    <span>Approve</span>
                  </label>
                </div>
              </div>

            </div>

            <!-- Permission Table Scroll Container (Zero top padding) -->
            <div class="permissions-matrix-scroll-wrap" style="overflow-y: auto; flex: 1; min-height: 0; padding: 0; background: #0b1329;">
              <table class="permissions-matrix-table" style="margin: 0; width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; table-layout: fixed !important;">
                <thead>
                  <tr>
                    <th style="width: 250px; text-align: left; padding-left: 16px;">Module Name</th>
                    <th style="width: 66px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #34d399; font-weight: 800; text-transform: uppercase;">Read</div>
                      <input type="checkbox" id="col-toggle-VIEW" class="col-header-toggle" title="Toggle Read" style="cursor: pointer; accent-color: #10b981; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 66px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #38bdf8; font-weight: 800; text-transform: uppercase;">Add</div>
                      <input type="checkbox" id="col-toggle-ADD" class="col-header-toggle" title="Toggle Add" style="cursor: pointer; accent-color: #0284c7; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 66px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #fbbf24; font-weight: 800; text-transform: uppercase;">Edit</div>
                      <input type="checkbox" id="col-toggle-EDIT" class="col-header-toggle" title="Toggle Edit" style="cursor: pointer; accent-color: #f59e0b; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 66px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #f87171; font-weight: 800; text-transform: uppercase;">Delete</div>
                      <input type="checkbox" id="col-toggle-DELETE" class="col-header-toggle" title="Toggle Delete" style="cursor: pointer; accent-color: #ef4444; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 66px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #c084fc; font-weight: 800; text-transform: uppercase;">Import</div>
                      <input type="checkbox" id="col-toggle-IMPORT" class="col-header-toggle" title="Toggle Import" style="cursor: pointer; accent-color: #a855f7; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 66px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #818cf8; font-weight: 800; text-transform: uppercase;">Export</div>
                      <input type="checkbox" id="col-toggle-EXPORT" class="col-header-toggle" title="Toggle Export" style="cursor: pointer; accent-color: #6366f1; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 68px; text-align: center;">
                      <div style="font-size: 10.5px; margin-bottom: 2px; color: #f472b6; font-weight: 800; text-transform: uppercase;">Approve</div>
                      <input type="checkbox" id="col-toggle-APPROVE" class="col-header-toggle" title="Toggle Approve" style="cursor: pointer; accent-color: #ec4899; width: 14px; height: 14px;" />
                    </th>
                    <th style="width: 68px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${PERMISSION_CONFIG_MODULES.map(group => `
                    <tr class="module-group-header">
                      <td colspan="9" style="background: #142036 !important; color: #38bdf8 !important; font-weight: 800; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.6px; padding: 7px 16px !important; border-top: 1px solid rgba(56, 189, 248, 0.25); border-bottom: 1px solid rgba(56, 189, 248, 0.25); border-left: 3px solid #0284c7 !important;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="font-size: 13px;">📁</span>
                          <span>${group.group}</span>
                        </div>
                      </td>
                    </tr>
                    ${group.modules.map(mod => {
                      const modPerms = currentPerms[mod.id] || [];
                      const hasRead = modPerms.includes('VIEW') || modPerms.includes('READ');
                      const hasAdd = modPerms.includes('ADD');
                      const hasEdit = modPerms.includes('EDIT');
                      const hasDelete = modPerms.includes('DELETE');
                      const hasImport = modPerms.includes('IMPORT');
                      const hasExport = modPerms.includes('EXPORT');
                      const hasApprove = modPerms.includes('APPROVE');

                      const supportsAdd = mod.actions.includes('ADD');
                      const supportsEdit = mod.actions.includes('EDIT');
                      const supportsDelete = mod.actions.includes('DELETE');
                      const supportsImport = mod.actions.includes('IMPORT');
                      const supportsExport = mod.actions.includes('EXPORT');
                      const supportsApprove = mod.actions.includes('APPROVE');

                      return `
                        <tr class="module-row" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); background: transparent;">
                          <td style="font-weight: 600; font-size: 12px; color: #f8fafc; padding: 7px 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mod.name}">
                            ${mod.name}
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            <input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="VIEW" ${hasRead ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #10b981;" />
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            ${supportsAdd ? `<input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="ADD" ${hasAdd ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #0284c7;" />` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            ${supportsEdit ? `<input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="EDIT" ${hasEdit ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #f59e0b;" />` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            ${supportsDelete ? `<input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="DELETE" ${hasDelete ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #ef4444;" />` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            ${supportsImport ? `<input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="IMPORT" ${hasImport ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #a855f7;" />` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            ${supportsExport ? `<input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="EXPORT" ${hasExport ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #6366f1;" />` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 5px 2px;">
                            ${supportsApprove ? `<input type="checkbox" class="chk-perm-action" data-module="${mod.id}" data-action="APPROVE" ${hasApprove ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer; accent-color: #ec4899;" />` : '<span style="color: var(--text-muted); opacity: 0.25; font-weight: 600;">—</span>'}
                          </td>
                          <td style="text-align: center; padding: 5px 4px;">
                            <button type="button" class="btn btn-ghost btn-xs btn-perm-toggle-row" data-module="${mod.id}" title="Toggle all for ${mod.name}" style="font-size: 10px; padding: 2px 6px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px; background: rgba(56, 189, 248, 0.05);">
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

          <!-- TAB 2: LOCATION SCOPE -->
          <div id="preset-tab-panel-scope" style="display: ${activeModalTab === 'LOCATION_SCOPE' ? 'flex' : 'none'}; flex-direction: column; flex: 1; min-height: 0;">
            <div style="padding: 16px 24px; overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px;">
              <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 18px;">
                <div style="font-weight: 700; font-size: 13px; color: #fff; margin-bottom: 10px;">
                  Default Location Scope Policy:
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <label id="scope-mode-all-card" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; color: #fff; background: ${currentScope.allGroups ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.4)'}; border: 1.5px solid ${currentScope.allGroups ? '#38bdf8' : 'var(--border-color)'}; padding: 12px 16px; border-radius: var(--radius-md);">
                    <input type="radio" name="scope-mode" id="scope-mode-all" value="GLOBAL" ${currentScope.allGroups ? 'checked' : ''} style="cursor: pointer; accent-color: #0284c7; margin-top: 3px;" />
                    <div>
                      <div style="font-weight: 700; font-size: 13px; color: #38bdf8;">🌐 Unrestricted Global Access</div>
                      <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">Default access across all factory units, floors, and lines.</div>
                    </div>
                  </label>

                  <label id="scope-mode-restricted-card" style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; color: #fff; background: ${!currentScope.allGroups ? 'rgba(234, 179, 8, 0.15)' : 'rgba(15, 23, 42, 0.4)'}; border: 1.5px solid ${!currentScope.allGroups ? '#facc15' : 'var(--border-color)'}; padding: 12px 16px; border-radius: var(--radius-md);">
                    <input type="radio" name="scope-mode" id="scope-mode-restricted" value="RESTRICTED" ${!currentScope.allGroups ? 'checked' : ''} style="cursor: pointer; accent-color: #facc15; margin-top: 3px;" />
                    <div>
                      <div style="font-weight: 700; font-size: 13px; color: #facc15;">📍 Restricted Factory Scope</div>
                      <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">Restricted strictly to selected Units, Floors, or Lines.</div>
                    </div>
                  </label>
                </div>
              </div>

              <!-- 3-Panel Granular Selection Area (Visible when restricted) -->
              <div id="scope-granular-panels" style="display: ${currentScope.allGroups ? 'none' : 'grid'}; grid-template-columns: 1fr 1fr 1fr; gap: 14px; flex: 1; min-height: 280px;">
                <!-- Panel 1: Units -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                  <div style="padding: 10px 14px; background: rgba(2, 132, 199, 0.15); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #38bdf8;">🏭 Units (${allUnits.length})</div>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" id="btn-scope-all-units" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #38bdf8;">All</button>
                      <button type="button" id="btn-scope-clear-units" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: var(--text-muted);">Clear</button>
                    </div>
                  </div>
                  <div id="scope-units-scroll-list" style="padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    ${allUnits.map(unt => {
                      const isChecked = selectedUnitIds.includes(unt.id);
                      return `
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.3)' : 'transparent'};">
                          <input type="checkbox" class="chk-scope-unit" data-id="${unt.id}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer; accent-color: #0284c7;" />
                          <span style="font-weight: 600;">${unt.name}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Panel 2: Floors -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                  <div style="padding: 10px 14px; background: rgba(2, 132, 199, 0.15); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #38bdf8;">🏢 Floors (<span id="scope-floors-count">${availableFloors.length}</span>)</div>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" id="btn-scope-all-floors" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #38bdf8;">All</button>
                      <button type="button" id="btn-scope-clear-floors" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: var(--text-muted);">Clear</button>
                    </div>
                  </div>
                  <div id="scope-floors-scroll-list" style="padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    ${allFloors.map(flr => {
                      const isChecked = selectedFloorIds.includes(flr.id);
                      const isVisible = selectedUnitIds.length === 0 || selectedUnitIds.includes(flr.unitId);
                      return `
                        <label class="scope-floor-item" data-id="${flr.id}" data-unit="${flr.unitId}" style="display: ${isVisible ? 'flex' : 'none'}; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.3)' : 'transparent'};">
                          <input type="checkbox" class="chk-scope-floor" data-id="${flr.id}" data-unit="${flr.unitId}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer; accent-color: #0284c7;" />
                          <span style="font-weight: 600;">${flr.name}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- Panel 3: Lines -->
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden;">
                  <div style="padding: 10px 14px; background: rgba(2, 132, 199, 0.15); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #38bdf8;">🧵 Lines (<span id="scope-lines-count">${availableLines.length}</span>)</div>
                    <div style="display: flex; gap: 6px;">
                      <button type="button" id="btn-scope-all-lines" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #38bdf8;">All</button>
                      <button type="button" id="btn-scope-clear-lines" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: var(--text-muted);">Clear</button>
                    </div>
                  </div>
                  <div id="scope-lines-scroll-list" style="padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    ${allLines.map(lin => {
                      const isChecked = selectedLineIds.includes(lin.id);
                      const parentFloor = allFloors.find(f => f.id === lin.floorId);
                      const parentUnitId = parentFloor ? parentFloor.unitId : '';
                      const isVisible = selectedFloorIds.length > 0 ? selectedFloorIds.includes(lin.floorId) : (selectedUnitIds.length === 0 || selectedUnitIds.includes(parentUnitId));
                      return `
                        <label class="scope-line-item" data-id="${lin.id}" data-floor="${lin.floorId}" data-unit="${parentUnitId}" style="display: ${isVisible ? 'flex' : 'none'}; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer; padding: 6px 8px; border-radius: var(--radius-sm); background: ${isChecked ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.3)' : 'transparent'};">
                          <input type="checkbox" class="chk-scope-line" data-id="${lin.id}" data-floor="${lin.floorId}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer; accent-color: #0284c7;" />
                          <span style="font-weight: 600;">${lin.name}</span>
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Batch Update Checkbox (If editing existing preset with users) -->
          ${targetPreset && assignedUsers.length > 0 ? `
            <div style="background: rgba(2, 132, 199, 0.12); border-top: 1px solid rgba(56, 189, 248, 0.3); padding: 12px 24px; display: flex; align-items: flex-start; gap: 12px; flex-shrink: 0;">
              <input type="checkbox" id="preset-apply-to-assigned-users" checked style="width: 18px; height: 18px; accent-color: #0284c7; cursor: pointer; margin-top: 2px;" />
              <div>
                <label for="preset-apply-to-assigned-users" style="font-weight: 800; font-size: 12.5px; color: #38bdf8; cursor: pointer;">
                  Apply Changes to Assigned Users (${assignedUsers.length} user account(s) currently linked)
                </label>
                <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">
                  Automatically synchronize and update permissions and location scopes for all user accounts linked to this preset profile.
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Footer Actions -->
          <div style="background: var(--bg-surface); padding: 12px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
            <button type="button" id="btn-cancel-modal" class="btn btn-secondary" style="font-weight: 600;">Cancel</button>
            <button type="button" id="btn-save-preset-settings" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 24px;">
              💾 Save Permission Preset
            </button>
          </div>

        </div>
      </div>
    `;
  }

  // 5. ASSIGN USERS TO PRESET MODAL
  if (activeModalType === 'ASSIGN_USERS_TO_PRESET' && targetPreset) {
    const allUsers = authService.getAllUsers();
    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 620px; max-width: 95vw; max-height: 88vh; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
          
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">👥</span>
              <div>
                <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
                  Assign Users to Preset: ${targetPreset.name}
                </h2>
                <div style="font-size: 11.5px; color: #e0f2fe;">
                  Select users who should receive this permission profile
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <!-- Quick Actions & Options -->
          <div style="padding: 12px 20px; background: rgba(15, 23, 42, 0.7); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; flex-shrink: 0;">
            <div style="display: flex; gap: 8px;">
              <button type="button" id="btn-assign-modal-select-all" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #38bdf8;">Select All</button>
              <button type="button" id="btn-assign-modal-deselect-all" class="btn btn-secondary btn-xs" style="font-weight: 700; color: var(--text-muted);">Deselect All</button>
            </div>

            <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #fff; cursor: pointer;">
              <input type="checkbox" id="chk-sync-scope-to-users" checked style="accent-color: #0284c7; width: 15px; height: 15px;" />
              <span>Apply default factory location scope</span>
            </label>
          </div>

          <!-- User Checkbox List -->
          <div style="padding: 14px 20px; overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px;">
            ${allUsers.map(u => {
              const isCurrentlyAssigned = (u.presetId === targetPreset.id || u.presetId === targetPreset.code);
              const isChecked = selectedUserIdsForPreset.includes(u.id);
              const isSuper = (u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin';

              return `
                <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: ${isChecked ? 'rgba(56, 189, 248, 0.1)' : 'rgba(15, 23, 42, 0.4)'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.35)' : 'var(--border-color)'}; border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s ease;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input 
                      type="checkbox" 
                      class="chk-assign-user-item" 
                      data-id="${u.id}" 
                      ${isChecked ? 'checked' : ''} 
                      style="width: 17px; height: 17px; accent-color: #0284c7; cursor: pointer;" 
                    />
                    <div class="user-avatar-circle" style="width: 32px; height: 32px; font-size: 12px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                      ${u.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div style="font-weight: 700; color: #fff; font-size: 13px;">${u.name}</div>
                      <div style="font-size: 11px; color: var(--text-muted); display: flex; gap: 6px;">
                        <span style="color: #38bdf8;">@${u.username}</span>
                        <span>&bull;</span>
                        <span>${u.email}</span>
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge" style="font-size: 10px; padding: 2px 7px; background: rgba(148, 163, 184, 0.15); color: #cbd5e1;">
                      Current: ${u.presetName || (isSuper ? 'Super Admin' : 'Custom')}
                    </span>
                    ${isCurrentlyAssigned ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 9.5px; font-weight: 700;">ASSIGNED</span>' : ''}
                  </div>
                </label>
              `;
            }).join('')}
          </div>

          <!-- Footer -->
          <div style="background: var(--bg-surface); padding: 12px 22px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="font-size: 12px; color: var(--text-secondary);">
              <strong style="color: #38bdf8;" id="assign-selected-count">${selectedUserIdsForPreset.length}</strong> user(s) selected
            </div>
            <div style="display: flex; gap: 10px;">
              <button type="button" id="btn-cancel-modal" class="btn btn-secondary btn-sm" style="font-weight: 600;">Cancel</button>
              <button type="button" id="btn-confirm-assign-users" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 20px;">
                👥 Apply &amp; Assign Users
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // 6. 1-CLICK ASSIGN PRESET TO INDIVIDUAL USER MODAL
  if (activeModalType === 'USER_QUICK_PRESET' && targetUser) {
    const allPresets = authService.getAllPresets();
    const currentPresetId = targetUser.presetId || (
      ((targetUser.role || '').toUpperCase() === 'SUPER_ADMIN' || targetUser.username === 'superadmin') ? 'preset_super_admin' :
      ((targetUser.role || '').toUpperCase() === 'ADMIN' ? 'preset_admin' : 'preset_maintenance_user')
    );

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 540px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7); overflow: hidden;">
          
          <div style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">🛡️</span>
              <div>
                <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
                  Assign Preset: ${targetUser.name}
                </h2>
                <div style="font-size: 11.5px; color: #e0f2fe;">
                  @${targetUser.username} &bull; Current Profile: <strong>${targetUser.presetName || 'Custom'}</strong>
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 18px; padding: 2px 6px;">✕</button>
          </div>

          <div style="padding: 16px 22px; overflow-y: auto; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">
              Select a standardized permission preset to immediately apply all permissions and access levels to this account:
            </div>

            ${allPresets.map(p => {
              const isSelected = p.id === currentPresetId || p.code === currentPresetId;
              const isGlobal = !p.scope || p.scope.allGroups;

              return `
                <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: ${isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.4)'}; border: 1.5px solid ${isSelected ? 'rgba(56, 189, 248, 0.5)' : 'var(--border-color)'}; border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s ease;">
                  <input 
                    type="radio" 
                    name="quick-preset-choice" 
                    value="${p.id}" 
                    ${isSelected ? 'checked' : ''} 
                    style="accent-color: #0284c7; width: 17px; height: 17px; margin-top: 3px; cursor: pointer;" 
                  />
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                      <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; color: #fff; font-size: 13.5px;">
                        <span>${p.icon || '🛡️'}</span>
                        <span>${p.name}</span>
                      </div>
                      <span class="badge" style="font-size: 10px; padding: 2px 7px; background: ${p.badgeColor ? p.badgeColor + '20' : 'rgba(56, 189, 248, 0.15)'}; color: ${p.badgeColor || '#38bdf8'}; border: 1px solid ${p.badgeColor ? p.badgeColor + '40' : 'rgba(56, 189, 248, 0.3)'};">
                        ${p.accessLevel || 'Access Level'}
                      </span>
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px;">
                      ${p.description || ''}
                    </div>
                    <div style="font-size: 11px; color: #38bdf8; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                      <span>Scope:</span>
                      <span>${isGlobal ? '🌐 All Factory Locations' : '📍 Selected Plant Units / Lines'}</span>
                    </div>
                  </div>
                </label>
              `;
            }).join('')}

            <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: ${targetUser.presetId === 'CUSTOM' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.4)'}; border: 1.5px solid ${targetUser.presetId === 'CUSTOM' ? 'rgba(56, 189, 248, 0.5)' : 'var(--border-color)'}; border-radius: var(--radius-md); cursor: pointer;">
              <input 
                type="radio" 
                name="quick-preset-choice" 
                value="CUSTOM" 
                ${targetUser.presetId === 'CUSTOM' ? 'checked' : ''} 
                style="accent-color: #0284c7; width: 17px; height: 17px; margin-top: 3px; cursor: pointer;" 
              />
              <div style="flex: 1;">
                <div style="font-weight: 800; color: #fff; font-size: 13.5px;">👤 Custom User</div>
                <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                  Individual permission matrix without linking to a preset profile.
                </div>
              </div>
            </label>

            <div style="padding-top: 6px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #fff; cursor: pointer;">
                <input type="checkbox" id="chk-quick-preset-sync-scope" checked style="accent-color: #0284c7; width: 16px; height: 16px;" />
                <span>Also synchronize and apply preset default factory location scope</span>
              </label>
            </div>
          </div>

          <div style="background: var(--bg-surface); padding: 12px 22px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
            <button type="button" id="btn-cancel-modal" class="btn btn-secondary btn-sm" style="font-weight: 600;">Cancel</button>
            <button type="button" id="btn-confirm-quick-preset" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 20px;">
              ⚡ Assign Preset Now
            </button>
          </div>

        </div>
      </div>
    `;
  }

  return '';
}

export function initUserManagementEvents() {
  const refreshView = () => {
    const view = document.getElementById('main-view-container');
    if (!view) return;

    // 1. Capture exact scroll positions of main container, page, and table
    const containerY = view.scrollTop;
    const containerX = view.scrollLeft;
    const pageView = view.querySelector('.page-view');
    const pageViewY = pageView ? pageView.scrollTop : 0;
    const pageViewX = pageView ? pageView.scrollLeft : 0;
    const tableContainer = view.querySelector('.table-responsive, .user-table-container');
    const tableY = tableContainer ? tableContainer.scrollTop : 0;
    const tableX = tableContainer ? tableContainer.scrollLeft : 0;
    const winY = window.scrollY || document.documentElement.scrollTop || 0;
    const winX = window.scrollX || document.documentElement.scrollLeft || 0;

    // Capture modal scroll positions if a modal is open
    const modalWrap = view.querySelector('.modal-card, .modal-dialog, .modal-body');
    const modalY = modalWrap ? modalWrap.scrollTop : 0;
    const modalX = modalWrap ? modalWrap.scrollLeft : 0;

    const matrixScroll = view.querySelector('.permissions-matrix-scroll-wrap');
    const matrixY = matrixScroll ? matrixScroll.scrollTop : 0;

    const unitsScroll = view.querySelector('#scope-units-scroll-list');
    const unitsY = unitsScroll ? unitsScroll.scrollTop : 0;

    const floorsScroll = view.querySelector('#scope-floors-scroll-list');
    const floorsY = floorsScroll ? floorsScroll.scrollTop : 0;

    const linesScroll = view.querySelector('#scope-lines-scroll-list');
    const linesY = linesScroll ? linesScroll.scrollTop : 0;

    // Capture all elements with scrollable overflow inside modal
    const extraScrolls = [];
    view.querySelectorAll('.modal-overlay *').forEach((el, idx) => {
      if (el.scrollTop > 0 || el.scrollLeft > 0) {
        extraScrolls.push({
          id: el.id || null,
          index: idx,
          scrollTop: el.scrollTop,
          scrollLeft: el.scrollLeft
        });
      }
    });

    const activeEl = document.activeElement;
    const focusedId = activeEl && activeEl.id ? activeEl.id : null;
    const selectionStart = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;
    const selectionEnd = activeEl && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null;

    // 2. Perform DOM Update
    view.innerHTML = renderUserManagement();
    initUserManagementEvents();

    // 3. Immediately and synchronously restore scroll positions
    const restore = () => {
      view.scrollTop = containerY;
      view.scrollLeft = containerX;

      const newPv = view.querySelector('.page-view');
      if (newPv) {
        newPv.scrollTop = pageViewY;
        newPv.scrollLeft = pageViewX;
      }

      const newTc = view.querySelector('.table-responsive, .user-table-container');
      if (newTc) {
        newTc.scrollTop = tableY;
        newTc.scrollLeft = tableX;
      }

      if (winY > 0 || winX > 0) {
        window.scrollTo({ top: winY, left: winX, behavior: 'instant' });
      }

      const newModalWrap = view.querySelector('.modal-card, .modal-dialog, .modal-body');
      if (newModalWrap && modalY > 0) {
        newModalWrap.scrollTop = modalY;
        newModalWrap.scrollLeft = modalX;
      }

      const newMatrix = view.querySelector('.permissions-matrix-scroll-wrap');
      if (newMatrix && matrixY > 0) {
        newMatrix.scrollTop = matrixY;
      }

      const newUnits = view.querySelector('#scope-units-scroll-list');
      if (newUnits && unitsY > 0) newUnits.scrollTop = unitsY;

      const newFloors = view.querySelector('#scope-floors-scroll-list');
      if (newFloors && floorsY > 0) newFloors.scrollTop = floorsY;

      const newLines = view.querySelector('#scope-lines-scroll-list');
      if (newLines && linesY > 0) newLines.scrollTop = linesY;

      if (extraScrolls.length > 0) {
        const modalEls = view.querySelectorAll('.modal-overlay *');
        extraScrolls.forEach(s => {
          if (s.id) {
            const el = document.getElementById(s.id);
            if (el) {
              el.scrollTop = s.scrollTop;
              el.scrollLeft = s.scrollLeft;
            }
          } else if (modalEls[s.index]) {
            modalEls[s.index].scrollTop = s.scrollTop;
            modalEls[s.index].scrollLeft = s.scrollLeft;
          }
        });
      }

      if (focusedId) {
        const el = document.getElementById(focusedId);
        if (el && typeof el.focus === 'function' && document.activeElement !== el) {
          try {
            el.focus({ preventScroll: true });
            if (typeof selectionStart === 'number' && typeof selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
              el.setSelectionRange(selectionStart, selectionEnd);
            }
          } catch (_) {}
        }
      }
    };

    restore();
    requestAnimationFrame(restore);
  };

  let bindUserModalEvents = null;

  const updateUserModalLayer = () => {
    let modalLayer = document.getElementById('user-modal-layer');
    if (!modalLayer) {
      const view = document.getElementById('main-view-container');
      if (view) {
        modalLayer = document.createElement('div');
        modalLayer.id = 'user-modal-layer';
        view.appendChild(modalLayer);
      }
    }
    if (modalLayer) {
      // 1. Capture exact background scroll positions
      const view = document.getElementById('main-view-container');
      const containerY = view ? view.scrollTop : 0;
      const containerX = view ? view.scrollLeft : 0;
      const pageView = view ? view.querySelector('.page-view') : null;
      const pageViewY = pageView ? pageView.scrollTop : 0;
      const pageViewX = pageView ? pageView.scrollLeft : 0;
      const tableContainer = view ? view.querySelector('.table-responsive, .user-table-container') : null;
      const tableY = tableContainer ? tableContainer.scrollTop : 0;
      const tableX = tableContainer ? tableContainer.scrollLeft : 0;
      const winY = window.scrollY || document.documentElement.scrollTop || 0;
      const winX = window.scrollX || document.documentElement.scrollLeft || 0;

      // Capture inner modal scroll positions before updating
      const modalWrap = modalLayer.querySelector('.modal-card, .modal-dialog, .modal-body');
      const modalY = modalWrap ? modalWrap.scrollTop : 0;
      const modalX = modalWrap ? modalWrap.scrollLeft : 0;
      const matrixEl = modalLayer.querySelector('.permissions-matrix-scroll-wrap');
      const matrixY = matrixEl ? matrixEl.scrollTop : 0;
      const unitsEl = modalLayer.querySelector('#scope-units-scroll-list');
      const unitsY = unitsEl ? unitsEl.scrollTop : 0;
      const floorsEl = modalLayer.querySelector('#scope-floors-scroll-list');
      const floorsY = floorsEl ? floorsEl.scrollTop : 0;
      const linesEl = modalLayer.querySelector('#scope-lines-scroll-list');
      const linesY = linesEl ? linesEl.scrollTop : 0;

      modalLayer.innerHTML = renderActiveModalHtml();
      if (typeof bindUserModalEvents === 'function') {
        bindUserModalEvents();
      }

      // Restore background scroll positions immediately and in rAF
      const restoreAll = () => {
        if (view) {
          view.scrollTop = containerY;
          view.scrollLeft = containerX;
        }
        if (pageView) {
          pageView.scrollTop = pageViewY;
          pageView.scrollLeft = pageViewX;
        }
        if (tableContainer) {
          tableContainer.scrollTop = tableY;
          tableContainer.scrollLeft = tableX;
        }
        if (winY > 0 || winX > 0) {
          window.scrollTo({ top: winY, left: winX, behavior: 'instant' });
        }
        // Restore inner modal scroll positions
        const newModalWrap = modalLayer.querySelector('.modal-card, .modal-dialog, .modal-body');
        if (newModalWrap && modalY > 0) {
          newModalWrap.scrollTop = modalY;
          newModalWrap.scrollLeft = modalX;
        }
        const newMatrix = modalLayer.querySelector('.permissions-matrix-scroll-wrap');
        if (newMatrix && matrixY > 0) newMatrix.scrollTop = matrixY;
        const newUnits = modalLayer.querySelector('#scope-units-scroll-list');
        if (newUnits && unitsY > 0) newUnits.scrollTop = unitsY;
        const newFloors = modalLayer.querySelector('#scope-floors-scroll-list');
        if (newFloors && floorsY > 0) newFloors.scrollTop = floorsY;
        const newLines = modalLayer.querySelector('#scope-lines-scroll-list');
        if (newLines && linesY > 0) newLines.scrollTop = linesY;
      };

      restoreAll();
      requestAnimationFrame(restoreAll);
    }
  };

  const closeModal = (shouldRefreshTable = false) => {
    activeModalType = null;
    targetUser = null;
    targetPreset = null;
    editingPermissions = {};
    selectedUserIdsForPreset = [];
    if (shouldRefreshTable) {
      refreshView();
    } else {
      updateUserModalLayer();
    }
  };
  // 1. Search filter
  const searchInp = document.getElementById('user-search-input');
  if (searchInp) {
    searchInp.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      refreshView();
    });
  }

  const btnClearUserSearch = document.getElementById('btn-clear-user-search');
  if (btnClearUserSearch) {
    btnClearUserSearch.addEventListener('click', () => {
      searchQuery = '';
      refreshView();
    });
  }

  // 1b. Preset profile filter
  const presetSelect = document.getElementById('user-preset-filter');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      presetFilter = e.target.value;
      refreshView();
    });
  }

  // 2. Role filter
  const roleSelect = document.getElementById('user-role-filter');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      roleFilter = e.target.value;
      refreshView();
    });
  }

  // 3. Status filter
  const statusSelect = document.getElementById('user-status-filter');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      refreshView();
    });
  }

  // 4. Open Add User Modal (In-place, Zero-Jump)
  const btnOpenAdd = document.getElementById('btn-open-add-user-modal');
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      activeModalType = 'ADD_USER';
      targetUser = null;
      updateUserModalLayer();
    });
  }

  // 4b. Open Create Preset Modal (In-place, Zero-Jump)
  const handleOpenCreatePreset = (e) => {
    e.stopPropagation();
    activeModalType = 'CREATE_EDIT_PRESET';
    targetPreset = null;
    activeModalTab = 'PERMISSIONS';
    editingPermissions = {};
    PERMISSION_CONFIG_MODULES.forEach(grp => {
      grp.modules.forEach(m => {
        editingPermissions[m.id] = ['VIEW'];
      });
    });
    editingScope = { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] };
    applyToAssignedUsers = true;
    updateUserModalLayer();
  };

  const btnCreatePreset = document.getElementById('btn-open-create-preset-modal');
  if (btnCreatePreset) btnCreatePreset.addEventListener('click', handleOpenCreatePreset);

  const btnCreatePresetTop = document.getElementById('btn-open-create-preset-modal-top');
  if (btnCreatePresetTop) btnCreatePresetTop.addEventListener('click', handleOpenCreatePreset);

  // Navigation Tabs: User Accounts vs Permission Presets & Profiles
  const tabBtnUsers = document.getElementById('tab-btn-users');
  if (tabBtnUsers) {
    tabBtnUsers.addEventListener('click', () => {
      activeUserSection = 'USERS';
      if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_mgmt_section', 'USERS');
      refreshView();
    });
  }

  const tabBtnPresets = document.getElementById('tab-btn-presets');
  if (tabBtnPresets) {
    tabBtnPresets.addEventListener('click', () => {
      activeUserSection = 'PRESETS';
      if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_mgmt_section', 'PRESETS');
      refreshView();
    });
  }

  const linkJumpPresets = document.getElementById('link-jump-to-presets');
  if (linkJumpPresets) {
    linkJumpPresets.addEventListener('click', () => {
      activeUserSection = 'PRESETS';
      if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_mgmt_section', 'PRESETS');
      refreshView();
    });
  }

  const btnGotoPresets = document.getElementById('btn-goto-presets-mgmt');
  if (btnGotoPresets) {
    btnGotoPresets.addEventListener('click', () => {
      activeUserSection = 'PRESETS';
      if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_mgmt_section', 'PRESETS');
      refreshView();
    });
  }

  const linkJumpUsers = document.getElementById('link-jump-to-users');
  if (linkJumpUsers) {
    linkJumpUsers.addEventListener('click', () => {
      activeUserSection = 'USERS';
      if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_mgmt_section', 'USERS');
      refreshView();
    });
  }

  // Quick Preset Filter Pills
  document.querySelectorAll('.btn-pill-filter-preset').forEach(pill => {
    pill.addEventListener('click', () => {
      const pid = pill.getAttribute('data-id');
      if (pid === 'ALL' || presetFilter === pid) {
        presetFilter = 'ALL';
      } else {
        presetFilter = pid;
      }
      refreshView();
    });
  });

  // Reset Filters Button
  const btnClearFilters = document.getElementById('btn-clear-user-filters');
  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      searchQuery = '';
      roleFilter = 'ALL';
      statusFilter = 'ALL';
      presetFilter = 'ALL';
      refreshView();
    });
  }

  // Preset View Mode Switchers (Cards vs Table)
  const btnViewCards = document.getElementById('btn-preset-view-cards');
  if (btnViewCards) {
    btnViewCards.addEventListener('click', () => {
      presetViewMode = 'CARDS';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('al_muslim_preset_view_mode', 'CARDS');
      }
      refreshView();
    });
  }

  const btnViewTable = document.getElementById('btn-preset-view-table');
  if (btnViewTable) {
    btnViewTable.addEventListener('click', () => {
      presetViewMode = 'TABLE';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('al_muslim_preset_view_mode', 'TABLE');
      }
      refreshView();
    });
  }

  // Reset to Factory Default Presets Handlers
  const handleResetDefaultPresets = async () => {
    if (confirm('Are you sure you want to restore factory default permission presets?')) {
      try {
        await authService.resetToDefaultPresets();
        notificationService.success('Factory default permission presets restored successfully!');
        refreshView();
      } catch (err) {
        notificationService.error('Failed to reset presets: ' + err.message);
      }
    }
  };

  const btnResetPresets = document.getElementById('btn-reset-default-presets');
  if (btnResetPresets) btnResetPresets.addEventListener('click', handleResetDefaultPresets);

  const btnResetPresetsTop = document.getElementById('btn-reset-default-presets-top');
  if (btnResetPresetsTop) btnResetPresetsTop.addEventListener('click', handleResetDefaultPresets);

  // Card filter chip click to filter user table and switch to User Accounts
  document.querySelectorAll('.btn-card-filter-preset').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = chip.getAttribute('data-id');
      presetFilter = id;
      activeUserSection = 'USERS';
      if (typeof localStorage !== 'undefined') localStorage.setItem('al_muslim_user_mgmt_section', 'USERS');
      refreshView();
    });
  });

  // 5. Open Edit User Modal (In-place, Zero-Jump)
  document.querySelectorAll('.btn-action-edit-user').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const user = authService.getUserById(id);
      if (user) {
        activeModalType = 'EDIT_USER';
        targetUser = user;
        updateUserModalLayer();
      }
    });
  });

  // 6. Open Individual Permissions Modal (In-place, Zero-Jump)
  document.querySelectorAll('.btn-action-user-perms').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const user = authService.getUserById(id);
      if (user) {
        activeModalType = 'USER_PERMISSIONS';
        activeModalTab = 'PERMISSIONS';
        targetUser = user;
        editingPermissions = JSON.parse(JSON.stringify(user.permissions || {}));
        editingScope = JSON.parse(JSON.stringify(user.assignedScope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] }));
        updateUserModalLayer();
      }
    });
  });

  // 6b. Open Location Scope Modal (In-place, Zero-Jump)
  document.querySelectorAll('.btn-action-user-scope').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const user = authService.getUserById(id);
      if (user) {
        activeModalType = 'USER_PERMISSIONS';
        activeModalTab = 'LOCATION_SCOPE';
        targetUser = user;
        editingPermissions = JSON.parse(JSON.stringify(user.permissions || {}));
        editingScope = JSON.parse(JSON.stringify(user.assignedScope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] }));
        updateUserModalLayer();
      }
    });
  });

  // 6c. Open 1-Click Quick Preset Assignment Modal for User (In-place, Zero-Jump)
  document.querySelectorAll('.btn-action-user-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const user = authService.getUserById(id);
      if (user) {
        activeModalType = 'USER_QUICK_PRESET';
        targetUser = user;
        syncScopeOnPresetAssign = true;
        updateUserModalLayer();
      }
    });
  });

  // 6d. Edit Preset Profile (In-place, Zero-Jump)
  document.querySelectorAll('.btn-preset-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const preset = authService.getPresetById(id);
      if (preset) {
        activeModalType = 'CREATE_EDIT_PRESET';
        targetPreset = preset;
        activeModalTab = 'PERMISSIONS';
        editingPermissions = JSON.parse(JSON.stringify(preset.permissions || {}));
        editingScope = JSON.parse(JSON.stringify(preset.scope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] }));
        applyToAssignedUsers = true;
        updateUserModalLayer();
      }
    });
  });

  // 6e. Quick Assign Users to Preset (In-place, Zero-Jump)
  document.querySelectorAll('.btn-preset-quick-assign').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const preset = authService.getPresetById(id);
      if (preset) {
        activeModalType = 'ASSIGN_USERS_TO_PRESET';
        targetPreset = preset;
        const allUsers = authService.getAllUsers();
        selectedUserIdsForPreset = allUsers
          .filter(u => u.presetId === preset.id || u.presetId === preset.code ||
            (!u.presetId && preset.code === 'SUPER_ADMIN' && ((u.role || '').toUpperCase() === 'SUPER_ADMIN' || u.username === 'superadmin')) ||
            (!u.presetId && preset.code === 'ADMIN' && (u.role || '').toUpperCase() === 'ADMIN' && u.username !== 'superadmin') ||
            (!u.presetId && preset.code === 'MAINTENANCE_USER' && (u.role || '').toUpperCase() === 'USER'))
          .map(u => u.id);
        syncScopeOnPresetAssign = true;
        updateUserModalLayer();
      }
    });
  });

  // 6f. Duplicate Preset Profile
  document.querySelectorAll('.btn-preset-duplicate').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      try {
        const cloned = await authService.duplicatePreset(id);
        notificationService.success(`Created duplicate preset profile "${cloned.name}".`);
        refreshView();
      } catch (err) {
        notificationService.error(err.message);
      }
    });
  });

  // 6g. Delete Custom Preset Profile
  document.querySelectorAll('.btn-preset-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const preset = authService.getPresetById(id);
      if (!preset) return;
      if (preset.isSystem) {
        notificationService.warning(`Cannot delete built-in system preset "${preset.name}".`);
        return;
      }
      const confirmed = await notificationService.confirm({
        title: 'Delete Permission Preset',
        message: `Permanently delete preset profile <strong>${preset.name}</strong>? Any currently assigned users will be converted to Custom Users.`,
        icon: '🗑️',
        confirmText: 'Delete Preset',
        isDestructive: true
      });
      if (confirmed) {
        try {
          await authService.deletePreset(id);
          notificationService.success(`Preset "${preset.name}" has been deleted.`);
          refreshView();
        } catch (err) {
          notificationService.error(err.message);
        }
      }
    });
  });

  // 7. Open Reset Password Modal (In-place, Zero-Jump)
  document.querySelectorAll('.btn-action-reset-pwd').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const user = authService.getUserById(id);
      if (user) {
        activeModalType = 'RESET_PASSWORD';
        targetUser = user;
        updateUserModalLayer();
      }
    });
  });

  // 8. Toggle User Active/Inactive
  document.querySelectorAll('.btn-action-toggle-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      try {
        const newStatus = await authService.toggleUserStatus(id);
        notificationService.success(`User status changed to ${newStatus}`);
        refreshView();
      } catch (err) {
        notificationService.error('Failed to change status: ' + err.message);
      }
    });
  });

  // 9. Delete User
  document.querySelectorAll('.btn-action-delete-user').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const user = authService.getUserById(id);
      if (!user) return;

      const confirmed = await notificationService.confirm({
        title: 'Delete User Account',
        message: `Permanently delete account for <strong>${user.name}</strong> (@${user.username})? This action cannot be undone.`,
        icon: '🗑️',
        confirmText: 'Delete User',
        isDestructive: true
      });

      if (confirmed) {
        try {
          await authService.deleteUser(id);
          notificationService.success(`User '${user.name}' has been deleted.`);
          refreshView();
        } catch (err) {
          notificationService.error(err.message);
        }
      }
    });
  });

  // ==========================================
  // Isolated Modal Event Handlers (In-Place, Zero-Jump)
  // ==========================================
  bindUserModalEvents = () => {
    const modalLayer = document.getElementById('user-modal-layer');
    if (!modalLayer) return;

    // 10. Close Modal Buttons & Overlay Click
    modalLayer.querySelectorAll('#btn-close-modal, #btn-cancel-modal, .btn-cancel-user-modal').forEach(btn => {
      btn.addEventListener('click', () => closeModal(false));
    });
    const overlay = modalLayer.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(false);
      });
    }

    // 10b. Modal Tab Switching (In-place, Zero-Jump, Zero-Reanimation)
    const tabPerms = modalLayer.querySelector('#tab-btn-perms');
    const tabScope = modalLayer.querySelector('#tab-btn-scope');
    const panelPerms = modalLayer.querySelector('#user-tab-panel-perms, #preset-tab-panel-perms');
    const panelScope = modalLayer.querySelector('#user-tab-panel-scope, #preset-tab-panel-scope');

    if (tabPerms) {
      tabPerms.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeModalTab = 'PERMISSIONS';
        if (panelPerms) panelPerms.style.display = 'flex';
        if (panelScope) panelScope.style.display = 'none';
        tabPerms.className = 'btn btn-primary';
        tabPerms.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
        tabPerms.style.color = '#fff';
        if (tabScope) {
          tabScope.className = 'btn btn-ghost';
          tabScope.style.background = 'transparent';
          tabScope.style.color = 'var(--text-secondary)';
        }
      });
    }

    if (tabScope) {
      tabScope.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeModalTab = 'LOCATION_SCOPE';
        if (panelPerms) panelPerms.style.display = 'none';
        if (panelScope) panelScope.style.display = 'flex';
        tabScope.className = 'btn btn-primary';
        tabScope.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
        tabScope.style.color = '#fff';
        if (tabPerms) {
          tabPerms.className = 'btn btn-ghost';
          tabPerms.style.background = 'transparent';
          tabPerms.style.color = 'var(--text-secondary)';
        }
      });
    }

    // 11. Toggle Password Visibility
    const btnToggleAdd = modalLayer.querySelector('#btn-toggle-add-pwd');
    if (btnToggleAdd) {
      btnToggleAdd.addEventListener('click', () => {
        const inp = modalLayer.querySelector('#add-user-password');
        if (inp) {
          inp.type = inp.type === 'password' ? 'text' : 'password';
        }
      });
    }

    const btnToggleReset = modalLayer.querySelector('#btn-toggle-reset-pwd');
    if (btnToggleReset) {
      btnToggleReset.addEventListener('click', () => {
        const inp = modalLayer.querySelector('#reset-new-password');
        if (inp) {
          inp.type = inp.type === 'password' ? 'text' : 'password';
        }
      });
    }

    // 11b. Manpower Employee Card Selection & Auto-Fill for Add User
    const cardInput = modalLayer.querySelector('#add-user-emp-card-input');
    const cardSelect = modalLayer.querySelector('#add-user-emp-card-select');
    const btnClearCard = modalLayer.querySelector('#btn-clear-emp-card');
    const previewBox = modalLayer.querySelector('#manpower-assigned-preview');
    const btnGenPass = modalLayer.querySelector('#btn-generate-add-password');

    const activeEmployees = (typeof employeeService !== 'undefined' ? employeeService.getAllEmployees({ status: 'ACTIVE' }) : (storage.getTable(TABLE_NAMES.EMPLOYEES) || []))
      .filter(e => e && e.status !== 'INACTIVE' && e.status !== 'TERMINATED');

    const handleSelectEmployee = (emp) => {
      if (!emp) return;
      const cleanCard = String(emp.cardNumber || '').trim();
      const cleanName = (emp.name || '').trim();

      // 1. Autofill Full Name
      const nameInput = modalLayer.querySelector('#add-user-fullname');
      if (nameInput) nameInput.value = cleanName;

      // 2. Autofill Email: corporate email or card@al-muslim.com
      const emailInput = modalLayer.querySelector('#add-user-email');
      if (emailInput) {
        if (emp.email && emp.email.includes('@')) {
          emailInput.value = emp.email.trim();
        } else {
          const cardSlug = cleanCard.toLowerCase().replace(/[^a-z0-9]/g, '');
          emailInput.value = `${cardSlug || 'user'}@al-muslim.com`;
        }
      }

      // 3. Autofill Username: clean card number or slug
      const userInput = modalLayer.querySelector('#add-user-username');
      if (userInput) {
        const userSlug = cleanCard.toLowerCase().replace(/[^a-z0-9_]/g, '');
        userInput.value = userSlug || cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      // 4. Hidden metadata fields
      const hidId = modalLayer.querySelector('#add-user-emp-id');
      if (hidId) hidId.value = cleanCard;
      const hidDept = modalLayer.querySelector('#add-user-emp-dept');
      if (hidDept) hidDept.value = emp.department || '';
      const hidDesig = modalLayer.querySelector('#add-user-emp-desig');
      if (hidDesig) hidDesig.value = emp.designation || '';
      const hidPhone = modalLayer.querySelector('#add-user-emp-phone');
      if (hidPhone) hidPhone.value = emp.phone || '';
      const hidUnit = modalLayer.querySelector('#add-user-emp-unit');
      if (hidUnit) hidUnit.value = emp.unitId || '';

      // 5. Intelligent Preset & Role Auto-Selection
      const desigLower = (emp.designation || '').toLowerCase();
      const deptLower = (emp.department || '').toLowerCase();
      const presetSelect = modalLayer.querySelector('#add-user-preset');
      const roleSelect = modalLayer.querySelector('#add-user-role');

      if (presetSelect) {
        const options = Array.from(presetSelect.options);
        let targetPresetOpt = null;

        if (desigLower.includes('manager') || desigLower.includes('incharge') || desigLower.includes('admin') || deptLower.includes('admin') || desigLower.includes('head')) {
          targetPresetOpt = options.find(o => o.text.includes('Admin') && !o.text.includes('Super'));
          if (roleSelect) roleSelect.value = 'ADMIN';
        } else if (desigLower.includes('lab') || desigLower.includes('ent') || deptLower.includes('lab') || desigLower.includes('electronic')) {
          targetPresetOpt = options.find(o => o.text.includes('ET Lab') || o.text.includes('ENT') || o.value.includes('et_lab'));
          if (roleSelect) roleSelect.value = 'USER';
        } else if (desigLower.includes('store') || deptLower.includes('store')) {
          targetPresetOpt = options.find(o => o.text.includes('Store') || o.value.includes('store'));
          if (roleSelect) roleSelect.value = 'USER';
        } else if (desigLower.includes('qa') || desigLower.includes('quality') || deptLower.includes('quality')) {
          targetPresetOpt = options.find(o => o.text.includes('Quality') || o.text.includes('QA') || o.value.includes('qa'));
          if (roleSelect) roleSelect.value = 'USER';
        } else {
          // Default: Maintenance User profile
          targetPresetOpt = options.find(o => o.text.includes('Maintenance User') || o.value === 'preset_maintenance_user');
          if (roleSelect) roleSelect.value = 'USER';
        }

        if (targetPresetOpt) {
          presetSelect.value = targetPresetOpt.value;
        }
      }

      // 6. Update Live Preview Box
      if (previewBox) {
        previewBox.style.display = 'block';
        const av = previewBox.querySelector('#preview-emp-avatar');
        if (av) av.textContent = (cleanName.charAt(0) || 'M').toUpperCase();
        const nm = previewBox.querySelector('#preview-emp-name');
        if (nm) nm.textContent = cleanName;
        const cd = previewBox.querySelector('#preview-emp-card');
        if (cd) cd.textContent = `Card: ${cleanCard}`;
        const meta = previewBox.querySelector('#preview-emp-meta');
        if (meta) {
          meta.innerHTML = `
            <strong>${emp.designation || 'Staff'}</strong> • ${emp.department || 'Garments Maintenance'}
            ${emp.unitName ? ` • 🏢 <em>${emp.unitName}</em>` : ''}
            ${emp.workingArea ? ` • 📍 ${emp.workingArea}` : ''}
            ${emp.phone ? ` • 📞 ${emp.phone}` : ''}
          `;
        }

        // Check if employee already has an account
        const allUsers = authService.getAllUsers() || [];
        const isRegistered = allUsers.some(u => 
          (u.employeeId && String(u.employeeId).trim().toLowerCase() === cleanCard.toLowerCase()) ||
          (u.username && String(u.username).trim().toLowerCase() === cleanCard.toLowerCase())
        );
        const warnBadge = previewBox.querySelector('#preview-emp-reg-warn');
        if (warnBadge) {
          warnBadge.style.display = isRegistered ? 'inline-block' : 'none';
        }
      }

      // Sync input & select
      if (cardInput && cardInput.value !== cleanCard) cardInput.value = cleanCard;
      if (cardSelect && cardSelect.value !== cleanCard) cardSelect.value = cleanCard;
      if (btnClearCard) btnClearCard.style.display = 'inline-block';

      // Auto-focus on password field
      const pwdInput = modalLayer.querySelector('#add-user-password');
      if (pwdInput && !pwdInput.value) {
        pwdInput.focus();
      }

      notificationService.success(`✅ Loaded Manpower Profile: ${cleanName} (${cleanCard})`);
    };

    if (cardInput) {
      cardInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (!val) {
          if (btnClearCard) btnClearCard.style.display = 'none';
          if (previewBox) previewBox.style.display = 'none';
          return;
        }
        if (btnClearCard) btnClearCard.style.display = 'inline-block';

        const match = activeEmployees.find(emp => 
          String(emp.cardNumber || '').trim().toLowerCase() === val ||
          `${String(emp.cardNumber || '').trim().toLowerCase()} - ${emp.name?.toLowerCase()}`.includes(val)
        );
        if (match) {
          handleSelectEmployee(match);
        }
      });

      cardInput.addEventListener('change', (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (!val) return;
        const match = activeEmployees.find(emp => 
          String(emp.cardNumber || '').trim().toLowerCase() === val ||
          (emp.name && emp.name.toLowerCase() === val) ||
          String(emp.cardNumber || '').trim().toLowerCase().startsWith(val)
        );
        if (match) {
          handleSelectEmployee(match);
        }
      });
    }

    if (cardSelect) {
      cardSelect.addEventListener('change', (e) => {
        const cardVal = e.target.value;
        if (!cardVal) {
          if (btnClearCard) btnClearCard.click();
          return;
        }
        const match = activeEmployees.find(emp => String(emp.cardNumber || '').trim() === cardVal);
        if (match) {
          handleSelectEmployee(match);
        }
      });
    }

    if (btnClearCard) {
      btnClearCard.addEventListener('click', () => {
        if (cardInput) cardInput.value = '';
        if (cardSelect) cardSelect.value = '';
        if (previewBox) previewBox.style.display = 'none';
        btnClearCard.style.display = 'none';
        const hidId = modalLayer.querySelector('#add-user-emp-id');
        if (hidId) hidId.value = '';
        const hidDept = modalLayer.querySelector('#add-user-emp-dept');
        if (hidDept) hidDept.value = '';
        const hidDesig = modalLayer.querySelector('#add-user-emp-desig');
        if (hidDesig) hidDesig.value = '';
        const hidPhone = modalLayer.querySelector('#add-user-emp-phone');
        if (hidPhone) hidPhone.value = '';
        const hidUnit = modalLayer.querySelector('#add-user-emp-unit');
        if (hidUnit) hidUnit.value = '';
      });
    }

    // Auto-Generate Password Button Handler
    if (btnGenPass) {
      btnGenPass.addEventListener('click', () => {
        const hidId = modalLayer.querySelector('#add-user-emp-id')?.value?.trim();
        const cleanCard = (hidId || 'AMG').replace(/[^a-zA-Z0-9]/g, '');
        const autoPass = `${cleanCard}@${Math.floor(1000 + Math.random() * 9000)}`;
        const pwdInput = modalLayer.querySelector('#add-user-password');
        if (pwdInput) {
          pwdInput.value = autoPass;
          pwdInput.type = 'text';
          notificationService.info(`🎲 Password generated: ${autoPass}`);
        }
      });
    }

    // 12. Submit Add User Form
    const formAdd = modalLayer.querySelector('#form-add-new-user');
    if (formAdd) {
      formAdd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = modalLayer.querySelector('#add-user-fullname')?.value?.trim();
        const email = modalLayer.querySelector('#add-user-email')?.value?.trim();
        const username = modalLayer.querySelector('#add-user-username')?.value?.trim();
        const password = modalLayer.querySelector('#add-user-password')?.value;
        const role = modalLayer.querySelector('#add-user-role')?.value || 'USER';
        const status = modalLayer.querySelector('#add-user-status')?.value || 'ACTIVE';
        const presetId = modalLayer.querySelector('#add-user-preset')?.value;
        const employeeId = modalLayer.querySelector('#add-user-emp-id')?.value?.trim() || '';
        const department = modalLayer.querySelector('#add-user-emp-dept')?.value?.trim() || '';
        const designation = modalLayer.querySelector('#add-user-emp-desig')?.value?.trim() || '';
        const phone = modalLayer.querySelector('#add-user-emp-phone')?.value?.trim() || '';

        try {
          const newUser = await authService.createUser({
            name,
            email,
            username,
            password,
            role,
            status,
            presetId,
            employeeId,
            department,
            designation,
            phone
          });
          notificationService.success(`User '${newUser.name}' created successfully with profile [${newUser.presetName}]!`);
          closeModal(true);
        } catch (err) {
          notificationService.error(err.message);
        }
      });
    }

    // 13. Submit Edit User Form
    const formEdit = modalLayer.querySelector('#form-edit-user');
    if (formEdit && targetUser) {
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = modalLayer.querySelector('#edit-user-fullname')?.value?.trim();
        const email = modalLayer.querySelector('#edit-user-email')?.value?.trim();
        const username = modalLayer.querySelector('#edit-user-username')?.value?.trim();
        const role = modalLayer.querySelector('#edit-user-role')?.value || targetUser.role;
        const status = modalLayer.querySelector('#edit-user-status')?.value || targetUser.status;
        const presetId = modalLayer.querySelector('#edit-user-preset')?.value;

        try {
          await authService.updateUser(targetUser.id, {
            name,
            email,
            username,
            role,
            status,
            presetId: presetId || targetUser.presetId
          });
          notificationService.success(`Updated profile for '${name}'.`);
          closeModal(true);
        } catch (err) {
          notificationService.error(err.message);
        }
      });
    }

    // 14. Submit Reset Password Form
    const formReset = modalLayer.querySelector('#form-reset-password');
    if (formReset && targetUser) {
      formReset.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPwd = modalLayer.querySelector('#reset-new-password')?.value;
        const confirmPwd = modalLayer.querySelector('#reset-confirm-password')?.value;
        const sendEmail = modalLayer.querySelector('#chk-send-reset-email')?.checked;

        if (newPwd !== confirmPwd) {
          notificationService.error('Passwords do not match. Please re-enter.');
          return;
        }

        try {
          await authService.updateUser(targetUser.id, { password: newPwd });

          if (sendEmail && targetUser.email && emailService.isEmailConfigured()) {
            try {
              await emailService.sendMail({
                to: targetUser.email,
                subject: 'Al-Muslim ERP: Password Reset Notification',
                html: `<p>Dear ${targetUser.name},</p><p>Your password for Al-Muslim ERP has been reset by the administrator. You can now log in with your updated credentials.</p>`
              });
              notificationService.success('Password reset and confirmation email sent!');
            } catch (mailErr) {
              notificationService.warning('Password reset successfully, but email notification could not be delivered: ' + mailErr.message);
            }
          } else {
            notificationService.success(`Password for '${targetUser.name}' updated successfully!`);
          }

          closeModal(true);
        } catch (err) {
          notificationService.error(err.message);
        }
      });
    }

    // 15. Permission Matrix Checkbox Handlers (7 Actions)
    modalLayer.querySelectorAll('.chk-perm-action').forEach(chk => {
      chk.addEventListener('change', () => {
        const mod = chk.getAttribute('data-module');
        const action = chk.getAttribute('data-action');
        if (!editingPermissions[mod]) editingPermissions[mod] = [];

        if (chk.checked) {
          if (!editingPermissions[mod].includes(action)) {
            editingPermissions[mod].push(action);
          }
          // If enabling any action, also ensure VIEW is enabled
          if (action !== 'VIEW' && !editingPermissions[mod].includes('VIEW')) {
            editingPermissions[mod].push('VIEW');
            const viewChk = modalLayer.querySelector(`.chk-perm-action[data-module="${mod}"][data-action="VIEW"]`);
            if (viewChk) viewChk.checked = true;
          }
        } else {
          editingPermissions[mod] = editingPermissions[mod].filter(a => a !== action);
          // If disabling VIEW, disable all actions for this module
          if (action === 'VIEW') {
            editingPermissions[mod] = [];
            modalLayer.querySelectorAll(`.chk-perm-action[data-module="${mod}"]`).forEach(c => { c.checked = false; });
          }
        }
      });
    });

    // 15b. Column-Header & Master Action Toggle Checkboxes
    ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'].forEach(act => {
      const colToggle = modalLayer.querySelector(`#col-toggle-${act}`);
      const masterToggle = modalLayer.querySelector(`#master-toggle-${act}`);

      const handleActionToggle = (isChecked) => {
        modalLayer.querySelectorAll(`.chk-perm-action[data-action="${act}"]`).forEach(c => {
          c.checked = isChecked;
          const mod = c.getAttribute('data-module');
          if (!editingPermissions[mod]) editingPermissions[mod] = [];
          if (isChecked) {
            if (!editingPermissions[mod].includes(act)) editingPermissions[mod].push(act);
            if (act !== 'VIEW' && !editingPermissions[mod].includes('VIEW')) {
              editingPermissions[mod].push('VIEW');
              const viewChk = modalLayer.querySelector(`.chk-perm-action[data-module="${mod}"][data-action="VIEW"]`);
              if (viewChk) viewChk.checked = true;
            }
          } else {
            editingPermissions[mod] = editingPermissions[mod].filter(a => a !== act);
            if (act === 'VIEW') {
              editingPermissions[mod] = [];
              modalLayer.querySelectorAll(`.chk-perm-action[data-module="${mod}"]`).forEach(sub => { sub.checked = false; });
            }
          }
        });
        if (colToggle) colToggle.checked = isChecked;
        if (masterToggle) masterToggle.checked = isChecked;
      };

      if (colToggle) {
        colToggle.addEventListener('change', (e) => handleActionToggle(e.target.checked));
      }
      if (masterToggle) {
        masterToggle.addEventListener('change', (e) => handleActionToggle(e.target.checked));
      }
    });

    // 16. Row Quick Toggle
    modalLayer.querySelectorAll('.btn-perm-toggle-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mod = btn.getAttribute('data-module');
        const checkboxes = modalLayer.querySelectorAll(`.chk-perm-action[data-module="${mod}"]`);
        const anyUnchecked = Array.from(checkboxes).some(c => !c.checked);

        checkboxes.forEach(c => {
          c.checked = anyUnchecked;
          const act = c.getAttribute('data-action');
          if (!editingPermissions[mod]) editingPermissions[mod] = [];
          if (anyUnchecked) {
            if (!editingPermissions[mod].includes(act)) editingPermissions[mod].push(act);
          } else {
            editingPermissions[mod] = editingPermissions[mod].filter(a => a !== act);
          }
        });
      });
    });

    const syncPermCheckboxes = () => {
      modalLayer.querySelectorAll('.chk-perm-action').forEach(c => {
        const mod = c.getAttribute('data-module');
        const act = c.getAttribute('data-action');
        c.checked = Array.isArray(editingPermissions[mod]) && editingPermissions[mod].includes(act);
      });
      ['VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE'].forEach(act => {
        const list = Array.from(modalLayer.querySelectorAll(`.chk-perm-action[data-action="${act}"]`));
        const allChecked = list.length > 0 && list.every(c => c.checked);
        const col = modalLayer.querySelector(`#col-toggle-${act}`);
        const mas = modalLayer.querySelector(`#master-toggle-${act}`);
        if (col) col.checked = allChecked;
        if (mas) mas.checked = allChecked;
      });
    };

    // 17. Select All Permissions (All 7 Actions)
    const btnSelectAll = modalLayer.querySelector('#btn-perm-select-all');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        editingPermissions = {};
        PERMISSION_CONFIG_MODULES.forEach(grp => {
          grp.modules.forEach(m => {
            editingPermissions[m.id] = [...m.actions];
          });
        });
        syncPermCheckboxes();
      });
    }

    // 18. Clear All Permissions
    const btnClearAll = modalLayer.querySelector('#btn-perm-clear-all');
    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        editingPermissions = {};
        syncPermCheckboxes();
      });
    }

    // 19. Admin Preset Button (Full 7 Actions)
    const btnAdminPreset = modalLayer.querySelector('#btn-perm-preset-admin');
    if (btnAdminPreset) {
      btnAdminPreset.addEventListener('click', () => {
        editingPermissions = {};
        PERMISSION_CONFIG_MODULES.forEach(grp => {
          grp.modules.forEach(m => {
            editingPermissions[m.id] = [...m.actions];
          });
        });
        syncPermCheckboxes();
      });
    }

    // 19b. Approver Preset Button (Read, Export, Approve)
    const btnApproverPreset = modalLayer.querySelector('#btn-perm-preset-approver');
    if (btnApproverPreset) {
      btnApproverPreset.addEventListener('click', () => {
        editingPermissions = {};
        PERMISSION_CONFIG_MODULES.forEach(grp => {
          grp.modules.forEach(m => {
            editingPermissions[m.id] = m.actions.filter(a => ['VIEW', 'READ', 'EXPORT', 'APPROVE'].includes(a));
          });
        });
        syncPermCheckboxes();
      });
    }

    // 19c. Data Operator Preset Button (Read, Add, Edit, Import, Export - No Delete or Approve)
    const btnOperatorPreset = modalLayer.querySelector('#btn-perm-preset-operator');
    if (btnOperatorPreset) {
      btnOperatorPreset.addEventListener('click', () => {
        editingPermissions = {};
        PERMISSION_CONFIG_MODULES.forEach(grp => {
          grp.modules.forEach(m => {
            editingPermissions[m.id] = m.actions.filter(a => ['VIEW', 'READ', 'ADD', 'EDIT', 'IMPORT', 'EXPORT'].includes(a));
          });
        });
        syncPermCheckboxes();
      });
    }

    // 20. View Only Preset Button (Read Only)
    const btnViewOnlyPreset = modalLayer.querySelector('#btn-perm-preset-viewonly');
    if (btnViewOnlyPreset) {
      btnViewOnlyPreset.addEventListener('click', () => {
        editingPermissions = {};
        PERMISSION_CONFIG_MODULES.forEach(grp => {
          grp.modules.forEach(m => {
            editingPermissions[m.id] = ['VIEW'];
          });
        });
        syncPermCheckboxes();
      });
    }

    // 21. Save Permissions Button
    const btnSavePerms = modalLayer.querySelector('#btn-save-user-perms');
    if (btnSavePerms && targetUser) {
      btnSavePerms.addEventListener('click', async () => {
        try {
          const finalPerms = {};
          modalLayer.querySelectorAll('.chk-perm-action').forEach(c => {
            if (c.checked) {
              const mod = c.getAttribute('data-module');
              const act = c.getAttribute('data-action');
              if (!finalPerms[mod]) finalPerms[mod] = [];
              if (!finalPerms[mod].includes(act)) finalPerms[mod].push(act);
            }
          });

          await authService.updateUserPermissions(targetUser.id, finalPerms);
          notificationService.success(`Action permissions for '${targetUser.name}' saved successfully!`);
          closeModal(true);
        } catch (err) {
          notificationService.error('Failed to save permissions: ' + err.message);
        }
      });
    }

    // ==========================================
    // 22. LOCATION DATA ACCESS SCOPING HANDLERS
    // ==========================================

    // ==========================================
    // 22. LOCATION DATA ACCESS SCOPING HANDLERS (In-Place, Zero-Jump)
    // ==========================================

    const updateScopeLiveStatus = () => {
      const liveStatusEl = modalLayer.querySelector('#scope-live-status-container');
      const allCard = modalLayer.querySelector('#scope-mode-all-card');
      const restCard = modalLayer.querySelector('#scope-mode-restricted-card');
      const panels = modalLayer.querySelector('#scope-granular-panels');

      const isAll = Boolean(editingScope.allGroups);
      if (allCard) {
        allCard.style.background = isAll ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.4)';
        allCard.style.borderColor = isAll ? '#38bdf8' : 'var(--border-color)';
      }
      if (restCard) {
        restCard.style.background = !isAll ? 'rgba(234, 179, 8, 0.15)' : 'rgba(15, 23, 42, 0.4)';
        restCard.style.borderColor = !isAll ? '#facc15' : 'var(--border-color)';
      }
      if (panels) {
        panels.style.display = isAll ? 'none' : 'grid';
      }

      if (liveStatusEl) {
        if (isAll) {
          liveStatusEl.innerHTML = `<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700;">🌐 Unrestricted Global Access (All Locations)</span>`;
        } else {
          const uCount = Array.isArray(editingScope.unitIds) ? editingScope.unitIds.length : 0;
          const fCount = Array.isArray(editingScope.floorIds) ? editingScope.floorIds.length : 0;
          const lCount = Array.isArray(editingScope.lineIds) ? editingScope.lineIds.length : 0;
          liveStatusEl.innerHTML = `<span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #facc15; font-weight: 700;">📍 ${uCount} Unit(s) &bull; ${fCount} Floor(s) &bull; ${lCount} Line(s)</span>`;
        }
      }
    };

    const filterScopeListsInPlace = () => {
      if (!Array.isArray(editingScope.unitIds)) editingScope.unitIds = [];
      if (!Array.isArray(editingScope.floorIds)) editingScope.floorIds = [];
      if (!Array.isArray(editingScope.lineIds)) editingScope.lineIds = [];

      const selectedUnitIds = editingScope.unitIds;
      let visibleFloorsCount = 0;
      modalLayer.querySelectorAll('.scope-floor-item').forEach(item => {
        const uId = item.getAttribute('data-unit');
        const isVisible = selectedUnitIds.length === 0 || selectedUnitIds.includes(uId);
        item.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) {
          visibleFloorsCount++;
        } else {
          const chk = item.querySelector('.chk-scope-floor');
          if (chk && chk.checked) {
            chk.checked = false;
            const fId = chk.getAttribute('data-id');
            editingScope.floorIds = editingScope.floorIds.filter(x => x !== fId);
          }
        }
      });
      const floorsCountEl = modalLayer.querySelector('#scope-floors-count');
      if (floorsCountEl) floorsCountEl.textContent = visibleFloorsCount;

      const selectedFloorIds = editingScope.floorIds;
      let visibleLinesCount = 0;
      modalLayer.querySelectorAll('.scope-line-item').forEach(item => {
        const fId = item.getAttribute('data-floor');
        const uId = item.getAttribute('data-unit');
        const unitValid = selectedUnitIds.length === 0 || selectedUnitIds.includes(uId);
        const isVisible = selectedFloorIds.length > 0 ? selectedFloorIds.includes(fId) : unitValid;
        item.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) {
          visibleLinesCount++;
        } else {
          const chk = item.querySelector('.chk-scope-line');
          if (chk && chk.checked) {
            chk.checked = false;
            const lId = chk.getAttribute('data-id');
            editingScope.lineIds = editingScope.lineIds.filter(x => x !== lId);
          }
        }
      });
      const linesCountEl = modalLayer.querySelector('#scope-lines-count');
      if (linesCountEl) linesCountEl.textContent = visibleLinesCount;

      updateScopeLiveStatus();
    };

    // 22a. Scope Mode Switch (All Locations vs Granular)
    const modeAll = modalLayer.querySelector('#scope-mode-all');
    const modeRestricted = modalLayer.querySelector('#scope-mode-restricted');

    if (modeAll) {
      modeAll.addEventListener('change', () => {
        editingScope.allGroups = true;
        updateScopeLiveStatus();
      });
    }

    if (modeRestricted) {
      modeRestricted.addEventListener('change', () => {
        editingScope.allGroups = false;
        updateScopeLiveStatus();
      });
    }

    // 22b. Unit Checkboxes
    modalLayer.querySelectorAll('.chk-scope-unit').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        if (!Array.isArray(editingScope.unitIds)) editingScope.unitIds = [];
        if (chk.checked) {
          if (!editingScope.unitIds.includes(id)) editingScope.unitIds.push(id);
        } else {
          editingScope.unitIds = editingScope.unitIds.filter(x => x !== id);
        }
        filterScopeListsInPlace();
      });
    });

    // Unit All / Clear
    const btnAllUnits = modalLayer.querySelector('#btn-scope-all-units');
    if (btnAllUnits) {
      btnAllUnits.addEventListener('click', () => {
        const allUnits = masterDataService.getAllUnits();
        editingScope.unitIds = allUnits.map(u => u.id);
        modalLayer.querySelectorAll('.chk-scope-unit').forEach(c => { c.checked = true; });
        filterScopeListsInPlace();
      });
    }

    const btnClearUnits = modalLayer.querySelector('#btn-scope-clear-units');
    if (btnClearUnits) {
      btnClearUnits.addEventListener('click', () => {
        editingScope.unitIds = [];
        editingScope.floorIds = [];
        editingScope.lineIds = [];
        modalLayer.querySelectorAll('.chk-scope-unit, .chk-scope-floor, .chk-scope-line').forEach(c => { c.checked = false; });
        filterScopeListsInPlace();
      });
    }

    // 22c. Floor Checkboxes
    modalLayer.querySelectorAll('.chk-scope-floor').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        if (!Array.isArray(editingScope.floorIds)) editingScope.floorIds = [];
        if (chk.checked) {
          if (!editingScope.floorIds.includes(id)) editingScope.floorIds.push(id);
        } else {
          editingScope.floorIds = editingScope.floorIds.filter(x => x !== id);
        }
        filterScopeListsInPlace();
      });
    });

    // Floor All / Clear
    const btnAllFloors = modalLayer.querySelector('#btn-scope-all-floors');
    if (btnAllFloors) {
      btnAllFloors.addEventListener('click', () => {
        if (!Array.isArray(editingScope.floorIds)) editingScope.floorIds = [];
        modalLayer.querySelectorAll('.scope-floor-item').forEach(item => {
          if (item.style.display !== 'none') {
            const chk = item.querySelector('.chk-scope-floor');
            if (chk) {
              chk.checked = true;
              const fId = chk.getAttribute('data-id');
              if (!editingScope.floorIds.includes(fId)) editingScope.floorIds.push(fId);
            }
          }
        });
        filterScopeListsInPlace();
      });
    }

    const btnClearFloors = modalLayer.querySelector('#btn-scope-clear-floors');
    if (btnClearFloors) {
      btnClearFloors.addEventListener('click', () => {
        editingScope.floorIds = [];
        editingScope.lineIds = [];
        modalLayer.querySelectorAll('.chk-scope-floor, .chk-scope-line').forEach(c => { c.checked = false; });
        filterScopeListsInPlace();
      });
    }

    // 22d. Line Checkboxes
    modalLayer.querySelectorAll('.chk-scope-line').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        if (!Array.isArray(editingScope.lineIds)) editingScope.lineIds = [];
        if (chk.checked) {
          if (!editingScope.lineIds.includes(id)) editingScope.lineIds.push(id);
        } else {
          editingScope.lineIds = editingScope.lineIds.filter(x => x !== id);
        }
        updateScopeLiveStatus();
      });
    });

    // Line All / Clear
    const btnAllLines = modalLayer.querySelector('#btn-scope-all-lines');
    if (btnAllLines) {
      btnAllLines.addEventListener('click', () => {
        if (!Array.isArray(editingScope.lineIds)) editingScope.lineIds = [];
        modalLayer.querySelectorAll('.scope-line-item').forEach(item => {
          if (item.style.display !== 'none') {
            const chk = item.querySelector('.chk-scope-line');
            if (chk) {
              chk.checked = true;
              const lId = chk.getAttribute('data-id');
              if (!editingScope.lineIds.includes(lId)) editingScope.lineIds.push(lId);
            }
          }
        });
        updateScopeLiveStatus();
      });
    }

    const btnClearLines = modalLayer.querySelector('#btn-scope-clear-lines');
    if (btnClearLines) {
      btnClearLines.addEventListener('click', () => {
        editingScope.lineIds = [];
        modalLayer.querySelectorAll('.chk-scope-line').forEach(c => { c.checked = false; });
        updateScopeLiveStatus();
      });
    }

    // 22e. Save Location Scope Button
    const btnSaveScope = modalLayer.querySelector('#btn-save-user-scope');
    if (btnSaveScope && targetUser) {
      btnSaveScope.addEventListener('click', async () => {
        try {
          await authService.updateUserScope(targetUser.id, editingScope);
          notificationService.success(`Location access scope for '${targetUser.name}' saved successfully!`);
          closeModal(true);
        } catch (err) {
          notificationService.error('Failed to save location scope: ' + err.message);
        }
      });
    }

    // ==========================================
    // 23. PRESET MODAL ACTION HANDLERS
    // ==========================================

    // 23a. Save Preset Settings (Create or Update)
    const btnSavePreset = modalLayer.querySelector('#btn-save-preset-settings');
    if (btnSavePreset) {
      btnSavePreset.addEventListener('click', async () => {
        const name = modalLayer.querySelector('#preset-name-input')?.value?.trim();
        const accessLevel = modalLayer.querySelector('#preset-access-level-input')?.value?.trim() || 'Module Access';
        const description = modalLayer.querySelector('#preset-description-input')?.value?.trim() || '';
        const icon = modalLayer.querySelector('#preset-icon-input')?.value || '🛡️';
        const badgeColor = modalLayer.querySelector('#preset-badge-color-input')?.value || '#0ea5e9';
        const applyToAssigned = modalLayer.querySelector('#preset-apply-to-assigned-users')?.checked ?? false;

        if (!name) {
          notificationService.error('Preset Name is required.');
          return;
        }

        const finalPerms = {};
        modalLayer.querySelectorAll('.chk-perm-action').forEach(c => {
          if (c.checked) {
            const mod = c.getAttribute('data-module');
            const act = c.getAttribute('data-action');
            if (!finalPerms[mod]) finalPerms[mod] = [];
            if (!finalPerms[mod].includes(act)) finalPerms[mod].push(act);
          }
        });

        try {
          if (targetPreset) {
            const result = await authService.updatePreset(targetPreset.id, {
              name,
              accessLevel,
              description,
              icon,
              badgeColor,
              permissions: finalPerms,
              scope: editingScope,
              syncScopeWithUsers: applyToAssigned
            }, applyToAssigned);

            let msg = `Preset "${name}" updated successfully!`;
            if (applyToAssigned && result.affectedUsersCount > 0) {
              msg += ` Applied to ${result.affectedUsersCount} assigned user(s).`;
            }
            notificationService.success(msg);
          } else {
            await authService.createPreset({
              name,
              accessLevel,
              description,
              icon,
              badgeColor,
              permissions: finalPerms,
              scope: editingScope
            });
            notificationService.success(`New Preset Profile "${name}" created successfully!`);
          }
          closeModal(true);
        } catch (err) {
          notificationService.error(err.message);
        }
      });
    }

    // 23b. Assign Users Modal Checkbox Handlers
    const btnSelectAllAssign = modalLayer.querySelector('#btn-assign-modal-select-all');
    if (btnSelectAllAssign) {
      btnSelectAllAssign.addEventListener('click', () => {
        modalLayer.querySelectorAll('.chk-assign-user-item').forEach(c => {
          c.checked = true;
          const uid = c.getAttribute('data-id');
          if (!selectedUserIdsForPreset.includes(uid)) selectedUserIdsForPreset.push(uid);
        });
        const countEl = modalLayer.querySelector('#assign-selected-count');
        if (countEl) countEl.innerText = selectedUserIdsForPreset.length;
      });
    }

    const btnDeselectAllAssign = modalLayer.querySelector('#btn-assign-modal-deselect-all');
    if (btnDeselectAllAssign) {
      btnDeselectAllAssign.addEventListener('click', () => {
        modalLayer.querySelectorAll('.chk-assign-user-item').forEach(c => {
          c.checked = false;
        });
        selectedUserIdsForPreset = [];
        const countEl = modalLayer.querySelector('#assign-selected-count');
        if (countEl) countEl.innerText = '0';
      });
    }

    modalLayer.querySelectorAll('.chk-assign-user-item').forEach(c => {
      c.addEventListener('change', () => {
        const uid = c.getAttribute('data-id');
        if (c.checked) {
          if (!selectedUserIdsForPreset.includes(uid)) selectedUserIdsForPreset.push(uid);
        } else {
          selectedUserIdsForPreset = selectedUserIdsForPreset.filter(x => x !== uid);
        }
        const countEl = modalLayer.querySelector('#assign-selected-count');
        if (countEl) countEl.innerText = selectedUserIdsForPreset.length;
      });
    });

    // 23c. Confirm Batch Assign Users to Preset
    const btnConfirmAssign = modalLayer.querySelector('#btn-confirm-assign-users');
    if (btnConfirmAssign && targetPreset) {
      btnConfirmAssign.addEventListener('click', async () => {
        const syncScope = modalLayer.querySelector('#chk-sync-scope-to-users')?.checked ?? true;
        try {
          const count = await authService.assignPresetToUsers(selectedUserIdsForPreset, targetPreset.id, syncScope);
          notificationService.success(`Assigned profile "${targetPreset.name}" to ${count} user account(s).`);
          closeModal(true);
        } catch (err) {
          notificationService.error(err.message);
        }
      });
    }

    // 23d. Confirm 1-Click Quick Preset Assignment to User
    const btnConfirmQuickPreset = modalLayer.querySelector('#btn-confirm-quick-preset');
    if (btnConfirmQuickPreset && targetUser) {
      btnConfirmQuickPreset.addEventListener('click', async () => {
        const choice = modalLayer.querySelector('input[name="quick-preset-choice"]:checked')?.value;
        const syncScope = modalLayer.querySelector('#chk-quick-preset-sync-scope')?.checked ?? true;
        if (!choice) {
          notificationService.error('Please select a permission preset profile.');
          return;
        }
        try {
          await authService.assignPresetToUser(targetUser.id, choice, syncScope);
          const p = authService.getPresetById(choice);
          notificationService.success(`Assigned profile "${p ? p.name : 'Custom User'}" to ${targetUser.name}!`);
          closeModal(true);
        } catch (err) {
          notificationService.error(err.message);
        }
      });
    }
  };

  // If a modal is already in the DOM, bind its events immediately
  if (activeModalType) {
    bindUserModalEvents();
  }
}
