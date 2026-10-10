/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Column Visibility & Frozen Columns Manager Modal Component
 * 
 * Features:
 * 1. ❄️ Frozen Columns (Sticky Left on Horizontal Scroll) - Admin Configurable
 *    - Default: Machine Name + Model + Serial Number
 *    - Allows freezing 1, 2, 3 or any number of columns
 *    - Pinned sequentially from the left with subtle border & drop shadow
 * 2. 👁️ Column Visibility (Show / Hide columns)
 *    - Core columns, optional spec columns, and custom fields
 */

import { customFieldService } from '../services/customFieldService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let activeColVisTab = 'frozen'; // 'frozen' | 'visibility'

export function renderColumnVisibilityModal() {
  const visibleCols = state.get('visibleColumns') || new Set();
  const frozenCols = state.get('frozenColumns') || ['machineName', 'model', 'serialNumber'];
  const customFields = customFieldService.getActiveFields();

  const freezableCols = [
    { key: 'machineName', label: 'Machine Name', width: '220px', desc: 'Identifies machine type' },
    { key: 'model', label: 'Machine Model', width: '150px', desc: 'Model specification number' },
    { key: 'serialNumber', label: 'Machine Serial Number', width: '160px', desc: 'Unique asset identifier tag' },
    { key: 'brand', label: 'Machine Brand', width: '130px', desc: 'Manufacturer / Brand' },
    { key: 'group', label: 'Group / Conglomerate', width: '150px', desc: 'Corporate group' },
    { key: 'unit', label: 'Unit / Factory', width: '190px', desc: 'Plant location' },
    { key: 'floor', label: 'Floor', width: '130px', desc: 'Floor location' },
    { key: 'line', label: 'Line', width: '130px', desc: 'Production line' },
    { key: 'running', label: 'Running Quantity', width: '100px', desc: 'Operational machines' },
    { key: 'usable_idle', label: 'Usable Idle Quantity', width: '110px', desc: 'Standby usable machines' },
    { key: 'repairable_idle', label: 'Repairable Idle Quantity', width: '130px', desc: 'Under maintenance' },
    { key: 'total_quantity', label: 'Total Quantity', width: '100px', desc: 'System total quantity' },
    { key: 'status', label: 'Machine Status', width: '120px', desc: 'Current operational status' },
    { key: 'remarks', label: 'Remarks / Notes', width: '230px', desc: 'Asset remarks' }
  ];

  const standardCols = [
    { key: 'machineName', label: 'Machine Name' },
    { key: 'brand', label: 'Machine Brand' },
    { key: 'model', label: 'Machine Model' },
    { key: 'serialNumber', label: 'Machine Serial Number' },
    { key: 'group', label: 'Group / Conglomerate' },
    { key: 'unit', label: 'Unit / Factory' },
    { key: 'floor', label: 'Floor' },
    { key: 'line', label: 'Line' },
    { key: 'running', label: 'Running Quantity' },
    { key: 'usable_idle', label: 'Usable Idle Quantity' },
    { key: 'repairable_idle', label: 'Repairable Idle Quantity' },
    { key: 'total_quantity', label: 'Total Quantity' },
    { key: 'status', label: 'Machine Status' },
    { key: 'remarks', label: 'Remarks / Notes' },
    { key: 'actions', label: 'Action Menu (⋮ Actions)' }
  ];

  const optionalCols = [
    { key: 'purchase_date', label: 'Purchase Date' },
    { key: 'installation_date', label: 'Installation Date' },
    { key: 'supplier_name', label: 'Supplier / Vendor' },
    { key: 'country_of_origin', label: 'Country of Origin' },
    { key: 'machine_capacity', label: 'Machine Capacity / RPM' }
  ];

  const frozenList = Array.isArray(frozenCols) ? frozenCols : ['machineName', 'model', 'serialNumber'];

  return `
    <div class="modal-overlay" id="modal-column-vis-overlay">
      <div class="modal-dialog" style="max-width: 620px; max-height: 90vh; display: flex; flex-direction: column; background: #0b1120; border: 1.5px solid #38bdf8; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.9);">
        
        <!-- Header -->
        <div class="modal-header" style="background: #0f172a; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 14px 20px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚙️</span>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">Table Columns &amp; Freeze Settings</div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">Sticky Frozen Left Columns &bull; Column Visibility Control</div>
            </div>
          </div>
          <button id="btn-close-colvis-modal" class="btn btn-ghost btn-sm" style="font-size: 18px; color: #94a3b8;">✕</button>
        </div>

        <!-- Tab Navigation -->
        <div style="display: flex; background: #080d1a; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 8px 16px; gap: 8px;">
          <button type="button" id="tab-btn-frozen" class="btn btn-sm ${activeColVisTab === 'frozen' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px;">
            <span>❄️ Frozen Columns</span>
            <span class="badge" style="background: rgba(255,255,255,0.2); font-size: 10px; font-weight: 800;">${frozenList.length}</span>
          </button>
          <button type="button" id="tab-btn-visibility" class="btn btn-sm ${activeColVisTab === 'visibility' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px;">
            <span>👁️ Column Visibility</span>
            <span class="badge" style="background: rgba(255,255,255,0.2); font-size: 10px; font-weight: 800;">${visibleCols.size}</span>
          </button>
        </div>

        <div class="modal-body" style="padding: 18px 20px; overflow-y: auto; flex: 1; min-height: 0;">
          
          <!-- TAB 1: FROZEN COLUMNS (DEFAULT) -->
          <div id="tab-content-frozen" style="display: ${activeColVisTab === 'frozen' ? 'block' : 'none'};">
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 14.5px; font-weight: 800; color: #fff; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <span>❄️</span>
                  <span>Frozen Columns</span>
                </span>
                <span class="badge" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-size: 11px;">
                  Sticky on Horizontal Scroll
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5;">
                Select which columns should remain visible while horizontally scrolling. Admin can freeze or unfreeze any number of columns according to their preference.
              </div>
            </div>

            <!-- Quick Presets -->
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 8px 12px; margin-bottom: 14px;">
              <span style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Presets:</span>
              <button type="button" id="btn-preset-default-freeze" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.5);">
                ⭐ Machine Name + Model + Serial
              </button>
              <button type="button" id="btn-preset-name-only" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; font-weight: 700;">
                Machine Name Only
              </button>
              <button type="button" id="btn-preset-unfreeze-all" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; font-weight: 700; color: #f87171;">
                🔓 Unfreeze All
              </button>
            </div>

            <!-- Current Frozen Order Indicator -->
            <div id="frozen-columns-summary" style="background: rgba(2, 132, 199, 0.1); border: 1px dashed rgba(56, 189, 248, 0.4); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
              <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px;">
                📍 Fixed Left Sequence (During Horizontal Scroll):
              </div>
              <div style="font-size: 12px; color: #e2e8f0; font-family: var(--font-mono); line-height: 1.6;">
                <span style="color: #94a3b8;">SL (50px)</span> ➔ 
                <span style="color: #94a3b8;">Check (44px)</span>
                ${frozenList.length > 0 ? frozenList.map(k => {
                  const c = freezableCols.find(x => x.key === k);
                  return ` ➔ <strong style="color: #38bdf8;">${c ? c.label : k}</strong>`;
                }).join('') : ' ➔ <span style="color: #94a3b8; font-style: italic;">(No data columns frozen)</span>'}
              </div>
            </div>

            <!-- Column Freeze Checklist -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${freezableCols.map(c => {
                const isFrozen = frozenList.includes(c.key);
                return `
                  <label class="freeze-col-item" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: ${isFrozen ? 'rgba(2, 132, 199, 0.15)' : 'rgba(15, 23, 42, 0.5)'}; border: 1px solid ${isFrozen ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; cursor: pointer; transition: all 0.15s;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <input type="checkbox" class="colfreeze-check" data-col="${c.key}" ${isFrozen ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
                      <div>
                        <div style="font-size: 13px; font-weight: 700; color: #fff;">${c.label}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${c.desc} &bull; Width: ${c.width}</div>
                      </div>
                    </div>
                    <div>
                      ${isFrozen 
                        ? '<span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 10.5px; font-weight: 800;">❄️ Frozen</span>'
                        : '<span class="badge" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; font-size: 10.5px;">Unpinned</span>'
                      }
                    </div>
                  </label>
                `;
              }).join('')}
            </div>

          </div>

          <!-- TAB 2: COLUMN VISIBILITY (SHOW / HIDE) -->
          <div id="tab-content-visibility" style="display: ${activeColVisTab === 'visibility' ? 'block' : 'none'};">
            
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
              Choose which columns to show or hide in the Machine Inventory table.
            </div>

            <h4 style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px;">
              Core Machine Columns
            </h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px;">
              ${standardCols.map(c => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; padding: 4px 6px; background: rgba(15, 23, 42, 0.4); border-radius: 4px;">
                  <input type="checkbox" class="colvis-check" data-col="${c.key}" ${visibleCols.has(c.key) ? 'checked' : ''} />
                  <span>${c.label}</span>
                </label>
              `).join('')}
            </div>

            <h4 style="font-size: 12px; font-weight: 800; color: #a78bfa; text-transform: uppercase; margin-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
              Optional Specification Columns
            </h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px;">
              ${optionalCols.map(c => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; padding: 4px 6px; background: rgba(15, 23, 42, 0.4); border-radius: 4px;">
                  <input type="checkbox" class="colvis-check" data-col="${c.key}" ${visibleCols.has(c.key) ? 'checked' : ''} />
                  <span>${c.label}</span>
                </label>
              `).join('')}
            </div>

            ${customFields.length > 0 ? `
              <h4 style="font-size: 12px; font-weight: 800; color: #34d399; text-transform: uppercase; margin-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                Custom Fields
              </h4>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${customFields.map(cf => `
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; padding: 4px 6px; background: rgba(15, 23, 42, 0.4); border-radius: 4px;">
                    <input type="checkbox" class="colvis-check" data-col="${cf.code}" ${visibleCols.has(cf.code) ? 'checked' : ''} />
                    <span>${cf.label}</span>
                  </label>
                `).join('')}
              </div>
            ` : ''}

          </div>

        </div>

        <!-- Footer -->
        <div class="modal-footer" style="background: #0f172a; border-top: 1px solid rgba(255,255,255,0.1); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
          <button id="btn-colvis-reset-default" class="btn btn-secondary btn-sm" style="font-weight: 700;">
            ↺ Reset Defaults
          </button>
          <button id="btn-close-colvis-done" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 6px 18px;">
            Done &amp; Save
          </button>
        </div>

      </div>
    </div>
  `;
}

export function initColumnVisibilityEvents() {
  const overlay = document.getElementById('modal-column-vis-overlay');
  const closeBtn = document.getElementById('btn-close-colvis-modal');
  const doneBtn = document.getElementById('btn-close-colvis-done');
  const tabBtnFrozen = document.getElementById('tab-btn-frozen');
  const tabBtnVisibility = document.getElementById('tab-btn-visibility');
  const tabContentFrozen = document.getElementById('tab-content-frozen');
  const tabContentVisibility = document.getElementById('tab-content-visibility');

  const closeModal = () => state.set('activeModal', null);

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (doneBtn) doneBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Tab Switching
  if (tabBtnFrozen && tabBtnVisibility && tabContentFrozen && tabContentVisibility) {
    tabBtnFrozen.addEventListener('click', () => {
      activeColVisTab = 'frozen';
      tabContentFrozen.style.display = 'block';
      tabContentVisibility.style.display = 'none';
      tabBtnFrozen.className = 'btn btn-sm btn-primary';
      tabBtnVisibility.className = 'btn btn-sm btn-ghost';
    });

    tabBtnVisibility.addEventListener('click', () => {
      activeColVisTab = 'visibility';
      tabContentFrozen.style.display = 'none';
      tabContentVisibility.style.display = 'block';
      tabBtnFrozen.className = 'btn btn-sm btn-ghost';
      tabBtnVisibility.className = 'btn btn-sm btn-primary';
    });
  }

  // Preset Handlers for Frozen Columns
  const btnPresetDefault = document.getElementById('btn-preset-default-freeze');
  if (btnPresetDefault) {
    btnPresetDefault.addEventListener('click', () => {
      const defaultFrozen = ['machineName', 'model', 'serialNumber'];
      state.setFrozenColumns(defaultFrozen);
      notificationService.success('Frozen columns set to: Machine Name, Model, Serial Number');
      // Re-render modal to reflect changes
      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = renderColumnVisibilityModal();
        initColumnVisibilityEvents();
      }
    });
  }

  const btnPresetNameOnly = document.getElementById('btn-preset-name-only');
  if (btnPresetNameOnly) {
    btnPresetNameOnly.addEventListener('click', () => {
      state.setFrozenColumns(['machineName']);
      notificationService.info('Frozen column set to: Machine Name only');
      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = renderColumnVisibilityModal();
        initColumnVisibilityEvents();
      }
    });
  }

  const btnPresetUnfreeze = document.getElementById('btn-preset-unfreeze-all');
  if (btnPresetUnfreeze) {
    btnPresetUnfreeze.addEventListener('click', () => {
      state.setFrozenColumns([]);
      notificationService.info('All data columns unpinned. Only SL and Checkbox remain fixed.');
      const modalLayer = document.getElementById('modal-layer');
      if (modalLayer) {
        modalLayer.innerHTML = renderColumnVisibilityModal();
        initColumnVisibilityEvents();
      }
    });
  }

  // Individual Column Freeze Checkboxes
  document.querySelectorAll('.colfreeze-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const col = e.target.getAttribute('data-col');
      if (col) {
        state.toggleFreezeColumn(col);
        const modalLayer = document.getElementById('modal-layer');
        if (modalLayer) {
          modalLayer.innerHTML = renderColumnVisibilityModal();
          initColumnVisibilityEvents();
        }
      }
    });
  });

  // Individual Column Visibility Checkboxes
  document.querySelectorAll('.colvis-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const col = e.target.getAttribute('data-col');
      if (col) {
        state.toggleColumnVisibility(col);
      }
    });
  });

  // Reset to Default Button
  const resetDefaultBtn = document.getElementById('btn-colvis-reset-default');
  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      const defaultCols = [
        'sl', 'select', 'machineName', 'brand', 'model', 'serialNumber',
        'unit', 'floor', 'line', 'running', 'usable_idle', 'repairable_idle',
        'total_quantity', 'status', 'actions'
      ];
      state.state.visibleColumns = new Set(defaultCols);
      try {
        localStorage.setItem('erp_visible_columns_v3', JSON.stringify(defaultCols));
      } catch (e) {}

      const defaultFrozen = ['machineName', 'model', 'serialNumber'];
      state.setFrozenColumns(defaultFrozen);

      state.emit('columns:changed', defaultCols);
      notificationService.success('Reset all columns and freeze settings to factory defaults.');
      closeModal();
    });
  }
}
