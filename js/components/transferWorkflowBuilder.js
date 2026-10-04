/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Transfer Approval Configuration & Workflow Builder
 * 
 * Ultra User-Friendly, 100% English, Interactive Vertical Pipeline Builder
 */

import { workflowService, WORKFLOW_PRESETS } from '../services/workflowService.js';
import { masterDataService } from '../services/masterDataService.js';
import { APPROVER_TYPES } from '../db/schema.js';
import { state } from '../state.js';
import { notificationService } from '../services/notificationService.js';

let editingWorkflow = null;
let showAdvancedScope = false;

// Approver metadata helper for clean English labels and icons
function getApproverInfo(type) {
  switch (type) {
    case APPROVER_TYPES.SOURCE_LOCATION:
      return {
        icon: '📤',
        nameEn: 'Source Location In-Charge',
        descEn: 'Origin production line / floor in-charge release',
        badgeClass: 'badge-source'
      };
    case APPROVER_TYPES.DEST_LOCATION:
      return {
        icon: '📥',
        nameEn: 'Destination Location In-Charge',
        descEn: 'Target receiving line / floor in-charge acceptance',
        badgeClass: 'badge-dest'
      };
    case APPROVER_TYPES.ADMIN:
      return {
        icon: '🛡️',
        nameEn: 'Central Maintenance Admin',
        descEn: 'Super Admin or Maintenance Admin authorization',
        badgeClass: 'badge-admin'
      };
    case APPROVER_TYPES.MAINTENANCE_MANAGER:
      return {
        icon: '🔧',
        nameEn: 'Central Maintenance Manager',
        descEn: 'Engineering lead overhaul & capacity verification',
        badgeClass: 'badge-manager'
      };
    case APPROVER_TYPES.DEPARTMENT_HEAD:
      return {
        icon: '👔',
        nameEn: 'Department Head / AGM',
        descEn: 'Division executive or plant GM sign-off',
        badgeClass: 'badge-head'
      };
    default:
      return {
        icon: '👤',
        nameEn: 'Authorized Approver',
        descEn: 'Designated user role sign-off',
        badgeClass: 'badge-default'
      };
  }
}

export function renderTransferWorkflowBuilder() {
  const workflows = workflowService.getWorkflows();
  const units = masterDataService.getUnits();
  const categories = masterDataService.getCategories();

  // Find currently selected workflow or default to first
  let currentWf = editingWorkflow;
  if (!currentWf) {
    currentWf = workflows.find(w => w.isDefault) || workflows[0] || {
      name: 'Standard Factory Transfer (Source → Dest → Admin)',
      description: 'Standard multi-stage relocation protocol',
      requireDocument: true,
      sequential: true,
      isDefault: true,
      scope: {},
      levels: [
        { level: 1, title: 'Source Floor In-Charge Release', approverType: APPROVER_TYPES.SOURCE_LOCATION, description: 'Release equipment from source line.' },
        { level: 2, title: 'Destination Floor In-Charge Acceptance', approverType: APPROVER_TYPES.DEST_LOCATION, description: 'Accept machine at target destination line.' },
        { level: 3, title: 'Central Maintenance Admin Authorization', approverType: APPROVER_TYPES.ADMIN, description: 'Final gate pass authorization and inventory update.' }
      ]
    };
    editingWorkflow = JSON.parse(JSON.stringify(currentWf));
  }

  // Determine if advanced scope is active
  if (currentWf.scope?.unitId || currentWf.scope?.categoryId) {
    showAdvancedScope = true;
  }

  const levels = currentWf.levels || [];

  return `
    <div class="page-view wf-builder-wrapper">
      
      <!-- 1. COMPACT TOP HEADER BAR -->
      <div class="view-header-row" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="min-width: 0; flex: 1;">
          <h1 style="font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; margin: 0; word-break: break-word;">
            <span>⚙️ Transfer Approval Configuration &amp; Workflows</span>
          </h1>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin: 4px 0 0 0;">
            Configure who authorizes machinery relocations between factory lines and manages gate pass policies.
          </p>
        </div>

        <div class="view-header-actions" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1 1 240px; min-width: 0; width: 100%;">
            <label style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; white-space: nowrap;">Active Rule:</label>
            <select id="wf-select-switcher" class="form-control" style="flex: 1; min-width: 0; width: 100%; font-weight: 700; font-size: 13px; background: var(--bg-card); border-color: #38bdf8;">
              ${workflows.map(w => `
                <option value="${w.id}" ${currentWf.id === w.id ? 'selected' : ''}>
                  ${w.name} ${w.isDefault ? '⭐ [DEFAULT]' : ''}
                </option>
              `).join('')}
            </select>
          </div>

          <button type="button" id="btn-create-new-workflow" class="btn btn-primary" style="font-weight: 800; display: flex; align-items: center; gap: 6px;">
            <span>➕ New Workflow</span>
          </button>

          <button type="button" id="btn-top-save-workflow" class="btn btn-success" style="font-weight: 800; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);">
            <span>💾 Save Workflow</span>
          </button>
        </div>
      </div>

      <!-- 2. QUICK STARTER TEMPLATES (1-Click Fast Presets) -->
      <div class="wf-presets-container">
        <div class="wf-presets-title">
          <span>⚡ Quick Starter Templates — Click any template to instantly configure steps:</span>
        </div>
        
        <div class="wf-presets-grid">
          ${WORKFLOW_PRESETS.map(p => `
            <div class="wf-preset-item-card btn-quick-preset-item" data-preset-id="${p.id}">
              <div class="wf-preset-item-header">
                <span class="wf-preset-item-icon">${p.icon || '⚡'}</span>
                <span class="wf-preset-item-tag ${p.tagType || 'badge-fast'}">${p.tag || 'Template'}</span>
              </div>
              <div>
                <div class="wf-preset-item-name">${(p.name || '').replace('Option ', '').replace(': ', ' — ')}</div>
                <div class="wf-preset-item-desc">${p.description}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 3. MAIN FORM: INTERACTIVE VISUAL APPROVAL PIPELINE -->
      <form id="form-workflow-builder" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- SECTION 1: VISUAL APPROVAL PIPELINE -->
        <div class="wf-form-card" style="border-left: 4px solid #38bdf8;">
          <div class="wf-form-card-header">
            <div class="wf-card-title-group">
              <span class="wf-card-step-badge" style="background: #0284c7;">1</span>
              <div>
                <div class="wf-form-card-title">Approval Sequence &amp; Routing Steps</div>
                <div class="wf-form-card-subtitle">When a machine move request is submitted, it progresses sequentially through these stages:</div>
              </div>
            </div>

            <button type="button" id="btn-add-level" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); display: flex; align-items: center; gap: 6px;">
              <span>➕ Add Approval Level</span>
            </button>
          </div>

          <!-- The Vertical Interactive Chain -->
          <div class="wf-flow-chain-container">
            
            <!-- A. START NODE -->
            <div class="wf-flow-start-node">
              <div class="wf-flow-node-icon">🚀</div>
              <div>
                <div class="wf-flow-node-title">Step 0: Transfer Request Initiated</div>
                <div class="wf-flow-node-desc">Maintenance technician submits machine serial number, source location, and target destination.</div>
              </div>
            </div>

            <!-- B. DYNAMIC APPROVAL STAGES -->
            <div id="wf-levels-container" style="display: flex; flex-direction: column; gap: 0;">
              ${levels.map((lvl, index) => {
                const info = getApproverInfo(lvl.approverType);
                const isFirst = index === 0;
                const isLast = index === (levels.length - 1);
                const isOnlyOne = levels.length <= 1;

                return `
                  <!-- Connector Arrow Above This Step -->
                  <div class="wf-flow-connector">
                    <span class="wf-flow-connector-arrow">⬇️ Then requires Level ${index + 1} sign-off:</span>
                  </div>

                  <!-- Step Card -->
                  <div class="wf-step-item-card" data-level-index="${index}">
                    <div class="wf-step-header">
                      <div class="wf-step-number-tag">
                        <span>${info.icon}</span>
                        <span>Level ${index + 1} Approval Gate: <strong>${lvl.title || info.nameEn}</strong></span>
                      </div>

                      <div class="wf-step-actions">
                        <button type="button" class="wf-step-action-btn btn-move-level-up" data-idx="${index}" ${isFirst ? 'disabled' : ''} title="Move Up in sequence">
                          <span>⬆️ Move Up</span>
                        </button>
                        <button type="button" class="wf-step-action-btn btn-move-level-down" data-idx="${index}" ${isLast ? 'disabled' : ''} title="Move Down in sequence">
                          <span>⬇️ Move Down</span>
                        </button>
                        <button type="button" class="wf-step-action-btn btn-delete btn-remove-level" data-idx="${index}" ${isOnlyOne ? 'disabled' : ''} title="Remove this level">
                          <span>🗑️ Remove</span>
                        </button>
                      </div>
                    </div>

                    <div class="form-grid-2">
                      <div class="form-group">
                        <label class="form-label">Who Must Authorize This Stage? <span class="req">*</span></label>
                        <select class="form-control level-input-type" data-idx="${index}" style="font-weight: 700; font-size: 13px;">
                          <option value="${APPROVER_TYPES.DEST_LOCATION}" ${lvl.approverType === APPROVER_TYPES.DEST_LOCATION ? 'selected' : ''}>
                            📥 Destination Location In-Charge (Target Floor / Line)
                          </option>
                          <option value="${APPROVER_TYPES.SOURCE_LOCATION}" ${lvl.approverType === APPROVER_TYPES.SOURCE_LOCATION ? 'selected' : ''}>
                            📤 Source Location In-Charge (Origin Floor / Line)
                          </option>
                          <option value="${APPROVER_TYPES.ADMIN}" ${lvl.approverType === APPROVER_TYPES.ADMIN ? 'selected' : ''}>
                            🛡️ Central Maintenance Admin / Super Admin
                          </option>
                          <option value="${APPROVER_TYPES.MAINTENANCE_MANAGER}" ${lvl.approverType === APPROVER_TYPES.MAINTENANCE_MANAGER ? 'selected' : ''}>
                            🔧 Central Maintenance Manager / Engineering Lead
                          </option>
                          <option value="${APPROVER_TYPES.DEPARTMENT_HEAD}" ${lvl.approverType === APPROVER_TYPES.DEPARTMENT_HEAD ? 'selected' : ''}>
                            👔 Department Head / Division AGM Sign-off
                          </option>
                        </select>
                      </div>

                      <div class="form-group">
                        <label class="form-label">Stage Display Name <span class="req">*</span></label>
                        <input type="text" class="form-control level-input-title" data-idx="${index}" value="${lvl.title || info.nameEn}" placeholder="e.g. Destination Floor Acceptance" required />
                      </div>

                      <div class="form-group full-width" style="margin-bottom: 0;">
                        <label class="form-label">Verification Instructions / Checklist (Optional)</label>
                        <input type="text" class="form-control level-input-desc" data-idx="${index}" value="${lvl.description || ''}" placeholder="e.g. Verify destination physical line space, electrical power, and mechanic allocation" />
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- C. ADD NEXT STEP BUTTON -->
            <div style="display: flex; justify-content: center; margin: 8px 0;">
              <button type="button" id="btn-add-level-bottom" class="btn btn-secondary" style="font-weight: 800; width: 100%; border: 1.5px dashed rgba(56, 189, 248, 0.45); color: #38bdf8; padding: 12px; background: rgba(56, 189, 248, 0.05);">
                ➕ Add Another Approval Stage (+ Add Next Step)
              </button>
            </div>

            <!-- D. FINAL COMPLETION CONNECTOR & NODE -->
            <div class="wf-flow-connector">
              <span class="wf-flow-connector-arrow">⬇️ Once all stages above are approved:</span>
            </div>

            <div class="wf-flow-end-node">
              <div class="wf-flow-node-icon" style="color: #34d399; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.15);">✅</div>
              <div>
                <div class="wf-flow-node-title" style="color: #34d399;">Final Execution: Gate Pass Issued &amp; Inventory Updated</div>
                <div class="wf-flow-node-desc">Machine record is automatically relocated to the target floor/line, status becomes Active, and an official printable Gate Pass is generated.</div>
              </div>
            </div>

          </div>
        </div>

        <!-- SECTION 2: WORKFLOW POLICIES & FACTORY SCOPE -->
        <div class="wf-form-card">
          <div class="wf-form-card-header">
            <div class="wf-card-title-group">
              <span class="wf-card-step-badge" style="background: #10b981;">2</span>
              <div>
                <div class="wf-form-card-title">Workflow Rules &amp; Factory Scope</div>
                <div class="wf-form-card-subtitle">Set rule name, gate pass document policy, and plant applicability:</div>
              </div>
            </div>

            <!-- Default Rule Toggle Switch -->
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #fff; cursor: pointer; background: rgba(255, 255, 255, 0.06); padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <input type="checkbox" id="wf-field-default" ${currentWf.isDefault ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
              <span>⭐ Set as Factory Default Rule</span>
            </label>
          </div>

          <div class="form-grid-2">
            <!-- Left Side: Basic Names -->
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Workflow Rule Name <span class="req">*</span></label>
                <input type="text" id="wf-field-name" class="form-control" value="${currentWf.name || ''}" placeholder="e.g. Standard Factory Transfer (Source → Dest → Admin)" required />
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Description / Purpose (Optional)</label>
                <input type="text" id="wf-field-desc" class="form-control" value="${currentWf.description || ''}" placeholder="e.g. Standard 3-stage relocation protocol for sewing and cutting machinery" />
              </div>
            </div>

            <!-- Right Side: Document & Scope Cards -->
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <!-- Document Policy -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Transfer Verification Document Policy</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
                  <div class="wf-doc-choice-card choice-mandatory ${currentWf.requireDocument ? 'selected' : ''}" id="card-doc-mandatory">
                    <div class="wf-doc-choice-icon">📄</div>
                    <div>
                      <div class="wf-doc-choice-title">Mandatory Upload</div>
                      <div class="wf-doc-choice-desc">Challan / Gate Pass scan required before sign-off</div>
                    </div>
                  </div>
                  <div class="wf-doc-choice-card ${!currentWf.requireDocument ? 'selected' : ''}" id="card-doc-optional">
                    <div class="wf-doc-choice-icon">⚡</div>
                    <div>
                      <div class="wf-doc-choice-title">Optional Upload</div>
                      <div class="wf-doc-choice-desc">Can proceed without attaching physical files</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Scope Applicability -->
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Plant Applicability Scope</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
                  <div class="wf-doc-choice-card ${!showAdvancedScope ? 'selected' : ''}" id="btn-scope-global">
                    <div class="wf-doc-choice-icon">🌐</div>
                    <div>
                      <div class="wf-doc-choice-title">Global (All Units)</div>
                      <div class="wf-doc-choice-desc">Applies to all factory floors and machines</div>
                    </div>
                  </div>
                  <div class="wf-doc-choice-card ${showAdvancedScope ? 'selected' : ''}" id="btn-scope-custom">
                    <div class="wf-doc-choice-icon">🎯</div>
                    <div>
                      <div class="wf-doc-choice-title">Restricted Scope</div>
                      <div class="wf-doc-choice-desc">Limit to specific Unit or Category</div>
                    </div>
                  </div>
                </div>

                <!-- Hidden / Expandable Specific Scope Selectors -->
                <div id="wf-advanced-scope-area" style="display: ${showAdvancedScope ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; padding: 12px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                  <div>
                    <label class="form-label" style="font-size: 11px;">Restricted to Unit:</label>
                    <select id="wf-scope-unit" class="form-control" style="font-size: 12px;">
                      <option value="">-- All Units (Global) --</option>
                      ${units.map(u => `<option value="${u.id}" ${currentWf.scope?.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 11px;">Restricted to Category:</label>
                    <select id="wf-scope-category" class="form-control" style="font-size: 12px;">
                      <option value="">-- All Categories --</option>
                      ${categories.map(c => `<option value="${c.id}" ${currentWf.scope?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- 4. BOTTOM ACTION BUTTONS BAR -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: 16px 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            ${currentWf.id && !currentWf.isDefault ? `
              <button type="button" id="btn-delete-workflow" class="btn btn-danger" style="font-weight: 700; display: flex; align-items: center; gap: 6px;">
                <span>🗑️ Delete Workflow</span>
              </button>
            ` : `
              <span style="font-size: 12.5px; color: var(--text-muted);">
                ${currentWf.isDefault ? '🛡️ System default workflow cannot be deleted.' : ''}
              </span>
            `}
          </div>

          <div style="display: flex; gap: 12px; align-items: center;">
            <button type="submit" class="btn btn-success" style="padding: 12px 32px; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
              <span>💾 Save &amp; Activate Workflow</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  `;
}

export function initTransferWorkflowBuilderEvents() {
  const workflows = workflowService.getWorkflows();

  // Helper to re-render smoothly while preserving scroll
  const refreshUI = () => {
    state.emit('inventory:updated');
  };

  // Helper to sync user inputs to editingWorkflow before re-rendering
  const saveFormValuesToState = () => {
    if (!editingWorkflow) return;
    editingWorkflow.name = document.getElementById('wf-field-name')?.value.trim() || editingWorkflow.name;
    editingWorkflow.description = document.getElementById('wf-field-desc')?.value.trim() || '';
    editingWorkflow.isDefault = Boolean(document.getElementById('wf-field-default')?.checked);

    const levels = [];
    document.querySelectorAll('.wf-step-item-card').forEach((card, i) => {
      const title = card.querySelector('.level-input-title')?.value.trim() || `Level ${i + 1} Approval Gate`;
      const approverType = card.querySelector('.level-input-type')?.value || APPROVER_TYPES.ADMIN;
      const desc = card.querySelector('.level-input-desc')?.value.trim() || '';

      levels.push({
        level: i + 1,
        title,
        approverType,
        description: desc,
        required: true
      });
    });
    editingWorkflow.levels = levels;
  };

  // 1. Quick Starter Template Cards
  document.querySelectorAll('.btn-quick-preset-item').forEach(card => {
    card.addEventListener('click', () => {
      const presetId = card.getAttribute('data-preset-id');
      const preset = WORKFLOW_PRESETS.find(p => p.id === presetId);
      if (preset) {
        saveFormValuesToState();
        editingWorkflow = {
          id: editingWorkflow?.id,
          name: (preset.name || '').replace('Option ', '').replace(': ', ' — '),
          description: preset.description,
          requireDocument: Boolean(preset.requireDocument),
          sequential: true,
          isDefault: editingWorkflow?.isDefault || false,
          scope: editingWorkflow?.scope || {},
          levels: JSON.parse(JSON.stringify(preset.levels))
        };
        notificationService.toast(`Loaded '${editingWorkflow.name}' template!`, 'info', 'Template Applied');
        refreshUI();
      }
    });
  });

  // 2. Switch workflow from dropdown
  const switcher = document.getElementById('wf-select-switcher');
  if (switcher) {
    switcher.addEventListener('change', (e) => {
      const id = e.target.value;
      const wf = workflowService.getWorkflowById(id);
      if (wf) {
        editingWorkflow = JSON.parse(JSON.stringify(wf));
        refreshUI();
      }
    });
  }

  // 3. Create new workflow button
  const btnNew = document.getElementById('btn-create-new-workflow');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      editingWorkflow = {
        name: 'New Factory Relocation Workflow',
        description: 'Destination verification followed by Central Maintenance sign-off',
        requireDocument: true,
        sequential: true,
        isDefault: false,
        scope: {},
        levels: [
          { level: 1, title: 'Destination Floor Acceptance', approverType: APPROVER_TYPES.DEST_LOCATION, description: 'Verify machine line space, electrical power, and operator allocation.' },
          { level: 2, title: 'Central Maintenance Admin Authorization', approverType: APPROVER_TYPES.ADMIN, description: 'Final gate pass authorization and live inventory update.' }
        ]
      };
      notificationService.toast('New custom workflow created. Configure steps and save.', 'info');
      refreshUI();
    });
  }

  // Top Save Button triggers form submit
  const btnTopSave = document.getElementById('btn-top-save-workflow');
  if (btnTopSave) {
    btnTopSave.addEventListener('click', () => {
      const form = document.getElementById('form-workflow-builder');
      if (form) {
        form.requestSubmit ? form.requestSubmit() : form.submit();
      }
    });
  }

  // 4. Scope toggle cards (Global vs Custom)
  const btnScopeGlobal = document.getElementById('btn-scope-global');
  const btnScopeCustom = document.getElementById('btn-scope-custom');
  const advancedArea = document.getElementById('wf-advanced-scope-area');

  if (btnScopeGlobal && btnScopeCustom) {
    btnScopeGlobal.addEventListener('click', () => {
      showAdvancedScope = false;
      btnScopeGlobal.classList.add('selected');
      btnScopeCustom.classList.remove('selected');
      if (advancedArea) advancedArea.style.display = 'none';

      if (editingWorkflow) {
        editingWorkflow.scope = {};
      }
      const unitSel = document.getElementById('wf-scope-unit');
      const catSel = document.getElementById('wf-scope-category');
      if (unitSel) unitSel.value = '';
      if (catSel) catSel.value = '';
    });

    btnScopeCustom.addEventListener('click', () => {
      showAdvancedScope = true;
      btnScopeCustom.classList.add('selected');
      btnScopeGlobal.classList.remove('selected');
      if (advancedArea) advancedArea.style.display = 'grid';
    });
  }

  // 5. Document Requirement Cards
  const cardDocMandatory = document.getElementById('card-doc-mandatory');
  const cardDocOptional = document.getElementById('card-doc-optional');

  if (cardDocMandatory && cardDocOptional) {
    cardDocMandatory.addEventListener('click', () => {
      if (editingWorkflow) editingWorkflow.requireDocument = true;
      cardDocMandatory.classList.add('selected');
      cardDocOptional.classList.remove('selected');
    });

    cardDocOptional.addEventListener('click', () => {
      if (editingWorkflow) editingWorkflow.requireDocument = false;
      cardDocOptional.classList.add('selected');
      cardDocMandatory.classList.remove('selected');
    });
  }

  // 6. Add Level handlers (both top and bottom buttons)
  const addLevelHandler = () => {
    saveFormValuesToState();
    if (!editingWorkflow) {
      editingWorkflow = workflows[0] || WORKFLOW_PRESETS[0];
    }
    if (!editingWorkflow.levels) editingWorkflow.levels = [];

    const newIdx = editingWorkflow.levels.length + 1;
    editingWorkflow.levels.push({
      level: newIdx,
      title: `Level ${newIdx} Approval Gate`,
      approverType: APPROVER_TYPES.ADMIN,
      description: 'Authorized sign-off and equipment verification.'
    });
    refreshUI();
  };

  const btnAddLvl = document.getElementById('btn-add-level');
  const btnAddLvlBottom = document.getElementById('btn-add-level-bottom');
  if (btnAddLvl) btnAddLvl.addEventListener('click', addLevelHandler);
  if (btnAddLvlBottom) btnAddLvlBottom.addEventListener('click', addLevelHandler);

  // 7. Reorder levels (Move Up / Move Down)
  document.querySelectorAll('.btn-move-level-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      if (idx > 0 && editingWorkflow?.levels) {
        saveFormValuesToState();
        const temp = editingWorkflow.levels[idx];
        editingWorkflow.levels[idx] = editingWorkflow.levels[idx - 1];
        editingWorkflow.levels[idx - 1] = temp;
        refreshUI();
      }
    });
  });

  document.querySelectorAll('.btn-move-level-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      if (editingWorkflow?.levels && idx < editingWorkflow.levels.length - 1) {
        saveFormValuesToState();
        const temp = editingWorkflow.levels[idx];
        editingWorkflow.levels[idx] = editingWorkflow.levels[idx + 1];
        editingWorkflow.levels[idx + 1] = temp;
        refreshUI();
      }
    });
  });

  // 8. Remove level
  document.querySelectorAll('.btn-remove-level').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      if (editingWorkflow?.levels && editingWorkflow.levels.length > 1) {
        saveFormValuesToState();
        editingWorkflow.levels.splice(idx, 1);
        refreshUI();
      } else {
        notificationService.toast('Workflow must contain at least one approval level.', 'warning');
      }
    });
  });

  // 9. Delete workflow
  const btnDelete = document.getElementById('btn-delete-workflow');
  if (btnDelete && editingWorkflow?.id) {
    btnDelete.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete workflow '${editingWorkflow.name}'?`)) {
        try {
          workflowService.deleteWorkflow(editingWorkflow.id);
          editingWorkflow = null;
          notificationService.toast('Workflow deleted successfully.', 'success', 'Workflow Removed');
          refreshUI();
        } catch (e) {
          notificationService.toast('Error: ' + e.message, 'error');
        }
      }
    });
  }

  // 10. Form submit & Save
  const form = document.getElementById('form-workflow-builder');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('wf-field-name')?.value.trim();
      if (!name) {
        notificationService.toast('Please enter a workflow name.', 'warning');
        return;
      }

      const description = document.getElementById('wf-field-desc')?.value.trim();
      const isDefault = document.getElementById('wf-field-default')?.checked;
      const unitId = showAdvancedScope ? document.getElementById('wf-scope-unit')?.value : '';
      const categoryId = showAdvancedScope ? document.getElementById('wf-scope-category')?.value : '';

      // Collect levels from DOM
      const levels = [];
      document.querySelectorAll('.wf-step-item-card').forEach((card, i) => {
        const title = card.querySelector('.level-input-title')?.value.trim() || `Level ${i + 1} Approval Gate`;
        const approverType = card.querySelector('.level-input-type')?.value || APPROVER_TYPES.ADMIN;
        const desc = card.querySelector('.level-input-desc')?.value.trim() || '';

        levels.push({
          level: i + 1,
          title,
          approverType,
          description: desc,
          required: true
        });
      });

      if (levels.length === 0) {
        notificationService.toast('Workflow must contain at least one approval level.', 'warning');
        return;
      }

      const isDocMandatory = document.getElementById('card-doc-mandatory')?.classList.contains('selected') ?? true;

      const payload = {
        id: editingWorkflow?.id,
        name,
        description,
        isDefault,
        requireDocument: isDocMandatory,
        sequential: true,
        scope: {
          unitId: unitId || undefined,
          categoryId: categoryId || undefined
        },
        levels
      };

      try {
        const saved = workflowService.saveWorkflow(payload);
        editingWorkflow = saved;
        notificationService.toast(`Workflow '${saved.name}' saved and activated successfully!`, 'success', 'Saved');
        refreshUI();
      } catch (err) {
        notificationService.toast('Failed to save workflow: ' + err.message, 'error');
      }
    });
  }
}
