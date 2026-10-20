/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dynamic Public Homepage Component (User-Friendly & Fully Admin Controlled)
 * 
 * Features:
 * - Truly Sticky Top Navigation with Smooth In-Page Scrolling
 * - Separate Admin Login & User Login Buttons
 * - 1-Click Fast Demo Login Access
 * - Dynamic Sections (Hero, Modules, Features, About, Benefits, Contact, Footer)
 * - Interactive Module Cards with Direct Route Navigation
 */

import { authService } from '../services/authService.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { homepageService } from '../services/homepageService.js';
import { state } from '../state.js';
import { router } from '../services/router.js?v=4.26.50';

export function renderHomepageView(isDraft = false) {
  const config = isDraft ? homepageService.getDraftConfig() : homepageService.getPublishedConfig();
  const currentUser = authService.getCurrentUser();
  const isLoggedIn = !!currentUser;
  const userInitial = (currentUser?.name?.replace(/^(Engr\.|Dr\.|Mr\.|Mrs\.|Ms\.|Md\.)\s+/i, '') || currentUser?.name || currentUser?.username || 'U').trim().charAt(0).toUpperCase();

  const isMaintenance = authService.isMaintenanceModeActive();
  const maintConfig = authService.getMaintenanceModeConfig();
  const canBypass = authService.canBypassMaintenance(currentUser);

  // 1. MAINTENANCE MODE LOCKDOWN FOR VISITORS & NON-ADMINS:
  // When Maintenance Mode is active, visitors and non-admin users ONLY see the official maintenance notice.
  // NO operational machinery data, modules, or factory statistics are exposed.
  if (isMaintenance && !canBypass) {
    return renderMaintenanceLockdownHomepage({ currentUser, isLoggedIn, userInitial, maintConfig });
  }

  const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const transfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
  const spareParts = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];

  const activeCount = machines.filter(m => m.status === 'ACTIVE').length;

  const hero = config.hero || {};
  const about = config.about || {};
  const features = config.features || { items: [] };
  const modules = config.modules || { items: [] };
  const benefits = config.benefits || { items: [] };
  const contact = config.contact || {};
  const footer = config.footer || {};

  const activeFeatures = (features.items || []).filter(f => f.status !== 'INACTIVE');
  const activeModules = (modules.items || []).filter(m => m.status !== 'INACTIVE');

  return `
    <div class="public-homepage-wrapper" style="min-height: 100%; width: 100%; background: #0b0f19; color: #f8fafc; font-family: var(--font-main); overflow: visible; display: flex; flex-direction: column; position: relative;">
      
      <!-- 1. STICKY USER-FRIENDLY PUBLIC HEADER -->
      <header class="public-header" style="position: -webkit-sticky; position: sticky; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(11, 15, 25, 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding: 12px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 25px rgba(0,0,0,0.6); flex-shrink: 0;">
        
        <!-- Brand Logo -->
        <div class="header-brand" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" id="home-brand-logo">
          <div style="width: 38px; height: 38px; background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);">
            🔧
          </div>
          <div>
            <div style="font-weight: 900; font-size: 15px; letter-spacing: 0.8px; color: #ffffff; line-height: 1.2;">
              AL-MUSLIM GROUP
            </div>
            <div style="font-size: 10.5px; color: #94a3b8; font-weight: 500;">
              Industrial Machine &amp; Assets Management System
            </div>
          </div>
        </div>

        <!-- Navigation Menu Links with Smooth Scrolling -->
        <nav class="header-nav-links" style="display: flex; gap: 20px; align-items: center;">
          <button type="button" class="btn-home-scroll-link active" data-target="hero" style="background: none; border: none; color: #38bdf8; font-size: 13.5px; font-weight: 700; cursor: pointer; padding: 4px 8px;">
            Home
          </button>
          ${modules.enabled !== false ? `
            <button type="button" class="btn-home-scroll-link" data-target="modules-section" style="background: none; border: none; color: #cbd5e1; font-size: 13.5px; font-weight: 600; cursor: pointer; padding: 4px 8px;">
              Modules
            </button>
          ` : ''}
          ${features.enabled !== false ? `
            <button type="button" class="btn-home-scroll-link" data-target="features-section" style="background: none; border: none; color: #cbd5e1; font-size: 13.5px; font-weight: 600; cursor: pointer; padding: 4px 8px;">
              Features
            </button>
          ` : ''}
          ${about.enabled !== false ? `
            <button type="button" class="btn-home-scroll-link" data-target="about-section" style="background: none; border: none; color: #cbd5e1; font-size: 13.5px; font-weight: 600; cursor: pointer; padding: 4px 8px;">
              About
            </button>
          ` : ''}
          ${contact.enabled !== false ? `
            <button type="button" class="btn-home-scroll-link" data-target="contact-section" style="background: none; border: none; color: #cbd5e1; font-size: 13.5px; font-weight: 600; cursor: pointer; padding: 4px 8px;">
              Support
            </button>
          ` : ''}
        </nav>

        <!-- Header Actions: Separate Admin & User Login or Session Dashboard -->
        <div style="display: flex; align-items: center; gap: 10px;">
          ${isLoggedIn ? `
            <div style="display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 20px; padding: 3px 12px 3px 6px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #0284c7; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                ${userInitial}
              </div>
              <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">${currentUser.name || 'User'}</span>
            </div>
            <button id="btn-home-enter-erp" class="btn btn-primary btn-sm" style="font-weight: 700; padding: 7px 16px; border-radius: 6px; box-shadow: 0 0 15px rgba(2, 132, 199, 0.5);">
              🚀 Enter Dashboard
            </button>
            <button id="btn-home-logout" class="btn btn-ghost btn-sm" style="color: #f87171; font-size: 12px; padding: 5px 8px;" title="Logout">
              🔒 Logout
            </button>
          ` : `
            <!-- Staff & Personnel Sign In Portal -->
            <button id="btn-header-login-user" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 7px 18px; border-radius: 6px; font-size: 13px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 0 15px rgba(2, 132, 199, 0.45); display: flex; align-items: center; gap: 6px;">
              <span>🔐</span>
              <span>Sign In</span>
            </button>
          `}
        </div>
      </header>

      ${isMaintenance && canBypass ? `
        <!-- Administrator Maintenance Mode Ribbon (For Logged-in Admins Only) -->
        <div style="background: linear-gradient(90deg, #92400e, #b45309, #d97706); color: #fff; padding: 10px 24px; text-align: center; font-size: 13px; font-weight: 600; box-shadow: 0 4px 20px rgba(180, 83, 9, 0.4); display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid rgba(251, 191, 36, 0.4); z-index: 50; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">⚠️</span>
            <span>
              <strong>System Maintenance Mode Active:</strong> Public visitors and general users see the lockdown notice only. You are viewing as an authorized Administrator.
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button id="btn-home-maint-settings" class="btn btn-xs" style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.4); color: #fff; font-weight: 700; padding: 3px 10px; border-radius: 4px; cursor: pointer;">
              ⚙️ Maintenance Settings
            </button>
          </div>
        </div>
      ` : (!isLoggedIn ? `
        <!-- Visitor Public Portal Notice -->
        <div style="background: rgba(15, 23, 42, 0.75); border-bottom: 1px solid rgba(56, 189, 248, 0.15); padding: 8px 24px; text-align: center; font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="color: #38bdf8; font-weight: 800;">📢 Visitor Notice:</span>
          <span>You are viewing the public portal. Internal machine assets, inventory records, and floor operations require factory login.</span>
        </div>
      ` : '')}

      <!-- 2. DYNAMIC HERO SECTION -->
      ${hero.enabled !== false ? `
        <section id="hero" style="position: relative; padding: 65px 32px 50px; max-width: 1200px; margin: 0 auto; text-align: center; width: 100%;">
          
          <!-- Background Glow Effect -->
          <div style="position: absolute; top: 25%; left: 50%; transform: translate(-50%, -50%); width: 700px; height: 350px; background: radial-gradient(circle, rgba(2, 132, 199, 0.22) 0%, rgba(11, 15, 25, 0) 70%); pointer-events: none; z-index: 0;"></div>

          <div style="position: relative; z-index: 1;">
            
            <!-- Badge -->
            ${hero.badgeText ? `
              <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 20px; padding: 6px 16px; margin-bottom: 22px; font-size: 12px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px;">
                <span>${hero.badgeText}</span>
                ${hero.badgeTag ? `<span style="background: #0284c7; color: #fff; padding: 2px 7px; border-radius: 10px; font-size: 10px;">${hero.badgeTag}</span>` : ''}
              </div>
            ` : ''}

            <!-- Main Heading -->
            <h1 style="font-size: 44px; font-weight: 900; line-height: 1.15; color: #ffffff; margin-bottom: 14px; letter-spacing: -0.5px;">
              ${hero.title || 'AL-MUSLIM MAINTENANCE ERP'}
            </h1>

            <!-- Subheading -->
            <h2 style="font-size: 21px; font-weight: 600; color: #94a3b8; margin-bottom: 18px;">
              ${hero.subtitle || 'Complete Maintenance & Workforce Management System'}
            </h2>

            <!-- Description -->
            <p style="font-size: 14.5px; color: #cbd5e1; max-width: 800px; margin: 0 auto 36px; line-height: 1.6;">
              ${hero.description || ''}
            </p>

            <!-- Live Metrics Strip (if enabled) - Privacy Protected for Unauthenticated Visitors -->
            ${hero.showLiveMetrics !== false ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; max-width: 960px; margin: 0 auto; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 18px 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.37);">
                <div style="border-right: 1px solid rgba(255,255,255,0.08); padding-right: 12px;">
                  <div style="font-size: 26px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono);">${isLoggedIn ? machines.length : '<span style="font-size: 18px; letter-spacing: 2px; color: #64748b;">••••</span>'}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Total Machines</div>
                  ${!isLoggedIn ? `<div style="font-size: 10px; color: #38bdf8; margin-top: 3px; font-weight: 700; cursor: pointer;" class="btn-live-metric-login">🔒 Sign in to view</div>` : ''}
                </div>
                <div style="border-right: 1px solid rgba(255,255,255,0.08); padding-right: 12px;">
                  <div style="font-size: 26px; font-weight: 900; color: #34d399; font-family: var(--font-mono);">${isLoggedIn ? activeCount : '<span style="font-size: 18px; letter-spacing: 2px; color: #64748b;">••••</span>'}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Active in Lines</div>
                  ${!isLoggedIn ? `<div style="font-size: 10px; color: #34d399; margin-top: 3px; font-weight: 700; cursor: pointer;" class="btn-live-metric-login">🔒 Sign in to view</div>` : ''}
                </div>
                <div style="border-right: 1px solid rgba(255,255,255,0.08); padding-right: 12px;">
                  <div style="font-size: 26px; font-weight: 900; color: #fbbf24; font-family: var(--font-mono);">${isLoggedIn ? transfers.length : '<span style="font-size: 18px; letter-spacing: 2px; color: #64748b;">••••</span>'}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Transfers Tracked</div>
                  ${!isLoggedIn ? `<div style="font-size: 10px; color: #fbbf24; margin-top: 3px; font-weight: 700; cursor: pointer;" class="btn-live-metric-login">🔒 Sign in to view</div>` : ''}
                </div>
                <div>
                  <div style="font-size: 26px; font-weight: 900; color: #c084fc; font-family: var(--font-mono);">${isLoggedIn ? spareParts.length : '<span style="font-size: 18px; letter-spacing: 2px; color: #64748b;">••••</span>'}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Master Spare Parts</div>
                  ${!isLoggedIn ? `<div style="font-size: 10px; color: #c084fc; margin-top: 3px; font-weight: 700; cursor: pointer;" class="btn-live-metric-login">🔒 Sign in to view</div>` : ''}
                </div>
              </div>
            ` : ''}

          </div>
        </section>
      ` : ''}

      <!-- 3. DYNAMIC ERP MODULES SHOWCASE -->
      ${modules.enabled !== false && activeModules.length > 0 ? `
        <section id="modules-section" style="padding: 60px 32px; background: rgba(15, 23, 42, 0.4); border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div style="max-width: 1200px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 40px;">
              <h2 style="font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 8px;">
                ${modules.title || 'Integrated ERP Modules'}
              </h2>
              <p style="font-size: 14px; color: var(--text-secondary); margin: 0 auto; max-width: 600px;">
                ${modules.subtitle || 'Explore the Complete Suite of Industrial Plant Systems'}
              </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
              ${activeModules.map(mod => `
                <div 
                  class="home-module-card" 
                  data-view="${mod.targetView || 'dashboard'}"
                  style="background: linear-gradient(145deg, #111827, #1e293b); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-lg); padding: 24px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.25s ease;"
                  onmouseover="this.style.borderColor='#38bdf8'; this.style.transform='translateY(-3px)';"
                  onmouseout="this.style.borderColor='rgba(56, 189, 248, 0.2)'; this.style.transform='translateY(0)';"
                >
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                      <div style="font-size: 32px;">${mod.icon || '📦'}</div>
                      <span class="badge badge-idle" style="font-size: 11px;">${mod.badge || 'Module'}</span>
                    </div>
                    <h3 style="font-size: 17px; font-weight: 800; color: #fff; margin-bottom: 8px;">${mod.name}</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                      ${mod.description}
                    </p>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #38bdf8; margin-top: 16px;">
                    <span>Open Module</span>
                    <span>&rarr;</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      ` : ''}

      <!-- 4. DYNAMIC FEATURES SECTION -->
      ${features.enabled !== false && activeFeatures.length > 0 ? `
        <section id="features-section" style="padding: 70px 32px; max-width: 1200px; margin: 0 auto; width: 100%;">
          <div style="text-align: center; margin-bottom: 44px;">
            <h2 style="font-size: 28px; font-weight: 900; color: #fff; margin-bottom: 8px;">
              ${features.title || 'Core System Capabilities'}
            </h2>
            <p style="font-size: 14px; color: var(--text-secondary); margin: 0 auto; max-width: 600px;">
              ${features.subtitle || 'State-of-the-Art Factory Operations'}
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
            ${activeFeatures.map(feat => `
              <div style="background: rgba(17, 24, 39, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-lg); padding: 24px; transition: border-color 0.2s;" onmouseover="this.style.borderColor='rgba(56, 189, 248, 0.4)'" onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.08)'">
                <div style="font-size: 30px; margin-bottom: 12px;">${feat.icon || '⭐'}</div>
                <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 8px;">${feat.title}</h3>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
                  ${feat.description}
                </p>
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}

      <!-- 5. DYNAMIC ABOUT & BENEFITS SECTION -->
      ${about.enabled !== false ? `
        <section id="about-section" style="padding: 60px 32px; background: rgba(15, 23, 42, 0.6); border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div style="max-width: 1200px; margin: 0 auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: center;">
              <div>
                <span class="badge badge-idle" style="font-size: 11px; margin-bottom: 12px;">🏭 INDUSTRIAL APPAREL SUITE</span>
                <h2 style="font-size: 26px; font-weight: 900; color: #fff; margin-bottom: 12px; line-height: 1.25;">
                  ${about.title || 'Engineered for Heavy Garments & Apparel Plants'}
                </h2>
                <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 24px;">
                  ${about.description || ''}
                </p>

                ${benefits.enabled !== false && (benefits.items || []).length > 0 ? `
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${(benefits.items || []).map(b => `
                      <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <span style="font-size: 20px; flex-shrink: 0;">${b.icon || '✓'}</span>
                        <div>
                          <div style="font-size: 13.5px; font-weight: 800; color: #34d399;">${b.title}</div>
                          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">${b.description}</div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>

              <!-- Factory Stats Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                ${(about.stats || []).map(st => `
                  <div style="background: rgba(17, 24, 39, 0.9); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-md); padding: 18px; text-align: center;">
                    <div style="font-size: 28px; margin-bottom: 6px;">${st.icon || '📊'}</div>
                    <div style="font-size: 22px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono);">${st.value}</div>
                    <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px; font-weight: 600;">${st.label}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </section>
      ` : ''}

      <!-- 6. CONTACT & SUPPORT SECTION -->
      ${contact.enabled !== false ? `
        <section id="contact-section" style="padding: 60px 32px; max-width: 1200px; margin: 0 auto; width: 100%;">
          <div style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(15, 23, 42, 0.8)); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-xl); padding: 36px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 24px;">
            <div>
              <h3 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 6px;">
                ${contact.title || 'Factory Support & Maintenance Bay'}
              </h3>
              <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 16px; max-width: 550px;">
                ${contact.subtitle || 'Central Engineering & IT Systems Helpdesk'} &bull; ${contact.hours || '24/7 Floor Support'}
              </p>
              <div style="display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px;">
                <div>📞 <strong>Phone:</strong> <span style="color: #38bdf8;">${contact.phone || '—'}</span></div>
                <div>✉️ <strong>Email:</strong> <span style="color: #38bdf8;">${contact.email || '—'}</span></div>
                <div>📍 <strong>Location:</strong> <span style="color: #cbd5e1;">${contact.location || '—'}</span></div>
              </div>
            </div>

            <button id="btn-contact-login-action" class="btn btn-primary" style="font-weight: 800; padding: 12px 26px; border-radius: 8px; font-size: 14px; box-shadow: 0 4px 20px rgba(2, 132, 199, 0.5);">
              🚀 Access Plant ERP
            </button>
          </div>
        </section>
      ` : ''}

      <!-- 7. CORPORATE FOOTER WITH DYNAMIC DEVELOPER CREDIT -->
      ${footer.enabled !== false ? `
        <footer style="margin-top: auto; border-top: 1px solid rgba(255,255,255,0.08); background: #070a12; padding: 22px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--text-muted);">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span>${footer.copyrightText || '© 2026 Al-Muslim Group Maintenance Department ERP. All Rights Reserved.'}</span>
            ${footer.showCredit !== false && footer.creditName ? `
              <span style="color: rgba(255,255,255,0.2);">|</span>
              <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 12px;">
                <span>${footer.creditPrefix || 'Developed by'}:</span>
                ${footer.creditUrl ? `
                  <a href="${footer.creditUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-weight: 700; text-decoration: underline; text-underline-offset: 3px;" title="Visit Developer Website">
                    ${footer.creditName} ↗
                  </a>
                ` : `
                  <strong style="color: #38bdf8; font-weight: 700;">${footer.creditName}</strong>
                `}
              </span>
            ` : ''}
          </div>
        </footer>
      ` : ''}

    </div>
  `;
}

/**
 * Dedicated Maintenance Lockdown Homepage for Visitors and Regular Users
 * Strictly shields all machine records, counts, and modules while displaying the official notice.
 */
function renderMaintenanceLockdownHomepage({ currentUser, isLoggedIn, userInitial, maintConfig }) {
  return `
    <div class="public-homepage-wrapper" style="min-height: 100vh; width: 100%; background: #0b0f19; color: #f8fafc; font-family: var(--font-main); display: flex; flex-direction: column; position: relative;">
      
      <!-- 1. STICKY PUBLIC HEADER -->
      <header class="public-header" style="position: -webkit-sticky; position: sticky; top: 0; left: 0; right: 0; z-index: 1000; background: rgba(11, 15, 25, 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(245, 158, 11, 0.3); padding: 14px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 25px rgba(0,0,0,0.6); flex-shrink: 0;">
        
        <!-- Brand Logo -->
        <div class="header-brand" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" id="home-brand-logo">
          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);">
            🛠️
          </div>
          <div>
            <div style="font-weight: 900; font-size: 15px; letter-spacing: 0.8px; color: #ffffff; line-height: 1.2;">
              AL-MUSLIM GROUP
            </div>
            <div style="font-size: 10.5px; color: #94a3b8; font-weight: 500;">
              Industrial Machine &amp; Assets Management System
            </div>
          </div>
        </div>

        <!-- Maintenance Status Badge -->
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #fbbf24;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 8px #f59e0b; display: inline-block;"></span>
          <span>MAINTENANCE MODE ACTIVE</span>
        </div>

        <!-- Action: Admin Login or User Logout -->
        <div style="display: flex; align-items: center; gap: 10px;">
          ${isLoggedIn ? `
            <div style="display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 20px; padding: 3px 12px 3px 6px;">
              <div style="width: 24px; height: 24px; border-radius: 50%; background: #f59e0b; color: #000; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                ${userInitial}
              </div>
              <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">${currentUser.name || 'User'}</span>
            </div>
            <button id="btn-home-logout" class="btn btn-ghost btn-sm" style="color: #f87171; font-size: 12px; padding: 5px 8px;" title="Logout">
              🔒 Logout
            </button>
          ` : `
            <button id="btn-header-login-admin" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 8px 18px; border-radius: 6px; font-size: 13px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 0 15px rgba(2, 132, 199, 0.4);">
              👑 Admin Login
            </button>
          `}
        </div>
      </header>

      <!-- 2. DEDICATED MAINTENANCE NOTICE & LOCKDOWN CARD (NO DATA EXPOSURE) -->
      <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 24px; position: relative;">
        
        <!-- Background Atmospheric Glow -->
        <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); width: 750px; height: 400px; background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(11, 15, 25, 0) 70%); pointer-events: none; z-index: 0;"></div>

        <div style="position: relative; z-index: 1; max-width: 680px; width: 100%; background: linear-gradient(145deg, #131b2e, #0e1526); border: 1.5px solid rgba(245, 158, 11, 0.35); border-radius: 16px; padding: 40px 36px; box-shadow: 0 20px 60px rgba(0,0,0,0.65); text-align: center;">
          
          <!-- Pulsing Maintenance Icon -->
          <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0.05) 70%); border: 2px solid #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 38px; box-shadow: 0 0 35px rgba(245, 158, 11, 0.35);">
            🛠️
          </div>

          <!-- Badge -->
          <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; padding: 5px 16px; margin-bottom: 18px; font-size: 11.5px; font-weight: 800; color: #fbbf24; letter-spacing: 0.8px;">
            <span style="font-size: 13px;">🔒</span> SYSTEM UNDER MAINTENANCE
          </div>

          <!-- Main Heading -->
          <h1 style="font-size: 28px; font-weight: 900; color: #ffffff; margin-bottom: 10px; line-height: 1.25; letter-spacing: -0.3px;">
            Scheduled Maintenance in Progress
          </h1>

          <!-- Subtitle -->
          <p style="font-size: 14.5px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5;">
            Public access to machinery records, live operational telemetry, and user portals is temporarily paused.
          </p>

          <!-- Official Public Notice Box -->
          <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(245, 158, 11, 0.3); border-left: 4px solid #f59e0b; border-radius: 10px; padding: 20px 22px; margin-bottom: 24px; text-align: left; box-shadow: inset 0 2px 6px rgba(0,0,0,0.3);">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: #fde68a; margin-bottom: 8px;">
              <span>📢</span> Official Notice:
            </div>
            <div style="font-size: 14px; color: #f1f5f9; line-height: 1.6; font-weight: 500;">
              ${maintConfig.message || 'Routine scheduled system maintenance and server upgrade is currently in progress. Normal operations will resume shortly.'}
            </div>
            ${maintConfig.estimatedEnd ? `
              <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(245, 158, 11, 0.25); display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #fbbf24; font-weight: 700;">
                <span>⏳</span>
                <span>Expected Completion / ETA: <strong>${maintConfig.estimatedEnd}${/^\d+$/.test(maintConfig.estimatedEnd.toString().trim()) ? ' Minutes' : ''}</strong></span>
              </div>
            ` : ''}
          </div>

          <!-- Security Policy Note -->
          <div style="font-size: 12px; color: #64748b; margin-bottom: 28px; line-height: 1.5; background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 8px;">
            🔒 All operational machine registries, spare parts logs, and relocation tracking data are shielded to preserve system integrity.
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
            <button id="btn-maint-notice-login" class="btn btn-primary" style="font-weight: 800; padding: 11px 24px; border-radius: 8px; font-size: 13.5px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 0 20px rgba(2, 132, 199, 0.45); display: flex; align-items: center; gap: 8px;">
              <span>🔐</span>
              <span>Sign In</span>
            </button>
            <button id="btn-maint-notice-refresh" class="btn btn-secondary" style="font-weight: 700; padding: 11px 20px; border-radius: 8px; font-size: 13.5px; border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; display: flex; align-items: center; gap: 8px;">
              <span>🔄</span>
              <span>Check Status / Refresh</span>
            </button>
          </div>

        </div>
      </main>

      <!-- 3. MINIMAL FOOTER -->
      <footer style="border-top: 1px solid rgba(255,255,255,0.06); background: #070a12; padding: 18px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 11.5px; color: #64748b; flex-shrink: 0;">
        <div>
          &copy; 2026 Al-Muslim Group Garments Factory Maintenance Department ERP. All Rights Reserved.
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>🔒 Maintenance Operations Shield Active</span>
        </div>
      </footer>

    </div>
  `;
}

export function initHomepageEvents() {
  const scrollToElem = (targetId) => {
    const homeRoot = document.getElementById('home-root-container');
    if (targetId === 'hero') {
      if (homeRoot) homeRoot.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const elem = document.getElementById(targetId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Smooth scroll for in-page navigation links
  document.querySelectorAll('.btn-home-scroll-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      scrollToElem(targetId);
      document.querySelectorAll('.btn-home-scroll-link').forEach(b => {
        b.style.color = '#cbd5e1';
      });
      btn.style.color = '#38bdf8';
    });
  });

  // Brand Logo clicks to top
  const brandLogo = document.getElementById('home-brand-logo');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => {
      scrollToElem('hero');
    });
  }

  // Maintenance Notice Sign In Button
  const btnMaintLogin = document.getElementById('btn-maint-notice-login');
  if (btnMaintLogin) {
    btnMaintLogin.addEventListener('click', () => {
      router.navigate('login');
      state.set('currentView', 'login');
    });
  }

  // Maintenance Notice Check Status / Refresh Button
  const btnMaintRefresh = document.getElementById('btn-maint-notice-refresh');
  if (btnMaintRefresh) {
    btnMaintRefresh.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Admin ribbon settings button
  const btnHomeMaintSettings = document.getElementById('btn-home-maint-settings');
  if (btnHomeMaintSettings) {
    btnHomeMaintSettings.addEventListener('click', () => {
      router.navigate('settings');
      state.set('currentView', 'settings');
    });
  }

  // Live Metrics login triggers for unauthenticated visitors
  document.querySelectorAll('.btn-live-metric-login').forEach(btn => {
    btn.addEventListener('click', () => {
      state.set('loginTab', 'user');
      try {
        sessionStorage.setItem('al_muslim_login_tab', 'user');
      } catch (_) {}
      router.navigate('login');
      state.set('currentView', 'login');
    });
  });

  // Header User Login
  const btnHeaderUser = document.getElementById('btn-header-login-user');
  if (btnHeaderUser) {
    btnHeaderUser.addEventListener('click', () => {
      state.set('loginTab', 'user');
      try {
        sessionStorage.setItem('al_muslim_login_tab', 'user');
      } catch (_) {}
      router.navigate('login');
      state.set('currentView', 'login');
    });
  }

  // Enter ERP Dashboard (when already logged in)
  const btnEnterErp = document.getElementById('btn-home-enter-erp');
  if (btnEnterErp) {
    btnEnterErp.addEventListener('click', () => {
      router.navigate('dashboard');
      state.set('currentView', 'dashboard');
    });
  }

  // Logout from Home Page
  const btnLogout = document.getElementById('btn-home-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      try {
        storage.flushImmediate();
      } catch (_) {}
      authService.logout();
      router.navigate('login', { replace: true });
      state.set('currentView', 'login');
    });
  }

  // Contact Login Button
  const btnContactLogin = document.getElementById('btn-contact-login-action');
  if (btnContactLogin) {
    btnContactLogin.addEventListener('click', () => {
      if (authService.getCurrentUser()) {
        router.navigate('dashboard');
        state.set('currentView', 'dashboard');
      } else {
        state.set('loginTab', 'user');
        try {
          sessionStorage.setItem('al_muslim_login_tab', 'user');
        } catch (_) {}
        router.navigate('login');
        state.set('currentView', 'login');
      }
    });
  }

  // Module Cards Direct Click Navigation
  document.querySelectorAll('.home-module-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-view') || 'dashboard';
      router.navigate(target);
      state.set('currentView', target);
    });
  });
}
