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
 *    - Synchronized with active Excel Structure (e.g., Standard Garments Machinery Layout)
 *    - Preserves user custom order, field keys, and specifications
 *    - 1-Click quick layout application & visibility toggles
 */

import { customFieldService } from '../services/customFieldService.js';
import { notificationService } from '../services/notificationService.js';
import { excelService, mapFieldKeyToTableKey, isColumnKeyVisible } from '../services/excelService.js';
import { authService } from '../services/authService.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { state } from '../state.js';

// Freezable columns list available across entire modal lifecycle
export const FREEZABLE_COLUMNS = [
  { key: 'machineName', label: 'Machine Name', width: '200px', desc: 'Identifies machine type' },
  { key: 'brand', label: 'Machine Brand', width: '95px', desc: 'Manufacturer / Brand' },
  { key: 'model', label: 'Machine Model', width: '120px', desc: 'Model specification number' },
  { key: 'serialNumber', label: 'Machine Serial Number', width: '130px', desc: 'Unique asset identifier tag' },
  { key: 'systemAssetId', label: 'System Asset ID', width: '140px', desc: 'Permanent system-generated asset ID' },
  { key: 'manufacturing_serial', label: 'Manufacturing Serial Number', width: '125px', desc: 'Factory mfg serial tag' },
  { key: 'group', label: 'Group / Conglomerate', width: '110px', desc: 'Corporate group' },
  { key: 'unit', label: 'Unit / Factory', width: '140px', desc: 'Plant location' },
  { key: 'floor', label: 'Floor', width: '95px', desc: 'Floor location' },
  { key: 'line', label: 'Line', width: '95px', desc: 'Production line' },
  { key: 'running', label: 'Running Quantity', width: '75px', desc: 'Operational machines' },
  { key: 'usable_idle', label: 'Usable Idle Quantity', width: '80px', desc: 'Standby usable machines' },
  { key: 'repairable_idle', label: 'Repairable Idle Quantity', width: '90px', desc: 'Under maintenance' },
  { key: 'total_quantity', label: 'Total Quantity', width: '75px', desc: 'System total quantity' },
  { key: 'status', label: 'Machine Status', width: '95px', desc: 'Current operational status' },
  { key: 'service_date', label: 'Last Service Date', width: '125px', desc: 'PM maintenance servicing date' },
  { key: 'remarks', label: 'Remarks / Notes', width: '120px', desc: 'Asset remarks' }
];

let activeColVisTab = 'frozen'; // 'frozen' | 'visibility'

export function renderColumnVisibilityModal() {
  const visibleCols = state.get('visibleColumns') || new Set();
  const frozenCols = state.get('frozenColumns') || ['machineName', 'model', 'serialNumber'];
  const customFields = customFieldService.getActiveFields();
  const isAdmin = Boolean(typeof authService !== 'undefined' && (authService.isAdmin() || authService.isSuperAdmin()));

  // Active Excel Structure layout integration
  const activeStructure = (typeof excelService !== 'undefined' && excelService.getActiveStructure)
    ? excelService.getActiveStructure()
    : null;
  const layoutCols = (activeStructure && Array.isArray(activeStructure.columns))
    ? [...activeStructure.columns].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];
  const structName = activeStructure?.name || 'Standard Garments Machinery Layout';

  const freezableCols = FREEZABLE_COLUMNS;

  // Set of keys already present in the active layout
  const layoutKeys = new Set();
  layoutCols.forEach(c => {
    layoutKeys.add(c.fieldKey.toLowerCase());
    const mapped = mapFieldKeyToTableKey(c.fieldKey);
    if (mapped) layoutKeys.add(mapped.toLowerCase());
  });

  // Additional specification columns not in active layout
  const allSpecCols = [
    { key: 'systemAssetId', label: 'System Asset ID', fieldKey: 'system_asset_id' },
    { key: 'group', label: 'Group / Conglomerate', fieldKey: 'group' },
    { key: 'purchase_date', label: 'Purchase Date', fieldKey: 'purchase_date' },
    { key: 'installation_date', label: 'Installation Date', fieldKey: 'installation_date' },
    { key: 'supplier_name', label: 'Supplier / Vendor', fieldKey: 'supplier_name' },
    { key: 'country_of_origin', label: 'Country of Origin', fieldKey: 'country_of_origin' },
    { key: 'machine_capacity', label: 'Machine Capacity / RPM', fieldKey: 'machine_capacity' },
    { key: 'manufacturing', label: 'Manufacturing Info', fieldKey: 'manufacturing' },
    { key: 'manufacturing_year', label: 'Manufacturing Year', fieldKey: 'manufacturing_year' }
  ];
  const specCols = allSpecCols.filter(sc => !layoutKeys.has(sc.key.toLowerCase()) && !layoutKeys.has(sc.fieldKey.toLowerCase()));

  const frozenList = Array.isArray(frozenCols) ? frozenCols : ['machineName', 'model', 'serialNumber'];

  // Count active visible layout columns
  let visibleLayoutCount = 0;
  layoutCols.forEach(c => {
    const tableKey = mapFieldKeyToTableKey(c.fieldKey);
    if (isColumnKeyVisible(c.fieldKey, visibleCols) || isColumnKeyVisible(tableKey, visibleCols)) {
      visibleLayoutCount++;
    }
  });

  return `
    <div class="modal-overlay" id="modal-column-vis-overlay">
      <div class="modal-dialog" style="max-width: 660px; max-height: 90vh; display: flex; flex-direction: column; background: #0b1120; border: 1.5px solid #38bdf8; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.9);">
        
        <!-- Header -->
        <div class="modal-header" style="background: #0f172a; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 14px 20px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚙️</span>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>Table Columns &amp; Freeze Settings</span>
                ${isAdmin ? `
                  <span class="badge" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 10px; font-weight: 800; padding: 2px 6px;">
                    👑 Admin Default Control
                  </span>
                ` : `
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 10px; font-weight: 800; padding: 2px 6px;">
                    👤 Personal Customization
                  </span>
                `}
              </div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">
                ${isAdmin 
                  ? 'Personalize your view or save default layout for all factory users &bull; Auto-persists across refresh' 
                  : 'Customize columns for your workflow &bull; Saved preferences persist across refresh'
                }
              </div>
            </div>
          </div>
          <button id="btn-close-colvis-modal" class="btn btn-ghost btn-sm" style="font-size: 18px; color: #94a3b8;" title="Close modal">✕</button>
        </div>

        <!-- Tab Navigation -->
        <div style="display: flex; background: #080d1a; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 8px 16px; gap: 8px;">
          <button type="button" id="tab-btn-frozen" class="btn btn-sm ${activeColVisTab === 'frozen' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px;">
            <span>❄️ Frozen Columns</span>
            <span class="badge" style="background: rgba(255,255,255,0.2); font-size: 10px; font-weight: 800;">${frozenList.length}</span>
          </button>
          <button type="button" id="tab-btn-visibility" class="btn btn-sm ${activeColVisTab === 'visibility' ? 'btn-primary' : 'btn-ghost'}" style="font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px;">
            <span>👁️ Column Visibility</span>
            <span class="badge" style="background: rgba(255,255,255,0.2); font-size: 10px; font-weight: 800;">${visibleLayoutCount}/${layoutCols.length}</span>
          </button>
        </div>

        <div class="modal-body" style="padding: 18px 20px; overflow-y: auto; flex: 1; min-height: 0;">
          
          <!-- TAB 1: FROZEN COLUMNS -->
          <div id="tab-content-frozen" style="display: ${activeColVisTab === 'frozen' ? 'block' : 'none'};">
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 14.5px; font-weight: 800; color: #fff; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 8px;">
                  <span>❄️</span>
                  <span>Sticky Frozen Columns</span>
                </span>
                <span class="badge" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-size: 11px;">
                  Pinned on Horizontal Scroll
                </span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5;">
                Select columns to pin to the left edge while horizontally scrolling the Machine Inventory table.
              </div>
            </div>

            <!-- Quick Presets -->
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 8px 12px; margin-bottom: 14px;">
              <span style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Presets:</span>
              <button type="button" id="btn-preset-default-freeze" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.5);">
                ⭐ Name + Model + Serial
              </button>
              <button type="button" id="btn-preset-with-mfg" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; font-weight: 700; color: #34d399; border-color: rgba(52, 211, 153, 0.5);">
                ⭐ Name + Serial + Mfg Serial
              </button>
              <button type="button" id="btn-preset-name-only" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; font-weight: 700;">
                Name Only
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
                  const c = FREEZABLE_COLUMNS.find(x => x.key === k || mapFieldKeyToTableKey(x.key) === mapFieldKeyToTableKey(k));
                  return ` ➔ <strong style="color: #38bdf8;">${c ? c.label : k}</strong>`;
                }).join('') : ' ➔ <span style="color: #94a3b8; font-style: italic;">(No data columns frozen)</span>'}
              </div>
            </div>

            <!-- Column Freeze Checklist -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${freezableCols.map(c => {
                const isFrozen = frozenList.includes(c.key) || frozenList.includes(mapFieldKeyToTableKey(c.key));
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
            
            <!-- Active Layout Info Banner & Action Deck -->
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div style="font-size: 12.5px; font-weight: 800; color: #fff;">
                  <span style="color: #38bdf8;">Current Layout:</span> ${structName}
                </div>
                <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 10.5px; font-weight: 800;">
                  ${layoutCols.length} Columns Configured
                </span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 10px;">
                Choose which columns to show or hide in the Machine Inventory table. All columns below are synchronized directly with your current active layout.
              </div>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <button type="button" id="btn-colvis-apply-layout" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 4px 10px; font-weight: 800;">
                  📋 Show All Layout Columns (${layoutCols.length})
                </button>
                <button type="button" id="btn-colvis-select-all" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 4px 10px; font-weight: 700;">
                  👁️ Show All Available
                </button>
                <button type="button" id="btn-colvis-minimal" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 4px 10px; font-weight: 700;">
                  🗂️ Minimal View
                </button>
                <button type="button" id="btn-colvis-deselect-all" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 4px 10px; font-weight: 700; color: #f87171;">
                  ✕ Deselect All
                </button>
              </div>
            </div>

            <!-- Section 1: Active Layout Columns (1 to 15) -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin: 0;">
                Current Layout Columns (${structName})
              </h4>
              <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Ordered #1 to #${layoutCols.length}</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px;">
              ${layoutCols.map((c, i) => {
                const tableKey = mapFieldKeyToTableKey(c.fieldKey);
                const isChecked = isColumnKeyVisible(c.fieldKey, visibleCols) || isColumnKeyVisible(tableKey, visibleCols);
                return `
                  <label class="colvis-item-label" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; cursor: pointer; padding: 6px 10px; background: ${isChecked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.4)'}; border: 1px solid ${isChecked ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)'}; border-radius: 6px; transition: all 0.15s;">
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                      <input type="checkbox" class="colvis-check" data-col="${tableKey}" data-field="${c.fieldKey}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer;" />
                      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis;">${c.header}</div>
                        <div style="font-size: 10px; color: #94a3b8; font-family: var(--font-mono);">${c.fieldKey}</div>
                      </div>
                    </div>
                    <span class="badge" style="background: rgba(255,255,255,0.08); color: #38bdf8; font-size: 10px; font-weight: 800; padding: 1px 5px; flex-shrink: 0;">#${c.order || (i + 1)}</span>
                  </label>
                `;
              }).join('')}

              <!-- Actions Column -->
              <label class="colvis-item-label" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; cursor: pointer; padding: 6px 10px; background: ${isColumnKeyVisible('actions', visibleCols) ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.4)'}; border: 1px solid ${isColumnKeyVisible('actions', visibleCols) ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)'}; border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" class="colvis-check" data-col="actions" ${isColumnKeyVisible('actions', visibleCols) ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer;" />
                  <div>
                    <div style="font-weight: 700; color: #fff;">Action Menu</div>
                    <div style="font-size: 10px; color: #94a3b8;">⋮ Actions</div>
                  </div>
                </div>
                <span class="badge" style="background: rgba(255,255,255,0.08); color: #a78bfa; font-size: 10px; font-weight: 800; padding: 1px 5px;">Menu</span>
              </label>
            </div>

            ${specCols.length > 0 ? `
              <!-- Section 2: Additional Specification Columns -->
              <h4 style="font-size: 12px; font-weight: 800; color: #a78bfa; text-transform: uppercase; margin-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                Additional Specification Columns
              </h4>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px;">
                ${specCols.map(c => {
                  const isChecked = isColumnKeyVisible(c.key, visibleCols);
                  return `
                    <label class="colvis-item-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; padding: 6px 8px; background: ${isChecked ? 'rgba(167, 139, 250, 0.08)' : 'rgba(15, 23, 42, 0.4)'}; border: 1px solid ${isChecked ? 'rgba(167, 139, 250, 0.35)' : 'rgba(255,255,255,0.06)'}; border-radius: 6px;">
                      <input type="checkbox" class="colvis-check" data-col="${c.key}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer;" />
                      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-weight: 700; color: #fff;">${c.label}</div>
                        <div style="font-size: 10px; color: #94a3b8; font-family: var(--font-mono);">${c.key}</div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            ` : ''}

            ${customFields.length > 0 ? `
              <!-- Section 3: Custom Fields -->
              <h4 style="font-size: 12px; font-weight: 800; color: #34d399; text-transform: uppercase; margin-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                Custom Fields
              </h4>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                ${customFields.map(cf => {
                  const isChecked = isColumnKeyVisible(cf.code, visibleCols);
                  return `
                    <label class="colvis-item-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; padding: 6px 8px; background: ${isChecked ? 'rgba(52, 211, 153, 0.08)' : 'rgba(15, 23, 42, 0.4)'}; border: 1px solid ${isChecked ? 'rgba(52, 211, 153, 0.35)' : 'rgba(255,255,255,0.06)'}; border-radius: 6px;">
                      <input type="checkbox" class="colvis-check" data-col="${cf.code}" ${isChecked ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer;" />
                      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-weight: 700; color: #fff;">${cf.label}</div>
                        <div style="font-size: 10px; color: #94a3b8; font-family: var(--font-mono);">${cf.code}</div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            ` : ''}

          </div>

        </div>

        <!-- Footer -->
        <div class="modal-footer" style="background: #0f172a; border-top: 1px solid rgba(255,255,255,0.1); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <button type="button" id="btn-colvis-reset-default" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 6px 14px;" title="Reset your column layout to Admin organization defaults">
            ↺ Reset to Admin Default
          </button>
          
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            ${isAdmin ? `
              <button type="button" id="btn-colvis-save-global-default" class="btn btn-sm" style="font-weight: 800; font-size: 11.5px; background: linear-gradient(135deg, #d97706, #b45309); border: 1px solid #f59e0b; color: #fff; padding: 6px 14px; display: inline-flex; align-items: center; gap: 6px;" title="Set these visible columns as the organization default baseline for all users">
                <span>💾</span> Save as Default for All Users
              </button>
            ` : ''}
            <button type="button" id="btn-close-colvis-done" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11.5px; padding: 6px 18px; display: inline-flex; align-items: center; gap: 6px;" title="Save your personal column preferences and close">
              <span>✓</span> Done &amp; Save
            </button>
          </div>
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

  const handleEscape = (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      window.removeEventListener('keydown', handleEscape);
      closeModal();
    }
  };
  window.addEventListener('keydown', handleEscape);

  const closeModal = () => {
    window.removeEventListener('keydown', handleEscape);
    state.set('activeModal', null);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Helper to read currently checked visible columns from modal DOM
  const getCheckedVisibleCols = () => {
    const checkedCols = [];
    document.querySelectorAll('.colvis-check:checked').forEach(el => {
      const col = el.getAttribute('data-col');
      const field = el.getAttribute('data-field');
      if (col && !checkedCols.includes(col)) checkedCols.push(col);
      if (field && !checkedCols.includes(field)) checkedCols.push(field);
    });
    if (checkedCols.length === 0) {
      checkedCols.push('machineName', 'actions');
    }
    if (!checkedCols.includes('sl')) checkedCols.unshift('sl');
    if (!checkedCols.includes('select')) checkedCols.splice(1, 0, 'select');
    return checkedCols;
  };

  // Helper to read currently checked frozen columns from modal DOM
  const getCheckedFrozenCols = () => {
    const checkedFrozen = [];
    document.querySelectorAll('.colfreeze-check:checked').forEach(el => {
      const col = el.getAttribute('data-col');
      if (col && !checkedFrozen.includes(col)) checkedFrozen.push(col);
    });
    return checkedFrozen;
  };

  // Update Frozen Columns Summary UI in-place without destroying DOM
  const updateFrozenSummaryUI = (frozenList) => {
    const summaryContainer = document.getElementById('frozen-columns-summary');
    if (summaryContainer) {
      const colHtml = frozenList.length > 0 ? frozenList.map(k => {
        const c = FREEZABLE_COLUMNS.find(x => x.key === k || mapFieldKeyToTableKey(x.key) === mapFieldKeyToTableKey(k));
        return ` ➔ <strong style="color: #38bdf8;">${c ? c.label : k}</strong>`;
      }).join('') : ' ➔ <span style="color: #94a3b8; font-style: italic;">(No data columns frozen)</span>';

      summaryContainer.innerHTML = `
        <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px;">
          📍 Fixed Left Sequence (During Horizontal Scroll):
        </div>
        <div style="font-size: 12px; color: #e2e8f0; font-family: var(--font-mono); line-height: 1.6;">
          <span style="color: #94a3b8;">SL (50px)</span> ➔ 
          <span style="color: #94a3b8;">Check (44px)</span>
          ${colHtml}
        </div>
      `;
    }

    // Update Tab 1 badge
    if (tabBtnFrozen) {
      const badge = tabBtnFrozen.querySelector('.badge');
      if (badge) badge.textContent = String(frozenList.length);
    }

    // Update labels and checkboxes visual state
    document.querySelectorAll('.colfreeze-check').forEach(chk => {
      const colKey = chk.getAttribute('data-col');
      const isChecked = frozenList.includes(colKey) || frozenList.includes(mapFieldKeyToTableKey(colKey));
      chk.checked = isChecked;
      const parentLabel = chk.closest('.freeze-col-item');
      if (parentLabel) {
        parentLabel.style.background = isChecked ? 'rgba(2, 132, 199, 0.15)' : 'rgba(15, 23, 42, 0.5)';
        parentLabel.style.borderColor = isChecked ? '#38bdf8' : 'rgba(255,255,255,0.08)';
        const badgeDiv = parentLabel.lastElementChild;
        if (badgeDiv) {
          badgeDiv.innerHTML = isChecked
            ? '<span class="badge" style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 10.5px; font-weight: 800;">❄️ Frozen</span>'
            : '<span class="badge" style="background: rgba(148, 163, 184, 0.1); color: #94a3b8; font-size: 10.5px;">Unpinned</span>';
        }
      }
    });
  };

  // Update Column Visibility Summary UI in-place
  const updateVisibilitySummaryUI = () => {
    const checked = document.querySelectorAll('.colvis-check:checked');
    const total = document.querySelectorAll('.colvis-check').length || 16;
    if (tabBtnVisibility) {
      const badge = tabBtnVisibility.querySelector('.badge');
      if (badge) {
        badge.textContent = `${checked.length}/${total}`;
      }
    }
  };

  // Done & Save: Commits user's chosen columns & frozen settings to persistent state
  if (doneBtn) {
    doneBtn.addEventListener('click', () => {
      const checkedCols = getCheckedVisibleCols();
      const checkedFrozen = getCheckedFrozenCols();
      const finalFrozen = checkedFrozen;

      state.setVisibleColumns(checkedCols, false, true);
      state.setFrozenColumns(finalFrozen, false, true);

      notificationService.success(`Saved personal table column & freeze settings (${checkedCols.length} columns active, ${finalFrozen.length} frozen).`);
      closeModal();
    });
  }

  // Admin Save as Default for All Users: Persists organization default layout to Settings in MySQL & Storage
  const globalSaveBtn = document.getElementById('btn-colvis-save-global-default');
  if (globalSaveBtn) {
    globalSaveBtn.addEventListener('click', async () => {
      const origHtml = globalSaveBtn.innerHTML;
      globalSaveBtn.disabled = true;
      globalSaveBtn.innerHTML = '<span>⏳</span> Saving to Cloud...';

      const checkedCols = getCheckedVisibleCols();
      const checkedFrozen = getCheckedFrozenCols();
      const finalFrozen = checkedFrozen;

      try {
        await state.saveAdminDefaultColumns(checkedCols, finalFrozen);
        notificationService.success(`✅ Saved ${checkedCols.length} columns & ${finalFrozen.length} frozen columns as organization default for all users and synced to cloud!`);
        closeModal();
      } catch (err) {
        console.error('Error saving global settings:', err);
        notificationService.error('Failed to save default columns to cloud: ' + (err.message || 'Network error'));
        globalSaveBtn.disabled = false;
        globalSaveBtn.innerHTML = origHtml;
      }
    });
  }

  const reRenderModal = () => {
    const modalLayer = document.getElementById('modal-layer');
    if (modalLayer) {
      modalLayer.innerHTML = renderColumnVisibilityModal();
      initColumnVisibilityEvents();
    }
  };

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
      state.setFrozenColumns(defaultFrozen, false, true);
      updateFrozenSummaryUI(defaultFrozen);
    });
  }

  const btnPresetWithMfg = document.getElementById('btn-preset-with-mfg');
  if (btnPresetWithMfg) {
    btnPresetWithMfg.addEventListener('click', () => {
      const mfgFrozen = ['machineName', 'serialNumber', 'manufacturing_serial'];
      state.setFrozenColumns(mfgFrozen, false, true);
      updateFrozenSummaryUI(mfgFrozen);
    });
  }

  const btnPresetNameOnly = document.getElementById('btn-preset-name-only');
  if (btnPresetNameOnly) {
    btnPresetNameOnly.addEventListener('click', () => {
      const nameFrozen = ['machineName'];
      state.setFrozenColumns(nameFrozen, false, true);
      updateFrozenSummaryUI(nameFrozen);
    });
  }

  const btnPresetUnfreeze = document.getElementById('btn-preset-unfreeze-all');
  if (btnPresetUnfreeze) {
    btnPresetUnfreeze.addEventListener('click', () => {
      state.setFrozenColumns([], false, true);
      updateFrozenSummaryUI([]);
    });
  }

  // Individual Column Freeze Checkboxes
  document.querySelectorAll('.colfreeze-check').forEach(chk => {
    chk.addEventListener('change', () => {
      const currentFrozen = getCheckedFrozenCols();
      state.setFrozenColumns(currentFrozen, false, true);
      updateFrozenSummaryUI(currentFrozen);
    });
  });

  // Quick Action Presets under Column Visibility Tab
  const btnApplyLayout = document.getElementById('btn-colvis-apply-layout');
  if (btnApplyLayout) {
    btnApplyLayout.addEventListener('click', () => {
      const struct = excelService.getActiveStructure();
      const activeCols = struct?.columns || [];
      const cols = ['sl', 'select'];
      activeCols.forEach(c => {
        cols.push(mapFieldKeyToTableKey(c.fieldKey));
        cols.push(c.fieldKey);
      });
      cols.push('actions');
      state.setVisibleColumns(cols, false, true);
      document.querySelectorAll('.colvis-check').forEach(c => {
        const col = c.getAttribute('data-col');
        const field = c.getAttribute('data-field');
        const isChecked = cols.includes(col) || cols.includes(field);
        c.checked = isChecked;
        const parentLabel = c.closest('.colvis-item-label');
        if (parentLabel) {
          parentLabel.style.background = isChecked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.4)';
          parentLabel.style.borderColor = isChecked ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)';
        }
      });
      updateVisibilitySummaryUI();
    });
  }

  const btnSelectAll = document.getElementById('btn-colvis-select-all');
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      const allPossible = [
        'sl', 'select', 'machineName', 'machine_name', 'brand', 'machine_brand',
        'model', 'machine_model', 'serialNumber', 'machine_serial',
        'manufacturing_serial', 'group', 'unit', 'unit_factory', 'floor', 'line',
        'running', 'usable_idle', 'repairable_idle', 'total_quantity', 'status', 'machine_status',
        'service_date', 'remarks', 'purchase_date', 'installation_date', 'supplier_name',
        'country_of_origin', 'machine_capacity', 'manufacturing', 'manufacturing_year', 'actions'
      ];
      const customFields = customFieldService.getActiveFields();
      customFields.forEach(cf => allPossible.push(cf.code));
      state.setVisibleColumns(allPossible, false, true);
      document.querySelectorAll('.colvis-check').forEach(c => {
        c.checked = true;
        const parentLabel = c.closest('.colvis-item-label');
        if (parentLabel) {
          parentLabel.style.background = 'rgba(56, 189, 248, 0.08)';
          parentLabel.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        }
      });
      updateVisibilitySummaryUI();
    });
  }

  const btnMinimal = document.getElementById('btn-colvis-minimal');
  if (btnMinimal) {
    btnMinimal.addEventListener('click', () => {
      const minCols = ['sl', 'select', 'machineName', 'model', 'serialNumber', 'unit', 'line', 'total_quantity', 'status', 'actions'];
      state.setVisibleColumns(minCols, false, true);
      document.querySelectorAll('.colvis-check').forEach(c => {
        const col = c.getAttribute('data-col');
        const field = c.getAttribute('data-field');
        const isChecked = minCols.includes(col) || minCols.includes(field);
        c.checked = isChecked;
        const parentLabel = c.closest('.colvis-item-label');
        if (parentLabel) {
          parentLabel.style.background = isChecked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.4)';
          parentLabel.style.borderColor = isChecked ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)';
        }
      });
      updateVisibilitySummaryUI();
    });
  }

  const btnDeselectAll = document.getElementById('btn-colvis-deselect-all');
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      const baseCols = ['sl', 'select', 'machineName', 'actions'];
      state.setVisibleColumns(baseCols, false, true);
      document.querySelectorAll('.colvis-check').forEach(c => {
        const col = c.getAttribute('data-col');
        const isBase = col === 'machineName' || col === 'actions';
        c.checked = isBase;
        const parentLabel = c.closest('.colvis-item-label');
        if (parentLabel) {
          parentLabel.style.background = isBase ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.4)';
          parentLabel.style.borderColor = isBase ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)';
        }
      });
      updateVisibilitySummaryUI();
    });
  }

  // Individual Column Visibility Checkboxes
  document.querySelectorAll('.colvis-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const col = e.target.getAttribute('data-col');
      const field = e.target.getAttribute('data-field');
      if (col) {
        state.toggleColumnVisibility(col);
        if (field && field !== col) {
          const isNowVis = state.get('visibleColumns')?.has(col);
          if (isNowVis) state.get('visibleColumns')?.add(field);
          else state.get('visibleColumns')?.delete(field);
        }
        const parentLabel = chk.closest('.colvis-item-label');
        if (parentLabel) {
          parentLabel.style.background = chk.checked ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.4)';
          parentLabel.style.borderColor = chk.checked ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255,255,255,0.06)';
        }
        updateVisibilitySummaryUI();
      }
    });
  });

  // Reset to Default Button (Restores Admin-configured organization default)
  const resetDefaultBtn = document.getElementById('btn-colvis-reset-default');
  if (resetDefaultBtn) {
    resetDefaultBtn.addEventListener('click', () => {
      state.resetVisibleColumnsToAdminDefault();
      notificationService.success('Reset columns to organization default layout.');
      closeModal();
    });
  }
}
