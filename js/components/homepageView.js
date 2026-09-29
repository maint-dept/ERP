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

export function renderHomepageView(isDraft = false) {
  const config = isDraft ? homepageService.getDraftConfig() : homepageService.getPublishedConfig();
  const currentUser = authService.getCurrentUser();
  const isLoggedIn = !!currentUser;
  const userInitial = (currentUser?.name?.replace(/^(Engr\.|Dr\.|Mr\.|Mrs\.|Ms\.|Md\.)\s+/i, '') || currentUser?.name || currentUser?.username || 'U').trim().charAt(0).toUpperCase();

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
              AL-MUSLIM GROUP <span style="color: #38bdf8;">• MAINTENANCE DEPARTMENT ERP</span>
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
            <!-- Separate Admin Login -->
            <button id="btn-header-login-admin" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 0 15px rgba(2, 132, 199, 0.4);">
              👑 Admin Login
            </button>

            <!-- Separate User Login -->
            <button id="btn-header-login-user" class="btn btn-secondary btn-sm" style="font-weight: 700; padding: 7px 14px; border-radius: 6px; font-size: 12.5px; border: 1px solid rgba(167, 139, 250, 0.4); color: #c4b5fd;">
              👤 User Login
            </button>
          `}
        </div>
      </header>

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
            <p style="font-size: 14.5px; color: #cbd5e1; max-width: 800px; margin: 0 auto 30px; line-height: 1.6;">
              ${hero.description || ''}
            </p>

            <!-- Separate Primary & Secondary Buttons (Admin Login vs User Login) -->
            <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; margin-bottom: 24px;">
              <button 
                id="btn-hero-admin-login" 
                class="btn btn-primary" 
                style="font-size: 14.5px; font-weight: 800; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 25px rgba(2, 132, 199, 0.5); display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #0284c7, #0369a1);"
              >
                <span>👑</span>
                <span>Admin Login</span>
              </button>

              <button 
                id="btn-hero-user-login" 
                class="btn btn-secondary" 
                style="font-size: 14.5px; font-weight: 700; padding: 12px 26px; border-radius: 8px; border: 1.5px solid rgba(167, 139, 250, 0.4); background: rgba(30, 41, 59, 0.6); color: #c4b5fd; display: flex; align-items: center; gap: 8px;"
              >
                <span>👤</span>
                <span>User Login</span>
              </button>

              <button 
                id="btn-hero-explore-registry" 
                class="btn btn-ghost" 
                style="font-size: 14px; font-weight: 600; padding: 12px 20px; border-radius: 8px; color: #38bdf8; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(56, 189, 248, 0.2);"
              >
                <span>📦</span>
                <span>Explore Registry</span>
              </button>
            </div>

            <!-- Quick 1-Click Fast Login Access Bar -->
            <div style="display: inline-flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 30px; padding: 6px 18px; margin-bottom: 36px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
              <span style="font-size: 11.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">⚡ Instant 1-Click Demo:</span>
              <button id="btn-quick-enter-superadmin" class="btn btn-ghost btn-xs" style="font-weight: 700; font-size: 11.5px; color: #38bdf8; padding: 2px 8px; border-radius: 12px; background: rgba(2, 132, 199, 0.15);">
                👑 Super Admin
              </button>
              <span style="color: rgba(255,255,255,0.2);">|</span>
              <button id="btn-quick-enter-user" class="btn btn-ghost btn-xs" style="font-weight: 700; font-size: 11.5px; color: #a78bfa; padding: 2px 8px; border-radius: 12px; background: rgba(167, 139, 250, 0.15);">
                👤 Standard User
              </button>
            </div>

            <!-- Live Metrics Strip (if enabled) -->
            ${hero.showLiveMetrics !== false ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; max-width: 960px; margin: 0 auto; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 18px 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.37);">
                <div style="border-right: 1px solid rgba(255,255,255,0.08); padding-right: 12px;">
                  <div style="font-size: 26px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono);">${machines.length}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Total Machines</div>
                </div>
                <div style="border-right: 1px solid rgba(255,255,255,0.08); padding-right: 12px;">
                  <div style="font-size: 26px; font-weight: 900; color: #34d399; font-family: var(--font-mono);">${activeCount}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Active in Lines</div>
                </div>
                <div style="border-right: 1px solid rgba(255,255,255,0.08); padding-right: 12px;">
                  <div style="font-size: 26px; font-weight: 900; color: #fbbf24; font-family: var(--font-mono);">${transfers.length}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Transfers Tracked</div>
                </div>
                <div>
                  <div style="font-size: 26px; font-weight: 900; color: #c084fc; font-family: var(--font-mono);">${spareParts.length}</div>
                  <div style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">Master Spare Parts</div>
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
          
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="color: #38bdf8; font-weight: 700;">${footer.systemVersion || 'v2.6 Enterprise Edition'}</span>
            <span>&bull;</span>
            <button id="btn-footer-admin-link" style="background: none; border: none; color: #fbbf24; cursor: pointer; font-size: 11.5px; font-weight: 700; padding: 0;">
              ⚙️ Admin Console
            </button>
          </div>
        </footer>
      ` : ''}

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

  // Header Admin Login
  const btnHeaderAdmin = document.getElementById('btn-header-login-admin');
  if (btnHeaderAdmin) {
    btnHeaderAdmin.addEventListener('click', () => {
      localStorage.setItem('al_muslim_saved_username', 'superadmin');
      window.location.hash = '#login';
      state.set('currentView', 'login');
    });
  }

  // Header User Login
  const btnHeaderUser = document.getElementById('btn-header-login-user');
  if (btnHeaderUser) {
    btnHeaderUser.addEventListener('click', () => {
      localStorage.setItem('al_muslim_saved_username', 'user');
      window.location.hash = '#login';
      state.set('currentView', 'login');
    });
  }

  // Hero Admin Login
  const btnHeroAdmin = document.getElementById('btn-hero-admin-login');
  if (btnHeroAdmin) {
    btnHeroAdmin.addEventListener('click', () => {
      localStorage.setItem('al_muslim_saved_username', 'superadmin');
      window.location.hash = '#login';
      state.set('currentView', 'login');
    });
  }

  // Hero User Login
  const btnHeroUser = document.getElementById('btn-hero-user-login');
  if (btnHeroUser) {
    btnHeroUser.addEventListener('click', () => {
      localStorage.setItem('al_muslim_saved_username', 'user');
      window.location.hash = '#login';
      state.set('currentView', 'login');
    });
  }

  // Hero Explore Registry
  const btnHeroExplore = document.getElementById('btn-hero-explore-registry');
  if (btnHeroExplore) {
    btnHeroExplore.addEventListener('click', () => {
      if (authService.isAuthenticated()) {
        window.location.hash = '#inventory';
        state.set('currentView', 'inventory');
      } else {
        window.location.hash = '#login';
        state.set('currentView', 'login');
      }
    });
  }

  // Enter ERP Dashboard (when already logged in)
  const btnEnterErp = document.getElementById('btn-home-enter-erp');
  if (btnEnterErp) {
    btnEnterErp.addEventListener('click', () => {
      window.location.hash = '#dashboard';
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
      window.location.hash = '#login';
      window.location.reload();
    });
  }

  // Contact Login Button
  const btnContactLogin = document.getElementById('btn-contact-login-action');
  if (btnContactLogin) {
    btnContactLogin.addEventListener('click', () => {
      if (authService.getCurrentUser()) {
        window.location.hash = '#dashboard';
        state.set('currentView', 'dashboard');
      } else {
        window.location.hash = '#login';
        state.set('currentView', 'login');
      }
    });
  }

  // Footer Admin Console Link
  const btnFooterAdmin = document.getElementById('btn-footer-admin-link');
  if (btnFooterAdmin) {
    btnFooterAdmin.addEventListener('click', () => {
      if (authService.getCurrentUser()) {
        window.location.hash = '#homepage-manager';
        state.set('currentView', 'homepage-manager');
      } else {
        localStorage.setItem('al_muslim_saved_username', 'superadmin');
        window.location.hash = '#login';
        state.set('currentView', 'login');
      }
    });
  }

  // Module Cards Direct Click Navigation
  document.querySelectorAll('.home-module-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-view') || 'dashboard';
      window.location.hash = '#' + target;
      state.set('currentView', target);
    });
  });
}
