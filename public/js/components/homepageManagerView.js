/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Home Page Management View Component (Admin Panel)
 * 
 * Allows Super Admin and Administrators to customize all public Home Page content:
 * - Enable / Disable any section
 * - Edit Hero texts, badges, and CTA button destinations
 * - Add, edit, reorder, and toggle dynamic Feature Cards
 * - Add, edit, and toggle dynamic Module Showcase Cards
 * - Manage About, Statistics, Benefits, Contact, and Footer info
 * - Live Preview and 1-Click Publish to Live Page
 */

import { homepageService } from '../services/homepageService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { renderHomepageView, initHomepageEvents } from './homepageView.js';
import { state } from '../state.js';

let activeEditorTab = 'sections'; // 'sections' | 'hero' | 'features' | 'modules' | 'about' | 'contact'
let activeModalState = null; // { type: 'ADD_FEATURE'|'EDIT_FEATURE'|'ADD_MODULE'|'EDIT_MODULE'|'PREVIEW', item: Object }

export function renderHomepageManagerView() {
  const config = homepageService.getDraftConfig();
  const published = homepageService.getPublishedConfig();
  const isAdmin = authService.isAdmin();

  return `
    <div class="page-view" style="gap: 16px; max-width: 1300px; margin: 0 auto; width: 100%;">
      
      <!-- Top Command Bar -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🏠
          </div>
          <div>
            <h1 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">
              Home Page Management
            </h1>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
              Admin-controlled dynamic content, public landing page sections, feature cards, and branding.
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <button id="btn-home-mgr-preview" class="btn btn-secondary" style="font-weight: 700;">
            👁️ Preview Home Page
          </button>
          <button id="btn-home-mgr-publish" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);">
            🚀 Publish to Live Page
          </button>
          <button id="btn-home-mgr-reset" class="btn btn-ghost btn-sm" style="color: #f87171; font-weight: 700;" title="Restore corporate defaults">
            ↺ Reset Defaults
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; flex-wrap: wrap;">
        <button class="btn ${activeEditorTab === 'sections' ? 'btn-primary' : 'btn-ghost'}" data-home-tab="sections" style="font-weight: 700; font-size: 13px; padding: 7px 16px;">
          📑 Sections Overview
        </button>
        <button class="btn ${activeEditorTab === 'hero' ? 'btn-primary' : 'btn-ghost'}" data-home-tab="hero" style="font-weight: 700; font-size: 13px; padding: 7px 16px;">
          🚀 Hero Section
        </button>
        <button class="btn ${activeEditorTab === 'features' ? 'btn-primary' : 'btn-ghost'}" data-home-tab="features" style="font-weight: 700; font-size: 13px; padding: 7px 16px;">
          ⭐ Feature Cards (${(config.features?.items || []).length})
        </button>
        <button class="btn ${activeEditorTab === 'modules' ? 'btn-primary' : 'btn-ghost'}" data-home-tab="modules" style="font-weight: 700; font-size: 13px; padding: 7px 16px;">
          📦 ERP Modules (${(config.modules?.items || []).length})
        </button>
        <button class="btn ${activeEditorTab === 'about' ? 'btn-primary' : 'btn-ghost'}" data-home-tab="about" style="font-weight: 700; font-size: 13px; padding: 7px 16px;">
          ℹ️ About &amp; Benefits
        </button>
        <button class="btn ${activeEditorTab === 'contact' ? 'btn-primary' : 'btn-ghost'}" data-home-tab="contact" style="font-weight: 700; font-size: 13px; padding: 7px 16px;">
          📞 Contact &amp; Footer
        </button>
      </div>

      <!-- Editor Content Body -->
      <div id="home-editor-body" style="display: flex; flex-direction: column; gap: 16px;">
        ${renderEditorTabContent(config)}
      </div>

      <!-- Modal Container (Feature / Module / Live Preview) -->
      ${renderHomeManagerModalDOM(config)}

    </div>
  `;
}

function renderEditorTabContent(config) {
  switch (activeEditorTab) {
    case 'sections':
      return renderSectionsOverviewTab(config);
    case 'hero':
      return renderHeroEditorTab(config);
    case 'features':
      return renderFeaturesEditorTab(config);
    case 'modules':
      return renderModulesEditorTab(config);
    case 'about':
      return renderAboutEditorTab(config);
    case 'contact':
      return renderContactEditorTab(config);
    default:
      return renderSectionsOverviewTab(config);
  }
}

// ---------------------------------------------------------------------------
// TAB 1: SECTIONS OVERVIEW & TOGGLES
// ---------------------------------------------------------------------------
function renderSectionsOverviewTab(config) {
  const sections = [
    { id: 'hero', name: 'Hero Banner Section', desc: 'Main headline, badge, subtitle, login buttons, and live metrics', enabled: config.hero?.enabled !== false, icon: '🚀' },
    { id: 'about', name: 'About ERP Section', desc: 'Industrial plant architecture, connected units, and stats', enabled: config.about?.enabled !== false, icon: 'ℹ️' },
    { id: 'features', name: 'Dynamic Feature Cards', desc: 'Grid of capability cards (Machinery catalog, transfer ledger, spare parts, etc.)', enabled: config.features?.enabled !== false, icon: '⭐' },
    { id: 'modules', name: 'Integrated ERP Modules', desc: 'Module cards with direct access shortcuts', enabled: config.modules?.enabled !== false, icon: '📦' },
    { id: 'benefits', name: 'Factory Benefits & ROI', desc: 'Zero asset loss, breakdown response, and audit benefits', enabled: config.benefits?.enabled !== false, icon: '📈' },
    { id: 'contact', name: 'Contact & Support', desc: 'Factory support phone, email, industrial complex address, and hours', enabled: config.contact?.enabled !== false, icon: '📞' },
    { id: 'footer', name: 'Corporate Footer', desc: 'Copyright notice, company brand, and system version', enabled: config.footer?.enabled !== false, icon: '📄' }
  ];

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">Public Home Page Sections</h3>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px; margin-bottom: 0;">
          Toggle section visibility on the live public Home Page. Disabled sections will be completely hidden.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${sections.map((sec, idx) => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <span style="font-size: 24px;">${sec.icon}</span>
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #fff;">
                  ${sec.name}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 1px;">
                  ${sec.desc}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <button 
                class="btn-section-toggle" 
                data-section="${sec.id}" 
                style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 9999px; font-size: 11.5px; font-weight: 800; cursor: pointer; border: 1.5px solid ${sec.enabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; background: ${sec.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${sec.enabled ? '#34d399' : '#f87171'};"
              >
                <span>${sec.enabled ? '🟢' : '🔴'}</span>
                <span>${sec.enabled ? 'VISIBLE / ON' : 'HIDDEN / OFF'}</span>
              </button>

              <button 
                class="btn btn-secondary btn-sm btn-goto-section-tab" 
                data-target-tab="${sec.id === 'about' || sec.id === 'benefits' ? 'about' : (sec.id === 'contact' || sec.id === 'footer' ? 'contact' : sec.id)}"
                style="padding: 5px 12px; font-size: 12px;"
              >
                ✏️ Edit Content
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// TAB 2: HERO SECTION EDITOR
// ---------------------------------------------------------------------------
function renderHeroEditorTab(config) {
  const hero = config.hero || {};

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">🚀 Hero Banner Configuration</h3>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          Customize the main entrance banner, badges, headings, call-to-action buttons, and live inventory metrics.
        </p>
      </div>

      <form id="form-hero-editor" style="display: flex; flex-direction: column; gap: 14px;">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Badge Text</label>
            <input type="text" id="inp-hero-badge-text" class="form-control" value="${hero.badgeText || ''}" placeholder="e.g. 🏭 Enterprise Maintenance Department ERP" />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Badge Tag</label>
            <input type="text" id="inp-hero-badge-tag" class="form-control" value="${hero.badgeTag || ''}" placeholder="e.g. v3.8 LIVE" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Main Heading *</label>
          <input type="text" id="inp-hero-title" class="form-control" required value="${hero.title || ''}" placeholder="e.g. AL-MUSLIM GROUP" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Subtitle / Tagline *</label>
          <input type="text" id="inp-hero-subtitle" class="form-control" required value="${hero.subtitle || ''}" placeholder="e.g. Maintenance Department ERP System" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Description Text</label>
          <textarea id="inp-hero-desc" class="form-control" rows="3" placeholder="Enter paragraph description...">${hero.description || ''}</textarea>
        </div>

        <!-- Buttons Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: var(--bg-card); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <h4 style="font-size: 12.5px; font-weight: 700; color: #38bdf8; margin: 0;">Primary CTA Button</h4>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Button Text</label>
              <input type="text" id="inp-hero-btn1-text" class="form-control" value="${hero.primaryBtnText || 'User Login'}" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Action Destination</label>
              <select id="inp-hero-btn1-action" class="filter-select">
                <option value="login" ${hero.primaryBtnAction === 'login' ? 'selected' : ''}>Open Login Dialog</option>
                <option value="dashboard" ${hero.primaryBtnAction === 'dashboard' ? 'selected' : ''}>Go to Dashboard</option>
                <option value="inventory" ${hero.primaryBtnAction === 'inventory' ? 'selected' : ''}>Go to Machine Inventory</option>
              </select>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <h4 style="font-size: 12.5px; font-weight: 700; color: #a78bfa; margin: 0;">Secondary CTA Button</h4>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Button Text</label>
              <input type="text" id="inp-hero-btn2-text" class="form-control" value="${hero.secondaryBtnText || 'Explore Registry'}" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Action Destination</label>
              <select id="inp-hero-btn2-action" class="filter-select">
                <option value="inventory" ${hero.secondaryBtnAction === 'inventory' ? 'selected' : ''}>Go to Machine Inventory</option>
                <option value="reports" ${hero.secondaryBtnAction === 'reports' ? 'selected' : ''}>Go to Reports</option>
                <option value="manpower" ${hero.secondaryBtnAction === 'manpower' ? 'selected' : ''}>Go to Manpower</option>
              </select>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <input type="checkbox" id="inp-hero-show-metrics" ${hero.showLiveMetrics !== false ? 'checked' : ''} style="width: 16px; height: 16px;" />
          <label for="inp-hero-show-metrics" style="font-size: 12.5px; font-weight: 600; color: #fff; cursor: pointer;">
            Display Live Metrics Counter Strip (Total Machines, Active in Lines, Transfers Tracked, Spare Parts)
          </label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
          <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 24px;">
            💾 Save Hero Section Draft
          </button>
        </div>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// TAB 3: DYNAMIC FEATURE CARDS
// ---------------------------------------------------------------------------
function renderFeaturesEditorTab(config) {
  const items = config.features?.items || [];

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">⭐ Dynamic Feature Cards (${items.length})</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px; margin-bottom: 0;">
            Manage unlimited capability cards displayed on the public Home Page. Add, edit, reorder, or toggle active status.
          </p>
        </div>
        <button id="btn-add-feature-modal" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1);">
          ➕ Add New Feature Card
        </button>
      </div>

      <!-- Feature Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;">
        ${items.map((feat, idx) => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 26px;">${feat.icon || '⭐'}</span>
                  <div>
                    <div style="font-size: 14px; font-weight: 800; color: #fff;">${feat.title}</div>
                    <span class="badge ${feat.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}" style="font-size: 10px; margin-top: 2px;">
                      ${feat.status}
                    </span>
                  </div>
                </div>
              </div>

              <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 10px; line-height: 1.5; margin-bottom: 0;">
                ${feat.description}
              </p>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 6px; border-top: 1px solid var(--border-color); padding-top: 10px;">
              <button class="btn btn-ghost btn-xs btn-feature-toggle" data-id="${feat.id}" style="font-weight: 700; color: ${feat.status === 'ACTIVE' ? '#f87171' : '#34d399'};">
                ${feat.status === 'ACTIVE' ? '⏸️ Disable' : '▶️ Enable'}
              </button>
              <button class="btn btn-secondary btn-xs btn-feature-edit" data-id="${feat.id}">
                ✏️ Edit
              </button>
              <button class="btn btn-ghost btn-xs btn-feature-delete" data-id="${feat.id}" style="color: #f87171;">
                🗑️
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// TAB 4: DYNAMIC ERP MODULES
// ---------------------------------------------------------------------------
function renderModulesEditorTab(config) {
  const items = config.modules?.items || [];

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">📦 Dynamic Module Showcase (${items.length})</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px; margin-bottom: 0;">
            Showcase enterprise ERP modules on the landing page with direct shortcut links.
          </p>
        </div>
        <button id="btn-add-module-modal" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1);">
          ➕ Add ERP Module Card
        </button>
      </div>

      <!-- Modules Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;">
        ${items.map((mod, idx) => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 26px;">${mod.icon || '📦'}</span>
                  <div>
                    <div style="font-size: 14px; font-weight: 800; color: #fff;">${mod.name}</div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                      <span class="badge badge-idle" style="font-size: 10px;">${mod.badge || 'Module'}</span>
                      <span class="badge ${mod.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}" style="font-size: 10px;">
                        ${mod.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 10px; line-height: 1.5; margin-bottom: 0;">
                ${mod.description}
              </p>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px;">
              <span style="font-size: 11px; color: #38bdf8; font-family: var(--font-mono);">View: #${mod.targetView || 'dashboard'}</span>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-ghost btn-xs btn-module-toggle" data-id="${mod.id}" style="font-weight: 700; color: ${mod.status === 'ACTIVE' ? '#f87171' : '#34d399'};">
                  ${mod.status === 'ACTIVE' ? '⏸️' : '▶️'}
                </button>
                <button class="btn btn-secondary btn-xs btn-module-edit" data-id="${mod.id}">
                  ✏️ Edit
                </button>
                <button class="btn btn-ghost btn-xs btn-module-delete" data-id="${mod.id}" style="color: #f87171;">
                  🗑️
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
// TAB 5: ABOUT & BENEFITS EDITOR
// ---------------------------------------------------------------------------
function renderAboutEditorTab(config) {
  const about = config.about || {};
  const benefits = config.benefits || {};

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">ℹ️ About System &amp; Enterprise Benefits</h3>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          Configure corporate description, connected factory units overview, and line productivity metrics.
        </p>
      </div>

      <form id="form-about-editor" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">About Heading</label>
          <input type="text" id="inp-about-title" class="form-control" value="${about.title || ''}" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">About Subtitle</label>
          <input type="text" id="inp-about-subtitle" class="form-control" value="${about.subtitle || ''}" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">About Narrative Description</label>
          <textarea id="inp-about-desc" class="form-control" rows="3">${about.description || ''}</textarea>
        </div>

        <div style="border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 6px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: #34d399; margin: 0 0 10px 0;">📈 Factory Benefits Heading</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Benefits Title</label>
              <input type="text" id="inp-benefits-title" class="form-control" value="${benefits.title || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Benefits Subtitle</label>
              <input type="text" id="inp-benefits-subtitle" class="form-control" value="${benefits.subtitle || ''}" />
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
          <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 24px;">
            💾 Save About &amp; Benefits Draft
          </button>
        </div>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// TAB 6: CONTACT & FOOTER EDITOR
// ---------------------------------------------------------------------------
function renderContactEditorTab(config) {
  const contact = config.contact || {};
  const footer = config.footer || {};

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px;">
      <div>
        <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">📞 Contact Information &amp; Footer Branding</h3>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          Configure support contact numbers, official maintenance desk email, factory address, and copyright text.
        </p>
      </div>

      <form id="form-contact-editor" style="display: flex; flex-direction: column; gap: 14px;">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Support Phone Number</label>
            <input type="text" id="inp-contact-phone" class="form-control" value="${contact.phone || ''}" placeholder="+880 1711-000001" />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Support Email Address</label>
            <input type="email" id="inp-contact-email" class="form-control" value="${contact.email || ''}" placeholder="maintenance.support@al-muslim.com" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Factory Complex Location / Address</label>
          <input type="text" id="inp-contact-location" class="form-control" value="${contact.location || ''}" placeholder="Al-Muslim Group Industrial Complex, Savar, Dhaka" />
        </div>

        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Support Working Hours</label>
          <input type="text" id="inp-contact-hours" class="form-control" value="${contact.hours || ''}" placeholder="24/7 Production Floor Support & Maintenance Bay" />
        </div>

        <div style="border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 6px;">
          <h4 style="font-size: 13.5px; font-weight: 800; color: #38bdf8; margin: 0 0 10px 0;">📄 Footer Branding &amp; Developer Credit</h4>
          
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Copyright Notice Text</label>
            <input type="text" id="inp-footer-copyright" class="form-control" value="${footer.copyrightText || ''}" placeholder="© 2026 Al-Muslim Group Maintenance Department ERP..." />
          </div>

          <!-- Developer Credit Configuration Box -->
          <div style="background: var(--bg-card); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h5 style="font-size: 13px; font-weight: 800; color: #38bdf8; margin: 0;">🏷️ Footer Developer / Creator Credit</h5>
                <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                  Add your custom credit name and clickable portfolio/website URL in the public footer.
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <input type="checkbox" id="inp-footer-show-credit" ${footer.showCredit !== false ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
                <label for="inp-footer-show-credit" style="font-size: 12px; font-weight: 700; color: #fff; cursor: pointer;">Enable Credit</label>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 140px 1fr 1fr; gap: 10px; align-items: center;">
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Prefix Text</label>
                <input type="text" id="inp-footer-credit-prefix" class="form-control" value="${footer.creditPrefix || 'Developed by'}" placeholder="e.g. Developed by" />
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Credit Name / Author *</label>
                <input type="text" id="inp-footer-credit-name" class="form-control" value="${footer.creditName || ''}" placeholder="e.g. Enamul Hoque / IT Division" />
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Credit Website / Portfolio URL</label>
                <input type="url" id="inp-footer-credit-url" class="form-control" value="${footer.creditUrl || ''}" placeholder="e.g. https://yourwebsite.com" />
              </div>
            </div>
          </div>

        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
          <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); padding: 8px 24px;">
            💾 Save Contact &amp; Footer Draft
          </button>
        </div>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// MODALS (Add/Edit Feature, Add/Edit Module, Fullscreen Preview)
// ---------------------------------------------------------------------------
function renderHomeManagerModalDOM(config) {
  if (!activeModalState) return '';

  // 1. ADD / EDIT FEATURE CARD MODAL
  if (activeModalState.type === 'ADD_FEATURE' || activeModalState.type === 'EDIT_FEATURE') {
    const isEdit = activeModalState.type === 'EDIT_FEATURE';
    const item = activeModalState.item || {};

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 500px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); padding: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">
              ${isEdit ? 'Edit Feature Card' : 'Add New Feature Card'}
            </h3>
            <button id="btn-modal-close" style="background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer;">✕</button>
          </div>

          <form id="form-feature-modal-submit" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Icon</label>
                <input type="text" id="inp-feat-icon" class="form-control" value="${item.icon || '⭐'}" style="text-align: center; font-size: 20px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Feature Title *</label>
                <input type="text" id="inp-feat-title" class="form-control" required value="${item.title || ''}" placeholder="e.g. 7-Level Machinery Catalog" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Description *</label>
              <textarea id="inp-feat-desc" class="form-control" rows="3" required placeholder="Enter feature details...">${item.description || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Status</label>
              <select id="inp-feat-status" class="filter-select">
                <option value="ACTIVE" ${item.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE (Visible on Home Page)</option>
                <option value="INACTIVE" ${item.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE (Hidden)</option>
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
              <button type="button" id="btn-modal-cancel" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1);">
                💾 Save Feature Card
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 2. ADD / EDIT ERP MODULE CARD MODAL
  if (activeModalState.type === 'ADD_MODULE' || activeModalState.type === 'EDIT_MODULE') {
    const isEdit = activeModalState.type === 'EDIT_MODULE';
    const item = activeModalState.item || {};

    return `
      <div class="modal-overlay" style="display: flex; align-items: center; justify-content: center; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); z-index: 9999;">
        <div class="modal-card" style="width: 520px; max-width: 95vw; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); padding: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">
              ${isEdit ? 'Edit ERP Module Card' : 'Add ERP Module Card'}
            </h3>
            <button id="btn-modal-close" style="background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer;">✕</button>
          </div>

          <form id="form-module-modal-submit" style="display: flex; flex-direction: column; gap: 14px;">
            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Icon</label>
                <input type="text" id="inp-mod-icon" class="form-control" value="${item.icon || '📦'}" style="text-align: center; font-size: 20px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Module Name *</label>
                <input type="text" id="inp-mod-name" class="form-control" required value="${item.name || ''}" placeholder="e.g. Manpower Management" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Badge Tag</label>
                <input type="text" id="inp-mod-badge" class="form-control" value="${item.badge || 'Core Asset'}" placeholder="e.g. Workforce" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Target View Route</label>
                <select id="inp-mod-target" class="filter-select">
                  <option value="inventory" ${item.targetView === 'inventory' ? 'selected' : ''}>Machine Inventory</option>
                  <option value="manpower" ${item.targetView === 'manpower' ? 'selected' : ''}>Manpower Management</option>
                  <option value="transfers" ${item.targetView === 'transfers' ? 'selected' : ''}>Machine Transfers</option>
                  <option value="spare-parts" ${item.targetView === 'spare-parts' ? 'selected' : ''}>Spare Parts Catalog</option>
                  <option value="machine-history" ${item.targetView === 'machine-history' ? 'selected' : ''}>Machine History</option>
                  <option value="reports" ${item.targetView === 'reports' ? 'selected' : ''}>Reports & Analytics</option>
                  <option value="dashboard" ${item.targetView === 'dashboard' ? 'selected' : ''}>Dashboard</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Description *</label>
              <textarea id="inp-mod-desc" class="form-control" rows="3" required placeholder="Enter module summary details...">${item.description || ''}</textarea>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Status</label>
              <select id="inp-mod-status" class="filter-select">
                <option value="ACTIVE" ${item.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE (Visible on Home Page)</option>
                <option value="INACTIVE" ${item.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE (Hidden)</option>
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
              <button type="button" id="btn-modal-cancel" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1);">
                💾 Save Module Card
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 3. FULLSCREEN LIVE PREVIEW MODAL
  if (activeModalState.type === 'PREVIEW') {
    return `
      <div class="modal-overlay" style="display: flex; flex-direction: column; background: rgba(8, 13, 26, 0.96); z-index: 9999; padding: 0;">
        <!-- Preview Floating Header Bar -->
        <div style="background: rgba(15, 23, 42, 0.95); border-bottom: 2px solid #0284c7; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="badge badge-idle" style="font-size: 12px; padding: 4px 10px;">👁️ LIVE DRAFT PREVIEW</span>
            <span style="font-size: 12.5px; color: var(--text-secondary);">Showing how the Home Page will look when published</span>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button id="btn-preview-publish-direct" class="btn btn-success btn-sm" style="font-weight: 800;">
              🚀 Publish This Draft Now
            </button>
            <button id="btn-modal-close" class="btn btn-secondary btn-sm" style="font-weight: 700;">
              ✕ Close Preview
            </button>
          </div>
        </div>

        <!-- Render Draft Home Page in View Container -->
        <div style="flex: 1; overflow-y: auto;">
          ${renderHomepageView(true)}
        </div>
      </div>
    `;
  }

  return '';
}

export function initHomepageManagerEvents() {
  const refreshView = () => {
    const view = document.getElementById('main-view-container');
    if (view) {
      view.innerHTML = renderHomepageManagerView();
      initHomepageManagerEvents();
    }
  };

  const closeModal = () => {
    activeModalState = null;
    refreshView();
  };

  // 1. Tab Switching
  document.querySelectorAll('[data-home-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeEditorTab = btn.getAttribute('data-home-tab');
      refreshView();
    });
  });

  // Direct Jump from Sections Overview
  document.querySelectorAll('.btn-goto-section-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeEditorTab = btn.getAttribute('data-target-tab');
      refreshView();
    });
  });

  // 2. Section Visibility Toggles
  document.querySelectorAll('.btn-section-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const secId = btn.getAttribute('data-section');
      const config = homepageService.getDraftConfig();
      if (!config[secId]) config[secId] = {};
      config[secId].enabled = config[secId].enabled === false ? true : false;
      homepageService.saveDraftConfig(config);
      notificationService.success(`Section '${secId}' visibility updated`);
      refreshView();
    });
  });

  // 3. Hero Section Form Submit
  const formHero = document.getElementById('form-hero-editor');
  if (formHero) {
    formHero.addEventListener('submit', (e) => {
      e.preventDefault();
      const config = homepageService.getDraftConfig();
      if (!config.hero) config.hero = {};

      config.hero.badgeText = document.getElementById('inp-hero-badge-text')?.value?.trim();
      config.hero.badgeTag = document.getElementById('inp-hero-badge-tag')?.value?.trim();
      config.hero.title = document.getElementById('inp-hero-title')?.value?.trim();
      config.hero.subtitle = document.getElementById('inp-hero-subtitle')?.value?.trim();
      config.hero.description = document.getElementById('inp-hero-desc')?.value?.trim();
      config.hero.primaryBtnText = document.getElementById('inp-hero-btn1-text')?.value?.trim();
      config.hero.primaryBtnAction = document.getElementById('inp-hero-btn1-action')?.value;
      config.hero.secondaryBtnText = document.getElementById('inp-hero-btn2-text')?.value?.trim();
      config.hero.secondaryBtnAction = document.getElementById('inp-hero-btn2-action')?.value;
      config.hero.showLiveMetrics = document.getElementById('inp-hero-show-metrics')?.checked;

      homepageService.saveDraftConfig(config);
      notificationService.success('Hero section draft saved!');
      refreshView();
    });
  }

  // 4. About Section Form Submit
  const formAbout = document.getElementById('form-about-editor');
  if (formAbout) {
    formAbout.addEventListener('submit', (e) => {
      e.preventDefault();
      const config = homepageService.getDraftConfig();
      if (!config.about) config.about = {};
      if (!config.benefits) config.benefits = {};

      config.about.title = document.getElementById('inp-about-title')?.value?.trim();
      config.about.subtitle = document.getElementById('inp-about-subtitle')?.value?.trim();
      config.about.description = document.getElementById('inp-about-desc')?.value?.trim();

      config.benefits.title = document.getElementById('inp-benefits-title')?.value?.trim();
      config.benefits.subtitle = document.getElementById('inp-benefits-subtitle')?.value?.trim();

      homepageService.saveDraftConfig(config);
      notificationService.success('About & Benefits draft saved!');
      refreshView();
    });
  }

  // 5. Contact Section Form Submit
  const formContact = document.getElementById('form-contact-editor');
  if (formContact) {
    formContact.addEventListener('submit', (e) => {
      e.preventDefault();
      const config = homepageService.getDraftConfig();
      if (!config.contact) config.contact = {};
      if (!config.footer) config.footer = {};

      config.contact.phone = document.getElementById('inp-contact-phone')?.value?.trim();
      config.contact.email = document.getElementById('inp-contact-email')?.value?.trim();
      config.contact.location = document.getElementById('inp-contact-location')?.value?.trim();
      config.contact.hours = document.getElementById('inp-contact-hours')?.value?.trim();

      config.footer.copyrightText = document.getElementById('inp-footer-copyright')?.value?.trim();
      config.footer.creditPrefix = document.getElementById('inp-footer-credit-prefix')?.value?.trim() || 'Developed by';
      config.footer.creditName = document.getElementById('inp-footer-credit-name')?.value?.trim();
      config.footer.creditUrl = document.getElementById('inp-footer-credit-url')?.value?.trim();
      config.footer.showCredit = document.getElementById('inp-footer-show-credit')?.checked;

      homepageService.saveDraftConfig(config);
      notificationService.success('Contact & Footer draft saved!');
      refreshView();
    });
  }

  // 6. Add Feature Modal
  const btnAddFeat = document.getElementById('btn-add-feature-modal');
  if (btnAddFeat) {
    btnAddFeat.addEventListener('click', (e) => {
      e.stopPropagation();
      activeModalState = { type: 'ADD_FEATURE' };
      refreshView();
    });
  }

  document.querySelectorAll('.btn-feature-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const config = homepageService.getDraftConfig();
      const item = (config.features?.items || []).find(f => f.id === id);
      if (item) {
        activeModalState = { type: 'EDIT_FEATURE', item };
        refreshView();
      }
    });
  });

  document.querySelectorAll('.btn-feature-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      homepageService.toggleFeatureStatus(id);
      notificationService.success('Feature status updated');
      refreshView();
    });
  });

  document.querySelectorAll('.btn-feature-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const confirmed = await notificationService.confirm({
        title: 'Delete Feature Card',
        message: 'Delete this feature card from Home Page?',
        icon: '🗑️',
        confirmText: 'Delete Card',
        isDestructive: true
      });
      if (confirmed) {
        homepageService.deleteFeature(id);
        notificationService.success('Feature card deleted');
        refreshView();
      }
    });
  });

  // 7. Add Module Modal
  const btnAddMod = document.getElementById('btn-add-module-modal');
  if (btnAddMod) {
    btnAddMod.addEventListener('click', (e) => {
      e.stopPropagation();
      activeModalState = { type: 'ADD_MODULE' };
      refreshView();
    });
  }

  document.querySelectorAll('.btn-module-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const config = homepageService.getDraftConfig();
      const item = (config.modules?.items || []).find(m => m.id === id);
      if (item) {
        activeModalState = { type: 'EDIT_MODULE', item };
        refreshView();
      }
    });
  });

  document.querySelectorAll('.btn-module-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      homepageService.toggleModuleStatus(id);
      notificationService.success('Module status updated');
      refreshView();
    });
  });

  document.querySelectorAll('.btn-module-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const confirmed = await notificationService.confirm({
        title: 'Delete Module Card',
        message: 'Delete this module card from Home Page?',
        icon: '🗑️',
        confirmText: 'Delete Module',
        isDestructive: true
      });
      if (confirmed) {
        homepageService.deleteModule(id);
        notificationService.success('Module card deleted');
        refreshView();
      }
    });
  });

  // 8. Submit Feature Modal Form
  const formFeatModal = document.getElementById('form-feature-modal-submit');
  if (formFeatModal && activeModalState) {
    formFeatModal.addEventListener('submit', (e) => {
      e.preventDefault();
      const icon = document.getElementById('inp-feat-icon')?.value?.trim() || '⭐';
      const title = document.getElementById('inp-feat-title')?.value?.trim();
      const description = document.getElementById('inp-feat-desc')?.value?.trim();
      const status = document.getElementById('inp-feat-status')?.value || 'ACTIVE';

      if (activeModalState.type === 'EDIT_FEATURE') {
        homepageService.updateFeature(activeModalState.item.id, { icon, title, description, status });
        notificationService.success(`Updated feature '${title}'`);
      } else {
        homepageService.addFeature({ icon, title, description, status });
        notificationService.success(`Added feature '${title}'`);
      }

      closeModal();
    });
  }

  // 9. Submit Module Modal Form
  const formModModal = document.getElementById('form-module-modal-submit');
  if (formModModal && activeModalState) {
    formModModal.addEventListener('submit', (e) => {
      e.preventDefault();
      const icon = document.getElementById('inp-mod-icon')?.value?.trim() || '📦';
      const name = document.getElementById('inp-mod-name')?.value?.trim();
      const badge = document.getElementById('inp-mod-badge')?.value?.trim() || 'Module';
      const targetView = document.getElementById('inp-mod-target')?.value || 'dashboard';
      const description = document.getElementById('inp-mod-desc')?.value?.trim();
      const status = document.getElementById('inp-mod-status')?.value || 'ACTIVE';

      if (activeModalState.type === 'EDIT_MODULE') {
        homepageService.updateModule(activeModalState.item.id, { icon, name, badge, targetView, description, status });
        notificationService.success(`Updated module '${name}'`);
      } else {
        homepageService.addModule({ icon, name, badge, targetView, description, status });
        notificationService.success(`Added module '${name}'`);
      }

      closeModal();
    });
  }

  // 10. Live Preview Action
  const btnPreview = document.getElementById('btn-home-mgr-preview');
  if (btnPreview) {
    btnPreview.addEventListener('click', (e) => {
      e.stopPropagation();
      activeModalState = { type: 'PREVIEW' };
      refreshView();
    });
  }

  const btnPreviewPublishDirect = document.getElementById('btn-preview-publish-direct');
  if (btnPreviewPublishDirect) {
    btnPreviewPublishDirect.addEventListener('click', async (e) => {
      e.stopPropagation();
      const origText = btnPreviewPublishDirect.innerHTML;
      btnPreviewPublishDirect.disabled = true;
      btnPreviewPublishDirect.innerHTML = '⏳ Publishing to Database...';
      try {
        const result = await homepageService.publishConfig();
        if (result && result.success) {
          notificationService.success('✅ Draft published to Live Home Page and synced to Database!');
          closeModal();
        } else {
          notificationService.error('❌ Publish failed: ' + (result?.error || 'Database write error. Try again.'));
          btnPreviewPublishDirect.disabled = false;
          btnPreviewPublishDirect.innerHTML = origText;
        }
      } catch (err) {
        notificationService.error('❌ Publish failed: ' + err.message);
        btnPreviewPublishDirect.disabled = false;
        btnPreviewPublishDirect.innerHTML = origText;
      }
    });
  }

  // 11. Publish to Live Action
  const btnPublish = document.getElementById('btn-home-mgr-publish');
  if (btnPublish) {
    btnPublish.addEventListener('click', async (e) => {
      e.stopPropagation();
      const origText = btnPublish.innerHTML;
      btnPublish.disabled = true;
      btnPublish.innerHTML = '⏳ Publishing to Database...';
      try {
        const result = await homepageService.publishConfig();
        if (result && result.success) {
          notificationService.success('✅ Home Page published & synced to Database! All devices will update cleanly.');
          refreshView();
        } else {
          notificationService.error('❌ Publish failed: ' + (result?.error || 'Database write error. Check your connection.'));
          btnPublish.disabled = false;
          btnPublish.innerHTML = origText;
        }
      } catch (err) {
        notificationService.error('❌ Publish failed: ' + err.message);
        btnPublish.disabled = false;
        btnPublish.innerHTML = origText;
      }
    });
  }

  // 12. Reset Defaults Action
  const btnReset = document.getElementById('btn-home-mgr-reset');
  if (btnReset) {
    btnReset.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await notificationService.confirm({
        title: 'Reset Home Page to Factory Defaults',
        message: 'Are you sure you want to revert all sections, features, and text back to default corporate template?',
        icon: '⚠️',
        confirmText: 'Reset Defaults',
        isDestructive: true
      });

      if (confirmed) {
        const origResetText = btnReset?.innerHTML;
        if (btnReset) { btnReset.disabled = true; btnReset.innerHTML = '⏳ Resetting...'; }
        try {
          const result = await homepageService.resetToDefaults();
          if (result && result.success) {
            notificationService.success('✅ Home Page reset to corporate defaults and synced to Database.');
            refreshView();
          } else {
            notificationService.error('❌ Reset failed: ' + (result?.error || 'Database write error.'));
            if (btnReset) { btnReset.disabled = false; btnReset.innerHTML = origResetText; }
          }
        } catch (err) {
          notificationService.error('❌ Reset failed: ' + err.message);
          if (btnReset) { btnReset.disabled = false; btnReset.innerHTML = origResetText; }
        }
      }
    });
  }

  // 13. Close Modal
  const btnClose = document.getElementById('btn-modal-close');
  const btnCancel = document.getElementById('btn-modal-cancel');
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
}
