/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dynamic Transfer Approval Workflow Service
 * Configurable multi-level routing, location-based scoping rules & permission evaluator
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, APPROVER_TYPES, ROLES } from '../db/schema.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';

export const WORKFLOW_PRESETS = [
  {
    id: 'preset-almuslim-factory',
    name: 'Al-Muslim Smart Factory Rule (Intelligent 1-Step Approval)',
    description: 'Auto-routes by transfer scope: Same Floor ➔ Floor Manager | Cross Floor ➔ Destination Floor | Cross Unit ➔ Destination Unit Admin. Central Admin can approve ANY stage at any time!',
    tag: '⭐ Al-Muslim Standard',
    tagType: 'badge-popular',
    icon: '🏭',
    flowTeaser: 'Smart Factory 1-Step ➔ Admin Override',
    requireDocument: false,
    isSmartRouting: true,
    levels: [
      {
        level: 1,
        title: 'Factory In-Charge / Admin Approval',
        approverType: APPROVER_TYPES.DEST_LOCATION,
        description: 'Auto-adapts: Floor Manager (same floor), Receiving Floor (cross-floor), Unit Admin (cross-unit). Central Admin has full override.'
      }
    ]
  },
  {
    id: 'preset-option-a',
    name: 'Option A: Admin Direct Authorization (Fast-Track)',
    description: 'Fast track single-step approval by System or Department Admin.',
    tag: '⚡ Fast-Track',
    tagType: 'badge-fast',
    icon: '⚡',
    flowTeaser: 'Direct Admin Sign-off',
    requireDocument: false,
    levels: [
      {
        level: 1,
        title: 'Central Maintenance Admin Approval',
        approverType: APPROVER_TYPES.ADMIN,
        description: 'Requires Super Admin or System Admin authorization.'
      }
    ]
  },
  {
    id: 'preset-option-b',
    name: 'Option B: Destination User Approval',
    description: 'Relocations authorized directly by destination line or floor in-charge.',
    tag: '🏢 1-Step Dest',
    tagType: 'badge-fast',
    icon: '🏢',
    flowTeaser: 'Receiving Floor In-Charge Approval',
    requireDocument: false,
    levels: [
      {
        level: 1,
        title: 'Destination Floor / Line In-Charge Approval',
        approverType: APPROVER_TYPES.DEST_LOCATION,
        description: 'Requires authorization from personnel scoped to target destination.'
      }
    ]
  },
  {
    id: 'preset-option-c',
    name: 'Option C: Destination User + Admin Approval',
    description: 'Two-stage verification by destination receiving team followed by Central Admin.',
    tag: '⭐ Recommended',
    tagType: 'badge-popular',
    icon: '⭐',
    flowTeaser: 'Receiving Floor ➔ Central Admin',
    requireDocument: true,
    levels: [
      {
        level: 1,
        title: 'Destination Location In-Charge',
        approverType: APPROVER_TYPES.DEST_LOCATION,
        description: 'Confirms line capacity, machine space & readiness.'
      },
      {
        level: 2,
        title: 'Central Admin Final Approval',
        approverType: APPROVER_TYPES.ADMIN,
        description: 'Super Admin or Maintenance Admin final authorization.'
      }
    ]
  },
  {
    id: 'preset-option-d',
    name: 'Option D: Source + Destination + Admin Approval',
    description: '3-tier gate requiring source release, destination acceptance, and admin sign-off.',
    tag: '🔒 Strict 3-Tier',
    tagType: 'badge-secure',
    icon: '🔒',
    flowTeaser: 'Source ➔ Destination ➔ Admin',
    requireDocument: true,
    levels: [
      {
        level: 1,
        title: 'Source Location Release In-Charge',
        approverType: APPROVER_TYPES.SOURCE_LOCATION,
        description: 'Authorizes equipment release from current production line.'
      },
      {
        level: 2,
        title: 'Destination Location Receiving In-Charge',
        approverType: APPROVER_TYPES.DEST_LOCATION,
        description: 'Authorizes machine receipt and physical installation space.'
      },
      {
        level: 3,
        title: 'Central Maintenance Admin Authorization',
        approverType: APPROVER_TYPES.ADMIN,
        description: 'Formal management sign-off and live inventory update.'
      }
    ]
  },
  {
    id: 'preset-option-e',
    name: 'Option E: Multi-Level Enterprise Workflow (4 Levels)',
    description: 'Comprehensive 4-stage hierarchy for inter-unit and major plant transfers.',
    tag: '🏛️ Enterprise 4-Level',
    tagType: 'badge-secure',
    icon: '🏛️',
    flowTeaser: 'Source Eng ➔ Dest ➔ Manager ➔ Admin',
    requireDocument: true,
    levels: [
      {
        level: 1,
        title: 'Source Floor Maintenance Engineer',
        approverType: APPROVER_TYPES.SOURCE_LOCATION,
        description: 'Validates machine physical condition and disconnection.'
      },
      {
        level: 2,
        title: 'Destination Floor In-Charge',
        approverType: APPROVER_TYPES.DEST_LOCATION,
        description: 'Confirms line allocation and electrical connection readiness.'
      },
      {
        level: 3,
        title: 'Central Maintenance Manager',
        approverType: APPROVER_TYPES.MAINTENANCE_MANAGER,
        description: 'Validates mechanical maintenance schedules and asset utilization.'
      },
      {
        level: 4,
        title: 'Executive Admin Final Approval',
        approverType: APPROVER_TYPES.ADMIN,
        description: 'Final execution gate and live system inventory commit.'
      }
    ]
  }
];

class WorkflowService {
  /**
   * Returns all configured transfer approval workflows
   */
  getWorkflows() {
    let list = storage.getTable(TABLE_NAMES.TRANSFER_WORKFLOWS) || [];
    if (list.length === 0 || !list.some(w => w.id === 'wf-almuslim-factory')) {
      this.seedDefaultWorkflows();
      list = storage.getTable(TABLE_NAMES.TRANSFER_WORKFLOWS) || [];
    }
    return list;
  }

  getWorkflowById(id) {
    const list = this.getWorkflows();
    return list.find(w => w.id === id) || null;
  }

  /**
   * Match the best approval workflow for a given transfer context.
   * Auto-routes intelligently by factory transfer scope:
   * 1. Intra-Floor (Same Floor Line to Line): Floor Maintenance Manager Approval
   * 2. Inter-Floor (Cross Floor): Destination Floor In-Charge Approval
   * 3. Inter-Unit (Cross Unit): Destination Unit Admin Approval
   * * In all cases, Super Admin & Central Admin can approve anytime (Universal Override).
   */
  matchWorkflow({ sourceGroupId, sourceUnitId, sourceFloorId, sourceLineId, destUnitId, destFloorId, destLineId, categoryId }) {
    const workflows = this.getWorkflows().filter(w => w.status === 'ACTIVE');

    // 1. Identify move scope
    const isCrossUnit = Boolean(sourceUnitId && destUnitId && sourceUnitId !== destUnitId);
    const isCrossFloor = Boolean(!isCrossUnit && sourceFloorId && destFloorId && sourceFloorId !== destFloorId);
    const isSameFloor = Boolean(!isCrossUnit && !isCrossFloor);

    // 2. Check if a custom workflow explicitly targets this specific unit/category
    let bestMatch = null;
    let highestScore = -1;

    workflows.forEach(w => {
      let score = 0;
      const s = w.scope || {};

      if (s.unitId) {
        if (s.unitId === destUnitId || s.unitId === sourceUnitId) score += 10;
        else return;
      }
      if (s.floorId) {
        if (s.floorId === destFloorId || s.floorId === sourceFloorId) score += 5;
        else return;
      }
      if (s.lineId) {
        if (s.lineId === destLineId || s.lineId === sourceLineId) score += 5;
        else return;
      }
      if (s.categoryId) {
        if (s.categoryId === categoryId) score += 3;
        else return;
      }
      if (w.isDefault) score += 1;

      if (score > highestScore) {
        highestScore = score;
        bestMatch = w;
      }
    });

    // If a custom specific scope workflow was explicitly defined and matched (score > 1), and NOT the smart default, return it
    if (bestMatch && highestScore > 1 && !bestMatch.isSmartRouting && bestMatch.id !== 'wf-almuslim-factory') {
      return bestMatch;
    }

    // Otherwise, generate the smart Al-Muslim 1-Step factory rule tailored to this transfer:
    const destUnitName = storage.getItem(TABLE_NAMES.UNITS, destUnitId)?.name || 'Destination Unit';
    const destFloorName = storage.getItem(TABLE_NAMES.FLOORS, destFloorId)?.name || 'Destination Floor';
    const sourceFloorName = storage.getItem(TABLE_NAMES.FLOORS, sourceFloorId)?.name || 'Source Floor';

    if (isCrossUnit) {
      return {
        id: 'wf-smart-cross-unit',
        name: `Inter-Unit Transfer (${destFloorName} & Admin Approval)`,
        description: `Relocation from Unit to Unit requiring Destination Floor In-Charge or Central Admin authorization.`,
        isDefault: true,
        isSmartRouting: true,
        requireDocument: false,
        sequential: true,
        levels: [
          {
            level: 1,
            title: `Destination Floor Manager / Admin Approval (${destFloorName})`,
            approverType: APPROVER_TYPES.DEST_LOCATION,
            description: `Requires authorization from ${destFloorName} Floor In-Charge or Central Admin.`
          }
        ]
      };
    }

    if (isCrossFloor) {
      return {
        id: 'wf-smart-cross-floor',
        name: `Inter-Floor Transfer (${destFloorName} Acceptance)`,
        description: `Relocation to a different floor requiring Destination Floor In-Charge acceptance.`,
        isDefault: true,
        isSmartRouting: true,
        requireDocument: false,
        sequential: true,
        levels: [
          {
            level: 1,
            title: `Destination Floor In-Charge Acceptance (${destFloorName})`,
            approverType: APPROVER_TYPES.DEST_LOCATION,
            description: `Requires receiving acceptance from ${destFloorName} Floor In-Charge or Central Admin.`
          }
        ]
      };
    }

    // Intra-Floor (Same floor line-to-line)
    return {
      id: 'wf-smart-intra-floor',
      name: `Intra-Floor Transfer (${sourceFloorName} Manager Approval)`,
      description: `Line-to-line rebalancing requiring Floor Maintenance Manager authorization.`,
      isDefault: true,
      isSmartRouting: true,
      requireDocument: false,
      sequential: true,
      levels: [
        {
          level: 1,
          title: `Floor Maintenance Manager Approval (${sourceFloorName})`,
          approverType: APPROVER_TYPES.SOURCE_LOCATION,
          description: `Requires sign-off from ${sourceFloorName} Maintenance Manager or Central Admin.`
        }
      ]
    };
  }

  /**
   * Check whether the current user is authorized to approve the current step of a transfer request.
   * Super Admin & Central Admin can ALWAYS approve any stage of any transfer (Universal System Authority).
   */
  canUserApproveStep(transferRequest, user = null) {
    const currentUser = user || authService.getCurrentUser();
    if (!currentUser) return false;

    // 1. Universal Admin Authority (Super Admin possesses master authority across all workflows)
    if (currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN || authService.isAdmin()) {
      return true;
    }

    // 2. Explicit APPROVE permission grant (user-level access control)
    if (authService.hasAccess('transfers', 'APPROVE')) {
      return true;
    }

    const currentStepIndex = (transferRequest.currentLevel || 1) - 1;
    const currentStep = transferRequest.levels?.[currentStepIndex];
    if (!currentStep) return false;

    // If step is already approved
    if (currentStep.status === 'APPROVED') return false;

    const type = currentStep.approverType;

    switch (type) {
      case APPROVER_TYPES.ADMIN:
        return authService.isAdmin();

      case APPROVER_TYPES.MAINTENANCE_MANAGER:
        // Scoped to source floor
        return (authService.isManager() && authService.isLocationAllowed(
          transferRequest.sourceUnitId,
          transferRequest.sourceFloorId
        )) || authService.isAdmin();

      case APPROVER_TYPES.SOURCE_LOCATION:
        // Floor Manager / Supervisor for source floor
        return authService.isLocationAllowed(
          transferRequest.sourceUnitId,
          transferRequest.sourceFloorId
        ) || authService.isAdmin();

      case APPROVER_TYPES.DEST_LOCATION:
        // Floor In-Charge / Receiver for destination floor
        return authService.isLocationAllowed(
          transferRequest.destUnitId,
          transferRequest.destFloorId
        ) || authService.isAdmin();

      case APPROVER_TYPES.SPECIFIC_USER:
        return currentUser.id === currentStep.approverUserId || authService.isAdmin();

      case APPROVER_TYPES.ROLE:
        return currentUser.role === currentStep.approverRole || authService.isAdmin();

      default:
        return authService.isAdmin();
    }
  }

  /**
   * Save or update a workflow configuration
   */
  async saveWorkflow(workflowData) {
    if (!authService.isAdmin()) {
      throw new Error('Unauthorized: Only Admin can configure transfer approval workflows.');
    }

    const workflows = this.getWorkflows();
    const user = authService.getCurrentUser();

    if (!workflowData.name || !workflowData.name.trim()) {
      throw new Error('Workflow name is required.');
    }

    if (!workflowData.levels || workflowData.levels.length === 0) {
      throw new Error('Workflow must contain at least one approval level.');
    }

    // Ensure level sequence is normalized
    const normalizedLevels = workflowData.levels.map((lvl, index) => ({
      level: index + 1,
      title: lvl.title || `Level ${index + 1} Approval`,
      approverType: lvl.approverType || APPROVER_TYPES.ADMIN,
      approverRole: lvl.approverRole || '',
      approverUserId: lvl.approverUserId || '',
      description: lvl.description || '',
      required: lvl.required !== false
    }));

    if (workflowData.id) {
      // Update existing — CONFIRMED WRITE
      const existing = workflows.find(w => w.id === workflowData.id);
      if (!existing) throw new Error('Workflow not found.');

      let updated;
      await storage.writeAndConfirm(TABLE_NAMES.TRANSFER_WORKFLOWS, (tbl) => {
        const idx = tbl.findIndex(w => w.id === workflowData.id);
        if (idx !== -1) {
          tbl[idx] = { ...tbl[idx],
            name: workflowData.name.trim(),
            description: workflowData.description || '',
            scope: workflowData.scope || {},
            requireDocument: Boolean(workflowData.requireDocument),
            sequential: workflowData.sequential !== false,
            isDefault: Boolean(workflowData.isDefault),
            status: workflowData.status || 'ACTIVE',
            levels: normalizedLevels,
            updatedBy: user.id,
            updatedAt: new Date().toISOString()
          };
          updated = tbl[idx];
        }
      });

      auditService.log('WORKFLOW_UPDATED', 'TRANSFER_WORKFLOW', updated?.name, `Updated transfer workflow '${updated?.name}' with ${normalizedLevels.length} levels.`);
      return updated;
    } else {
      // Create new — CONFIRMED WRITE
      const newWorkflow = {
        id: `wf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: workflowData.name.trim(),
        description: workflowData.description || '',
        scope: workflowData.scope || {},
        requireDocument: Boolean(workflowData.requireDocument),
        sequential: workflowData.sequential !== false,
        isDefault: Boolean(workflowData.isDefault),
        status: 'ACTIVE',
        levels: normalizedLevels,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedBy: user.id,
        updatedAt: new Date().toISOString()
      };

      await storage.writeAndConfirm(TABLE_NAMES.TRANSFER_WORKFLOWS, (tbl) => { tbl.push(newWorkflow); });
      auditService.log('WORKFLOW_CREATED', 'TRANSFER_WORKFLOW', newWorkflow.name, `Created transfer workflow '${newWorkflow.name}' with ${normalizedLevels.length} levels.`);
      return newWorkflow;
    }
  }

  async deleteWorkflow(workflowId) {
    if (!authService.isAdmin()) {
      throw new Error('Unauthorized to delete workflow.');
    }
    const wf = storage.getItem(TABLE_NAMES.TRANSFER_WORKFLOWS, workflowId);
    if (wf?.isDefault) {
      throw new Error('Cannot delete the system default workflow.');
    }
    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.TRANSFER_WORKFLOWS, (tbl) => {
      const idx = tbl.findIndex(w => w.id === workflowId);
      if (idx !== -1) tbl.splice(idx, 1);
    });
    auditService.log('WORKFLOW_DELETED', 'TRANSFER_WORKFLOW', workflowId, `Deleted workflow ${wf?.name || workflowId}`);
    return true;
  }

  seedDefaultWorkflows() {
    const user = authService.getCurrentUser() || { id: 'usr-1' };
    const initial = [
      {
        id: 'wf-almuslim-factory',
        name: 'Al-Muslim Smart Factory Rule (Intelligent 1-Step Approval)',
        description: 'Auto-adapts: Same Floor ➔ Floor Manager | Cross Floor ➔ Destination Floor | Cross Unit ➔ Destination Unit Admin. Central Admin can approve ANY stage anytime!',
        isDefault: true,
        isSmartRouting: true,
        scope: {},
        requireDocument: false,
        sequential: true,
        status: 'ACTIVE',
        levels: [
          {
            level: 1,
            title: 'Factory In-Charge / Admin Approval',
            approverType: APPROVER_TYPES.DEST_LOCATION,
            description: 'Auto-adapts: Floor Manager (same floor), Receiving Floor (cross-floor), Unit Admin (cross-unit). Central Admin has full override.'
          }
        ],
        createdBy: user.id,
        createdAt: new Date().toISOString()
      },
      {
        id: 'wf-fast-track',
        name: 'Option A: Admin Direct Authorization (Fast-Track)',
        description: 'Emergency production line balancing approved directly by Super Admin.',
        isDefault: false,
        scope: {},
        requireDocument: false,
        sequential: true,
        status: 'ACTIVE',
        levels: [
          { level: 1, title: 'Super Admin / Maintenance Admin', approverType: APPROVER_TYPES.ADMIN, description: 'Direct one-step authorization.' }
        ],
        createdBy: user.id,
        createdAt: new Date().toISOString()
      },
      {
        id: 'wf-default',
        name: 'Standard Factory Transfer (Source → Dest → Admin)',
        description: 'Standard 3-stage relocation protocol for sewing and finishing machinery.',
        isDefault: false,
        scope: {},
        requireDocument: true,
        sequential: true,
        status: 'ACTIVE',
        levels: [
          { level: 1, title: 'Source Floor In-Charge Release', approverType: APPROVER_TYPES.SOURCE_LOCATION, description: 'Release equipment from source line.' },
          { level: 2, title: 'Destination Floor In-Charge Acceptance', approverType: APPROVER_TYPES.DEST_LOCATION, description: 'Accept machine at target destination.' },
          { level: 3, title: 'Central Maintenance Admin Authorization', approverType: APPROVER_TYPES.ADMIN, description: 'Final gate pass sign-off and inventory update.' }
        ],
        createdBy: user.id,
        createdAt: new Date().toISOString()
      },
      {
        id: 'wf-fast-track',
        name: 'Urgent Maintenance Admin Approval (Fast-Track)',
        description: 'Emergency production line balancing approved directly by Super Admin.',
        isDefault: false,
        scope: {},
        requireDocument: false,
        sequential: true,
        status: 'ACTIVE',
        levels: [
          { level: 1, title: 'Super Admin / Maintenance Admin', approverType: APPROVER_TYPES.ADMIN, description: 'Direct one-step authorization.' }
        ],
        createdBy: user.id,
        createdAt: new Date().toISOString()
      },
      {
        id: 'wf-heavy-utility',
        name: 'Heavy Utility & Cutting Equipment Relocation (4 Levels)',
        description: 'High-risk equipment transfer requiring manager and floor safety sign-offs.',
        isDefault: false,
        scope: { categoryId: 'cat-4' },
        requireDocument: true,
        sequential: true,
        status: 'ACTIVE',
        levels: [
          { level: 1, title: 'Source Floor Engineer', approverType: APPROVER_TYPES.SOURCE_LOCATION, description: 'Mechanical/electrical disconnection audit.' },
          { level: 2, title: 'Destination Plant In-Charge', approverType: APPROVER_TYPES.DEST_LOCATION, description: 'Utility connection and safety inspection.' },
          { level: 3, title: 'Chief Maintenance Manager', approverType: APPROVER_TYPES.MAINTENANCE_MANAGER, description: 'Asset compliance & overhaul approval.' },
          { level: 4, title: 'General Admin Sign-off', approverType: APPROVER_TYPES.ADMIN, description: 'Live location database update.' }
        ],
        createdBy: user.id,
        createdAt: new Date().toISOString()
      }
    ];

    storage.data[TABLE_NAMES.TRANSFER_WORKFLOWS] = initial;
    storage.saveTable(TABLE_NAMES.TRANSFER_WORKFLOWS);
  }
}

export const workflowService = new WorkflowService();
