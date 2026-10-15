/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * User Access Management Service
 * 
 * Provides:
 * 1. Automatic Account Creation for new Manpower records
 * 2. Manpower <-> User Account Synchronization (profile, floor/line, active/inactive)
 * 3. Individual & Bulk Feature Permission Matrix Management
 * 4. Cryptographically Secure Initial Password Generation & Salted Hashing
 * 5. Elevated Credential Export & Standard Single-Worksheet Excel Export
 * 6. Audit & Activity Logging without Exposing Secrets
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, DEFAULT_PERMISSION_TEMPLATES, DEFAULT_PERMISSION_PRESETS } from '../db/schema.js';
import { authService } from './authService.js';
import { cryptoService } from './cryptoService.js';
import { auditService } from './auditService.js';
import { masterDataService } from './masterDataService.js';

// In-memory + sessionStorage cache for temporary plaintext initial passwords
// Available strictly for elevated Admin Credential Export workflows
const SESSION_TEMP_CRED_KEY = 'al_muslim_temporary_credentials_cache';

class UserAccessService {
  constructor() {
    this._tempCredentials = new Map();
    this._loadTempCredentialsFromSession();
  }

  _loadTempCredentialsFromSession() {
    if (typeof sessionStorage !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(SESSION_TEMP_CRED_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(([userId, item]) => {
              // Expire after 48 hours
              if (item && item.expiresAt && Date.now() < item.expiresAt) {
                this._tempCredentials.set(userId, item);
              }
            });
          }
        }
      } catch (_) {}
    }
  }

  _saveTempCredentialsToSession() {
    if (typeof sessionStorage !== 'undefined') {
      try {
        const entries = Array.from(this._tempCredentials.entries()).filter(
          ([_, item]) => item && item.expiresAt && Date.now() < item.expiresAt
        );
        sessionStorage.setItem(SESSION_TEMP_CRED_KEY, JSON.stringify(entries));
      } catch (_) {}
    }
  }

  /**
   * Generates a unique, cryptographically secure random password
   * Configurable length (default: 14 characters)
   * Guaranteed to contain uppercase, lowercase, numbers, and symbols.
   * Never contains predictable patterns or Card Number.
   */
  generateSecurePassword(length = 14) {
    const minLength = Math.max(14, length);
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous I, O
    const lowers = 'abcdefghijkmnopqrstuvwxyz'; // Exclude ambiguous l
    const numbers = '23456789'; // Exclude ambiguous 0, 1
    const symbols = '!@#$%^&*()-_=+';
    const allChars = uppers + lowers + numbers + symbols;

    let passwordChars = [];

    // Ensure at least 2 of each category
    const getRandomChar = (charset) => {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const buf = new Uint32Array(1);
        window.crypto.getRandomValues(buf);
        return charset[buf[0] % charset.length];
      }
      return charset[Math.floor(Math.random() * charset.length)];
    };

    passwordChars.push(getRandomChar(uppers));
    passwordChars.push(getRandomChar(uppers));
    passwordChars.push(getRandomChar(lowers));
    passwordChars.push(getRandomChar(lowers));
    passwordChars.push(getRandomChar(numbers));
    passwordChars.push(getRandomChar(numbers));
    passwordChars.push(getRandomChar(symbols));
    passwordChars.push(getRandomChar(symbols));

    while (passwordChars.length < minLength) {
      passwordChars.push(getRandomChar(allChars));
    }

    // Cryptographic shuffle (Fisher-Yates)
    for (let i = passwordChars.length - 1; i > 0; i--) {
      let j = 0;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const buf = new Uint32Array(1);
        window.crypto.getRandomValues(buf);
        j = buf[0] % (i + 1);
      } else {
        j = Math.floor(Math.random() * (i + 1));
      }
      const tmp = passwordChars[i];
      passwordChars[i] = passwordChars[j];
      passwordChars[j] = tmp;
    }

    return passwordChars.join('');
  }

  /**
   * Stores generated plaintext initial password in temporary elevated cache
   */
  setTemporaryCredential(userId, plainPassword) {
    if (!userId || !plainPassword) return;
    this._tempCredentials.set(userId, {
      plainPassword,
      generatedAt: Date.now(),
      expiresAt: Date.now() + 48 * 60 * 60 * 1000 // 48 hour temporary validity
    });
    this._saveTempCredentialsToSession();
  }

  getTemporaryCredential(userId) {
    if (!userId) return null;
    const item = this._tempCredentials.get(userId);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this._tempCredentials.delete(userId);
      this._saveTempCredentialsToSession();
      return null;
    }
    return item.plainPassword;
  }

  clearTemporaryCredential(userId) {
    if (this._tempCredentials.has(userId)) {
      this._tempCredentials.delete(userId);
      this._saveTempCredentialsToSession();
    }
  }

  /**
   * Robust card number matcher supporting partial cards, prefixes (#), hyphens, spaces, and numeric IDs
   */
  matchesCardNumber(cardStr, query) {
    if (!cardStr || !query) return false;
    const rawCard = String(cardStr).toLowerCase().trim();
    const rawQuery = String(query).toLowerCase().trim();
    if (rawCard.includes(rawQuery)) return true;

    const normCard = rawCard.replace(/[#\s\-_]/g, '');
    const normQuery = rawQuery.replace(/[#\s\-_]/g, '');

    if (normCard && normQuery) {
      if (normCard.includes(normQuery) || normQuery.includes(normCard)) return true;
      const digitsCard = normCard.replace(/\D/g, '').replace(/^0+/, '');
      const digitsQuery = normQuery.replace(/\D/g, '').replace(/^0+/, '');
      if (digitsQuery.length >= 2 && digitsCard.length >= 2 && (digitsCard.includes(digitsQuery) || digitsQuery.includes(digitsCard))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates a unique, deterministic, clean username from employee details
   */
  generateUsernameForEmployee(employee) {
    const card = String(employee.cardNumber || employee.employeeId || '').trim();
    const cleanCard = card.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanName = (employee.name || '').trim().toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');
    
    let base = cleanCard || cleanName || 'user';
    if (/^\d+$/.test(base)) {
      base = `emp${base}`;
    }

    const allUsers = storage.getTable(TABLE_NAMES.USERS) || [];
    let username = base;
    let counter = 1;

    while (allUsers.some(u => (u.username || '').toLowerCase() === username.toLowerCase() && u.id !== employee.userId && u.manpowerId !== employee.id)) {
      username = `${base}${counter}`;
      counter++;
    }

    return username;
  }

  /**
   * Resolves default permissions and role preset based on employee designation/department
   */
  resolveDefaultPresetForEmployee(employee) {
    const desig = (employee.designation || '').toLowerCase();
    const dept = (employee.department || '').toLowerCase();

    const presets = authService.getAllPresets ? authService.getAllPresets() : [];

    // Check for management or admin roles
    if (desig.includes('manager') || desig.includes('head') || desig.includes('director')) {
      const p = presets.find(x => x.code === 'MAINTENANCE_MANAGER') || presets.find(x => x.code === 'MANAGER');
      if (p) return p;
    }

    if (desig.includes('supervisor') || desig.includes('incharge') || desig.includes('in-charge')) {
      const p = presets.find(x => x.code === 'MAINTENANCE_SUPERVISOR');
      if (p) return p;
    }

    // Standard Maintenance User
    const standardUserPreset = presets.find(x => x.code === 'MAINTENANCE_USER') ||
      presets.find(x => x.id === 'preset_maintenance_user') || {
        id: 'preset_maintenance_user',
        code: 'MAINTENANCE_USER',
        name: 'Maintenance User',
        permissions: DEFAULT_PERMISSION_TEMPLATES.USER || DEFAULT_PERMISSION_TEMPLATES.MAINTENANCE_USER
      };

    return standardUserPreset;
  }

  /**
   * 2. Automatic User Account Creation
   * Automatically creates a linked user account for a Manpower record.
   * If account already exists, updates links rather than duplicating.
   */
  async createAccountForEmployee(employee, options = {}) {
    if (!employee || (!employee.id && !employee.cardNumber)) {
      throw new Error('Valid employee record is required to create a user account.');
    }

    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    const cleanCard = String(employee.cardNumber || '').trim().toLowerCase();
    const normCard = cleanCard.replace(/[\s\-_#]/g, '');

    // Duplicate prevention: check by manpowerId, employeeId, or normalized cardNumber
    let existing = users.find(u => {
      if (employee.id && (u.manpowerId === employee.id || u.employeeId === employee.id)) return true;
      const uCard = String(u.cardNumber || u.employeeId || '').trim().toLowerCase();
      if (cleanCard && uCard === cleanCard) return true;
      const uNorm = uCard.replace(/[\s\-_#]/g, '');
      if (normCard && uNorm && normCard === uNorm) return true;
      return false;
    });

    if (existing) {
      // Account already exists — ensure Manpower fields are synced
      return await this.syncEmployeeToAccount(employee, existing.id);
    }

    const username = options.username || this.generateUsernameForEmployee(employee);
    const plainInitialPassword = options.password || this.generateSecurePassword(14);
    const hashedPassword = cryptoService.hashPassword(plainInitialPassword);

    // ZERO PERMISSIONS BY DEFAULT:
    // Whenever a new Manpower account is created, it must have ZERO permissions by default.
    // Do not automatically assign any role, module access, menu access, preset profile, or inherited permissions.
    // Only Admin can manually grant permissions later.
    const preset = options.preset || null;
    const presetId = options.presetId || (preset ? preset.id : null);
    const presetName = options.presetName || (preset ? preset.name : 'No Access (Pending Admin Assignment)');
    const role = options.role || (preset?.code === 'ADMIN' ? 'ADMIN' : 'NO_ACCESS');
    const roleId = options.roleId || (role === 'ADMIN' ? 'role-admin' : 'role-no-access');

    // Scoped location assignment: New accounts start with zero scope unless explicitly assigned
    const assignedScope = options.assignedScope ? {
      allGroups: Boolean(options.assignedScope.allGroups),
      groupIds: Array.isArray(options.assignedScope.groupIds) ? options.assignedScope.groupIds : [],
      allUnits: Boolean(options.assignedScope.allUnits),
      unitIds: Array.isArray(options.assignedScope.unitIds) ? options.assignedScope.unitIds : [],
      allFloors: Boolean(options.assignedScope.allFloors),
      floorIds: Array.isArray(options.assignedScope.floorIds) ? options.assignedScope.floorIds : [],
      allLines: Boolean(options.assignedScope.allLines),
      lineIds: Array.isArray(options.assignedScope.lineIds) ? options.assignedScope.lineIds : []
    } : {
      allGroups: false,
      groupIds: employee.groupId ? [employee.groupId] : [],
      allUnits: false,
      unitIds: employee.unitId ? [employee.unitId] : [],
      allFloors: false,
      floorIds: employee.floorId ? [employee.floorId] : [],
      allLines: false,
      lineIds: employee.lineId ? [employee.lineId] : []
    };

    // If options explicitly has permissions, use them; otherwise ZERO permissions {}
    const permissions = options.permissions 
      ? JSON.parse(JSON.stringify(options.permissions)) 
      : (preset?.permissions ? JSON.parse(JSON.stringify(preset.permissions)) : {});

    const newUser = {
      id: `usr-mp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      manpowerId: employee.id,
      cardNumber: employee.cardNumber || '',
      employeeId: employee.cardNumber || employee.id,
      name: (employee.name || 'Employee').trim(),
      username: username.toLowerCase(),
      password: hashedPassword,
      email: employee.email || `${username}@al-muslim.com`,
      phone: employee.phone || '',
      department: employee.department || 'Mechanical Maintenance',
      designation: employee.designation || 'Maintenance Technician',
      groupId: employee.groupId || 'grp-1',
      unitId: employee.unitId || null,
      floorId: employee.floorId || null,
      lineId: employee.lineId || null,
      groupName: employee.groupName || 'Al-Muslim Group',
      unitName: employee.unitName || '',
      floorName: employee.floorName || '',
      lineName: employee.lineName || employee.workingArea || '',
      role: role,
      roleId: roleId,
      presetId: presetId,
      presetName: presetName,
      status: employee.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      passwordStatus: 'TEMPORARY',
      mustChangePassword: true,
      lastPasswordReset: new Date().toISOString(),
      assignedScope: assignedScope,
      permissions: permissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoCreatedFromManpower: true
    };

    users.unshift(newUser);
    if (!options.skipSave) {
      const ok = await storage.saveTable(TABLE_NAMES.USERS, users, true);
      if (!ok) {
        const idx = users.findIndex(u => u.id === newUser.id);
        if (idx !== -1) users.splice(idx, 1);
        throw new CloudSaveError('Cloud save failed: Could not persist automatically created user account.');
      }
    }

    // Cache plain initial password in temporary memory cache for authorized credential export
    this.setTemporaryCredential(newUser.id, plainInitialPassword);

    // Audit the auto-creation
    if (!options.skipAudit) {
      auditService.log(
        'USER_ACCOUNT_AUTO_CREATED',
        'USER',
        newUser.id,
        `Automatically created user account '@${newUser.username}' for Manpower #${employee.cardNumber} (${employee.name}) - Status: ${newUser.status}.`
      );
    }

    return {
      user: newUser,
      initialPasswordPlain: plainInitialPassword
    };
  }

  /**
   * 11. Active and Inactive Account Synchronization
   * Synchronizes changes to an employee's Location, Designation, Department, or Status
   * to their linked User Account.
   */
  async syncEmployeeToAccount(employee, explicitUserId = null) {
    if (!employee) return null;

    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    const cleanCard = String(employee.cardNumber || '').trim().toLowerCase();

    let user = explicitUserId 
      ? users.find(u => u.id === explicitUserId)
      : users.find(u => 
          (employee.id && (u.manpowerId === employee.id || u.employeeId === employee.id)) ||
          (cleanCard && String(u.cardNumber || u.employeeId || '').trim().toLowerCase() === cleanCard)
        );

    if (!user) {
      return null;
    }

    const updates = {
      manpowerId: employee.id,
      cardNumber: employee.cardNumber || user.cardNumber,
      name: employee.name || user.name,
      designation: employee.designation || user.designation,
      department: employee.department || user.department,
      phone: employee.phone !== undefined ? employee.phone : user.phone,
      groupId: employee.groupId || user.groupId,
      unitId: employee.unitId !== undefined ? employee.unitId : user.unitId,
      floorId: employee.floorId !== undefined ? employee.floorId : user.floorId,
      lineId: employee.lineId !== undefined ? employee.lineId : user.lineId,
      groupName: employee.groupName || user.groupName,
      unitName: employee.unitName !== undefined ? employee.unitName : user.unitName,
      floorName: employee.floorName !== undefined ? employee.floorName : user.floorName,
      lineName: employee.lineName || employee.workingArea || user.lineName,
      status: employee.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      updatedAt: new Date().toISOString()
    };

    // Update location scope if organizational placement changed
    if (user.assignedScope && !user.assignedScope.allGroups) {
      updates.assignedScope = {
        ...user.assignedScope,
        groupIds: updates.groupId ? [updates.groupId] : user.assignedScope.groupIds,
        unitIds: updates.unitId ? [updates.unitId] : user.assignedScope.unitIds,
        floorIds: updates.floorId ? [updates.floorId] : user.assignedScope.floorIds,
        lineIds: updates.lineId ? [updates.lineId] : user.assignedScope.lineIds
      };
    }

    const updatedUser = storage.update(TABLE_NAMES.USERS, user.id, updates);
    await storage.saveTable(TABLE_NAMES.USERS, true);

    auditService.log(
      'MANPOWER_ACCOUNT_SYNC',
      'USER',
      user.id,
      `Synchronized user account '@${user.username}' with Manpower #${employee.cardNumber} - Status: ${updates.status}.`
    );

    return updatedUser;
  }

  /**
   * Retrieves unified list of all Manpower-linked accounts along with Manpower status
   * Enriches accounts with location names and password setup indicators.
   */
  getAllAccountsWithManpower() {
    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];

    // Map employees by Card Number and by ID
    const empByCard = new Map();
    const empById = new Map();
    employees.forEach(e => {
      if (e.id) empById.set(e.id, e);
      if (e.cardNumber) empByCard.set(String(e.cardNumber).trim().toLowerCase(), e);
    });

    const accounts = [];

    // 1. Process all existing User Accounts
    users.forEach(u => {
      const cleanCard = String(u.cardNumber || u.employeeId || '').trim().toLowerCase();
      const linkedEmp = (u.manpowerId && empById.get(u.manpowerId)) || (cleanCard && empByCard.get(cleanCard)) || null;

      // Extract assigned permissions summary
      let totalActions = 0;
      let totalModules = 0;
      if (u.permissions && typeof u.permissions === 'object') {
        Object.values(u.permissions).forEach(actions => {
          if (Array.isArray(actions) && actions.length > 0) {
            totalModules++;
            totalActions += actions.length;
          }
        });
      }

      // Check temporary password availability
      const hasTempPassword = Boolean(this.getTemporaryCredential(u.id));

      const floorObj = u.floorId ? masterDataService.getFloorById?.(u.floorId) : null;
      const unitObj = u.unitId ? masterDataService.getUnitById?.(u.unitId) : null;
      const groupObj = u.groupId ? masterDataService.getGroupById?.(u.groupId) : null;
      const lineObj = u.lineId ? masterDataService.getLineById?.(u.lineId) : null;

      accounts.push({
        ...u,
        type: 'ACCOUNT',
        hasAccount: true,
        linkedEmployee: linkedEmp,
        manpowerStatus: linkedEmp?.status || u.status,
        cardNumber: u.cardNumber || linkedEmp?.cardNumber || u.employeeId || '—',
        employeeName: u.name || linkedEmp?.name || 'Unnamed User',
        username: u.username || 'unassigned',
        designation: u.designation || linkedEmp?.designation || 'Staff',
        department: u.department || linkedEmp?.department || 'Central Maintenance',
        groupId: u.groupId || linkedEmp?.groupId || 'grp-1',
        groupName: groupObj?.name || u.groupName || linkedEmp?.groupName || 'Al-Muslim Group',
        unitId: u.unitId || linkedEmp?.unitId || null,
        unitName: unitObj?.name || u.unitName || linkedEmp?.unitName || '—',
        floorId: u.floorId || linkedEmp?.floorId || null,
        floorName: floorObj?.name || u.floorName || linkedEmp?.floorName || '—',
        lineId: u.lineId || linkedEmp?.lineId || null,
        lineName: lineObj?.name || u.lineName || linkedEmp?.lineName || linkedEmp?.workingArea || '—',
        accountStatus: u.status || 'ACTIVE',
        // Priority order for passwordStatus:
        // 1. If DB says ACTIVE or SETUP, OR mustChangePassword is explicitly false → ACTIVE (permanent password set)
        // 2. If DB says TEMPORARY or mustChangePassword is true or a temp credential is cached → TEMPORARY
        // 3. Default fallback → ACTIVE
        passwordStatus: (u.passwordStatus === 'ACTIVE' || u.passwordStatus === 'SETUP' || u.passwordStatus === 'CHANGED' || u.mustChangePassword === false)
          ? 'ACTIVE'
          : ((u.passwordStatus === 'TEMPORARY' || u.mustChangePassword === true || hasTempPassword) ? 'TEMPORARY' : 'ACTIVE'),
        hasTempPassword: hasTempPassword && u.passwordStatus !== 'ACTIVE' && u.passwordStatus !== 'SETUP' && u.mustChangePassword !== false,
        permissionsSummary: totalModules > 0 ? `${totalModules} Modules (${totalActions} Actions)` : 'No Permissions',
        totalModules,
        totalActions,
        lastLoginText: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never Logged In'
      });
    });

    // 2. Identify Manpower records that do NOT have a linked User Account yet
    employees.forEach(e => {
      const cleanCard = String(e.cardNumber || '').trim().toLowerCase();
      const normCard = cleanCard.replace(/[\s\-_#]/g, '');
      const hasAcc = accounts.some(a => {
        if (a.manpowerId && a.manpowerId === e.id) return true;
        const aCard = String(a.cardNumber || a.employeeId || '').trim().toLowerCase();
        if (cleanCard && aCard === cleanCard) return true;
        const aNorm = aCard.replace(/[\s\-_#]/g, '');
        if (normCard && aNorm && normCard === aNorm) return true;
        return false;
      });

      if (!hasAcc) {
        const floorObj = e.floorId ? masterDataService.getFloorById?.(e.floorId) : null;
        const unitObj = e.unitId ? masterDataService.getUnitById?.(e.unitId) : null;
        const groupObj = e.groupId ? masterDataService.getGroupById?.(e.groupId) : null;
        const lineObj = e.lineId ? masterDataService.getLineById?.(e.lineId) : null;

        accounts.push({
          id: `pending-${e.id}`,
          manpowerId: e.id,
          cardNumber: e.cardNumber || '—',
          employeeName: e.name || 'Unnamed Employee',
          username: '— (No Account)',
          designation: e.designation || 'Staff',
          department: e.department || 'Maintenance',
          groupId: e.groupId || 'grp-1',
          groupName: groupObj?.name || e.groupName || 'Al-Muslim Group',
          unitId: e.unitId || null,
          unitName: unitObj?.name || e.unitName || '—',
          floorId: e.floorId || null,
          floorName: floorObj?.name || e.floorName || '—',
          lineId: e.lineId || null,
          lineName: lineObj?.name || e.lineName || e.workingArea || '—',
          accountStatus: 'NOT_CREATED',
          passwordStatus: 'PENDING',
          permissionsSummary: 'Pending Account Creation',
          totalModules: 0,
          totalActions: 0,
          lastLoginText: '—',
          type: 'MANPOWER_UNLINKED',
          hasAccount: false,
          linkedEmployee: e
        });
      }
    });

    return accounts;
  }

  /**
   * Scans all Manpower records without accounts and bulk creates linked accounts
   */
  async autoCreateMissingAccountsForAll() {
    const all = this.getAllAccountsWithManpower();
    const missing = all.filter(a => !a.hasAccount && a.linkedEmployee);

    const successful = [];
    const failed = [];

    for (const item of missing) {
      try {
        const res = await this.createAccountForEmployee(item.linkedEmployee, { skipSave: true, skipAudit: true });
        successful.push({
          userId: res.user.id,
          employeeId: item.linkedEmployee.id,
          cardNumber: item.linkedEmployee.cardNumber || '—',
          name: item.linkedEmployee.name || 'Unnamed',
          username: res.user.username,
          designation: item.linkedEmployee.designation || item.designation || 'Staff',
          department: item.linkedEmployee.department || item.department || 'Maintenance',
          floor: item.floorName || item.linkedEmployee.floorName || '—',
          initialPassword: res.initialPasswordPlain
        });

      } catch (err) {
        failed.push({
          employeeId: item.linkedEmployee.id,
          cardNumber: item.linkedEmployee.cardNumber,
          name: item.linkedEmployee.name,
          error: err.message
        });
      }
    }

    if (successful.length > 0) {
      const users = storage.getTable(TABLE_NAMES.USERS) || [];
      await storage.saveTable(TABLE_NAMES.USERS, users, true);
    }

    auditService.log(
      'BULK_ACCOUNTS_AUTO_CREATED',
      'USER',
      'BATCH',
      `Auto-created ${successful.length} missing user accounts (${failed.length} failed).`
    );

    return { successful, failed, totalProcessed: missing.length };
  }

  /**
   * Complete Auto-Sync: Reconciles all Manpower records with User Accounts.
   * 1. Updates location/profile for existing accounts without touching permissions.
   * 2. Automatically creates user accounts with ZERO permissions (NO_ACCESS) for any Manpower records lacking an account.
   * 3. Prevents duplicates by strict 3-way matching (manpowerId, employeeId, normalized cardNumber).
   */
  async syncAllManpowerAccounts() {
    if (this._isSyncingManpower) return { success: true, alreadyRunning: true };
    this._isSyncingManpower = true;

    try {
      const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
      const users = storage.getTable(TABLE_NAMES.USERS) || [];

      let modifiedUsers = false;
      let newAccountsCount = 0;
      let syncedExistingCount = 0;

      // Build lookup maps
      const userByCard = new Map();
      const userByNormCard = new Map();
      const userByEmpId = new Map();
      users.forEach(u => {
        if (u.manpowerId) userByEmpId.set(u.manpowerId, u);
        if (u.employeeId) userByEmpId.set(u.employeeId, u);
        const c = String(u.cardNumber || u.employeeId || '').trim().toLowerCase();
        if (c) {
          userByCard.set(c, u);
          const norm = c.replace(/[\s\-_#]/g, '');
          if (norm) userByNormCard.set(norm, u);
        }
      });

      const newUsersToBatch = [];

      for (const emp of employees) {
        if (!emp || !emp.cardNumber) continue;
        const cleanCard = String(emp.cardNumber || '').trim().toLowerCase();
        const normCard = cleanCard.replace(/[\s\-_#]/g, '');
        const existing = (emp.id && userByEmpId.get(emp.id)) || 
                         (cleanCard && userByCard.get(cleanCard)) || 
                         (normCard && userByNormCard.get(normCard));

        if (existing) {
          // Reconcile organizational fields
          let userChanged = false;
          if (emp.name && existing.name !== emp.name.trim()) { existing.name = emp.name.trim(); userChanged = true; }
          if (emp.designation && existing.designation !== emp.designation) { existing.designation = emp.designation; userChanged = true; }
          if (emp.department && existing.department !== emp.department) { existing.department = emp.department; userChanged = true; }
          if (emp.unitId !== undefined && existing.unitId !== emp.unitId) { existing.unitId = emp.unitId; userChanged = true; }
          if (emp.floorId !== undefined && existing.floorId !== emp.floorId) { existing.floorId = emp.floorId; userChanged = true; }
          if (emp.lineId !== undefined && existing.lineId !== emp.lineId) { existing.lineId = emp.lineId; userChanged = true; }
          if (emp.unitName && existing.unitName !== emp.unitName) { existing.unitName = emp.unitName; userChanged = true; }
          if (emp.floorName && existing.floorName !== emp.floorName) { existing.floorName = emp.floorName; userChanged = true; }
          if ((emp.lineName || emp.workingArea) && existing.lineName !== (emp.lineName || emp.workingArea)) { existing.lineName = emp.lineName || emp.workingArea; userChanged = true; }
          const targetStatus = emp.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
          if (existing.status !== targetStatus) { existing.status = targetStatus; userChanged = true; }
          if (existing.manpowerId !== emp.id) { existing.manpowerId = emp.id; userChanged = true; }

          if (userChanged) {
            existing.updatedAt = new Date().toISOString();
            modifiedUsers = true;
            syncedExistingCount++;
          }
        } else {
          // Missing account: auto-create with ZERO permissions
          const username = this.generateUsernameForEmployee(emp);
          const plainInitialPassword = this.generateSecurePassword(14);
          const hashedPassword = cryptoService.hashPassword(plainInitialPassword);

          const newUser = {
            id: `usr-mp-${Date.now()}-${Math.floor(Math.random() * 10000)}-${newUsersToBatch.length}`,
            manpowerId: emp.id,
            cardNumber: emp.cardNumber || '',
            employeeId: emp.cardNumber || emp.id,
            name: (emp.name || 'Employee').trim(),
            username: username.toLowerCase(),
            email: emp.email || '',
            phone: emp.phone || '',
            role: 'NO_ACCESS',
            roleId: 'role-no-access',
            presetId: 'no_access',
            presetName: 'No Access (Pending Admin Assignment)',
            designation: emp.designation || 'Staff',
            department: emp.department || 'Maintenance',
            groupId: emp.groupId || 'grp-1',
            groupName: emp.groupName || 'Al-Muslim Group',
            unitId: emp.unitId || null,
            unitName: emp.unitName || '',
            floorId: emp.floorId || null,
            floorName: emp.floorName || '',
            lineId: emp.lineId || null,
            lineName: emp.lineName || emp.workingArea || '',
            password: hashedPassword,
            passwordHash: hashedPassword,
            passwordStatus: 'TEMPORARY',
            status: emp.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
            mustChangePassword: true,
            lastPasswordReset: new Date().toISOString(),
            assignedScope: {
              allGroups: false,
              groupIds: emp.groupId ? [emp.groupId] : [],
              allUnits: false,
              unitIds: emp.unitId ? [emp.unitId] : [],
              allFloors: false,
              floorIds: emp.floorId ? [emp.floorId] : [],
              allLines: false,
              lineIds: emp.lineId ? [emp.lineId] : []
            },
            permissions: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            autoCreatedFromManpower: true
          };

          newUsersToBatch.push(newUser);
          this.setTemporaryCredential(newUser.id, plainInitialPassword);
          userByEmpId.set(emp.id, newUser);
          userByCard.set(cleanCard, newUser);
          if (normCard) userByNormCard.set(normCard, newUser);
          newAccountsCount++;
        }
      }

      if (newUsersToBatch.length > 0) {
        users.unshift(...newUsersToBatch);
        modifiedUsers = true;
      }

      if (modifiedUsers) {
        await storage.saveTable(TABLE_NAMES.USERS, users, true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp:users-updated'));
        }
      }

      auditService.log(
        'MANPOWER_AUTO_SYNC',
        'SYSTEM',
        'MANPOWER_SYNC',
        `Reconciled ${employees.length} Manpower employees: ${newAccountsCount} new zero-access accounts created, ${syncedExistingCount} existing accounts updated.`
      );

      return {
        success: true,
        totalEmployees: employees.length,
        newAccountsCount,
        syncedExistingCount,
        totalUsers: users.length
      };

    } catch (err) {
      console.error('[UserAccessService] Manpower auto-sync failed:', err);
      return { success: false, error: err.message };
    } finally {
      this._isSyncingManpower = false;
    }
  }

  /**
   * 6. Bulk Access Assignment
   * Assigns permissions and optional location scope to multiple selected users
   * Modes:
   *   'ADD': Adds permissions without revoking existing ones
   *   'REPLACE': Replaces existing permissions with selected ones
   */
  async bulkAssignPermissions(userIds = [], permissions = {}, mode = 'ADD', assignedScope = null) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('Please select at least one user account for bulk permission assignment.');
    }

    if (!permissions || Object.keys(permissions).length === 0) {
      throw new Error('Please select at least one module permission to assign.');
    }

    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    const successful = [];
    const failed = [];

    userIds.forEach(uid => {
      const idx = users.findIndex(u => u.id === uid);
      if (idx === -1) {
        failed.push({ userId: uid, reason: 'User record not found.' });
        return;
      }

      const target = users[idx];

      try {
        let updatedPerms = {};

        if (mode === 'REPLACE') {
          // Mode B: Replace entire permission structure
          updatedPerms = {};
          Object.entries(permissions).forEach(([modKey, acts]) => {
            if (Array.isArray(acts)) {
              updatedPerms[modKey] = [...acts];
            } else if (acts && typeof acts === 'object') {
              updatedPerms[modKey] = Object.entries(acts).filter(([_, v]) => Boolean(v)).map(([k]) => k.toUpperCase());
            }
          });
        } else {
          // Mode A: Add permissions without removing existing ones
          updatedPerms = JSON.parse(JSON.stringify(target.permissions || {}));
          Object.entries(permissions).forEach(([modKey, newActions]) => {
            if (!Array.isArray(updatedPerms[modKey])) {
              updatedPerms[modKey] = [];
            }
            if (Array.isArray(newActions)) {
              newActions.forEach(act => {
                const normAct = String(act).toUpperCase();
                if (!updatedPerms[modKey].includes(normAct)) {
                  updatedPerms[modKey].push(normAct);
                }
              });
            } else if (newActions && typeof newActions === 'object') {
              Object.entries(newActions).forEach(([act, val]) => {
                const normAct = String(act).toUpperCase();
                if (val && !updatedPerms[modKey].includes(normAct)) {
                  updatedPerms[modKey].push(normAct);
                }
              });
            }
          });
        }

        let hasAny = false;
        if (updatedPerms && typeof updatedPerms === 'object') {
          for (const k in updatedPerms) {
            if (Array.isArray(updatedPerms[k]) && updatedPerms[k].length > 0) {
              hasAny = true;
              break;
            }
          }
        }

        target.permissions = updatedPerms;
        if (!hasAny && target.role !== 'SUPER_ADMIN' && target.role !== 'ADMIN') {
          target.role = 'NO_ACCESS';
          target.roleId = 'role-no-access';
          target.presetId = 'no_access';
          target.presetName = 'No Access (Pending Admin Assignment)';
        } else {
          target.presetId = 'CUSTOM';
          target.presetName = 'Custom Access';
          if (target.role === 'NO_ACCESS') {
            target.role = 'USER';
            target.roleId = 'role-maintenance-user';
          }
        }

        // Apply bulk location scope if provided
        if (assignedScope && typeof assignedScope === 'object') {
          const cleanScope = {
            allGroups: Boolean(assignedScope.allGroups),
            groupIds: Array.isArray(assignedScope.groupIds) ? [...assignedScope.groupIds] : [],
            allUnits: Boolean(assignedScope.allUnits),
            unitIds: Array.isArray(assignedScope.unitIds) ? [...assignedScope.unitIds] : [],
            allFloors: Boolean(assignedScope.allFloors),
            floorIds: Array.isArray(assignedScope.floorIds) ? [...assignedScope.floorIds] : [],
            allLines: Boolean(assignedScope.allLines),
            lineIds: Array.isArray(assignedScope.lineIds) ? [...assignedScope.lineIds] : []
          };

          if (mode === 'REPLACE' || !target.assignedScope) {
            target.assignedScope = JSON.parse(JSON.stringify(cleanScope));
          } else {
            // Mode A (ADD): Merge location scopes
            if (cleanScope.allGroups) target.assignedScope.allGroups = true;
            if (cleanScope.allUnits) target.assignedScope.allUnits = true;
            if (cleanScope.allFloors) target.assignedScope.allFloors = true;
            if (cleanScope.allLines) target.assignedScope.allLines = true;

            cleanScope.groupIds.forEach(g => {
              if (!target.assignedScope.groupIds) target.assignedScope.groupIds = [];
              if (!target.assignedScope.groupIds.includes(g)) target.assignedScope.groupIds.push(g);
            });
            cleanScope.unitIds.forEach(u => {
              if (!target.assignedScope.unitIds) target.assignedScope.unitIds = [];
              if (!target.assignedScope.unitIds.includes(u)) target.assignedScope.unitIds.push(u);
            });
            cleanScope.floorIds.forEach(f => {
              if (!target.assignedScope.floorIds) target.assignedScope.floorIds = [];
              if (!target.assignedScope.floorIds.includes(f)) target.assignedScope.floorIds.push(f);
            });
            cleanScope.lineIds.forEach(l => {
              if (!target.assignedScope.lineIds) target.assignedScope.lineIds = [];
              if (!target.assignedScope.lineIds.includes(l)) target.assignedScope.lineIds.push(l);
            });
          }
        }

        target.updatedAt = new Date().toISOString();

        successful.push({
          userId: target.id,
          cardNumber: target.cardNumber || target.employeeId,
          name: target.name,
          username: target.username
        });
      } catch (e) {
        failed.push({
          userId: target.id,
          cardNumber: target.cardNumber,
          reason: e.message
        });
      }
    });

    const ok = await storage.saveTable(TABLE_NAMES.USERS, users, true);
    if (!ok) {
      throw new CloudSaveError('Cloud save failed: Could not persist bulk permission updates.');
    }

    // Record in Audit Trail
    const scopeNote = assignedScope ? ` and updated Location Scope (${this.formatScopeSummary(assignedScope)})` : '';
    auditService.log(
      mode === 'REPLACE' ? 'BULK_PERMISSIONS_REPLACED' : 'BULK_PERMISSIONS_ADDED',
      'USER',
      'BATCH',
      `Bulk assigned permissions in [${mode}] mode${scopeNote} to ${successful.length} user accounts (${failed.length} failed). Modules: ${Object.keys(permissions).join(', ')}.`
    );

    return {
      mode,
      successful,
      failed,
      successCount: successful.length,
      failureCount: failed.length,
      totalCount: userIds.length
    };
  }


  /**
   * 7 & 8. Password Generation & Reset
   * Generates a new secure random password for a single user
   */
  async generateOrResetPassword(userId, isReset = false) {
    const user = storage.getItem(TABLE_NAMES.USERS, userId);
    if (!user) throw new Error('User not found.');

    const newPlainPassword = this.generateSecurePassword(14);
    const hashedPassword = cryptoService.hashPassword(newPlainPassword);

    const updatedUser = await storage.updateConfirmed(TABLE_NAMES.USERS, userId, {
      password: hashedPassword,
      passwordStatus: 'TEMPORARY',
      mustChangePassword: true,
      lastPasswordReset: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (!updatedUser) throw new CloudSaveError('Cloud save failed during password update.');

    // Save in temporary elevated cache
    this.setTemporaryCredential(userId, newPlainPassword);

    auditService.log(
      isReset ? 'PASSWORD_RESET_ADMIN' : 'PASSWORD_GENERATED_INITIAL',
      'SECURITY',
      userId,
      `${isReset ? 'Reset' : 'Generated initial'} secure password for user '${user.name}' (@${user.username}) [Card #${user.cardNumber}].`
    );

    return {
      userId,
      username: user.username,
      plainPassword: newPlainPassword
    };
  }

  /**
   * Bulk generate initial passwords or bulk reset passwords
   */
  async bulkGenerateOrResetPasswords(userIds = [], isReset = false) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('Please select at least one user account.');
    }

    const successful = [];
    const failed = [];

    for (const uid of userIds) {
      try {
        const res = await this.generateOrResetPassword(uid, isReset);
        successful.push(res);
      } catch (err) {
        failed.push({ userId: uid, reason: err.message });
      }
    }

    auditService.log(
      isReset ? 'BULK_PASSWORDS_RESET' : 'BULK_INITIAL_PASSWORDS_GENERATED',
      'SECURITY',
      'BATCH',
      `${isReset ? 'Bulk reset' : 'Bulk generated initial'} passwords for ${successful.length} accounts (${failed.length} failed).`
    );

    return { successful, failed, total: userIds.length };
  }

  /**
   * 9 & 10. Single-Worksheet Excel Export
   * Standard Account Export: NEVER includes plaintext passwords or hashes.
   * Exports all matching records into EXACTLY ONE WORKSHEET.
   */
  async exportAccountsToExcel(accounts = [], scopeDescription = 'All Accounts') {
    if (typeof window === 'undefined' || !window.XLSX) {
      throw new Error('Excel generation library (XLSX) is not ready. Please try again.');
    }

    const headers = [
      'Serial Number',
      'Card Number',
      'Employee Name',
      'Username',
      'Designation',
      'Group',
      'Unit',
      'Floor',
      'Line',
      'Account Status',
      'Password Setup Status',
      'Assigned Permissions Summary'
    ];

    const rows = accounts.map((acc, idx) => [
      idx + 1,
      acc.cardNumber || '—',
      acc.employeeName || '—',
      acc.username || '—',
      acc.designation || '—',
      acc.groupName || '—',
      acc.unitName || '—',
      acc.floorName || '—',
      acc.lineName || '—',
      acc.accountStatus || 'ACTIVE',
      acc.passwordStatus || 'SETUP',
      acc.permissionsSummary || 'Standard Access'
    ]);

    const worksheetData = [headers, ...rows];
    const ws = window.XLSX.utils.aoa_to_sheet(worksheetData);

    // Auto-fit column widths
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(r => {
        const cell = String(r[i] || '');
        if (cell.length > maxLen) maxLen = cell.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 10), 40) };
    });
    ws['!cols'] = colWidths;

    const wb = window.XLSX.utils.book_new();
    // EXACTLY ONE WORKSHEET
    window.XLSX.utils.book_append_sheet(wb, ws, 'User_Accounts');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Al_Muslim_ERP_User_Accounts_${scopeDescription.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

    window.XLSX.writeFile(wb, filename);

    auditService.log(
      'ACCOUNT_EXPORT',
      'ADMIN',
      'EXCEL',
      `Admin exported ${accounts.length} user accounts to Excel (Scope: ${scopeDescription}, Single Worksheet).`
    );

    return { filename, count: accounts.length };
  }

  /**
   * 10. Elevated Security Credential Export
   * Re-authenticates Admin before exporting temporary login credentials.
   * Exports all matching records into EXACTLY ONE WORKSHEET.
   */
  async exportCredentialsToExcel(accounts = [], adminPassword, scopeDescription = 'Credentials') {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) throw new Error('No active administrator session.');

    if (!authService.isAdmin(currentUser)) {
      throw new Error('Access Denied: Only authorized System Administrators can export login credentials.');
    }

    if (!adminPassword) {
      throw new Error('Administrator re-authentication is required to export confidential credentials.');
    }

    const isValid = cryptoService.verifyPassword(adminPassword, currentUser.password);
    if (!isValid) {
      throw new Error('Administrator verification failed: Invalid password.');
    }

    if (typeof window === 'undefined' || !window.XLSX) {
      throw new Error('Excel generation library (XLSX) is not ready.');
    }

    const headers = [
      'Serial Number',
      'Card Number',
      'Employee Name',
      'Username',
      'Designation',
      'Group',
      'Unit',
      'Floor',
      'Line',
      'Account Status',
      'Password Setup Status',
      'Assigned Permissions Summary',
      'Initial Password'
    ];

    const rows = accounts.map((acc, idx) => {
      // Look up temporary plaintext initial password from elevated cache
      let initialPw = this.getTemporaryCredential(acc.id);
      if (!initialPw) {
        initialPw = acc.passwordStatus === 'TEMPORARY' 
          ? '[Temporary Password Expired / Re-generate Required]' 
          : '[Protected: Already Set by User]';
      }

      return [
        idx + 1,
        acc.cardNumber || '—',
        acc.employeeName || '—',
        acc.username || '—',
        acc.designation || '—',
        acc.groupName || '—',
        acc.unitName || '—',
        acc.floorName || '—',
        acc.lineName || '—',
        acc.accountStatus || 'ACTIVE',
        acc.passwordStatus || 'SETUP',
        acc.permissionsSummary || 'Standard Access',
        initialPw
      ];
    });

    const worksheetData = [headers, ...rows];
    const ws = window.XLSX.utils.aoa_to_sheet(worksheetData);

    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach(r => {
        const cell = String(r[i] || '');
        if (cell.length > maxLen) maxLen = cell.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
    });
    ws['!cols'] = colWidths;

    const wb = window.XLSX.utils.book_new();
    // EXACTLY ONE WORKSHEET
    window.XLSX.utils.book_append_sheet(wb, ws, 'User_Credentials');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Al_Muslim_ERP_User_Credentials_CONFIDENTIAL_${scopeDescription.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;

    window.XLSX.writeFile(wb, filename);

    // Audit export WITHOUT storing any password secrets
    auditService.log(
      'CREDENTIAL_EXPORT_CONFIDENTIAL',
      'SECURITY',
      'EXCEL',
      `Super Admin '${currentUser.name}' authorized and downloaded confidential credentials for ${accounts.length} accounts (Scope: ${scopeDescription}). Single Worksheet.`
    );

    return { filename, count: accounts.length };
  }

  /**
   * 13. Access & Password Activity Logs
   * Filters and retrieves audit logs related to users, access, and passwords
   */
  getUserAccessLogs(filters = {}) {
    const allLogs = (auditService._getNormalizedLogs ? auditService._getNormalizedLogs() : (storage.getTable(TABLE_NAMES.AUDIT_LOGS) || [])).slice();

    const accessActionCodes = [
      'USER_CREATED', 'USER_ACCOUNT_AUTO_CREATED', 'MANPOWER_ACCOUNT_SYNC',
      'USER_UPDATED', 'USER_DELETED', 'USER_STATUS_TOGGLED',
      'USER_PERMISSIONS_OVERRIDDEN', 'BULK_PERMISSIONS_ADDED', 'BULK_PERMISSIONS_REPLACED',
      'PASSWORD_CHANGED', 'PASSWORD_RESET_ADMIN', 'PASSWORD_GENERATED_INITIAL',
      'BULK_PASSWORDS_RESET', 'BULK_INITIAL_PASSWORDS_GENERATED',
      'PASSWORD_RESET_OTP', 'PASSWORD_RESET_COMPLETED',
      'ACCOUNT_EXPORT', 'CREDENTIAL_EXPORT_CONFIDENTIAL',
      'BULK_ACCOUNTS_AUTO_CREATED', 'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED'
    ];

    let filtered = allLogs.filter(log => {
      const act = (log.action || '').toUpperCase();
      const ent = (log.entity || '').toUpperCase();
      const det = (log.details || '').toUpperCase();

      return accessActionCodes.includes(act) ||
             ent === 'USER' || ent === 'SECURITY' || ent === 'ADMIN' ||
             det.includes('USER') || det.includes('PASSWORD') || det.includes('PERMISSION');
    });

    // Action filter
    if (filters.action && filters.action !== 'ALL') {
      filtered = filtered.filter(l => l.action === filters.action);
    }

    // Text query
    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      filtered = filtered.filter(l =>
        (l.username && l.username.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.entityId && l.entityId.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return filtered;
  }

  /**
   * Helper to format assignedScope into human readable text badge
   */
  formatScopeSummary(scope) {
    if (!scope) return 'Zero Locations';
    if (scope.allGroups && (scope.allUnits || (!scope.unitIds?.length && !scope.floorIds?.length && !scope.lineIds?.length))) {
      return '🌐 All Locations (Factory-Wide)';
    }
    const parts = [];
    if (scope.allUnits) {
      parts.push('All Units');
    } else if (Array.isArray(scope.unitIds) && scope.unitIds.length > 0) {
      parts.push(`${scope.unitIds.length} Unit${scope.unitIds.length > 1 ? 's' : ''}`);
    }

    if (scope.allFloors) {
      parts.push('All Floors');
    } else if (Array.isArray(scope.floorIds) && scope.floorIds.length > 0) {
      parts.push(`${scope.floorIds.length} Floor${scope.floorIds.length > 1 ? 's' : ''}`);
    }

    if (scope.allLines) {
      parts.push('All Lines');
    } else if (Array.isArray(scope.lineIds) && scope.lineIds.length > 0) {
      parts.push(`${scope.lineIds.length} Line${scope.lineIds.length > 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'Zero Locations';
  }
}

export const userAccessService = new UserAccessService();
