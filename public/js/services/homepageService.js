/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dynamic Home Page Content & Section Management Service
 * Handles live published & draft home page configuration, feature cards,
 * ERP modules showcase, CTA buttons, and corporate branding.
 * 
 * ✅ Database Synchronized: All published configs write to MySQL Primary.
 * ✅ Multi-Device Real-Time: Other devices receive updates via real-time polling.
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { auditService } from './auditService.js';

export const DEFAULT_HOMEPAGE_CONFIG = {
  version: '2.6',
  lastPublishedAt: new Date().toISOString(),
  sectionOrder: ['hero', 'about', 'features', 'modules', 'benefits', 'contact', 'footer'],
  
  // 1. Hero Section
  hero: {
    enabled: true,
    badgeText: '🏭 Enterprise Maintenance Department ERP',
    badgeTag: 'v3.8 LIVE',
    title: 'AL-MUSLIM GROUP',
    titleHighlight: 'MAINTENANCE DEPARTMENT ERP',
    subtitle: 'Maintenance Department ERP System',
    description: 'Manage machine inventory, machine transfers, spare parts replacement, manpower allocation, and complete equipment lifetime history from one centralized system across all manufacturing floors and production units.',
    primaryBtnText: 'User Login',
    primaryBtnAction: 'login',
    secondaryBtnText: 'Explore Machine Registry',
    secondaryBtnAction: 'inventory',
    showLiveMetrics: true
  },

  // 2. About ERP Section
  about: {
    enabled: true,
    title: 'Engineered for Heavy Garments & Apparel Plants',
    subtitle: 'System Architecture & Capabilities',
    description: 'Designed specifically for Al-Muslim Group composite knit, woven, and denim factories. The platform bridges mechanical maintenance teams, floor supervisors, store managers, and industrial engineering departments.',
    stats: [
      { label: 'Factory Units Connected', value: '4 Factories', icon: '🏭' },
      { label: 'Active Sewing & Specialized Lines', value: '38 Lines', icon: '🧵' },
      { label: 'Uptime Reliability Index', value: '99.4%', icon: '⚡' },
      { label: 'Barcode Scanning Accuracy', value: '100%', icon: '🏷️' }
    ]
  },

  // 3. Dynamic Feature Cards
  features: {
    enabled: true,
    title: 'Core System Capabilities',
    subtitle: 'State-of-the-Art Factory Operations',
    items: [
      {
        id: 'feat-1',
        icon: '📦',
        title: '7-Level Machinery Catalog',
        description: 'Complete physical machine asset register with group, unit, floor, line, brand, model, and barcode tag tracking.',
        status: 'ACTIVE',
        order: 1
      },
      {
        id: 'feat-2',
        icon: '🔄',
        title: 'Relocation & Transfer Ledger',
        description: 'Multi-level workflow approval engine for inter-floor, inter-factory, and external repair machine movements.',
        status: 'ACTIVE',
        order: 2
      },
      {
        id: 'feat-3',
        icon: '⚙️',
        title: 'Spare Parts Replacement Matrix',
        description: 'Inventory tracking, fitted part histories, minimum stock warnings, and automated parts consumption ledger.',
        status: 'ACTIVE',
        order: 3
      },
      {
        id: 'feat-4',
        icon: '👥',
        title: 'Workforce & Manpower Placement',
        description: 'Registry of mechanics, senior technicians, and floor line supervisors with custom skill grades and leave tracking.',
        status: 'ACTIVE',
        order: 4
      },
      {
        id: 'feat-5',
        icon: '📜',
        title: 'Digital Machine Passport',
        description: 'Complete lifetime lifecycle logs documenting every service, breakdown, line transfer, and spare part replacement.',
        status: 'ACTIVE',
        order: 5
      },
      {
        id: 'feat-6',
        icon: '📊',
        title: 'Excel Import / Export Hub',
        description: 'Instant roster and inventory upload/download in Microsoft Excel format with real-time error auditing.',
        status: 'ACTIVE',
        order: 6
      }
    ]
  },

  // 4. Dynamic Module Showcase
  modules: {
    enabled: true,
    title: 'Integrated ERP Modules',
    subtitle: 'Explore the Complete Suite of Industrial Plant Systems',
    items: [
      {
        id: 'mod-1',
        icon: '📦',
        name: 'Machine Inventory',
        description: 'Search, filter, view specifications, status badges, and barcode labels for all plant machinery.',
        badge: 'Core Asset',
        targetView: 'inventory',
        status: 'ACTIVE',
        order: 1
      },
      {
        id: 'mod-2',
        icon: '👥',
        name: 'Manpower Management',
        description: 'Workforce roster, employee relocations, dynamic parameters, and attendance records.',
        badge: 'Workforce',
        targetView: 'manpower',
        status: 'ACTIVE',
        order: 2
      },
      {
        id: 'mod-3',
        icon: '🔄',
        name: 'Machine Transfers',
        description: 'Transfer request authorization, floor movement records, and printed gate passes.',
        badge: 'Operations',
        targetView: 'transfers',
        status: 'ACTIVE',
        order: 3
      },
      {
        id: 'mod-4',
        icon: '⚙️',
        name: 'Spare Parts Management',
        description: 'Central parts stock, supplier catalog, price history, and machine replacement tracking.',
        badge: 'Maintenance',
        targetView: 'spare-parts',
        status: 'ACTIVE',
        order: 4
      },
      {
        id: 'mod-5',
        icon: '📜',
        name: 'Machine Lifetime History',
        description: 'Chronological timeline of all repair services, relocations, and installed spare parts.',
        badge: 'Lifecycle',
        targetView: 'machine-history',
        status: 'ACTIVE',
        order: 5
      },
      {
        id: 'mod-6',
        icon: '📊',
        name: 'Reports & Analytics Hub',
        description: 'Machine uptime reports, transfer audits, parts consumption sheets, and Excel exports.',
        badge: 'Executive',
        targetView: 'reports',
        status: 'ACTIVE',
        order: 6
      }
    ]
  },

  // 5. Factory Benefits & ROI
  benefits: {
    enabled: true,
    title: 'Enterprise Factory Benefits',
    subtitle: 'Driving Higher Machine OEE & Zero Downtime',
    items: [
      {
        icon: '🛡️',
        title: 'Zero Lost Assets',
        description: 'Every single sewing machine, overlock, lockstitch, and cutting unit is assigned a unique digital ID and floor barcode.'
      },
      {
        icon: '⏱️',
        title: '70% Faster Breakdown Response',
        description: 'Floor supervisors instantly log service requests directly to dedicated line mechanics.'
      },
      {
        icon: '💰',
        title: 'Optimized Spare Parts Consumption',
        description: 'Eliminate duplicate spare parts purchases by tracking real lifetime consumption and part replacement frequency.'
      },
      {
        icon: '📈',
        title: 'Complete Audit Transparency',
        description: 'Immutable historical logs of every relocation, approval, user activity, and maintenance action.'
      }
    ]
  },

  // 6. Support & Contact Section
  contact: {
    enabled: true,
    title: 'Factory Support & Maintenance Bay',
    subtitle: 'Central Engineering & IT Systems Helpdesk',
    phone: '+880 1711-000001',
    email: 'maintenance.support@al-muslim.com',
    location: 'Al-Muslim Group Industrial Complex, Savar, Dhaka, Bangladesh',
    hours: '24/7 Production Floor Support & Maintenance Bay'
  },

  // 7. Footer
  footer: {
    enabled: true,
    companyName: 'Al-Muslim Group',
    copyrightText: '© 2026 Al-Muslim Group Maintenance Department ERP. All Rights Reserved.',
    creditPrefix: 'Developed by',
    creditName: 'Al-Muslim IT & Engineering Division',
    creditUrl: 'https://al-muslim.com',
    showCredit: true,
    systemVersion: 'v3.8 Enterprise Edition'
  }
};

// Draft config key — drafts are local-only until published to Database
const STORAGE_KEY_DRAFT = 'al_muslim_homepage_draft_config';

class HomepageService {
  constructor() {
    this._initDraft();
  }

  /**
   * Initialize draft from published config if no local draft exists
   */
  _initDraft() {
    try {
      const draft = localStorage.getItem(STORAGE_KEY_DRAFT);
      if (!draft) {
        // Pre-populate draft from published config
        const published = this._getPublishedConfig();
        localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(published));
      }
    } catch (e) {
      console.error('Error initializing HomepageService draft:', e);
    }
  }

  /**
   * Get published config from storage (single source of truth)
   * Falls back to localStorage legacy key, then defaults.
   */
  _getPublishedConfig() {
    try {
      // Primary: storage engine
      const stored = storage.data && storage.data[TABLE_NAMES.HOMEPAGE_CONFIG];
      if (stored && typeof stored === 'object' && Object.keys(stored).length > 0) {
        return this.mergeWithDefaults(stored);
      }
    } catch (e) {}

    // Fallback: legacy localStorage key (for backward compat)
    try {
      const legacy = localStorage.getItem('al_muslim_homepage_published_config');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return this.mergeWithDefaults(parsed);
        }
      }
    } catch (e) {}

    return JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
  }

  mergeWithDefaults(saved) {
    if (!saved || typeof saved !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
    }
    const def = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
    const merged = { ...def, ...saved };

    // Ensure hero
    merged.hero = { ...def.hero, ...(saved.hero || {}) };

    // Ensure about
    merged.about = { ...def.about, ...(saved.about || {}) };
    if (!merged.about.stats || !Array.isArray(merged.about.stats) || merged.about.stats.length === 0) {
      merged.about.stats = def.about.stats;
    }

    // Ensure features
    merged.features = { ...def.features, ...(saved.features || {}) };
    if (!merged.features.items || !Array.isArray(merged.features.items) || merged.features.items.length === 0) {
      merged.features.items = def.features.items;
    }

    // Ensure modules
    merged.modules = { ...def.modules, ...(saved.modules || {}) };
    if (!merged.modules.items || !Array.isArray(merged.modules.items) || merged.modules.items.length === 0) {
      merged.modules.items = def.modules.items;
    }

    // Ensure benefits
    merged.benefits = { ...def.benefits, ...(saved.benefits || {}) };
    if (!merged.benefits.items || !Array.isArray(merged.benefits.items) || merged.benefits.items.length === 0) {
      merged.benefits.items = def.benefits.items;
    }

    // Ensure contact & footer
    merged.contact = { ...def.contact, ...(saved.contact || {}) };
    merged.footer = { ...def.footer, ...(saved.footer || {}) };

    return merged;
  }

  /**
   * Get published config — always reads from synchronized storage.
   * This ensures other devices always see the latest published version.
   */
  getPublishedConfig() {
    return this._getPublishedConfig();
  }

  /**
   * Get draft config — reads from localStorage (local-only until published)
   */
  getDraftConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DRAFT);
      if (saved) {
        return this.mergeWithDefaults(JSON.parse(saved));
      }
    } catch (e) {}
    return this.getPublishedConfig();
  }

  /**
   * Save draft config to localStorage (draft key + storage-engine key) so that
   * page refresh always restores the latest edited state without needing a
   * separate publishConfig() call.
   *
   * Flow:
   *  1. Draft key  → always saved (local preview / manager)
   *  2. Storage-engine key → saved so loadFromStorage() picks up latest on refresh
   *  3. storage.data in-memory → updated so _getPublishedConfig() returns latest
   */
  saveDraftConfig(config) {
    try {
      const serialised = JSON.stringify(config);

      // 1. Draft key (local-only, manager uses this)
      localStorage.setItem(STORAGE_KEY_DRAFT, serialised);

      // 2. Storage-engine localStorage key (read by loadFromStorage() on every page load)
      const STORAGE_KEY_PREFIX = 'al_muslim_erp_';
      localStorage.setItem(STORAGE_KEY_PREFIX + TABLE_NAMES.HOMEPAGE_CONFIG, serialised);

      // 3. Update in-memory cache so getPublishedConfig() returns latest immediately
      if (!storage.data) storage.data = {};
      storage.data[TABLE_NAMES.HOMEPAGE_CONFIG] = config;

      // 4. Update legacy key for backward compat
      try {
        localStorage.setItem('al_muslim_homepage_published_config', serialised);
      } catch (_) {}

      return true;
    } catch (e) {
      console.error('Failed to save draft homepage config:', e);
      throw new Error('Storage quota exceeded or browser storage unavailable.');
    }
  }

  /**
   * Publish config to Primary Database — the main sync operation.
   * 
   * Flow: User clicks Publish → Database write starts → 
   *       Database confirms success → UI shows Saved Successfully
   *       Database fails → UI shows Save Failed (data NOT shown as updated)
   * 
   * @returns {Promise<{success: boolean, config?: object, error?: string}>}
   */
  async publishConfig() {
    try {
      const draft = this.getDraftConfig();
      draft.lastPublishedAt = new Date().toISOString();
      draft.updatedAt = draft.lastPublishedAt;

      // Step 1: Write to Primary Database (MySQL)
      const ok = await storage.saveTable(TABLE_NAMES.HOMEPAGE_CONFIG, draft, true);

      if (!ok) {
        console.warn('[HomepageService] Database write failed during publish');
        return { success: false, error: 'Database write failed. Check your connection and try again.' };
      }

      // Step 2: Update local storage engine in-memory data (so getPublishedConfig() returns latest)
      if (!storage.data) storage.data = {};
      storage.data[TABLE_NAMES.HOMEPAGE_CONFIG] = draft;

      // Step 3: Update local draft to match published
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft));

      // Step 4: Update legacy localStorage key (backward compat)
      try {
        localStorage.setItem('al_muslim_homepage_published_config', JSON.stringify(draft));
      } catch (_) {}

      // Step 5: Update lastTableUpdates so this device knows it just wrote
      if (!storage.lastTableUpdates) storage.lastTableUpdates = {};
      storage.lastTableUpdates[TABLE_NAMES.HOMEPAGE_CONFIG] = Date.now();

      // Step 6: Dispatch update event so current page re-renders if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:homepage-updated', { detail: draft }));
        window.dispatchEvent(new CustomEvent('erp:storage-updated'));
      }

      auditService.log(
        'HOMEPAGE_PUBLISHED',
        'ADMIN',
        'homepage-config',
        'Administrator published updated dynamic Home Page configuration to Database.'
      );

      console.log('[HomepageService] ✅ Homepage config published to Database successfully');
      return { success: true, config: draft };

    } catch (e) {
      console.error('[HomepageService] Publish failed:', e);
      return { success: false, error: e.message || 'Unexpected error during publish.' };
    }
  }

  /**
   * Reset to factory defaults and publish to Database
   * @returns {Promise<{success: boolean, config?: object, error?: string}>}
   */
  async resetToDefaults() {
    const defaults = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_CONFIG));
    defaults.lastPublishedAt = new Date().toISOString();
    defaults.updatedAt = defaults.lastPublishedAt;

    // Write reset to Primary Database
    const ok = await storage.saveTable(TABLE_NAMES.HOMEPAGE_CONFIG, defaults, true);

    if (!ok) {
      return { success: false, error: 'Database write failed during reset. Try again.' };
    }

    // Update in-memory and local storage
    if (!storage.data) storage.data = {};
    storage.data[TABLE_NAMES.HOMEPAGE_CONFIG] = defaults;
    localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(defaults));
    try {
      localStorage.setItem('al_muslim_homepage_published_config', JSON.stringify(defaults));
    } catch (_) {}

    if (!storage.lastTableUpdates) storage.lastTableUpdates = {};
    storage.lastTableUpdates[TABLE_NAMES.HOMEPAGE_CONFIG] = Date.now();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:homepage-updated', { detail: defaults }));
      window.dispatchEvent(new CustomEvent('erp:storage-updated'));
    }

    auditService.log(
      'HOMEPAGE_RESET_DEFAULT',
      'ADMIN',
      'homepage-config',
      'Administrator reset Home Page to corporate factory defaults and synced to Database.'
    );

    return { success: true, config: defaults };
  }

  // ── Feature Management Helpers ─────────────────────────────────────────────
  // All helpers operate on the local draft. Call publishConfig() to sync to Database.

  addFeature(featureData) {
    const config = this.getDraftConfig();
    if (!config.features.items) config.features.items = [];
    
    const newFeature = {
      id: `feat-${Date.now()}`,
      icon: featureData.icon || '⭐',
      title: featureData.title || 'New Capability',
      description: featureData.description || 'Feature description details',
      status: featureData.status || 'ACTIVE',
      order: config.features.items.length + 1
    };

    config.features.items.push(newFeature);
    this.saveDraftConfig(config);
    return newFeature;
  }

  updateFeature(id, updates) {
    const config = this.getDraftConfig();
    const item = (config.features.items || []).find(f => f.id === id);
    if (item) {
      Object.assign(item, updates);
      this.saveDraftConfig(config);
      return item;
    }
    throw new Error('Feature not found.');
  }

  deleteFeature(id) {
    const config = this.getDraftConfig();
    config.features.items = (config.features.items || []).filter(f => f.id !== id);
    this.saveDraftConfig(config);
    return true;
  }

  toggleFeatureStatus(id) {
    const config = this.getDraftConfig();
    const item = (config.features.items || []).find(f => f.id === id);
    if (item) {
      item.status = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      this.saveDraftConfig(config);
      return item.status;
    }
    throw new Error('Feature not found.');
  }

  // ── Module Showcase Helpers ────────────────────────────────────────────────

  addModule(moduleData) {
    const config = this.getDraftConfig();
    if (!config.modules.items) config.modules.items = [];

    const newModule = {
      id: `mod-${Date.now()}`,
      icon: moduleData.icon || '📦',
      name: moduleData.name || 'New Module',
      description: moduleData.description || 'Module details and capabilities',
      badge: moduleData.badge || 'Module',
      targetView: moduleData.targetView || 'dashboard',
      status: moduleData.status || 'ACTIVE',
      order: config.modules.items.length + 1
    };

    config.modules.items.push(newModule);
    this.saveDraftConfig(config);
    return newModule;
  }

  updateModule(id, updates) {
    const config = this.getDraftConfig();
    const item = (config.modules.items || []).find(m => m.id === id);
    if (item) {
      Object.assign(item, updates);
      this.saveDraftConfig(config);
      return item;
    }
    throw new Error('Module not found.');
  }

  deleteModule(id) {
    const config = this.getDraftConfig();
    config.modules.items = (config.modules.items || []).filter(m => m.id !== id);
    this.saveDraftConfig(config);
    return true;
  }

  toggleModuleStatus(id) {
    const config = this.getDraftConfig();
    const item = (config.modules.items || []).find(m => m.id === id);
    if (item) {
      item.status = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      this.saveDraftConfig(config);
      return item.status;
    }
    throw new Error('Module not found.');
  }
}

export const homepageService = new HomepageService();
