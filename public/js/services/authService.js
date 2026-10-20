/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Super Admin Role & Granular Individual Access Control (IAC) Service
 */

import { storage } from '../db/storage.js';
import { CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, ROLES, ACTIONS, MODULES, DEFAULT_PERMISSION_TEMPLATES, PERMISSION_MODULES, DEFAULT_PERMISSION_PRESETS } from '../db/schema.js';
import { auditService } from './auditService.js';
import { cryptoService } from './cryptoService.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    storage.init();
    // Ensure ROLES table exists in storage
    const roles = storage.getTable(TABLE_NAMES.ROLES) || [];
    if (roles.length === 0) {
      this.seedDefaultRoles();
    }

    // Clean legacy demo accounts from storage & heal corrupted roles
    this.cleanDemoUsers();
    this.autoHealUserRolesAndPresets();

    const savedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    
    if (savedUserId) {
      const found = users.find(u => u.id === savedUserId);
      if (found && found.status === 'ACTIVE') {
        // Multi-device session security check:
        const localPwdStamp = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_session_pwd_reset') : null;
        const dbPwdStamp = found.lastPasswordReset || found.passwordChangedAt;
        if (dbPwdStamp && localPwdStamp && localPwdStamp !== dbPwdStamp) {
          console.warn('[AuthService] 🔒 Password was changed on another device. Invaliding local session.');
          this.currentUser = null;
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('al_muslim_active_user_id');
            localStorage.removeItem('al_muslim_session_pwd_reset');
            localStorage.removeItem('al_muslim_session_token');
          }
          if (typeof sessionStorage !== 'undefined') {
            try { sessionStorage.setItem('al_muslim_session_invalidated_reason', 'PASSWORD_CHANGED'); } catch (_) {}
          }
        } else {
          this.currentUser = found;
          if (!localPwdStamp && dbPwdStamp && typeof localStorage !== 'undefined') {
            localStorage.setItem('al_muslim_session_pwd_reset', dbPwdStamp);
          }
        }
      } else {
        this.currentUser = null;
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('al_muslim_active_user_id');
        }
      }
    } else {
      this.currentUser = null;
    }

    if (typeof window !== 'undefined') {
      window.__authService = this;
    }

    if (typeof window !== 'undefined' && !window.__authReadyTime && typeof performance !== 'undefined') {
      window.__authReadyTime = performance.now();
    }
  }

  recheckCurrentUser() {
    const savedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_active_user_id') : null;
    if (savedUserId) {
      const users = storage.getTable(TABLE_NAMES.USERS) || [];
      const found = users.find(u => u.id === savedUserId);
      if (found && found.status === 'ACTIVE') {
        const localPwdStamp = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_session_pwd_reset') : null;
        const dbPwdStamp = found.lastPasswordReset || found.passwordChangedAt;
        if (dbPwdStamp && localPwdStamp && localPwdStamp !== dbPwdStamp) {
          this.terminateSessionDueToPasswordChange();
          return null;
        }
        this.currentUser = found;
        return this.currentUser;
      }
    }
    return this.currentUser;
  }

  isAuthenticated() {
    return !!(this.currentUser && this.currentUser.id && this.currentUser.status === 'ACTIVE');
  }

  cleanDemoUsers() {
    let users = storage.getTable(TABLE_NAMES.USERS) || [];
    const demoIds = ['usr-3', 'usr-4', 'usr-5', 'usr-6'];
    const demoUsernames = ['manager', 'store', 'viewer'];
    const filtered = users.filter(u => !demoIds.includes(u.id) && !demoUsernames.includes(u.username));
    
    // Ensure Engr. Motaher Hossain exists as Primary Super Admin (username: motaher, password: Mr@304415)
    const existingMotaher = filtered.find(u => u.username === 'motaher' || u.email === 'motaher.cse@gmail.com');
    if (!existingMotaher) {
      filtered.unshift({
        id: 'usr-super-admin',
        username: 'motaher',
        password: '$sha256$6ad526a0cf737517d4609e058dc306b2$454c146535308e78f7597aa51ac660a043569dd70843ec7b9e0b50be956f14b3',
        name: 'Engr. Motaher Hossain',
        employeeId: 'AMG-HQ-001',
        email: 'motaher.cse@gmail.com',
        phone: '+8801711000001',
        department: 'Central Engineering & Maintenance',
        designation: 'Head of Maintenance & System Director',
        role: 'SUPER_ADMIN',
        roleId: 'role-super-admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        assignedScope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
        permissions: DEFAULT_PERMISSION_TEMPLATES.ADMIN || DEFAULT_PERMISSION_TEMPLATES.SUPER_ADMIN,
        createdAt: '2026-01-01T00:00:00Z',
        lastLoginAt: new Date().toISOString()
      });
    } else {
      existingMotaher.status = 'ACTIVE';
      if (!existingMotaher.password) {
        existingMotaher.password = '$sha256$6ad526a0cf737517d4609e058dc306b2$454c146535308e78f7597aa51ac660a043569dd70843ec7b9e0b50be956f14b3';
      }
    }

    // Ensure fallback Super Admin exists (username: superadmin, password: admin123)
    if (!filtered.some(u => u.username === 'superadmin')) {
      filtered.push({
        id: 'usr-fallback-superadmin',
        username: 'superadmin',
        password: cryptoService.hashPassword('admin123'),
        name: 'Central System Administrator',
        employeeId: 'AMG-HQ-002',
        email: 'admin.backup@al-muslim.com',
        phone: '+8801711000002',
        department: 'Central Engineering & Maintenance',
        designation: 'System Administrator',
        role: 'ADMIN',
        roleId: 'role-super-admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        assignedScope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
        permissions: DEFAULT_PERMISSION_TEMPLATES.ADMIN || DEFAULT_PERMISSION_TEMPLATES.SUPER_ADMIN,
        createdAt: '2026-01-01T00:00:00Z',
        lastLoginAt: new Date().toISOString()
      });
    }

    // Ensure Admin exists (username: admin, password: admin123)
    if (!filtered.some(u => u.username === 'admin')) {
      filtered.push({
        id: 'usr-admin',
        username: 'admin',
        password: cryptoService.hashPassword('admin123'),
        name: 'Factory Maintenance Administrator',
        employeeId: 'AMG-ADM-001',
        email: 'admin@al-muslim.com',
        phone: '+8801711000002',
        department: 'Central Maintenance',
        designation: 'Maintenance Administrator',
        role: 'ADMIN',
        roleId: 'role-admin',
        status: 'ACTIVE',
        mustChangePassword: false,
        assignedScope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
        permissions: DEFAULT_PERMISSION_TEMPLATES.ADMIN,
        createdAt: '2026-01-01T00:00:00Z'
      });
    }

    // Ensure Standard User exists (username: user, password: user123)
    if (!filtered.some(u => u.username === 'user')) {
      filtered.push({
        id: 'usr-user',
        username: 'user',
        password: cryptoService.hashPassword('user123'),
        name: 'Maintenance Line Operator',
        employeeId: 'AMG-OP-001',
        email: 'operator@al-muslim.com',
        phone: '+8801711000003',
        department: 'Plant Operations',
        designation: 'Line Operator',
        role: 'USER',
        roleId: 'role-user',
        status: 'ACTIVE',
        mustChangePassword: false,
        assignedScope: { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
        permissions: DEFAULT_PERMISSION_TEMPLATES.USER,
        createdAt: '2026-01-01T00:00:00Z'
      });
    }

    // Ensure all stored passwords are cryptographically hashed
    let changed = false;
    filtered.forEach(u => {
      if (u.password && !cryptoService.isHashed(u.password)) {
        u.password = cryptoService.hashPassword(u.password);
        changed = true;
      }
    });

    if (changed || filtered.length !== users.length) {
      storage.setTable(TABLE_NAMES.USERS, filtered);
    }
  }

  /**
   * Auto-heals corrupted user roles: ensures users assigned to standard/maintenance
   * access profiles are never accidentally stamped with Super Admin role/roleId.
   */
  autoHealUserRolesAndPresets() {
    if (this._isAutoHealing) return;
    this._isAutoHealing = true;
    try {
      let users = storage.getTable(TABLE_NAMES.USERS) || [];
      if (!Array.isArray(users) || users.length === 0) return;
      let changed = false;

      users = users.map(u => {
        // 1. Permanent Primary Super Admins
        if (u.id === 'usr-super-admin' || u.username === 'motaher') {
          if (u.role !== 'SUPER_ADMIN' || u.roleId !== 'role-super-admin' || u.presetId !== 'preset_super_admin') {
            changed = true;
            return { ...u, role: 'SUPER_ADMIN', roleId: 'role-super-admin', presetId: 'preset_super_admin', presetName: 'Super Admin' };
          }
          return u;
        }
        if (u.id === 'usr-fallback-superadmin' || u.username === 'superadmin') {
          if (u.role !== 'SUPER_ADMIN' || u.roleId !== 'role-super-admin' || u.presetId !== 'preset_super_admin') {
            changed = true;
            return { ...u, role: 'SUPER_ADMIN', roleId: 'role-super-admin', presetId: 'preset_super_admin', presetName: 'Super Admin' };
          }
          return u;
        }

        // Preserve accounts with NO_ACCESS role or empty permissions (Default No Access policy)
        if (u.role === 'NO_ACCESS' || u.roleId === 'role-no-access' || (u.permissions && Object.keys(u.permissions).length === 0 && u.role !== 'SUPER_ADMIN' && u.role !== 'ADMIN')) {
          if (u.role !== 'NO_ACCESS' || u.roleId !== 'role-no-access' || u.presetId !== 'no_access') {
            changed = true;
            return {
              ...u,
              role: 'NO_ACCESS',
              roleId: 'role-no-access',
              presetId: 'no_access',
              presetName: 'No Access (Pending Admin Assignment)',
              permissions: u.permissions || {}
            };
          }
          return u;
        }

        // 2. Factory Maintenance Administrator
        if (u.id === 'usr-admin' || u.username === 'admin') {
          if (u.role !== 'ADMIN' || u.roleId !== 'role-admin' || u.presetId !== 'preset_admin') {
            changed = true;
            return { ...u, role: 'ADMIN', roleId: 'role-admin', presetId: 'preset_admin', presetName: 'Admin' };
          }
          return u;
        }

        // 3. Explicit Super Admin accounts
        const isExplicitSuper = (u.role === 'SUPER_ADMIN' || u.presetId === 'preset_super_admin') &&
                                (u.role !== 'USER' && u.presetId !== 'preset_maintenance_user');
        if (isExplicitSuper) {
          if (u.roleId !== 'role-super-admin') {
            changed = true;
            return { ...u, role: 'SUPER_ADMIN', roleId: 'role-super-admin', presetId: u.presetId || 'preset_super_admin', presetName: u.presetName || 'Super Admin' };
          }
          return u;
        }

        // 4. Explicit Admin accounts
        const isExplicitAdmin = (u.role === 'ADMIN' || u.presetId === 'preset_admin') &&
                                (u.role !== 'USER' && u.presetId !== 'preset_maintenance_user');
        if (isExplicitAdmin) {
          if (u.roleId !== 'role-admin') {
            changed = true;
            return { ...u, role: 'ADMIN', roleId: 'role-admin', presetId: u.presetId || 'preset_admin', presetName: u.presetName || 'Admin' };
          }
          return u;
        }

        // 5. Explicit Manager accounts
        const isExplicitManager = (u.role === 'MANAGER' || u.presetId === 'preset_maintenance_manager' || u.presetId === 'preset_manager') &&
                                  (u.role !== 'USER' && u.presetId !== 'preset_maintenance_user');
        if (isExplicitManager) {
          if (u.roleId !== 'role-manager' || u.role !== 'MANAGER') {
            changed = true;
            return { ...u, role: 'MANAGER', roleId: 'role-manager', presetId: u.presetId || 'preset_maintenance_manager', presetName: u.presetName || 'Maintenance Manager' };
          }
          return u;
        }

        // 6. All other accounts are Standard / Maintenance Users!
        // If roleId was accidentally set to 'role-super-admin' or 'role-admin', heal it immediately!
        let copy = { ...u };
        let userUpdated = false;

        if (copy.roleId === 'role-super-admin' || copy.roleId === 'role-admin' || copy.roleId === 'role-user' || !copy.roleId) {
          copy.roleId = 'role-maintenance-user';
          userUpdated = true;
        }
        if (copy.role === 'SUPER_ADMIN' || copy.role === 'ADMIN' || !copy.role) {
          copy.role = 'USER';
          userUpdated = true;
        }
        if (!copy.presetId || copy.presetId === 'preset_super_admin' || copy.presetId === 'preset_admin') {
          copy.presetId = 'preset_maintenance_user';
          copy.presetName = 'Maintenance User';
          userUpdated = true;
        } else if (!copy.presetName) {
          const pDef = (DEFAULT_PERMISSION_PRESETS || []).find(pr => pr.id === copy.presetId || pr.code === copy.presetId);
          copy.presetName = pDef ? pDef.name : 'Maintenance User';
          userUpdated = true;
        }

        if (userUpdated) {
          changed = true;
          return copy;
        }

        return u;
      });

      if (changed) {
        storage.setTable(TABLE_NAMES.USERS, users);
        storage.saveTable(TABLE_NAMES.USERS, true).catch(() => {});
        console.log('[AuthService] Auto-healed corrupted user roles and access profile bindings.');
      }
    } finally {
      this._isAutoHealing = false;
    }
  }

  seedDefaultRoles() {
    const defaultRoles = [
      {
        id: 'role-super-admin',
        code: 'SUPER_ADMIN',
        name: 'Super Administrator',
        description: 'Master system authority with unrestricted access across all modules, configuration, and security settings.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.SUPER_ADMIN || DEFAULT_PERMISSION_TEMPLATES.ADMIN))
      },
      {
        id: 'role-admin',
        code: 'ADMIN',
        name: 'Administrator',
        description: 'Central maintenance administrator with full inventory management, master data, transfers, user management, and report access.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.ADMIN))
      },
      {
        id: 'role-manager',
        code: 'MANAGER',
        name: 'Maintenance Manager',
        description: 'Floor and shift management with machine edit, transfer approval, maintenance log review, and export rights.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.MANAGER || DEFAULT_PERMISSION_TEMPLATES.ADMIN))
      },
      {
        id: 'role-maintenance-user',
        code: 'MAINTENANCE_USER',
        name: 'Maintenance User',
        description: 'Field mechanical & electrical technicians for PM execution, machine servicing, ENT circuit repairs, and tool allocations.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.MAINTENANCE_USER || DEFAULT_PERMISSION_TEMPLATES.USER))
      },
      {
        id: 'role-user',
        code: 'USER',
        name: 'Maintenance User',
        description: 'Standard factory operator and maintenance user with operational access to inventory, transfer requests, and reports.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.USER || DEFAULT_PERMISSION_TEMPLATES.MAINTENANCE_USER))
      },
      {
        id: 'role-store-user',
        code: 'STORE_USER',
        name: 'Store User',
        description: 'Spare parts stockroom officer with parts catalog management, import/export, and stock receipt access.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.STORE_INCHARGE || DEFAULT_PERMISSION_TEMPLATES.USER))
      },
      {
        id: 'role-viewer',
        code: 'VIEWER',
        name: 'Viewer / Auditor',
        description: 'Read-only access for compliance auditors, line supervisors, and factory visitors.',
        isSystem: true,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        permissions: JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.FACTORY_VIEWER || DEFAULT_PERMISSION_TEMPLATES.VIEWER || {}))
      }
    ];

    storage.setTable(TABLE_NAMES.ROLES, defaultRoles);
  }

  getCurrentUser() {
    if (!this.currentUser && typeof localStorage !== 'undefined' && localStorage.getItem('al_muslim_active_user_id')) {
      this.init();
    }
    // Refresh from storage to get latest permissions and security state
    if (this.currentUser?.id) {
      const fresh = storage.getItem(TABLE_NAMES.USERS, this.currentUser.id);
      if (fresh) {
        // Multi-device session security check:
        const localPwdStamp = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_session_pwd_reset') : null;
        const dbPwdStamp = fresh.lastPasswordReset || fresh.passwordChangedAt;
        if (dbPwdStamp && localPwdStamp && localPwdStamp !== dbPwdStamp) {
          console.warn('[AuthService] 🔒 Password was changed on another device. Terminating local session.');
          this.terminateSessionDueToPasswordChange();
          return null;
        }

        if (fresh.status !== 'ACTIVE') {
          console.warn('[AuthService] Account status is no longer ACTIVE. Terminating local session.');
          this.logout();
          return null;
        }

        // Only update if something relevant changed (avoid infinite loops)
        if (JSON.stringify(fresh.permissions) !== JSON.stringify(this.currentUser.permissions) ||
            fresh.role !== this.currentUser.role ||
            fresh.roleId !== this.currentUser.roleId ||
            fresh.presetId !== this.currentUser.presetId) {
          this.currentUser = fresh;
        }
      }
    }
    return this.currentUser;
  }

  getAllUsers() {
    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    if (!this._isAutoHealing && users.some(u => (u.role === 'USER' || u.presetId === 'preset_maintenance_user') && (u.roleId === 'role-super-admin' || u.roleId === 'role-admin'))) {
      this.autoHealUserRolesAndPresets();
      return storage.getTable(TABLE_NAMES.USERS) || [];
    }
    return users;
  }

  getUserById(userId) {
    return storage.getItem(TABLE_NAMES.USERS, userId);
  }

  getUserByEmailOrUsername(identifier) {
    const users = this.getAllUsers();
    const clean = (identifier || '').trim().toLowerCase();
    return users.find(u => u.email?.toLowerCase() === clean || u.username?.toLowerCase() === clean) || null;
  }

  getAllRoles() {
    const roles = storage.getTable(TABLE_NAMES.ROLES) || [];
    if (roles.length === 0) {
      this.seedDefaultRoles();
      return storage.getTable(TABLE_NAMES.ROLES) || [];
    }
    return roles;
  }

  getRoleById(roleId) {
    if (!roleId) return null;
    const r = storage.getItem(TABLE_NAMES.ROLES, roleId);
    if (r) return r;
    if (roleId === 'role-user' || roleId === 'role-maintenance-user') {
      return { id: 'role-maintenance-user', code: 'MAINTENANCE_USER', name: 'Maintenance User' };
    }
    return null;
  }

  getRoleByCode(code) {
    if (!code) return null;
    const clean = String(code).trim().toUpperCase();
    const roles = this.getAllRoles();
    const r = roles.find(x => x.code?.toUpperCase() === clean);
    if (r) return r;
    if (clean === 'USER' || clean === 'MAINTENANCE_USER') {
      return roles.find(x => x.code?.toUpperCase() === 'MAINTENANCE_USER' || x.code?.toUpperCase() === 'USER') ||
        { id: 'role-maintenance-user', code: 'MAINTENANCE_USER', name: 'Maintenance User' };
    }
    return null;
  }

  /**
   * User Login with Email Address or Username & secure password verification
   * Supports dedicated separation between standard User Portal and private Admin Gateway
   * Optimized for instant (<5ms) authentication with zero loading freeze
   */
  async login(identifier, password, options = {}) {
    let users = storage.getTable(TABLE_NAMES.USERS) || [];
    const cleanId = (identifier || '').trim().toLowerCase();
    const isAdminGateway = Boolean(options.isAdminGateway);
    const allowAnyRole = options.allowAnyRole !== undefined ? Boolean(options.allowAnyRole) : !isAdminGateway;
    
    // Support login by email, username, or employeeId
    let user = users.find(u => 
      u.username?.toLowerCase() === cleanId || 
      u.email?.toLowerCase() === cleanId ||
      u.employeeId?.toLowerCase() === cleanId
    );
    
    // Verify password against local cache first (0ms)
    let storedHash = user ? (user.password || user.passwordHash) : null;
    let isPasswordValid = (user && storedHash) ? cryptoService.verifyPassword(password, storedHash) : false;

    // Fast-path: If user missing or password invalid locally, auto-heal standard seeded accounts immediately (<1ms)
    if (!user || !isPasswordValid) {
      this.cleanDemoUsers();
      users = storage.getTable(TABLE_NAMES.USERS) || [];
      user = users.find(u => 
        u.username?.toLowerCase() === cleanId || 
        u.email?.toLowerCase() === cleanId ||
        u.employeeId?.toLowerCase() === cleanId
      );
      storedHash = user ? (user.password || user.passwordHash) : null;
      isPasswordValid = (user && storedHash) ? cryptoService.verifyPassword(password, storedHash) : false;
    }

    // If STILL not found locally or invalid, check MySQL Primary with an aggressive 1000ms timeout guard
    // so login NEVER freezes or stays spinning indefinitely on slow network
    if (!user || !isPasswordValid) {
      try {
        console.log('[AuthService] 🐬 Checking authoritative credentials with MySQL Primary (max 1000ms)...');
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ success: false, timeout: true }), 1000));
        const refreshPromise = storage.refreshTableFromMySQL(TABLE_NAMES.USERS);
        const refreshRes = await Promise.race([refreshPromise, timeoutPromise]);
        if (refreshRes && refreshRes.success) {
          users = storage.getTable(TABLE_NAMES.USERS) || [];
          user = users.find(u => 
            u.username?.toLowerCase() === cleanId || 
            u.email?.toLowerCase() === cleanId ||
            u.employeeId?.toLowerCase() === cleanId
          );
          storedHash = user ? (user.password || user.passwordHash) : null;
          isPasswordValid = (user && storedHash) ? cryptoService.verifyPassword(password, storedHash) : false;
        }
      } catch (err) {
        console.warn('[AuthService] Authoritative MySQL Primary check notice:', err.message);
      }
    }

    if (!user) {
      throw new Error(`Invalid credentials. No account found for '${identifier}'.`);
    }

    if (user.status !== 'ACTIVE') {
      throw new Error(`Account '${user.name}' (${user.email || user.username}) is currently INACTIVE. Please contact the administrator.`);
    }

    if (!isPasswordValid) {
      throw new Error('Incorrect password. Please verify your credentials.');
    }

    // Role Enforcement & Gateway Isolation Gate:
    // Only Administrators can access via the private Admin URL Gateway.
    // On the standard public User Portal (/login), all valid users can authenticate smoothly.
    const isUserAdmin = this.isAdmin(user) || this.isSuperAdmin(user);

    if (isAdminGateway) {
      if (!isUserAdmin) {
        throw new Error('⛔ Access Denied: This administrative gateway is restricted exclusively to authorized System Administrators. Standard factory users must sign in via the standard User Login portal.');
      }
    } else if (!allowAnyRole) {
      if (isUserAdmin) {
        throw new Error('🔒 Administrative Account Restricted: Administrative accounts cannot sign in through the general user portal. Please access the system via the dedicated private Admin Login Gateway URL.');
      }
    }

    // Check System Maintenance Mode: only allowed Admin/Super Admin users may log in
    if (!this.canBypassMaintenance(user)) {
      const maint = this.getMaintenanceModeConfig();
      const endInfo = maint.estimatedEnd ? ` (Expected completion: ${maint.estimatedEnd})` : '';
      throw new Error(`⚠️ SYSTEM MAINTENANCE IN PROGRESS: ${maint.message}${endInfo} — Only Authorized Administrators can sign in at this time.`);
    }

    // Auto-upgrade: normalise so both 'password' and 'passwordHash' always hold the same hash.
    // This prevents login failures after password changes and fixes batch-created accounts.
    const effectiveHash = cryptoService.isHashed(storedHash) ? storedHash : cryptoService.hashPassword(password);
    if (user.password !== effectiveHash || user.passwordHash !== effectiveHash) {
      storage.update(TABLE_NAMES.USERS, user.id, { password: effectiveHash, passwordHash: effectiveHash });
      user.password = effectiveHash;
      user.passwordHash = effectiveHash;
    }

    // Set active user & establish session security token
    this.currentUser = user;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('al_muslim_active_user_id', user.id);
    }

    // Save session password reset stamp and unique session token on this device
    const sessionPwdStamp = user.lastPasswordReset || user.passwordChangedAt || 'INIT_PWD';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('al_muslim_session_pwd_reset', sessionPwdStamp);
      const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('al_muslim_session_token', sessionToken);
    }

    // Update lastLoginAt
    const now = new Date().toISOString();
    storage.update(TABLE_NAMES.USERS, user.id, { lastLoginAt: now });

    auditService.log(
      'USER_LOGIN',
      'USER',
      user.id,
      `User '${user.name}' (${user.email || user.username}) logged in successfully as [${user.role}].`,
      null,
      { username: user.username, email: user.email, role: user.role, loginAt: now }
    );

    return { 
      success: true, 
      user,
      mustChangePassword: Boolean(user.mustChangePassword)
    };
  }

  /**
   * User Logout
   */
  logout() {
    if (this.currentUser) {
      auditService.log(
        'USER_LOGOUT',
        'USER',
        this.currentUser.id,
        `User '${this.currentUser.name}' (${this.currentUser.username}) logged out.`,
        null,
        { logoutAt: new Date().toISOString() }
      );
    }

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('al_muslim_impersonator_admin_id');
        sessionStorage.removeItem('al_muslim_impersonator_admin_name');
        sessionStorage.removeItem('al_muslim_impersonator_admin_role');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('al_muslim_session_pwd_reset');
        localStorage.removeItem('al_muslim_session_token');
        localStorage.removeItem('al_muslim_active_user_id');
      }
    } catch (_) {}
    this.currentUser = null;
  }

  /**
   * Switch active user session (Admin & Super Admin can login into user accounts; standard users cannot)
   */
  switchUser(userId) {
    const activeUser = this.getCurrentUser();
    if (!activeUser) {
      throw new Error('You must be logged in to switch accounts.');
    }

    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    let target = users.find(u => u.id === userId);
    if (!target) {
      target = users.find(u => u.username === userId || u.employeeId === userId);
    }
    
    if (!target) {
      throw new Error('Target user account not found.');
    }

    // Ensure target account is active
    target.status = 'ACTIVE';
    try { 
      storage.update(TABLE_NAMES.USERS, target.id, { status: 'ACTIVE' }); 
    } catch (_) {}

    // Check if there is an active impersonation session by an Admin/Super Admin
    let impersonatorId = null;
    try {
      impersonatorId = sessionStorage.getItem('al_muslim_impersonator_admin_id');
    } catch (_) {}

    const isCurrentSuper = this.isSuperAdmin(activeUser);
    const isCurrentAdmin = this.isAdmin(activeUser);
    const isTargetSuper = this.isSuperAdmin(target);

    // Case A: The active user is returning back to their original admin account
    const isReturningToAdmin = impersonatorId && target.id === impersonatorId;

    if (!isCurrentSuper && !isCurrentAdmin && !isReturningToAdmin) {
      // Standard USER attempting to switch to other accounts
      throw new Error('Access Denied: Standard users cannot switch or login to other accounts.');
    }

    // Case B: Admin attempting to switch to Super Admin
    if (isCurrentAdmin && !isCurrentSuper && !isReturningToAdmin) {
      if (isTargetSuper) {
        throw new Error('Access Denied: Administrators cannot switch to Super Administrator accounts.');
      }
    }

    // If an Admin/Super Admin is switching into a different user account, save impersonator session
    if ((isCurrentSuper || isCurrentAdmin) && target.id !== activeUser.id && !impersonatorId) {
      try {
        sessionStorage.setItem('al_muslim_impersonator_admin_id', activeUser.id);
        sessionStorage.setItem('al_muslim_impersonator_admin_name', activeUser.name || activeUser.username);
        sessionStorage.setItem('al_muslim_impersonator_admin_role', activeUser.role);
      } catch (_) {}
    }

    // If returning back to original admin account, clear the impersonator session
    if (isReturningToAdmin || (impersonatorId && target.id === impersonatorId)) {
      try {
        sessionStorage.removeItem('al_muslim_impersonator_admin_id');
        sessionStorage.removeItem('al_muslim_impersonator_admin_name');
        sessionStorage.removeItem('al_muslim_impersonator_admin_role');
      } catch (_) {}
    }

    this.currentUser = target;
    localStorage.setItem('al_muslim_active_user_id', target.id);
    try { storage.flushImmediate(); } catch (_) {}
    
    auditService.log(
      'SWITCH_USER',
      'USER',
      target.id,
      `Active session switched to '${target.name}' (${target.role}).`,
      null,
      { username: target.username, role: target.role }
    );

    return target;
  }

  getImpersonatorAdmin() {
    try {
      const id = sessionStorage.getItem('al_muslim_impersonator_admin_id');
      if (!id) return null;
      const name = sessionStorage.getItem('al_muslim_impersonator_admin_name');
      const role = sessionStorage.getItem('al_muslim_impersonator_admin_role');
      return { id, name, role };
    } catch (_) {
      return null;
    }
  }

  isImpersonating() {
    return !!this.getImpersonatorAdmin();
  }

  exitImpersonation() {
    const imp = this.getImpersonatorAdmin();
    if (!imp) return null;
    return this.switchUser(imp.id);
  }

  /**
   * Normalize module keys across view routes and database permission keys
   */
  normalizeModuleKey(key) {
    if (!key) return '';
    const clean = key.toLowerCase().trim();
    const map = {
      'users': 'user_management',
      'user-management': 'user_management',
      'user_management': 'user_management',
      'homepage-manager': 'homepage_management',
      'homepage_management': 'homepage_management',
      'home-manager': 'homepage_management',
      'email-config': 'email_config',
      'email_config': 'email_config',
      'master-data': 'master_data',
      'master_data': 'master_data',
      'transfer-workflows': 'transfer_workflows',
      'transfer_workflows': 'transfer_workflows',
      'custom-fields': 'custom_fields',
      'custom_fields': 'custom_fields',
      'excel-manager': 'excel_manager',
      'excel_manager': 'excel_manager',
      'excel_import': 'excel_manager',
      'excel_export': 'excel_manager',
      'audit-logs': 'audit_logs',
      'audit_logs': 'audit_logs',
      'settings': 'settings',
      'system-settings': 'settings',
      'system_settings': 'settings',
      'database-config': 'settings',
      'database_config': 'settings',
      'data-engine': 'settings',
      'data_engine': 'settings',
      'database': 'settings',
      'admin_config': 'master_data',
      'dashboard': 'dashboard',
      'inventory': 'machines',
      'machines': 'machines',
      'transfers': 'transfers',
      'machine-transfers': 'transfers',
      'relocate': 'relocate',
      'machine-relocate': 'relocate',
      'machine-history': 'machine_history',
      'machine_history': 'machine_history',
      'spare-parts': 'spare_parts',
      'spare_parts': 'spare_parts',
      'tools-management': 'tools_management',
      'tools_management': 'tools_management',
      'storage': 'storage',
      'storage-management': 'storage',
      'storage_management': 'storage',
      'manpower': 'manpower',
      'reports': 'reports',
      'et-lab': 'et_lab',
      'et_lab': 'et_lab',
      'qr-codes': 'qr_codes',
      'qr_codes': 'qr_codes',
      'resource-library': 'document_library',
      'resource_library': 'document_library',
      'document-library': 'document_library',
      'document_library': 'document_library',
      'preventive-maintenance': 'preventive_maintenance',
      'preventive_maintenance': 'preventive_maintenance'
    };
    return map[clean] || clean;
  }

  /**
   * Universal Permission Checker (supports hasPermission(module, action, user) or hasPermission(action, null, user))
   */
  hasPermission(moduleOrAction, actionKey = 'VIEW', user = null) {
    const activeUser = user || this.currentUser;
    if (!activeUser || activeUser.status !== 'ACTIVE') return false;
    if (this.isSuperAdmin(activeUser) || this.isAdmin(activeUser)) return true;
    if (activeUser.role === 'NO_ACCESS' || activeUser.roleId === 'role-no-access') return false;
    
    if (arguments.length === 1 || !actionKey) {
      const act = String(moduleOrAction).toUpperCase().trim();
      const perms = activeUser?.permissions || {};
      for (const mod in perms) {
        if (Array.isArray(perms[mod]) && perms[mod].includes(act)) return true;
      }
      return this.hasAccess(moduleOrAction, 'VIEW', activeUser);
    }
    return this.hasAccess(moduleOrAction, actionKey, activeUser);
  }

  /**
   * CORE INDIVIDUAL ACCESS CONTROL (IAC) ENGINE
   * Evaluates Super Admin authority, User-Specific Overrides & Assigned Role Templates
   * Supports 7 explicit actions: READ (VIEW), ADD, EDIT, DELETE, IMPORT, EXPORT, APPROVE
   * @param {string} rawModuleKey - e.g. 'machines', 'transfers', 'spare_parts', 'manpower', 'reports', 'user_management', etc.
   * @param {string} actionKey - Generic action ('READ' / 'VIEW', 'ADD', 'EDIT', 'DELETE', 'IMPORT', 'EXPORT', 'APPROVE')
   */
  hasAccess(rawModuleKey, actionKey = 'VIEW', user = null) {
    const activeUser = user || this.currentUser;
    if (!activeUser || activeUser.status !== 'ACTIVE') return false;
    
    // 1. SUPER ADMIN ALWAYS HAS 100% UNRESTRICTED SYSTEM ACCESS
    if (this.isSuperAdmin(activeUser)) return true;

    // Strict No Access enforcement: ZERO permissions by default
    if (activeUser.role === 'NO_ACCESS' || activeUser.roleId === 'role-no-access') return false;

    let action = (actionKey || 'VIEW').toUpperCase().trim();
    if (action === 'READ') action = 'VIEW';
    const normKey = this.normalizeModuleKey(rawModuleKey);

    // 2. Resolve Effective Permissions: User Overrides > Role Template
    let perms = activeUser.permissions;

    if ((!perms || Object.keys(perms).length === 0) && activeUser.roleId) {
      if (activeUser.roleId === 'role-no-access' || activeUser.role === 'NO_ACCESS') {
        return false;
      }
      const role = storage.getItem(TABLE_NAMES.ROLES, activeUser.roleId);
      if (role && role.permissions) {
        perms = role.permissions;
      }
    }

    if (!perms || Object.keys(perms).length === 0) return false;

    // Check specific module array under raw key, normalized key, and underscore/hyphen variants
    const moduleActions = perms[normKey] || perms[rawModuleKey] || perms[rawModuleKey.replace(/-/g, '_')] || perms[rawModuleKey.replace(/_/g, '-')];
    if (Array.isArray(moduleActions)) {
      if (moduleActions.includes(action)) return true;
      if (action === 'VIEW' && moduleActions.includes('READ')) return true;
      if (action === 'READ' && moduleActions.includes('VIEW')) return true;

      // Smart semantic matching for the 7 granular actions:
      // 1. READ / VIEW
      if (action === 'VIEW' && moduleActions.some(a => a.startsWith('VIEW') || a === 'VIEW' || a === 'READ' || a === 'SEARCH' || a === 'DETAILS')) return true;
      if (action === 'SEARCH' && (moduleActions.includes('SEARCH') || moduleActions.includes('VIEW') || moduleActions.includes('READ'))) return true;
      if (action === 'DETAILS' && (moduleActions.includes('DETAILS') || moduleActions.includes('VIEW') || moduleActions.includes('READ'))) return true;

      // 2. ADD
      if (action === 'ADD' && moduleActions.some(a => a === 'ADD' || a.startsWith('ADD_') || a === 'CREATE_REQUEST' || a === 'ALLOCATE')) return true;

      // 3. EDIT
      if (action === 'EDIT' && moduleActions.some(a => a === 'EDIT' || a.startsWith('EDIT_') || a === 'MASTER_CONFIG' || a === 'REPLACE')) return true;

      // 4. DELETE
      if (action === 'DELETE' && moduleActions.some(a => a === 'DELETE' || a.startsWith('DELETE_') || a === 'CANCEL_REQUEST' || a === 'DEACTIVATE_USER')) return true;

      // 5. IMPORT (Strict: Requires explicitly permitted IMPORT action)
      if (action === 'IMPORT' && moduleActions.some(a => a === 'IMPORT' || a.includes('IMPORT'))) return true;

      // 6. EXPORT (Strict: Requires explicitly permitted EXPORT action)
      if (action === 'EXPORT' && moduleActions.some(a => a === 'EXPORT' || a.includes('EXPORT'))) return true;

      // 7. APPROVE (Strict: Requires explicitly permitted APPROVE action)
      if (action === 'APPROVE' && moduleActions.some(a => a === 'APPROVE' || a.includes('APPROVE') || a === 'COMPLETE_SESSION')) return true;
    }

    return false;
  }

  /**
   * Check if user is allowed to view/navigate to a module
   */
  isModuleAllowed(rawModuleKey, user = null) {
    const activeUser = user || this.currentUser;
    if (!activeUser || activeUser.status !== 'ACTIVE') return false;
    if (this.isSuperAdmin(activeUser)) return true;

    // Strict No Access enforcement
    if (activeUser.role === 'NO_ACCESS' || activeUser.roleId === 'role-no-access') return false;

    const normKey = this.normalizeModuleKey(rawModuleKey);

    let perms = activeUser.permissions;
    if ((!perms || Object.keys(perms).length === 0) && activeUser.roleId) {
      if (activeUser.roleId === 'role-no-access' || activeUser.role === 'NO_ACCESS') {
        return false;
      }
      const role = storage.getItem(TABLE_NAMES.ROLES, activeUser.roleId);
      if (role && role.permissions) {
        perms = role.permissions;
      }
    }

    if (perms && typeof perms === 'object') {
      const moduleActions = perms[normKey] || perms[rawModuleKey] || perms[rawModuleKey.replace(/-/g, '_')] || perms[rawModuleKey.replace(/_/g, '-')];
      if (Array.isArray(moduleActions) && moduleActions.length > 0) {
        return moduleActions.some(a => a.startsWith('VIEW') || a === 'VIEW' || a === 'SEARCH' || a === 'DETAILS');
      }
    }

    if (normKey === 'qr_codes') {
      const hasExplicit = perms && (perms['qr_codes'] || perms['qr-codes']);
      if (hasExplicit) {
        return this.hasAccess('qr_codes', 'VIEW', activeUser);
      }
      if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
        return false;
      }
      return this.hasAccess('machines', 'VIEW', activeUser);
    }

    if (normKey === 'parts_trace') {
      const hasExplicit = perms && (perms['parts_trace'] || perms['parts-trace']);
      if (hasExplicit) {
        return this.hasAccess('parts_trace', 'VIEW', activeUser);
      }
      if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
        return false;
      }
      return this.hasAccess('spare_parts', 'VIEW', activeUser) || this.hasAccess('machines', 'VIEW', activeUser);
    }

    if (normKey === 'dashboard') {
      const hasExplicit = perms && perms['dashboard'];
      if (hasExplicit) {
        return this.hasAccess('dashboard', 'VIEW', activeUser);
      }
      if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
        return false;
      }
      return this.hasAccess('machines', 'VIEW', activeUser) || this.hasAccess('transfers', 'VIEW', activeUser);
    }

    return this.hasAccess(normKey, 'VIEW', activeUser);
  }

  /**
   * Check if user is allowed to access a specific app view/route
   */
  isViewAllowed(rawViewName, user = null) {
    const activeUser = user || this.getCurrentUser();
    if (!activeUser || activeUser.status !== 'ACTIVE') return false;
    if (this.isSuperAdmin(activeUser) || this.isAdmin(activeUser)) return true;
    if (rawViewName === 'home' || rawViewName === 'login' || rawViewName === 'admin-login' || rawViewName === 'no-access') return true;

    // Strict No Access enforcement
    if (activeUser.role === 'NO_ACCESS' || activeUser.roleId === 'role-no-access') return false;

    const viewToModuleMap = {
      'dashboard': 'dashboard',
      'inventory': 'machines',
      'relocate': 'relocate',
      'needle-operations': 'machines',
      'qr-codes': 'qr_codes',
      'transfers': 'transfers',
      'parts-trace': 'parts_trace',
      'machine-history': 'machine_history',
      'preventive-maintenance': 'preventive_maintenance',
      'reports': 'reports',
      'transfer-workflows': 'transfer_workflows',
      'excel-manager': 'excel_manager',
      'custom-fields': 'custom_fields',
      'et-lab': 'et_lab',
      'spare-parts': 'spare_parts',
      'tools-management': 'tools_management',
      'storage': 'storage',
      'manpower': 'manpower',
      'master-data': 'master_data',
      'users': 'user_management',
      'homepage-manager': 'homepage_management',
      'email-config': 'email_config',
      'audit-logs': 'audit_logs',
      'settings': 'settings',
      'database-config': 'settings',
      'resource-library': 'document_library'
    };

    const targetModule = viewToModuleMap[rawViewName];
    if (!targetModule) return false;
    return this.isModuleAllowed(targetModule, activeUser);
  }

  /**
   * Returns the primary or first view accessible to the given user based on their active permissions.
   * Ensures users never land on restricted pages or access-denied screens.
   */
  getFirstAllowedView(user = null) {
    const activeUser = user || this.getCurrentUser();
    if (!activeUser) return 'login';
    if (activeUser.status !== 'ACTIVE') {
      activeUser.status = 'ACTIVE';
    }
    if (this.isSuperAdmin(activeUser) || this.isAdmin(activeUser)) return 'dashboard';
    if (activeUser.role === 'NO_ACCESS' || activeUser.roleId === 'role-no-access') return 'dashboard';

    // Prioritized list of operational user views
    const viewPriority = [
      { view: 'dashboard', module: 'dashboard' },
      { view: 'inventory', module: 'machines' },
      { view: 'transfers', module: 'transfers' },
      { view: 'preventive-maintenance', module: 'preventive_maintenance' },
      { view: 'relocate', module: 'relocate' },
      { view: 'qr-codes', module: 'qr_codes' },
      { view: 'parts-trace', module: 'parts_trace' },
      { view: 'machine-history', module: 'machine_history' },
      { view: 'spare-parts', module: 'spare_parts' },
      { view: 'et-lab', module: 'et_lab' },
      { view: 'tools-management', module: 'tools_management' },
      { view: 'resource-library', module: 'document_library' },
      { view: 'manpower', module: 'manpower' },
      { view: 'reports', module: 'reports' },
      { view: 'master-data', module: 'master_data' },
      { view: 'storage', module: 'storage' },
      { view: 'users', module: 'user_management' },
      { view: 'transfer-workflows', module: 'transfer_workflows' },
      { view: 'excel-manager', module: 'excel_manager' },
      { view: 'homepage-manager', module: 'homepage_management' },
      { view: 'email-config', module: 'email_config' },
      { view: 'audit-logs', module: 'audit_logs' },
      { view: 'settings', module: 'settings' },
      { view: 'database-config', module: 'settings' }
    ];

    for (const item of viewPriority) {
      if (this.isModuleAllowed(item.module, activeUser)) {
        return item.view;
      }
    }
    return 'dashboard';
  }

  /**
   * Role hierarchy checks
   */
  isSuperAdmin(user = null) {
    const u = user || this.currentUser;
    if (!u) return false;

    // Standard users, operators, technicians, and non-admin presets can NEVER be Super Admin
    const uRole = (u.role || '').toUpperCase();
    if (uRole === 'NO_ACCESS' || uRole === 'USER' || uRole === 'VIEWER' || uRole === 'OPERATOR' || uRole === 'MAINTENANCE_USER') {
      return false;
    }
    if (u.presetId && u.presetId !== 'preset_super_admin') {
      return false;
    }

    // Explicit primary system Super Admins
    if (u.username?.toLowerCase() === 'motaher' || u.id === 'usr-super-admin') return true;
    if (u.username?.toLowerCase() === 'superadmin' || u.id === 'usr-fallback-superadmin') return true;

    // Explicit role or preset check
    if (uRole === 'SUPER_ADMIN' || u.presetId === 'preset_super_admin') return true;

    // Only if roleId matches AND role is not downgraded to normal user/admin
    return (u.roleId === 'role-super-admin' && uRole !== 'ADMIN' && uRole !== 'USER');
  }

  isAdmin(user = null) {
    const u = user || this.currentUser;
    if (!u) return false;
    if (this.isSuperAdmin(u)) return true;

    const uRole = (u.role || '').toUpperCase();
    if (uRole === 'NO_ACCESS' || uRole === 'USER' || uRole === 'VIEWER' || uRole === 'OPERATOR' || uRole === 'MAINTENANCE_USER') {
      return false;
    }
    if (u.presetId && !['preset_admin', 'preset_super_admin'].includes(u.presetId)) {
      return false;
    }

    return uRole === 'ADMIN' || u?.roleId === 'role-admin' || u?.presetId === 'preset_admin';
  }

  isManager(user = null) {
    const u = user || this.currentUser;
    if (!u) return false;
    if (this.isAdmin(u)) return true;
    const uRole = (u.role || '').toUpperCase();
    if (uRole === 'USER' || uRole === 'VIEWER' || uRole === 'MAINTENANCE_USER') return false;
    return uRole === 'MANAGER' || u?.roleId === 'role-manager' || u?.presetId === 'preset_manager' || u?.designation?.toLowerCase().includes('manager');
  }

  isUser(user = null) {
    const u = user || this.currentUser;
    return !this.isAdmin(u) && !this.isSuperAdmin(u);
  }

  isViewer(user = null) {
    const u = user || this.currentUser;
    if (!u) return false;
    return u?.role === 'VIEWER' || u?.roleId === 'role-viewer' || u?.presetId === 'preset_view_only';
  }

  // ==========================================
  // Multi-Device Session Security & Heartbeat
  // ==========================================
  checkSessionSecurity() {
    if (!this.currentUser?.id) return true;
    const fresh = storage.getItem(TABLE_NAMES.USERS, this.currentUser.id);
    if (!fresh) return true;

    if (fresh.status !== 'ACTIVE') {
      console.warn('[AuthService] Account status is no longer ACTIVE. Terminating session.');
      this.logout();
      if (typeof window !== 'undefined') {
        window.location.hash = '#login';
        if (typeof state !== 'undefined' && state.set) state.set('currentView', 'login');
      }
      return false;
    }

    const localPwdStamp = typeof localStorage !== 'undefined' ? localStorage.getItem('al_muslim_session_pwd_reset') : null;
    const dbPwdStamp = fresh.lastPasswordReset || fresh.passwordChangedAt;

    if (dbPwdStamp && localPwdStamp && localPwdStamp !== dbPwdStamp) {
      console.warn('[AuthService] 🔒 Password changed on another device. Terminating local session for protection.');
      this.terminateSessionDueToPasswordChange();
      return false;
    }

    return true;
  }

  terminateSessionDueToPasswordChange() {
    this.logout();
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem('al_muslim_session_invalidated_reason', 'PASSWORD_CHANGED');
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      window.location.hash = '#login';
      if (typeof state !== 'undefined' && state.set) {
        state.set('currentView', 'login');
      }
      try {
        window.dispatchEvent(new CustomEvent('erp:session-terminated', { detail: { reason: 'PASSWORD_CHANGED' } }));
      } catch (_) {}
    }
  }

  // ==========================================
  // System Maintenance Mode Controls
  // ==========================================
  getMaintenanceModeConfig() {
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    return {
      enabled: Boolean(settings.maintenanceMode),
      message: settings.maintenanceMessage || 'Routine scheduled system maintenance is currently in progress. Normal operations will resume shortly.',
      estimatedEnd: settings.maintenanceEstimatedEnd || '',
      allowAdmin: settings.maintenanceAllowAdmin !== false,
      enabledAt: settings.maintenanceEnabledAt || null,
      enabledBy: settings.maintenanceEnabledBy || null
    };
  }

  isMaintenanceModeActive() {
    return Boolean(this.getMaintenanceModeConfig().enabled);
  }

  canBypassMaintenance(user = null) {
    const u = user || this.currentUser;
    if (!u) return false;
    const config = this.getMaintenanceModeConfig();
    if (!config.enabled) return true;
    if (this.isSuperAdmin(u)) return true;
    if (config.allowAdmin && this.isAdmin(u)) return true;
    return false;
  }

  async setMaintenanceMode(enabled, options = {}) {
    const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const u = this.getCurrentUser();
    const updated = {
      ...current,
      maintenanceMode: Boolean(enabled),
      maintenanceMessage: options.message !== undefined ? options.message : (current.maintenanceMessage || 'Routine scheduled system maintenance is currently in progress. Normal operations will resume shortly.'),
      maintenanceEstimatedEnd: options.estimatedEnd !== undefined ? options.estimatedEnd : (current.maintenanceEstimatedEnd || ''),
      maintenanceAllowAdmin: options.allowAdmin !== undefined ? Boolean(options.allowAdmin) : (current.maintenanceAllowAdmin !== false)
    };

    if (enabled) {
      updated.maintenanceEnabledAt = new Date().toISOString();
      updated.maintenanceEnabledBy = u?.name || u?.username || 'Administrator';
    }

    storage.data[TABLE_NAMES.SETTINGS] = updated;
    await storage.saveTable(TABLE_NAMES.SETTINGS, true);

    try {
      auditService.log(
        enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
        'SETTINGS',
        'system_settings',
        `System Maintenance Mode was turned ${enabled ? 'ON' : 'OFF'} by '${u?.name || 'Administrator'}'.`,
        null,
        { enabled, message: updated.maintenanceMessage, estimatedEnd: updated.maintenanceEstimatedEnd }
      );
    } catch (_) {}

    return updated;
  }

  // ==========================================
  // Dedicated Admin Login URL Gateway Manager
  // ==========================================
  getAdminLoginSlug() {
    let slug = '';
    try {
      const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      slug = settings.adminLoginSlug || settings.admin_login_slug;
    } catch (_) {}
    if (!slug && typeof localStorage !== 'undefined') {
      try {
        slug = localStorage.getItem('al_muslim_admin_login_slug');
        if (!slug) {
          const saved = JSON.parse(localStorage.getItem('al_muslim_erp_settings') || '{}');
          slug = saved.adminLoginSlug || saved.admin_login_slug || '';
        }
      } catch (_) {}
    }
    return (slug || 'secure-admin-gateway').trim().toLowerCase();
  }

  async setAdminLoginSlug(newSlug) {
    let raw = (newSlug || '').trim().toLowerCase();
    // Auto-strip full URL if pasted by accident (e.g. https://moviezonex.com/my-admin -> my-admin)
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const u = new URL(raw);
        raw = u.pathname;
      }
    } catch (_) {}
    if (raw.startsWith('/erp/')) raw = raw.slice(5);
    raw = raw.replace(/^\/+|\/+$/g, '');

    if (!raw) {
      throw new Error('Admin Login URL slug cannot be empty.');
    }
    if (raw.length < 3) {
      throw new Error('Admin Login URL slug must be at least 3 characters long.');
    }
    if (raw.length > 50) {
      throw new Error('Admin Login URL slug cannot exceed 50 characters.');
    }
    const slugRegex = /^[a-z0-9][a-z0-9-_]*[a-z0-9]$/;
    if (!slugRegex.test(raw)) {
      throw new Error('Admin Login URL slug may only contain letters, numbers, hyphens (-), and underscores (_), and cannot start or end with a symbol.');
    }

    const reservedRoutes = [
      'login', 'logout', 'home', 'index', 'dashboard', 'inventory', 'machines',
      'machine-inventory', 'relocate', 'needle-operations', 'needle-flow', 'needle',
      'qr-codes', 'qr', 'transfers', 'transfer-workflows', 'parts-trace', 'machine-history',
      'passport', 'preventive-maintenance', 'pm', 'reports', 'resource-library', 'documents',
      'excel-manager', 'excel-center', 'custom-fields', 'et-lab', 'spare-parts', 'tools-management',
      'tools', 'tools-equipment', 'storage', 'manpower', 'master-data', 'users', 'user-management', 'user-access',
      'homepage-manager', 'email-config', 'audit-logs', 'settings', 'database-config', 'no-access',
      'api', 'data', 'backup', 'backups', 'public', 'assets', 'css', 'js', 'lib'
    ];
    if (reservedRoutes.includes(raw)) {
      throw new Error(`The slug '${raw}' is a reserved system route. Please choose a different custom admin URL slug.`);
    }

    const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const oldSlug = current.adminLoginSlug || 'secure-admin-gateway';
    const u = this.getCurrentUser();
    const updated = {
      ...current,
      adminLoginSlug: raw,
      adminLoginSlugUpdatedAt: new Date().toISOString(),
      adminLoginSlugUpdatedBy: u?.name || u?.username || 'Administrator'
    };

    storage.data[TABLE_NAMES.SETTINGS] = updated;
    await storage.saveTable(TABLE_NAMES.SETTINGS, true);

    try {
      localStorage.setItem('al_muslim_admin_login_slug', raw);
      localStorage.setItem('al_muslim_erp_settings', JSON.stringify(updated));
    } catch (_) {}

    try {
      if (typeof syncManager !== 'undefined' && syncManager.primaryAdapter) {
        syncManager.primaryAdapter.saveTable(TABLE_NAMES.SETTINGS, updated).catch(() => {});
      }
    } catch (_) {}

    try {
      auditService.log(
        'ADMIN_URL_SLUG_UPDATED',
        'SETTINGS',
        'system_settings',
        `Admin Login Gateway URL slug was updated from '${oldSlug}' to '${raw}' by '${u?.name || 'Administrator'}'.`,
        null,
        { oldSlug, newSlug: raw }
      );
    } catch (_) {}

    return raw;
  }

  // ==========================================
  // Granular Action Access Checkers
  // ==========================================
  canViewMachines() { return this.hasAccess('machines', 'VIEW'); }
  canSearchMachines() { return this.hasAccess('machines', 'SEARCH'); }
  canAddMachine() { return this.hasAccess('machines', 'ADD'); }
  canEditMachine() { return this.hasAccess('machines', 'EDIT'); }
  canDeleteMachine() { return this.hasAccess('machines', 'DELETE'); }
  canImportMachineExcel() { return this.hasAccess('machines', 'IMPORT') || this.hasAccess('excel_import', 'MACHINE_IMPORT'); }
  canExportMachineExcel() { return this.hasAccess('machines', 'EXPORT') || this.hasAccess('excel_import', 'MACHINE_EXPORT'); }

  canViewTransfers() { return this.hasAccess('transfers', 'VIEW'); }
  canRequestTransfer() {
    return this.isSuperAdmin() || this.isAdmin() || this.hasAccess('transfers', 'CREATE_REQUEST') || this.hasAccess('transfers', 'ADD') || Boolean(this.currentUser && this.currentUser.status === 'ACTIVE');
  }
  canApproveTransfer() { return this.hasAccess('transfers', 'APPROVE'); }
  canDirectTransfer() { return this.hasAccess('transfers', 'DIRECT_TRANSFER'); }
  canExportTransfers() { return this.hasAccess('transfers', 'EXPORT') || this.hasAccess('excel_import', 'TRANSFER_EXPORT'); }

  canViewSpareParts() { return this.hasAccess('spare_parts', 'VIEW'); }
  canAddSparePartMaster() { return this.hasAccess('spare_parts', 'ADD'); }
  canEditSparePartMaster() { return this.hasAccess('spare_parts', 'EDIT'); }
  canDeleteSparePartMaster() { return this.hasAccess('spare_parts', 'DELETE'); }
  canImportPartsExcel() { return this.hasAccess('spare_parts', 'IMPORT') || this.hasAccess('excel_import', 'PARTS_IMPORT'); }
  canExportPartsExcel() { return this.hasAccess('spare_parts', 'EXPORT') || this.hasAccess('excel_import', 'PARTS_EXPORT'); }
  canAddSparePartReplacement() { return this.hasAccess('spare_parts', 'ADD_REPLACEMENT'); }

  canViewLifetimeHistory() { return this.hasAccess('machine_history', 'VIEW_LIFETIME') || this.hasAccess('machine_history', 'VIEW'); }
  canAddServiceEntry() { return this.hasAccess('machine_history', 'ADD_SERVICE'); }
  canExportHistory() { return this.hasAccess('machine_history', 'EXPORT'); }

  canViewReports() { return this.hasAccess('reports', 'VIEW_MACHINE_REPORT') || this.hasAccess('reports', 'VIEW'); }
  canExportReports() { return this.hasAccess('reports', 'EXPORT_MACHINE_REPORT') || this.hasAccess('reports', 'EXPORT'); }

  canManageUsers() { return this.hasAccess('user_management', 'VIEW_USERS') || this.isSuperAdmin(); }
  canManageRoles() { return this.hasAccess('user_management', 'MANAGE_PERMISSIONS') || this.isSuperAdmin(); }
  canManageConfig() { return this.hasAccess('admin_config', 'MACHINE_CONFIG') || this.isSuperAdmin(); }
  canManageSystemSettings() { return this.hasAccess('admin_config', 'SYSTEM_SETTINGS') || this.isSuperAdmin(); }
  canManageTemplates(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return true;
    if (this.isAdmin(u) || this.isSuperAdmin(u)) return true;
    return this.hasAccess('admin_config', 'MACHINE_CONFIG', u) ||
           this.hasAccess('admin_config', 'CUSTOM_FIELDS', u) ||
           this.hasAccess('excel_import', 'MACHINE_IMPORT', u) ||
           this.hasAccess('excel_manager', 'VIEW', u);
  }
  canManageFields(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return true;
    if (this.isAdmin(u) || this.isSuperAdmin(u)) return true;
    return this.hasAccess('admin_config', 'CUSTOM_FIELDS', u) ||
           this.hasAccess('admin_config', 'MACHINE_CONFIG', u) ||
           this.hasAccess('manpower', 'CUSTOM_FIELDS', u);
  }
  canViewAuditLogs() { return this.hasAccess('audit_logs', 'VIEW_LOGS') || this.isSuperAdmin(); }

  canViewTools() { return this.hasAccess('tools_management', 'VIEW') || true; }
  canAddToolAllocation() { return this.hasAccess('tools_management', 'ADD') || true; }
  canEditToolAllocation() { return this.hasAccess('tools_management', 'EDIT') || this.isAdmin(); }
  canDeleteToolAllocation() { return this.hasAccess('tools_management', 'DELETE') || this.isAdmin(); }
  canManageToolsMaster() { return this.hasAccess('tools_management', 'MANAGE_MASTER') || this.isAdmin(); }
  canDeleteToolsMaster() { return this.hasAccess('tools_management', 'DELETE_MASTER') || this.isAdmin(); }

  // ==========================================
  // Role Master CRUD by Super Admin
  // ==========================================

  createRole({ name, code, description, permissions }) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Super Admin can create custom roles.');
    }

    const cleanCode = (code || name).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    const cleanName = (name || '').trim();

    if (!cleanName) throw new Error('Role Name is required.');
    if (!cleanCode) throw new Error('Role Code is required.');

    const roles = this.getAllRoles();
    if (roles.some(r => r.code === cleanCode)) {
      throw new Error(`A role with code '${cleanCode}' already exists.`);
    }

    const newRole = {
      id: `role-custom-${Date.now()}`,
      code: cleanCode,
      name: cleanName,
      description: description?.trim() || 'Custom user role configured by Super Admin.',
      isSystem: false,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      permissions: permissions || JSON.parse(JSON.stringify(DEFAULT_PERMISSION_TEMPLATES.VIEWER))
    };

    storage.insert(TABLE_NAMES.ROLES, newRole);

    auditService.log(
      'ROLE_CREATED',
      'ADMIN',
      newRole.id,
      `Super Admin created custom role '${newRole.name}' [${newRole.code}].`
    );

    return newRole;
  }

  updateRole(roleId, updates) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Super Admin can modify roles.');
    }

    const role = storage.getItem(TABLE_NAMES.ROLES, roleId);
    if (!role) throw new Error('Role not found.');

    const updated = storage.update(TABLE_NAMES.ROLES, roleId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    auditService.log(
      'ROLE_UPDATED',
      'ADMIN',
      roleId,
      `Super Admin updated role '${role.name}' permissions and settings.`
    );

    return updated;
  }

  deleteRole(roleId) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Super Admin can delete custom roles.');
    }

    const role = storage.getItem(TABLE_NAMES.ROLES, roleId);
    if (!role) throw new Error('Role not found.');

    if (role.isSystem || role.code === 'SUPER_ADMIN' || role.code === 'ADMIN') {
      throw new Error(`Cannot delete built-in system role '${role.name}'. You can deactivate it instead.`);
    }

    // Check if any active user is assigned to this role
    const users = this.getAllUsers();
    const assignedUsers = users.filter(u => u.roleId === roleId || u.role === role.code);
    if (assignedUsers.length > 0) {
      throw new Error(`Cannot delete role '${role.name}' because it is currently assigned to ${assignedUsers.length} user(s). Please reassign them first.`);
    }

    storage.delete(TABLE_NAMES.ROLES, roleId);

    auditService.log(
      'ROLE_DELETED',
      'ADMIN',
      roleId,
      `Super Admin deleted custom role '${role.name}' [${role.code}].`
    );

    return true;
  }

  toggleRoleStatus(roleId) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Super Admin can modify role status.');
    }

    const role = storage.getItem(TABLE_NAMES.ROLES, roleId);
    if (!role) throw new Error('Role not found.');

    if (role.code === 'SUPER_ADMIN') {
      throw new Error('Super Admin role cannot be deactivated.');
    }

    const newStatus = role.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    storage.update(TABLE_NAMES.ROLES, roleId, { status: newStatus });

    auditService.log(
      'ROLE_STATUS_CHANGED',
      'ADMIN',
      roleId,
      `Role '${role.name}' status set to ${newStatus}.`
    );

    return newStatus;
  }

  // ============================================================
  // Permission Presets & Access Profiles Engine
  // ============================================================

  getAllPresets() {
    let presets = storage.getTable(TABLE_NAMES.PERMISSION_PRESETS) || [];
    let updated = false;

    // Ensure all standard system demo presets exist and have latest metadata
    (DEFAULT_PERMISSION_PRESETS || []).forEach(seed => {
      const existingIdx = presets.findIndex(p => 
        p.id === seed.id || 
        p.code === seed.code ||
        (seed.code === 'MAINTENANCE_MANAGER' && (p.code === 'MANAGER' || p.id === 'preset_manager'))
      );
      if (existingIdx === -1) {
        presets.push(JSON.parse(JSON.stringify(seed)));
        updated = true;
      } else {
        const existing = presets[existingIdx];
        if (existing.isSystem) {
          existing.id = seed.id;
          existing.code = seed.code;
          existing.name = seed.name;
          existing.accessLevel = seed.accessLevel;
          existing.description = seed.description;
          existing.icon = seed.icon;
          existing.badgeColor = seed.badgeColor;
          updated = true;
        }
      }
    });

    if (updated || presets.length === 0) {
      if (presets.length === 0) {
        presets = JSON.parse(JSON.stringify(DEFAULT_PERMISSION_PRESETS || []));
      }
      storage.setTable(TABLE_NAMES.PERMISSION_PRESETS, presets);
    }

    const allUsers = this.getAllUsers();

    // Dynamically calculate assigned users for each preset
    return presets.map(p => {
      const assignedUsers = allUsers.filter(u => {
        if (u.presetId) {
          return u.presetId === p.id || u.presetId === p.code;
        }
        // Legacy fallback matching
        if (p.code === 'SUPER_ADMIN' && (u.role === 'SUPER_ADMIN' || u.username === 'superadmin')) return true;
        if (p.code === 'ADMIN' && u.role === 'ADMIN') return true;
        if (p.code === 'MAINTENANCE_USER' && u.role === 'USER') return true;
        return false;
      });

      return {
        ...p,
        assignedUsersCount: assignedUsers.length,
        assignedUsers: assignedUsers.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          role: u.role,
          designation: u.designation
        }))
      };
    });
  }

  getPresetById(presetId) {
    if (!presetId) return null;
    const presets = this.getAllPresets();
    const normalized = String(presetId).replace(/-/g, '_');
    const hyphenated = String(presetId).replace(/_/g, '-');
    return presets.find(p => 
      p.id === presetId || 
      p.id === normalized || 
      p.id === hyphenated || 
      p.code === presetId || 
      p.code === normalized
    ) || null;
  }

  async createPreset(presetData) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Administrators can create Permission Presets.');
    }

    const name = (presetData.name || '').trim();
    if (!name) throw new Error('Preset Name is required.');

    const presets = storage.getTable(TABLE_NAMES.PERMISSION_PRESETS) || [];
    if (presets.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`A preset with name "${name}" already exists.`);
    }

    const cleanCode = (presetData.code || name).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

    const newPreset = {
      id: `preset_${Date.now()}`,
      code: cleanCode,
      name: name,
      description: presetData.description?.trim() || 'Custom access profile configured by Administrator.',
      accessLevel: presetData.accessLevel || 'Custom Access',
      badgeColor: presetData.badgeColor || '#0ea5e9',
      icon: presetData.icon || '🛡️',
      isSystem: false,
      scope: presetData.scope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] },
      permissions: presetData.permissions || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    presets.push(newPreset);
    const ok = await storage.saveTable(TABLE_NAMES.PERMISSION_PRESETS, presets, true);
    if (!ok) {
      const idx = presets.findIndex(p => p.id === newPreset.id);
      if (idx !== -1) presets.splice(idx, 1);
      throw new CloudSaveError('❌ Cloud Save Failed: Preset creation was not confirmed by the cloud.');
    }

    auditService.log(
      'CONFIG',
      'ADMIN',
      newPreset.id,
      `Created new Permission Preset & Access Profile: "${newPreset.name}" [${newPreset.code}]`
    );

    return newPreset;
  }

  async updatePreset(presetId, updates, applyToAssignedUsers = false) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Administrators can modify Permission Presets.');
    }

    const presets = storage.getTable(TABLE_NAMES.PERMISSION_PRESETS) || [];
    const idx = presets.findIndex(p => p.id === presetId || p.code === presetId);
    if (idx === -1) throw new Error('Preset not found.');

    const oldPreset = JSON.parse(JSON.stringify(presets[idx]));
    const updatedPreset = {
      ...oldPreset,
      ...updates,
      id: oldPreset.id,
      isSystem: Boolean(oldPreset.isSystem),
      updatedAt: new Date().toISOString()
    };

    presets[idx] = updatedPreset;
    const ok = await storage.saveTable(TABLE_NAMES.PERMISSION_PRESETS, presets, true);
    if (!ok) {
      presets[idx] = oldPreset;
      throw new CloudSaveError('❌ Cloud Save Failed: Preset update was not confirmed by the cloud.');
    }

    let affectedCount = 0;
    // Batch update assigned users if requested
    if (applyToAssignedUsers) {
      const users = this.getAllUsers();
      users.forEach(u => {
        const isAssigned = u.presetId === updatedPreset.id || u.presetId === updatedPreset.code ||
          (!u.presetId && updatedPreset.code === 'SUPER_ADMIN' && (u.role === 'SUPER_ADMIN' || u.username === 'superadmin')) ||
          (!u.presetId && updatedPreset.code === 'ADMIN' && u.role === 'ADMIN');

        if (isAssigned) {
          u.presetId = updatedPreset.id;
          u.presetName = updatedPreset.name;
          u.permissions = JSON.parse(JSON.stringify(updatedPreset.permissions || {}));
          if (updates.syncScopeWithUsers && updatedPreset.scope) {
            u.assignedScope = JSON.parse(JSON.stringify(updatedPreset.scope));
          }
          u.updatedAt = new Date().toISOString();
          storage.update(TABLE_NAMES.USERS, u.id, u);
          affectedCount++;
        }
      });

      if (affectedCount > 0) {
        await storage.saveTable(TABLE_NAMES.USERS, true);
      }

      if (this.currentUser && (this.currentUser.presetId === updatedPreset.id || this.currentUser.presetId === updatedPreset.code)) {
        this.currentUser = storage.getItem(TABLE_NAMES.USERS, this.currentUser.id);
      }
    }

    auditService.log(
      'CONFIG',
      'ADMIN',
      presetId,
      `Updated Permission Preset "${updatedPreset.name}" (applied to ${affectedCount} assigned users)`
    );

    return { preset: updatedPreset, affectedUsersCount: affectedCount };
  }

  async deletePreset(presetId) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Administrators can delete Permission Presets.');
    }

    let presets = this.getAllPresets();
    const preset = this.getPresetById(presetId);
    if (!preset) throw new Error('Preset not found.');

    if (preset.isSystem) {
      throw new Error(`Cannot delete built-in system preset "${preset.name}". You can customize its permissions instead.`);
    }

    // Detach any assigned users to CUSTOM
    const users = this.getAllUsers();
    let detachedCount = 0;
    users.forEach(u => {
      if (u.presetId === preset.id || u.presetId === preset.code) {
        u.presetId = 'CUSTOM';
        u.presetName = 'Custom User';
        storage.update(TABLE_NAMES.USERS, u.id, u);
        detachedCount++;
      }
    });

    const newPresets = presets.filter(p => p.id !== preset.id && p.code !== preset.code);
    const ok = await storage.saveTable(TABLE_NAMES.PERMISSION_PRESETS, newPresets, true);
    if (!ok) {
      throw new CloudSaveError('❌ Cloud Save Failed: Preset deletion was not confirmed by the cloud.');
    }
    if (detachedCount > 0) {
      await storage.saveTable(TABLE_NAMES.USERS, true);
    }

    auditService.log(
      'CONFIG',
      'ADMIN',
      presetId,
      `Deleted custom Permission Preset "${preset.name}"`
    );

    return true;
  }

  async duplicatePreset(presetId, newName = null) {
    const preset = this.getPresetById(presetId);
    if (!preset) throw new Error('Source preset not found.');

    const name = (newName || `${preset.name} (Copy)`).trim();
    return await this.createPreset({
      name: name,
      code: `${preset.code}_COPY`,
      description: `Duplicated from ${preset.name}`,
      accessLevel: preset.accessLevel,
      badgeColor: preset.badgeColor,
      icon: preset.icon,
      scope: JSON.parse(JSON.stringify(preset.scope || { allGroups: true, groupIds: [], unitIds: [], floorIds: [], lineIds: [] })),
      permissions: JSON.parse(JSON.stringify(preset.permissions || {}))
    });
  }

  async resetToDefaultPresets() {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Administrators can reset Permission Presets.');
    }
    const defaultPresets = JSON.parse(JSON.stringify(DEFAULT_PERMISSION_PRESETS || []));
    const ok = await storage.saveTable(TABLE_NAMES.PERMISSION_PRESETS, defaultPresets, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Preset reset was not confirmed by the cloud.');
    auditService.log(
      'CONFIG',
      'ADMIN',
      'PRESETS_RESET',
      'Administrator restored all factory default Permission Presets.'
    );
    return defaultPresets;
  }

  async resetToDemoPresets() {
    return await this.resetToDefaultPresets();
  }

  async assignPresetToUser(userId, presetId, syncScope = true) {
    if (!this.canManageUsers()) {
      throw new Error('Access Denied: You do not have permission to assign presets.');
    }

    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');

    if (presetId === 'CUSTOM') {
      const updated = storage.update(TABLE_NAMES.USERS, userId, {
        presetId: 'CUSTOM',
        presetName: 'Custom User',
        updatedAt: new Date().toISOString()
      });
      const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
      if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: User preset assignment was not confirmed by the cloud.');
      if (this.currentUser?.id === userId) this.currentUser = updated;
      return updated;
    }

    const preset = this.getPresetById(presetId);
    if (!preset) throw new Error('Permission Preset not found.');

    const updates = {
      presetId: preset.id,
      presetName: preset.name,
      permissions: JSON.parse(JSON.stringify(preset.permissions || {})),
      updatedAt: new Date().toISOString()
    };

    if (preset.code === 'SUPER_ADMIN') {
      updates.role = 'SUPER_ADMIN';
      updates.roleId = 'role-super-admin';
    } else if (preset.code === 'ADMIN') {
      updates.role = 'ADMIN';
      updates.roleId = 'role-admin';
    } else if (preset.code === 'MANAGER') {
      updates.role = 'MANAGER';
      updates.roleId = 'role-manager';
    } else {
      updates.role = 'USER';
      updates.roleId = 'role-maintenance-user';
    }

    if (syncScope && preset.scope) {
      updates.assignedScope = JSON.parse(JSON.stringify(preset.scope));
    }

    const updated = storage.update(TABLE_NAMES.USERS, userId, updates);
    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: User preset assignment was not confirmed by the cloud.');

    if (this.currentUser?.id === userId) this.currentUser = updated;

    auditService.log(
      'USER_UPDATED',
      'USER',
      userId,
      `Assigned Permission Preset "${preset.name}" to user ${user.name} (@${user.username})`
    );

    return updated;
  }

  async assignPresetToUsers(userIds, presetId, syncScope = true) {
    if (!Array.isArray(userIds) || userIds.length === 0) return 0;
    const preset = presetId === 'CUSTOM' ? { id: 'CUSTOM', name: 'Custom User' } : this.getPresetById(presetId);
    if (!preset) throw new Error('Permission Preset not found.');

    let count = 0;
    userIds.forEach(uid => {
      const user = storage.getItem(TABLE_NAMES.USERS, uid);
      if (user) {
        const updates = {
          presetId: preset.id,
          presetName: preset.name,
          updatedAt: new Date().toISOString()
        };
        if (preset.permissions) {
          updates.permissions = JSON.parse(JSON.stringify(preset.permissions));
        }
        if (preset.code === 'SUPER_ADMIN') {
          updates.role = 'SUPER_ADMIN';
          updates.roleId = 'role-super-admin';
        } else if (preset.code === 'ADMIN') {
          updates.role = 'ADMIN';
          updates.roleId = 'role-admin';
        } else if (preset.code === 'MANAGER') {
          updates.role = 'MANAGER';
          updates.roleId = 'role-manager';
        } else {
          updates.role = 'USER';
          updates.roleId = 'role-maintenance-user';
        }

        if (syncScope && preset.scope) {
          updates.assignedScope = JSON.parse(JSON.stringify(preset.scope));
        }
        storage.update(TABLE_NAMES.USERS, uid, updates);
        count++;
      }
    });

    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Batch preset assignment was not confirmed by the cloud.');
    return count;
  }

  // ==========================================
  // User Management by Super Admin
  // ==========================================

  async createUser({ name, username, password, confirmPassword, email, phone, employeeId, department, designation, role = 'USER', roleId, presetId, status = 'ACTIVE', mustChangePassword = false, assignedScope, permissions }) {
    if (!this.canManageUsers()) {
      throw new Error('Access Denied: You do not have permission to create user accounts.');
    }

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    let cleanUser = (username || '').trim().toLowerCase();

    if (!cleanName) throw new Error('Full Name is required.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('A valid Email Address is required.');

    // Auto-generate username from email if not provided
    if (!cleanUser) {
      cleanUser = cleanEmail.split('@')[0].replace(/[^a-z0-9_.-]/g, '');
    }

    if (!password || password.length < 4) throw new Error('Password must be at least 4 characters long.');
    if (confirmPassword && password !== confirmPassword) {
      throw new Error('Passwords do not match. Please re-enter.');
    }

    const users = this.getAllUsers();
    
    // Check email uniqueness
    if (users.some(u => u.email?.toLowerCase() === cleanEmail)) {
      throw new Error(`Email address '${cleanEmail}' is already registered.`);
    }

    // Ensure username uniqueness
    if (users.some(u => u.username?.toLowerCase() === cleanUser)) {
      cleanUser = `${cleanUser}_${Math.floor(100 + Math.random() * 900)}`;
    }

    // Determine normalized role code: 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'NO_ACCESS', or 'USER'
    const roleUpper = (role || 'USER').toUpperCase();
    let normalizedRole = 'USER';
    if (roleUpper === 'SUPER_ADMIN' || presetId === 'preset_super_admin') {
      normalizedRole = 'SUPER_ADMIN';
    } else if (roleUpper.includes('ADMIN') || presetId === 'preset_admin') {
      normalizedRole = 'ADMIN';
    } else if (roleUpper.includes('MANAGER') || presetId === 'preset_manager') {
      normalizedRole = 'MANAGER';
    } else if (roleUpper === 'NO_ACCESS' || presetId === 'no_access' || (!presetId && roleUpper === 'NO_ACCESS')) {
      normalizedRole = 'NO_ACCESS';
    } else {
      normalizedRole = 'USER';
    }

    // Role ID resolution
    let resolvedRoleId = 'role-maintenance-user';
    if (normalizedRole === 'SUPER_ADMIN') resolvedRoleId = 'role-super-admin';
    else if (normalizedRole === 'ADMIN') resolvedRoleId = 'role-admin';
    else if (normalizedRole === 'MANAGER') resolvedRoleId = 'role-manager';
    else if (normalizedRole === 'NO_ACCESS') resolvedRoleId = 'role-no-access';
    else resolvedRoleId = 'role-maintenance-user';

    // Check if preset is specified
    let selectedPreset = null;
    if (presetId && presetId !== 'no_access') {
      selectedPreset = this.getPresetById(presetId);
    }
    if (!selectedPreset && normalizedRole !== 'NO_ACCESS') {
      // Default to appropriate preset based on role
      const defaultPresetId = normalizedRole === 'SUPER_ADMIN' ? 'preset_super_admin' : (normalizedRole === 'ADMIN' ? 'preset_admin' : 'preset_maintenance_user');
      selectedPreset = this.getPresetById(defaultPresetId);
    }

    const defaultPerms = normalizedRole === 'ADMIN'
      ? (DEFAULT_PERMISSION_TEMPLATES.ADMIN || DEFAULT_PERMISSION_TEMPLATES.SUPER_ADMIN)
      : (normalizedRole === 'NO_ACCESS' ? {} : (DEFAULT_PERMISSION_TEMPLATES.USER || DEFAULT_PERMISSION_TEMPLATES.MAINTENANCE_USER));

    // If permissions are not explicitly passed or empty, load from preset or role template (or empty for NO_ACCESS)
    const effectivePermissions = permissions && Object.keys(permissions).length > 0
      ? permissions
      : (normalizedRole === 'NO_ACCESS' ? {} : JSON.parse(JSON.stringify(selectedPreset?.permissions || defaultPerms)));

    // Cryptographically hash password
    const hashedPassword = cryptoService.hashPassword(password);

    const newUser = {
      id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      username: cleanUser,
      password: hashedPassword,
      email: cleanEmail,
      phone: (phone || '').trim(),
      employeeId: (employeeId || '').trim(),
      department: (department || '').trim(),
      designation: (designation || '').trim(),
      role: normalizedRole,
      roleId: resolvedRoleId,
      presetId: selectedPreset ? selectedPreset.id : (normalizedRole === 'NO_ACCESS' ? null : 'preset_maintenance_user'),
      presetName: selectedPreset ? selectedPreset.name : (normalizedRole === 'NO_ACCESS' ? 'No Access (Pending Admin Assignment)' : 'Maintenance User'),
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      mustChangePassword: Boolean(mustChangePassword),
      assignedScope: assignedScope || (selectedPreset?.defaultScope ? JSON.parse(JSON.stringify(selectedPreset.defaultScope)) : (selectedPreset?.scope ? JSON.parse(JSON.stringify(selectedPreset.scope)) : { allGroups: false, groupIds: [], unitIds: [], floorIds: [], lineIds: [] })),
      permissions: effectivePermissions,
      createdAt: new Date().toISOString()
    };

    storage.insert(TABLE_NAMES.USERS, newUser);

    // Confirmed cloud write
    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) {
      storage.delete(TABLE_NAMES.USERS, newUser.id);
      throw new CloudSaveError('❌ Cloud Save Failed: User account creation was not confirmed by the cloud.');
    }

    auditService.log(
      'USER_CREATED',
      'USER',
      newUser.id,
      `Created user account '${newUser.name}' (${newUser.email}) with profile [${newUser.presetName}] and role [${newUser.role}].`
    );

    try {
      if (typeof window !== 'undefined' && window.notificationService) {
        window.notificationService.notify({
          title: '👤 New User Created',
          message: `${newUser.name} has been added as a ${newUser.presetName || newUser.role}.`,
          type: 'SUCCESS', module: 'user_management', action: 'VIEW',
          entityType: 'USER', entityId: newUser.id, targetUrl: '#users',
          targetRoles: ['ADMIN', 'SUPER_ADMIN']
        });
      }
    } catch (_) {}

    return newUser;
  }

  async updateUser(userId, updates) {
    const isSelf = Boolean(this.currentUser && this.currentUser.id === userId);
    if (!this.canManageUsers() && !isSelf) {
      throw new Error('Access Denied: You do not have permission to update user accounts.');
    }

    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const cleanUpdates = { ...updates };

    // Regular users updating their own profile cannot escalate privileges
    if (!this.canManageUsers()) {
      delete cleanUpdates.role;
      delete cleanUpdates.roleId;
      delete cleanUpdates.presetId;
      delete cleanUpdates.presetName;
      delete cleanUpdates.permissions;
      delete cleanUpdates.status;
      delete cleanUpdates.assignedScope;
    }

    // If updating username, verify format and uniqueness
    if (cleanUpdates.username) {
      const cleanUsername = cleanUpdates.username.trim().toLowerCase().replace(/\s+/g, '_');
      if (cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters long.');
      }
      if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
        throw new Error('Username may only contain letters, numbers, underscores, dots, and hyphens (3-30 characters).');
      }
      const users = this.getAllUsers();
      if (users.some(u => u.id !== userId && u.username?.toLowerCase() === cleanUsername)) {
        throw new Error(`Username '${cleanUsername}' is already taken by another account.`);
      }
      cleanUpdates.username = cleanUsername;
    }

    // If updating email, verify uniqueness
    if (cleanUpdates.email) {
      cleanUpdates.email = cleanUpdates.email.trim().toLowerCase();
      const users = this.getAllUsers();
      if (users.some(u => u.id !== userId && u.email?.toLowerCase() === cleanUpdates.email)) {
        throw new Error(`Email address '${cleanUpdates.email}' is already in use by another account.`);
      }
    }

    // If updating password, securely hash it and update both hash fields, mark ACTIVE
    if (cleanUpdates.password) {
      if (cleanUpdates.password.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }
      const hashed = cryptoService.hashPassword(cleanUpdates.password);
      cleanUpdates.password = hashed;
      cleanUpdates.passwordHash = hashed;
      cleanUpdates.mustChangePassword = false;
      cleanUpdates.passwordStatus = 'ACTIVE';
      cleanUpdates.lastPasswordReset = new Date().toISOString();
    }

    // If updating role, ensure roleId is updated and fallback permissions if none provided
    if (cleanUpdates.role) {
      const roleUpper = cleanUpdates.role.toUpperCase();
      let normalizedRole = 'USER';
      if (roleUpper === 'SUPER_ADMIN' || cleanUpdates.presetId === 'preset_super_admin') {
        normalizedRole = 'SUPER_ADMIN';
      } else if (roleUpper.includes('ADMIN') || cleanUpdates.presetId === 'preset_admin') {
        normalizedRole = 'ADMIN';
      } else if (roleUpper.includes('MANAGER') || cleanUpdates.presetId === 'preset_manager') {
        normalizedRole = 'MANAGER';
      } else {
        normalizedRole = 'USER';
      }

      cleanUpdates.role = normalizedRole;
      cleanUpdates.roleId = normalizedRole === 'SUPER_ADMIN' ? 'role-super-admin' : (normalizedRole === 'ADMIN' ? 'role-admin' : (normalizedRole === 'MANAGER' ? 'role-manager' : 'role-maintenance-user'));
      
      if (!cleanUpdates.permissions && !cleanUpdates.presetId) {
        cleanUpdates.permissions = JSON.parse(JSON.stringify(
          normalizedRole === 'SUPER_ADMIN'
            ? (DEFAULT_PERMISSION_TEMPLATES.SUPER_ADMIN || DEFAULT_PERMISSION_TEMPLATES.ADMIN)
            : (normalizedRole === 'ADMIN'
                ? DEFAULT_PERMISSION_TEMPLATES.ADMIN
                : (DEFAULT_PERMISSION_TEMPLATES.USER || DEFAULT_PERMISSION_TEMPLATES.MAINTENANCE_USER))
        ));
      }
    }

    // If preset is changed
    if (cleanUpdates.presetId && cleanUpdates.presetId !== user.presetId) {
      const preset = this.getPresetById(cleanUpdates.presetId);
      if (preset) {
        cleanUpdates.presetName = preset.name;
        if (preset.code === 'SUPER_ADMIN') {
          cleanUpdates.role = 'SUPER_ADMIN';
          cleanUpdates.roleId = 'role-super-admin';
        } else if (preset.code === 'ADMIN') {
          cleanUpdates.role = 'ADMIN';
          cleanUpdates.roleId = 'role-admin';
        } else if (preset.code === 'MANAGER') {
          cleanUpdates.role = 'MANAGER';
          cleanUpdates.roleId = 'role-manager';
        } else {
          cleanUpdates.role = 'USER';
          cleanUpdates.roleId = 'role-maintenance-user';
        }
        // if permissions not provided in updates, sync preset permissions
        if (!cleanUpdates.permissions) {
          cleanUpdates.permissions = JSON.parse(JSON.stringify(preset.permissions));
        }
      }
    }

    // Single atomic confirmed write - avoids race condition between
    // implicit non-confirmed save (inside storage.update) and explicit confirmed save
    const updated = await storage.updateConfirmed(TABLE_NAMES.USERS, userId, {
      ...cleanUpdates,
      updatedAt: new Date().toISOString()
    });

    if (!updated) throw new CloudSaveError('❌ Cloud Save Failed: User profile update was not confirmed by the cloud.');

    // If password was updated, clear temporary credentials cache so admin panel immediately shows SETUP
    if (cleanUpdates.password) {
      try {
        const { userAccessService } = await import('./userAccessService.js');
        userAccessService.clearTemporaryCredential(userId);
      } catch (_) {}
    }

    if (this.currentUser?.id === userId) {
      this.currentUser = updated;
      localStorage.setItem('al_muslim_active_user_id', updated.id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:user-profile-updated', { detail: updated }));
      }
    }

    auditService.log('USER_UPDATED', 'USER', userId, `Updated user profile for '${user.name}' (@${updated.username}).`);
    return updated;
  }

  /**
   * Change username of the currently logged-in user or specified user (Admin)
   */
  async changeUsername(newUsername, userId = null) {
    const targetId = userId || this.currentUser?.id;
    if (!targetId) throw new Error('No user session active.');

    // Only allow self or Admins
    if (targetId !== this.currentUser?.id && !this.canManageUsers()) {
      throw new Error('Access Denied: You cannot modify another user\'s username.');
    }

    const cleanUsername = (newUsername || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUsername)) {
      throw new Error('Username may only contain letters, numbers, underscores, dots, and hyphens (3-30 characters).');
    }

    const users = this.getAllUsers();
    if (users.some(u => u.id !== targetId && u.username?.toLowerCase() === cleanUsername)) {
      throw new Error(`Username '${cleanUsername}' is already taken. Please choose another.`);
    }

    const updated = storage.update(TABLE_NAMES.USERS, targetId, {
      username: cleanUsername,
      updatedAt: new Date().toISOString()
    });

    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Username change was not confirmed by the cloud.');

    if (this.currentUser?.id === targetId) {
      this.currentUser = updated;
      localStorage.setItem('al_muslim_active_user_id', updated.id);
    }

    auditService.log(
      'USERNAME_CHANGED',
      'USER',
      targetId,
      `User '${updated.name}' changed username to '@${cleanUsername}'.`,
      null,
      { newUsername: cleanUsername }
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:user-profile-updated', { detail: updated }));
    }

    return updated;
  }

  /**
   * Update Self Profile (Name, Email, Username, Phone)
   */
  async updateProfile(profileData) {
    if (!this.currentUser) throw new Error('No active user session.');
    const userId = this.currentUser.id;

    const updates = {};
    if (profileData.name && profileData.name.trim()) updates.name = profileData.name.trim();
    if (profileData.phone !== undefined) updates.phone = (profileData.phone || '').trim();
    if (profileData.designation !== undefined) updates.designation = (profileData.designation || '').trim();
    if (profileData.department !== undefined) updates.department = (profileData.department || '').trim();

    // Username update
    if (profileData.username) {
      const cleanUser = profileData.username.trim().toLowerCase().replace(/\s+/g, '_');
      if (cleanUser.length < 3) throw new Error('Username must be at least 3 characters long.');
      if (!/^[a-z0-9_.-]{3,30}$/.test(cleanUser)) {
        throw new Error('Username may only contain letters, numbers, underscores, dots, and hyphens.');
      }
      const users = this.getAllUsers();
      if (users.some(u => u.id !== userId && u.username?.toLowerCase() === cleanUser)) {
        throw new Error(`Username '${cleanUser}' is already taken by another account.`);
      }
      updates.username = cleanUser;
    }

    // Email update
    if (profileData.email) {
      const cleanEmail = profileData.email.trim().toLowerCase();
      if (!cleanEmail.includes('@')) throw new Error('Invalid email address format.');
      const users = this.getAllUsers();
      if (users.some(u => u.id !== userId && u.email?.toLowerCase() === cleanEmail)) {
        throw new Error(`Email '${cleanEmail}' is already registered to another account.`);
      }
      updates.email = cleanEmail;
    }

    const updated = storage.update(TABLE_NAMES.USERS, userId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Profile update was not confirmed by the cloud.');

    this.currentUser = updated;
    localStorage.setItem('al_muslim_active_user_id', updated.id);

    auditService.log(
      'PROFILE_UPDATED',
      'USER',
      userId,
      `User '${updated.name}' (@${updated.username}) updated their profile details.`
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:user-profile-updated', { detail: updated }));
    }

    return updated;
  }

  // NOTE: changePassword is defined as async below (the async version is the authoritative implementation)

  async updateUserPermissions(userId, permissions, presetId = 'CUSTOM', presetName = 'Custom User', assignedScope = null) {
    if (!this.canManageRoles()) {
      throw new Error('Access Denied: Only Administrator can override individual user permissions.');
    }
    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const updates = {
      permissions,
      presetId,
      presetName,
      updatedAt: new Date().toISOString()
    };

    if (assignedScope && typeof assignedScope === 'object') {
      updates.assignedScope = {
        allGroups: Boolean(assignedScope.allGroups),
        groupIds: Array.isArray(assignedScope.groupIds) ? assignedScope.groupIds : [],
        allUnits: Boolean(assignedScope.allUnits),
        unitIds: Array.isArray(assignedScope.unitIds) ? assignedScope.unitIds : [],
        allFloors: Boolean(assignedScope.allFloors),
        floorIds: Array.isArray(assignedScope.floorIds) ? assignedScope.floorIds : [],
        allLines: Boolean(assignedScope.allLines),
        lineIds: Array.isArray(assignedScope.lineIds) ? assignedScope.lineIds : []
      };
    }

    let hasAny = false;
    if (permissions && typeof permissions === 'object') {
      for (const k in permissions) {
        if (Array.isArray(permissions[k]) && permissions[k].length > 0) {
          hasAny = true;
          break;
        }
      }
    }

    if (!hasAny && !this.isAdmin(user) && !this.isSuperAdmin(user)) {
      updates.role = 'NO_ACCESS';
      updates.roleId = 'role-no-access';
      updates.presetId = 'no_access';
      updates.presetName = 'No Access (Pending Admin Assignment)';
      updates.permissions = {};
    } else if (hasAny && user.role === 'NO_ACCESS') {
      updates.role = 'USER';
      updates.roleId = 'role-maintenance-user';
    }

    const updated = storage.update(TABLE_NAMES.USERS, userId, updates);
    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Permission update was not confirmed by the cloud.');
    if (this.currentUser?.id === userId) this.currentUser = updated;
    auditService.log('USER_PERMISSIONS_OVERRIDDEN', 'ADMIN', userId, `Administrator customized individual permissions for '${user.name}' (${user.username}) [Profile: ${presetName}].`);
    return updated;
  }

  async deleteUser(userId) {
    if (!this.canManageUsers()) throw new Error('Access Denied: You do not have permission to delete users.');
    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User record not found.');
    if (this.currentUser?.id === userId) throw new Error('Security Notice: You cannot delete your own active user account.');
    if (user.role === 'SUPER_ADMIN' || user.roleId === 'role-super-admin' || user.username === 'superadmin') {
      throw new Error('Security Notice: The master Super Admin account cannot be deleted.');
    }
    storage.delete(TABLE_NAMES.USERS, userId);
    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) {
      storage.insert(TABLE_NAMES.USERS, user); // Rollback
      throw new CloudSaveError('❌ Cloud Save Failed: User deletion was not confirmed by the cloud.');
    }
    auditService.log('USER_DELETED', 'USER', userId, `Permanently deleted user account '${user.name}' (${user.email || user.username}).`);
    return true;
  }

  async toggleUserStatus(userId) {
    if (!this.canManageUsers()) throw new Error('Access Denied: You do not have permission to deactivate users.');
    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');
    if (user.role === 'SUPER_ADMIN' || user.username === 'superadmin') throw new Error('Super Admin account cannot be deactivated.');
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const toggled = await storage.updateConfirmed(TABLE_NAMES.USERS, userId, { status: newStatus });
    if (!toggled) throw new CloudSaveError('❌ Cloud Save Failed: User status change was not confirmed by the cloud.');
    auditService.log('USER_STATUS_TOGGLED', 'USER', userId, `Set user account '${user.name}' (${user.email || user.username}) status to ${newStatus}.`);
    return newStatus;
  }

  async resetPassword(userId, newPassword) {
    if (!this.canManageUsers()) {
      throw new Error('Access Denied: You do not have permission to reset passwords.');
    }

    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const hashedPassword = cryptoService.hashPassword(newPassword);

    const newResetTimestamp = new Date().toISOString();

    // Atomic confirmed write — save both hash fields and mark ACTIVE
    const resetOk = await storage.updateConfirmed(TABLE_NAMES.USERS, userId, {
      password: hashedPassword,
      passwordHash: hashedPassword,
      mustChangePassword: false,
      passwordStatus: 'ACTIVE',
      lastPasswordReset: newResetTimestamp,
      passwordChangedAt: newResetTimestamp,
      updatedAt: newResetTimestamp
    });
    if (!resetOk) throw new CloudSaveError('❌ Cloud Save Failed: Password reset was not confirmed by the cloud.');

    if (this.currentUser?.id === userId && typeof localStorage !== 'undefined') {
      localStorage.setItem('al_muslim_session_pwd_reset', newResetTimestamp);
    }

    // Also clear temp credential cache
    try {
      const { userAccessService } = await import('./userAccessService.js');
      userAccessService.clearTemporaryCredential(userId);
    } catch (_) {}

    auditService.log(
      'PASSWORD_RESET_ADMIN',
      'SECURITY',
      userId,
      `Admin reset password for user '${user.name}' (${user.email || user.username}).`
    );

    return true;
  }

  /**
   * Change Password for the current user (authoritative async implementation)
   */
  async changePassword(currentPassword, newPassword) {
    if (!this.currentUser) throw new Error('User not authenticated.');

    // Re-fetch user from storage to ensure we have the latest hashed password
    const userFromDb = storage.getItem(TABLE_NAMES.USERS, this.currentUser.id);
    if (!userFromDb) throw new Error('User record not found in database.');

    // Verify current password — check both 'password' and 'passwordHash' (mirrors login logic)
    const storedCurrentHash = userFromDb.password || userFromDb.passwordHash;
    const isCurrentValid = storedCurrentHash ? cryptoService.verifyPassword(currentPassword, storedCurrentHash) : false;
    if (!isCurrentValid) {
      throw new Error('Current password is incorrect. Please try again.');
    }
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const hashedPassword = cryptoService.hashPassword(newPassword);
    const newResetTimestamp = new Date().toISOString();

    // Single atomic confirmed write — save both hash fields and mark ACTIVE
    const updated = await storage.updateConfirmed(TABLE_NAMES.USERS, this.currentUser.id, {
      password: hashedPassword,
      passwordHash: hashedPassword,
      mustChangePassword: false,
      passwordStatus: 'ACTIVE',
      lastPasswordReset: newResetTimestamp,
      passwordChangedAt: newResetTimestamp,
      updatedAt: newResetTimestamp
    });

    if (!updated) throw new CloudSaveError('❌ Cloud Save Failed: Password change was not confirmed by the cloud.');

    // Update in-memory session with confirmed DB record and update this device's session timestamp
    this.currentUser = updated;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('al_muslim_session_pwd_reset', newResetTimestamp);
    }

    // Clear the temporary credential cache so admin panel shows SETUP (not TEMPORARY)
    try {
      const { userAccessService } = await import('./userAccessService.js');
      userAccessService.clearTemporaryCredential(this.currentUser.id);
    } catch (_) {}

    auditService.log(
      'PASSWORD_CHANGED',
      'SECURITY',
      this.currentUser.id,
      `User '${this.currentUser.name}' (@${this.currentUser.username}) successfully changed their account password. Status updated to ACTIVE.`
    );

    return true;
  }

  /**
   * Complete first-time password setup for a user logging in with a temporary password.
   * Atomically hashes the new password, updates database with confirmed write,
   * sets passwordStatus: 'SETUP', clears mustChangePassword, updates in-memory currentUser session,
   * and clears temporary credentials from cache.
   */
  async completeFirstLoginPassword(userId, newPassword) {
    if (!userId) throw new Error('User ID is required.');
    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User record not found in database.');

    const isSelf = Boolean(this.currentUser && (this.currentUser.id === userId || this.currentUser.id == userId));
    const isFirstLogin = Boolean(user.mustChangePassword || user.passwordStatus === 'TEMPORARY');
    if (!isSelf && !isFirstLogin && !this.canManageUsers()) {
      throw new Error('Access Denied: You do not have permission to configure this account.');
    }

    const hashedPassword = cryptoService.hashPassword(newPassword);
    const newResetTimestamp = new Date().toISOString();

    const updates = {
      password: hashedPassword,
      passwordHash: hashedPassword,
      mustChangePassword: false,
      passwordStatus: 'ACTIVE',
      lastPasswordReset: newResetTimestamp,
      passwordChangedAt: newResetTimestamp,
      updatedAt: newResetTimestamp
    };

    // 1. Confirmed write directly to MySQL Primary and local caches
    const updated = await storage.updateConfirmed(TABLE_NAMES.USERS, userId, updates);

    // 2. Update in-memory session and localStorage immediately (including this device's session timestamp)
    this.currentUser = updated || { ...user, ...updates };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('al_muslim_active_user_id', userId);
      localStorage.setItem('al_muslim_session_pwd_reset', newResetTimestamp);
    }

    // 3. Clear temporary credential cache immediately (0ms non-blocking)
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('al_muslim_temporary_credentials_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(([id]) => id !== userId);
            sessionStorage.setItem('al_muslim_temporary_credentials_cache', JSON.stringify(filtered));
          }
        }
      }
      if (typeof window !== 'undefined' && window.userAccessService) {
        window.userAccessService.clearTemporaryCredential(userId);
      }
      import('./userAccessService.js').then(({ userAccessService }) => {
        userAccessService?.clearTemporaryCredential(userId);
      }).catch(() => {});
    } catch (_) {}

    auditService.log(
      'FIRST_LOGIN_PASSWORD_SET',
      'SECURITY',
      userId,
      `User '${this.currentUser.name}' (@${this.currentUser.username}) configured permanent password on first login. Password status updated to ACTIVE.`
    );

    return this.currentUser;
  }

  requestPasswordResetOTP(identifier) {
    const users = this.getAllUsers();
    const clean = (identifier || '').trim().toLowerCase();
    const user = users.find(u => u.username?.toLowerCase() === clean || u.email?.toLowerCase() === clean);

    if (!user) {
      throw new Error(`No account found matching username or email '${identifier}'.`);
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    storage.update(TABLE_NAMES.USERS, user.id, {
      resetOTP: otpCode,
      resetOTPExpiry: expiry
    });

    auditService.log(
      'PASSWORD_RESET_REQUESTED',
      'SECURITY',
      user.id,
      `Password reset verification code generated for user '${user.username}'.`
    );

    return {
      success: true,
      otpCode: otpCode,
      user: user,
      email: user.email || `${user.username}@al-muslim.com`,
      expiresInMinutes: 15
    };
  }

  completePasswordReset(identifier, otpCode, newPassword) {
    const users = this.getAllUsers();
    const clean = (identifier || '').trim().toLowerCase();
    const user = users.find(u => u.username?.toLowerCase() === clean || u.email?.toLowerCase() === clean);

    if (!user) throw new Error('User account not found.');

    if (!user.resetOTP || user.resetOTP !== otpCode.trim()) {
      throw new Error('Invalid verification code. Please check and re-enter.');
    }

    if (user.resetOTPExpiry && new Date() > new Date(user.resetOTPExpiry)) {
      throw new Error('Verification code has expired. Please request a new code.');
    }

    if (!newPassword || newPassword.length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    const hashedPassword = cryptoService.hashPassword(newPassword);

    storage.update(TABLE_NAMES.USERS, user.id, {
      password: hashedPassword,
      resetOTP: null,
      resetOTPExpiry: null,
      mustChangePassword: false,
      updatedAt: new Date().toISOString()
    });

    auditService.log(
      'PASSWORD_RESET_COMPLETED',
      'SECURITY',
      user.id,
      `User '${user.username}' successfully completed password reset via OTP.`
    );

    return true;
  }

  isLocationAllowed(unitId, floorId = null, lineId = null, user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return false;
    // Zero-access accounts have no access anywhere
    if (u.role === 'NO_ACCESS') return false;

    const scope = u.assignedScope;
    // If no scope is assigned at all:
    // Legacy Super Admin accounts without scope record default to global bypass.
    // Regular accounts without scope record have no location access.
    if (!scope) {
      return this.isSuperAdmin(u);
    }

    // Explicit factory-wide unrestricted scope (All Groups / Factory-Wide)
    const isExplicitGlobal = Boolean(scope.allGroups) && 
      (Boolean(scope.allUnits) || (!scope.unitIds?.length && !scope.floorIds?.length && !scope.lineIds?.length));
    if (isExplicitGlobal) {
      return true;
    }

    // Check Unit-level access
    if (!scope.allUnits) {
      if (Array.isArray(scope.unitIds) && scope.unitIds.length > 0) {
        if (!unitId || !scope.unitIds.includes(unitId)) return false;
      } else if (!scope.allGroups) {
        return false;
      }
    }

    // Check Floor-level access
    if (!scope.allFloors) {
      if (Array.isArray(scope.floorIds) && scope.floorIds.length > 0) {
        if (floorId && !scope.floorIds.includes(floorId)) return false;
      } else if (!scope.allUnits && !scope.allGroups && floorId) {
        return false;
      }
    }

    // Check Line-level access
    if (!scope.allLines) {
      if (Array.isArray(scope.lineIds) && scope.lineIds.length > 0) {
        if (lineId && !scope.lineIds.includes(lineId)) return false;
      } else if (!scope.allFloors && !scope.allUnits && !scope.allGroups && lineId) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper to identify the Central Idle floor (flo-1788931702137-250 / name / code / tag)
   */
  isCentralIdleFloor(floorId) {
    if (!floorId) return false;
    if (floorId === 'flo-1788931702137-250') return true;
    const floor = storage.getItem(TABLE_NAMES.FLOORS, floorId) || 
      (storage.getTable(TABLE_NAMES.FLOORS) || []).find(f => f.id === floorId);
    if (!floor) return false;
    const name = (floor.name || '').toLowerCase();
    const code = (floor.code || '').toLowerCase();
    const tag = (floor.locationTag || '').toLowerCase();
    return name.includes('central idle') || (code === 'idle' && name.includes('central')) || tag === 'akm-idle' || name.includes('idle');
  }

  /**
   * Check if a machine is an Idle machine (Usable Idle, Idle, Repairable Idle, or on Central Idle floor)
   */
  isIdleMachine(machine) {
    if (!machine) return false;
    const status = (machine.status || '').toUpperCase().trim();
    if (
      status === 'IDLE' || 
      status === 'USABLE_IDLE' || 
      status === 'REPAIRABLE_IDLE' ||
      status === 'IN ACTIVE' ||
      status === 'INACTIVE' ||
      status === 'SPARE'
    ) return true;
    const uQty = parseInt(machine.usable_idle ?? machine.usableIdle ?? 0, 10) || 0;
    if (uQty > 0) return true;
    const rpQty = parseInt(machine.repairable_idle ?? machine.repairableIdle ?? 0, 10) || 0;
    if (rpQty > 0) return true;
    if (this.isCentralIdleFloor(machine.floorId)) return true;
    return false;
  }

  /**
   * Check if a machine can be operated (Edited, Deleted, Relocated, Status Changed) by the user.
   * Access follows the explicitly assigned location scope. Super Admin does not silently bypass.
   */
  canOperateMachine(machine, user = null) {
    if (!machine) return false;
    const u = user || this.getCurrentUser();
    if (!u) return false;
    if (u.role === 'NO_ACCESS') return false;
    return this.isLocationAllowed(machine.unitId, machine.floorId, machine.lineId, u);
  }

  /**
   * Check if a machine can be viewed by the user:
   * 1. If includeCrossFloorIdle is true: view idle machines across factory floors.
   * 2. Otherwise: strictly respect assigned Unit, Floor, and Line location scope.
   */
  canViewMachine(machine, user = null, includeCrossFloorIdle = false) {
    if (!machine) return false;
    const u = user || this.getCurrentUser();
    if (!u) return false;
    if (u.role === 'NO_ACCESS') return false;

    // Cross-Floor Idle exception
    if (includeCrossFloorIdle && this.isIdleMachine(machine)) {
      return true;
    }

    return this.isLocationAllowed(machine.unitId, machine.floorId, machine.lineId, u);
  }

  /**
   * Check if a machine is strictly View-Only for the user
   */
  isMachineViewOnlyForUser(machine, user = null, includeCrossFloorIdle = false) {
    if (!machine) return false;
    const u = user || this.getCurrentUser();
    if (!u) return false;
    return !this.canOperateMachine(machine, u) && this.canViewMachine(machine, u, includeCrossFloorIdle);
  }

  getScopedFilter(user = null) {
    const u = user || this.getCurrentUser();
    if (!u) return null;
    const scope = u.assignedScope;
    if (!scope) {
      return this.isSuperAdmin(u) ? null : { allGroups: false, unitIds: [], floorIds: [], lineIds: [] };
    }
    const isGlobal = Boolean(scope.allGroups) && 
      (Boolean(scope.allUnits) || (!scope.unitIds?.length && !scope.floorIds?.length && !scope.lineIds?.length));
    if (isGlobal) return null;

    return {
      allGroups: Boolean(scope.allGroups),
      groupIds: Array.isArray(scope.groupIds) ? scope.groupIds : [],
      allUnits: Boolean(scope.allUnits),
      unitIds: Array.isArray(scope.unitIds) ? scope.unitIds : [],
      allFloors: Boolean(scope.allFloors),
      floorIds: Array.isArray(scope.floorIds) ? scope.floorIds : [],
      allLines: Boolean(scope.allLines),
      lineIds: Array.isArray(scope.lineIds) ? scope.lineIds : []
    };
  }

  async updateUserScope(userId, assignedScope) {
    if (!this.canManageUsers() && !this.isSuperAdmin()) {
      throw new Error('Access Denied: You do not have permission to update user location access scope.');
    }

    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const cleanScope = {
      allGroups: Boolean(assignedScope?.allGroups),
      groupIds: Array.isArray(assignedScope?.groupIds) ? assignedScope.groupIds : [],
      allUnits: Boolean(assignedScope?.allUnits),
      unitIds: Array.isArray(assignedScope?.unitIds) ? assignedScope.unitIds : [],
      allFloors: Boolean(assignedScope?.allFloors),
      floorIds: Array.isArray(assignedScope?.floorIds) ? assignedScope.floorIds : [],
      allLines: Boolean(assignedScope?.allLines),
      lineIds: Array.isArray(assignedScope?.lineIds) ? assignedScope.lineIds : []
    };

    const updated = storage.update(TABLE_NAMES.USERS, userId, {
      assignedScope: cleanScope,
      updatedAt: new Date().toISOString()
    });

    const ok = await storage.saveTable(TABLE_NAMES.USERS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: User location scope update was not confirmed by the cloud.');

    if (this.currentUser?.id === userId) {
      this.currentUser = updated;
    }

    const scopeDesc = cleanScope.allGroups
      ? '🌐 All Locations (Global Unrestricted)'
      : `📍 ${cleanScope.unitIds.length} Unit(s), ${cleanScope.floorIds.length} Floor(s), ${cleanScope.lineIds.length} Line(s)`;

    auditService.log(
      'USER_SCOPE_UPDATED',
      'ADMIN',
      userId,
      `Super Admin updated location access scope for '${user.name}' (@${user.username}) to: ${scopeDesc}.`
    );

    return updated;
  }

  requiresApproval() {
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    if (!settings.requireApprovalForMaintenanceUsers) return false;
    const user = this.getCurrentUser();
    return user?.role === 'MAINTENANCE_USER' || user?.role === 'USER';
  }

  // 7 Action Check Helpers
  canRead(module) { return this.hasAccess(module, 'VIEW'); }
  canAdd(module) { return this.hasAccess(module, 'ADD'); }
  canEdit(module) { return this.hasAccess(module, 'EDIT'); }
  canDelete(module) { return this.hasAccess(module, 'DELETE'); }
  canImport(module) { return this.hasAccess(module, 'IMPORT'); }
  canExport(module) { return this.hasAccess(module, 'EXPORT'); }
  canApprove(module) { return this.hasAccess(module, 'APPROVE'); }

  canImportExcel() {
    return this.hasAccess('machines', 'IMPORT') || this.hasAccess('excel_import', 'MACHINE_IMPORT') || this.isSuperAdmin();
  }

  canExportExcel() {
    return this.hasAccess('machines', 'EXPORT') || this.hasAccess('excel_import', 'MACHINE_EXPORT') || this.hasAccess('reports', 'EXPORT');
  }

  canAddSparePart() {
    return this.hasAccess('spare_parts', 'ADD') || this.hasAccess('spare_parts', 'ADD_REPLACEMENT') || this.isSuperAdmin();
  }

  canLogServiceRepair() {
    return this.hasAccess('machine_history', 'ADD_SERVICE') || this.hasAccess('service_repair', 'ADD') || this.isSuperAdmin();
  }

  canManageSpareParts() {
    return this.hasAccess('spare_parts', 'ADD') || this.hasAccess('spare_parts', 'EDIT') || this.isSuperAdmin();
  }

  canManageAdminConfig() {
    return this.hasAccess('admin_config', 'MACHINE_CONFIG') || this.isAdmin();
  }

  canManageSystemSettings() {
    return this.hasAccess('admin_config', 'SYSTEM_SETTINGS') || this.isSuperAdmin();
  }
}

export const authService = (typeof window !== 'undefined' && window.__erpAuthService)
  ? window.__erpAuthService
  : new AuthService();

if (typeof window !== 'undefined') {
  window.__erpAuthService = authService;
  window.authService = authService;
}

