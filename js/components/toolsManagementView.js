/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Tools, Equipment & Accessories Management System Component
 * 
 * 5 Responsive UI Screens / Tabs:
 * 1. User ID Page (Employe Information Form & Last 10 Registrations)
 * 2. Tools Add Form (Equipment Add Form, Registration No, 1-Click Kit, Big Save, Live Table)
 * 3. Print Page (Format A: Full Page A4 SOP Sheet, Format B: Pocket Bag Slip, Print/PDF)
 * 4. Find & Select (Search & Historical Tracking, Replacements, Returns)
 * 5. Accessories Page (Master Catalog Stock Management, Excel Import/Export)
 */

import { state } from '../state.js';
import { toolService } from '../services/toolService.js?v=4.9.1';
import { employeeService } from '../services/employeeService.js';
import { authService } from '../services/authService.js';
import { historyService } from '../services/historyService.js';

// Local component state to preserve active working session
let currentActiveTab = 'user-id'; // 'user-id' | 'tools-add' | 'print-page' | 'find-select' | 'accessories-page'
let screen2CategoryFilter = 'ALL'; // 'ALL' | 'TOOL' | 'ACCESSORY' | 'SPARE_PART'
let screen2SelectedCatalogItem = null; // Currently selected item for single tool form

/**
 * Unified Catalog Items Helper
 * Combines Master Tools (28), Extra Accessories (10) and Spare Parts (20)
 */
function getAllCatalogItems(category = 'ALL') {
  const masterTools = (toolService.getAllMasterTools() || []).map(t => ({
    id: t.id || `tool-${t.code}`,
    type: 'TOOL',
    typeLabel: 'Tool / Equipment',
    code: String(t.code || '').padStart(3, '0'),
    name: t.name,
    category: t.category || 'TOOLS',
    unit: t.unit || 'Pcs',
    totalStock: Number(t.totalStock) || 0,
    defaultQty: '1',
    remarks: t.remarks || 'Standard maintenance equipment'
  }));

  const masterAccs = (toolService.getAllMasterAccessories() || []).map(a => ({
    id: a.id || `acc-${a.code}`,
    type: 'ACCESSORY',
    typeLabel: 'Accessory',
    code: a.code || 'ACC',
    name: a.name,
    category: a.category || 'ACCESSORIES',
    unit: a.unit || 'Pcs',
    totalStock: Number(a.totalStock) || 0,
    defaultQty: a.defaultQty ? a.defaultQty.replace(/[^0-9]/g, '') || '1' : '1',
    remarks: a.defaultRemarks || 'Extra factory accessory'
  }));

  const spareParts = (historyService.getSparePartsMaster() || []).map(sp => ({
    id: sp.id || `sp-${sp.code}`,
    type: 'SPARE_PART',
    typeLabel: 'Spare Part',
    code: sp.code || 'SP-00',
    name: sp.name,
    category: sp.category || 'Mechanical',
    unit: sp.unit || 'PCS',
    totalStock: sp.totalStock !== undefined ? Number(sp.totalStock) : 50,
    defaultQty: '1',
    remarks: sp.description || sp.areaOfUse || 'Genuine machine spare part'
  }));

  let combined = [...masterTools, ...masterAccs, ...spareParts];
  if (category && category !== 'ALL') {
    combined = combined.filter(it => it.type === category);
  }
  return combined;
}

let currentRegNo = '';
let currentPrintRegNo = '';
let currentPrintFormat = 'A4'; // 'A4' | 'POCKET'
let pocketCustomSettings = {
  preset: 'standard', // 'standard' (125x170mm) | 'a6' (105x148mm) | 'badge' (100x75mm) | 'cr80' (86x54mm) | 'custom'
  width: 125, // mm per card (Side 1 & Side 2 placed side-by-side)
  height: 170, // mm per card
  sigGap: '25px', // lowered down gap
  splitCount: 20,
  _userModified: false
};
let activeUserForm = {
  userId: '',
  userName: '',
  jobTitle: '',
  workingArea: '',
  issueDate: new Date().toISOString().split('T')[0],
  regNo: '',
  requisitionNo: ''
};
let liveAllocationQueue = [];
let findFilters = {
  search: '',
  regNo: 'ALL',
  userId: 'ALL',
  itemType: 'ALL',
  changeStatus: 'ALL',
  dateFrom: '',
  dateTo: ''
};
let accessoriesTabCategory = 'ALL';
let accessorySearch = '';
let databaseActiveTable = 'TOOL_ALLOCATIONS'; // 'TOOL_ALLOCATIONS' | 'TOOLS_MASTER' | 'ACCESSORIES_MASTER'
let databaseSearch = '';
let databaseDirectImportType = 'ALLOCATIONS'; // 'ALLOCATIONS' | 'TOOLS' | 'ACCESSORIES'
let databaseDirectParsedRows = [];
let databaseDirectFileName = '';
let findSelectedIds = new Set();
let dbSelectedIds = new Set();
let masterSelectedIds = new Set();

// =========================================================================
// ADMIN SECURITY AUTHORIZATION CONTROLLER (PROTECTS REMOVE / EDIT / DELETE)
// =========================================================================
export function ensureAdminAccess(actionDescription, onAuthorized) {
  if (authService.isAdmin() || authService.isSuperAdmin()) {
    onAuthorized();
    return;
  }

  // If not admin role, show security authorization modal
  openAdminSecurityModal({
    title: 'Admin Security Authorization Required',
    description: `The action "${actionDescription}" is restricted and requires Administrator permission or Master Admin Passcode.`,
    onAuthorized
  });
}

export function openAdminSecurityModal({ title, description, onAuthorized }) {
  const modalLayer = document.getElementById('tools-modal-layer') || document.getElementById('modal-layer');
  if (!modalLayer) {
    const pass = prompt(`🔒 Admin Security Authorization Required:\n${description}\n\nEnter Admin Passcode (e.g. admin123):`);
    if (pass === 'admin123' || pass === '123456' || pass === 'superadmin' || pass === 'admin') {
      onAuthorized();
    } else if (pass !== null) {
      alert('Incorrect Admin Passcode. Access denied.');
    }
    return;
  }

  modalLayer.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(6px);">
      <div style="background: #1e293b; border: 2px solid #ef4444; border-radius: 12px; width: 100%; max-width: 480px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
        
        <!-- Header -->
        <div style="background: linear-gradient(90deg, #b91c1c, #ef4444); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 15px;">
            <span>🔒</span>
            <span>${title || 'Admin Authorization Required'}</span>
          </div>
          <button id="btn-close-admin-auth" style="background: transparent; border: none; color: #fff; font-size: 20px; font-weight: bold; cursor: pointer;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px; font-size: 13px; color: #cbd5e1;">
          <p style="margin: 0; line-height: 1.45;">
            ${description || 'This operation modifies system records and is strictly Admin Controlled.'}
          </p>
          
          <div style="background: #0f172a; border-left: 3px solid #ef4444; border-radius: 4px; padding: 8px 12px; font-size: 11.5px; color: #94a3b8;">
            Current Active Role: <strong style="color: #f1f5f9;">${authService.getCurrentUser()?.role || 'USER'}</strong> (${authService.getCurrentUser()?.name || 'Operator'})
          </div>

          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">Enter Admin Security Passcode :</label>
            <input type="password" id="inp-admin-passcode" placeholder="Enter admin password (e.g. admin123)"
              style="width: 100%; background: #0f172a; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 9px 12px; font-size: 14px; font-family: monospace;" />
            <div id="admin-auth-error" style="color: #f87171; font-size: 11.5px; margin-top: 5px; display: none;">❌ Invalid passcode. Authorization denied.</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #0f172a; border-top: 1px solid #334155; padding: 12px 18px; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="btn-cancel-admin-auth" style="background: #334155; color: #cbd5e1; border: none; padding: 7px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;">
            Cancel
          </button>
          <button id="btn-confirm-admin-auth" style="background: #dc2626; color: #fff; border: none; padding: 7px 20px; border-radius: 6px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
            <span>🔓</span> Authorize &amp; Proceed
          </button>
        </div>

      </div>
    </div>
  `;

  const inputPass = document.getElementById('inp-admin-passcode');
  const errBox = document.getElementById('admin-auth-error');
  if (inputPass) inputPass.focus({ preventScroll: true });

  function verifyAndProceed() {
    const entered = (inputPass?.value || '').trim();
    if (entered === 'admin123' || entered === '123456' || entered === 'superadmin' || entered === 'admin') {
      modalLayer.innerHTML = '';
      window.app?.showToast('Admin Authorized', 'Action authorized successfully.', 'success');
      onAuthorized();
    } else {
      if (errBox) errBox.style.display = 'block';
      if (inputPass) inputPass.style.borderColor = '#ef4444';
    }
  }

  document.getElementById('btn-close-admin-auth').onclick = () => { modalLayer.innerHTML = ''; };
  document.getElementById('btn-cancel-admin-auth').onclick = () => { modalLayer.innerHTML = ''; };
  document.getElementById('btn-confirm-admin-auth').onclick = verifyAndProceed;
  if (inputPass) {
    inputPass.onkeydown = (e) => {
      if (e.key === 'Enter') verifyAndProceed();
    };
  }
}

export const TOOLS_TAB_CONFIG = {
  'user-id': {
    name: 'User ID Page',
    icon: '👤',
    bgColor: '#f59e0b',
    textColor: '#0f172a',
    borderColor: '#fbbf24',
    glowColor: 'rgba(245, 158, 11, 0.45)'
  },
  'tools-add': {
    name: 'Tools Add Form',
    icon: '🛠️',
    bgColor: '#0ea5e9',
    textColor: '#ffffff',
    borderColor: '#38bdf8',
    glowColor: 'rgba(14, 165, 233, 0.45)'
  },
  'print-page': {
    name: 'Print Page',
    icon: '🖨️',
    bgColor: '#10b981',
    textColor: '#ffffff',
    borderColor: '#34d399',
    glowColor: 'rgba(16, 185, 129, 0.45)'
  },
  'find-select': {
    name: 'Find & Select',
    icon: '🔍',
    bgColor: '#8b5cf6',
    textColor: '#ffffff',
    borderColor: '#a78bfa',
    glowColor: 'rgba(139, 92, 246, 0.45)'
  },
  'accessories-page': {
    name: 'Accessories Page',
    icon: '📦',
    bgColor: '#ec4899',
    textColor: '#ffffff',
    borderColor: '#f472b6',
    glowColor: 'rgba(236, 72, 153, 0.45)'
  },
  'database-page': {
    name: 'Database',
    icon: '💾',
    bgColor: '#059669',
    textColor: '#ffffff',
    borderColor: '#10b981',
    glowColor: 'rgba(5, 150, 105, 0.45)'
  }
};

export function renderToolsManagementView() {
  const activeTab = state.get('toolsActiveTab') || currentActiveTab || 'user-id';
  currentActiveTab = activeTab;
  const currentTabTheme = TOOLS_TAB_CONFIG[activeTab] || TOOLS_TAB_CONFIG['user-id'];

  return `
    <div class="page-view tools-management-view" id="tools-mgmt-root" style="padding: 0 20px 20px 20px; display: flex; flex-direction: column; gap: 16px; min-height: 100%;">
      
      <style>
        .tools-tab-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative !important;
          user-select: none !important;
          outline: none !important;
        }
        .tools-tab-btn:hover:not(.active) {
          background: #475569 !important;
          color: #f8fafc !important;
          border-color: #64748b !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35) !important;
          opacity: 1 !important;
        }
        .tools-tab-btn.active {
          font-weight: 800 !important;
          transform: translateY(-1px) scale(1.03) !important;
          z-index: 2 !important;
        }
        .tools-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 10%;
          right: 10%;
          height: 3px;
          background: #ffffff;
          border-radius: 4px;
          box-shadow: 0 0 8px #ffffff, 0 0 14px rgba(255,255,255,0.8);
        }
      </style>

      <!-- TOP NAVIGATION BAR (STICKY HEADER - PERMANENTLY PINNED AT TOP) -->
      <div class="tools-tab-navbar-wrapper" style="position: sticky; top: 0; z-index: 1000; background: #090d16; padding-top: 14px; padding-bottom: 12px; margin-left: -20px; margin-right: -20px; padding-left: 20px; padding-right: 20px; border-bottom: 1.5px solid rgba(56, 189, 248, 0.25); box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.75);">
        <div class="tools-tab-navbar" style="display: flex; gap: 8px; flex-wrap: wrap; background: #1e293b; padding: 8px 12px; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); align-items: center;">
          ${Object.entries(TOOLS_TAB_CONFIG).map(([tabKey, cfg]) => {
    const isAct = activeTab === tabKey;
    return `
              <button class="tools-tab-btn ${isAct ? 'active' : ''}" data-tab="${tabKey}" style="padding: 8px 18px; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; ${isAct ? `background: ${cfg.bgColor}; color: ${cfg.textColor}; font-weight: 800; border: 1.5px solid ${cfg.borderColor}; box-shadow: 0 0 16px ${cfg.glowColor}, 0 4px 8px rgba(0,0,0,0.5); transform: translateY(-1px) scale(1.03); opacity: 1;` : `background: #334155; color: #cbd5e1; font-weight: 600; border: 1px solid #475569; box-shadow: none; transform: translateY(0) scale(1); opacity: 0.9;`}">
                <span>${cfg.icon}</span> ${cfg.name}
              </button>
            `;
  }).join('')}

          <!-- MANUAL MANPOWER SYNC BUTTON -->
          <button id="btn-sync-manpower-top" style="padding: 7px 14px; border-radius: 6px; font-weight: 800; font-size: 12.5px; cursor: pointer; border: 1.5px solid #0284c7; display: flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; box-shadow: 0 2px 4px rgba(2,132,199,0.3); margin-left: 4px;" title="Manually sync all tool registrations with latest Manpower data (promotions, floor changes, card numbers)">
            <span class="sync-icon">🔄</span> Sync Manpower
          </button>

          <div style="margin-left: auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div id="tools-current-screen-badge" style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; background: ${currentTabTheme.bgColor}22; border: 1.5px solid ${currentTabTheme.borderColor}; color: ${currentTabTheme.bgColor}; box-shadow: 0 0 12px ${currentTabTheme.glowColor}; transition: all 0.25s ease;">
              <span style="color: #94a3b8; font-weight: 600;">Current:</span>
              <span id="tools-current-tab-label">${currentTabTheme.icon} ${currentTabTheme.name}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; color: #94a3b8;">Active Reg:</span>
              <span id="tools-current-reg-badge" style="font-family: monospace; font-weight: 800; color: #f59e0b; background: #0f172a; padding: 4px 10px; border-radius: 4px; border: 1px solid #475569;">#${currentRegNo}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ACTIVE TAB CONTENT CONTAINER -->
      <div class="tools-tab-content" id="tools-tab-content-container" style="flex: 1;">
        ${renderActiveTab(activeTab)}
      </div>

      <!-- MODAL CONTAINER LAYER FOR CUSTOMIZERS AND DIALOGS -->
      <div id="tools-modal-layer"></div>

    </div>
  `;
}

function renderActiveTab(tab) {
  switch (tab) {
    case 'user-id':
      return renderScreen1UserIdPage();
    case 'tools-add':
      return renderScreen2ToolsAddForm();
    case 'print-page':
      return renderScreen3PrintPage();
    case 'find-select':
      return renderScreen4FindAndSelect();
    case 'accessories-page':
      return renderScreen5AccessoriesPage();
    case 'database-page':
      return renderScreen6DatabasePage();
    default:
      return renderScreen1UserIdPage();
  }
}

// =========================================================================
// SCREEN 1: USER ID PAGE (EMPLOYE INFORMATION FORM & LAST 10 REGISTRATIONS)
// =========================================================================
function renderScreen1UserIdPage() {
  const recentRegistrations = toolService.getRecentRegistrations(10);
  const allStaff = employeeService.getAllEmployees() || [];

  return `
    <div class="screen-user-id" style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Employee Information Form Card (Sticky Header with Minimize Toggle) -->
      <div id="screen1-emp-form-card" style="position: sticky; top: 62px; z-index: 900; background: #090d16; padding-bottom: 2px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 20px -8px rgba(0,0,0,0.6);">
        
        <!-- Top Title Banner with Collapse/Expand Toggle -->
        <div style="background: linear-gradient(90deg, #65a30d, #84cc16); color: #000; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 15px; letter-spacing: 0.5px; border: 1px solid #4d7c0f; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span>Employee Information Form:</span>
            <button id="btn-toggle-emp-form-collapse" style="background: rgba(0,0,0,0.25); color: #000; border: 1px solid rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer;" title="Toggle form minimize/expand">
              <span id="txt-toggle-emp-form">🔼 Minimize</span>
            </button>
          </div>
          <div class="emp-banner-actions" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button id="btn-open-excel-import-modal" style="background: #0f172a; color: #fff; border: 1px solid #334155; padding: 4px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
              📥 Bulk Import History (Excel / CSV)
            </button>
            <button id="btn-download-sample-template" style="background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 4px 10px; border-radius: 4px; font-size: 11.5px; cursor: pointer;">
              📄 Download Excel Template
            </button>
          </div>
        </div>

        <!-- Employee Info Input Box -->
        <div id="emp-form-inputs-container" style="background: #0f172a; border: 1.5px solid #334155; border-radius: 8px; padding: 18px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; align-items: end;">
            
            <!-- ID Number with Autocomplete -->
            <div style="position: relative;">
              <label style="display: block; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
                ID Number :
              </label>
              <div style="display: flex; gap: 4px;">
                <input type="text" id="input-emp-id" value="${activeUserForm.userId || ''}" placeholder="Enter Card/ID (e.g. 142472)" 
                  style="width: 100%; background: #1e293b; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 8px 12px; font-size: 13px; font-family: monospace; font-weight: 700;" />
                <button id="btn-search-staff-modal" title="Search from Manpower Database" style="background: #2563eb; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                  🔍
                </button>
                <button id="btn-clear-emp-screen1" title="Clear Employee Fields" style="background: #475569; color: #cbd5e1; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                  🧹
                </button>
              </div>
              <div id="staff-typeahead-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #1e293b; border: 1px solid #3b82f6; border-radius: 6px; z-index: 50; max-height: 200px; overflow-y: auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);"></div>
            </div>

            <!-- User Name -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
                User Name :
              </label>
              <input type="text" id="input-emp-name" value="${activeUserForm.userName || ''}" placeholder="Enter Mechanic Name"
                style="width: 100%; background: #1e293b; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 8px 12px; font-size: 13px; font-weight: 600;" />
            </div>

            <!-- Job Title -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
                Job Title :
              </label>
              <input type="text" id="input-emp-title" value="${activeUserForm.jobTitle || ''}" placeholder="Job Title (e.g. Senior Mechanic)"
                style="width: 100%; background: #1e293b; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 8px 12px; font-size: 13px;" />
            </div>

            <!-- Working Area -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
                Working Area :
              </label>
              <input type="text" id="input-emp-area" value="${activeUserForm.workingArea || ''}" placeholder="Working Area / Floor (e.g. Sewing - Jamuna)"
                style="width: 100%; background: #1e293b; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 8px 12px; font-size: 13px;" />
            </div>

            <!-- Issue Date -->
            <div>
              <label style="display: block; font-size: 12px; font-weight: 700; color: #94a3b8; margin-bottom: 6px;">
                Issue Date (day-mm-yyyy) :
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="text" id="input-emp-date" value="${toolService.formatDateDMY(activeUserForm.issueDate || new Date().toISOString().split('T')[0])}" placeholder="DD-MM-YYYY"
                  style="width: 100%; background: #1e293b; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 8px 36px 8px 12px; font-size: 13px; font-family: monospace; font-weight: 700;" />
                <input type="date" id="picker-emp-date" style="position: absolute; right: 6px; opacity: 0; width: 26px; height: 26px; cursor: pointer;" title="Choose date from calendar" />
                <span style="position: absolute; right: 10px; pointer-events: none; font-size: 14px;">📅</span>
              </div>
            </div>

            <!-- Dynamic Sequential Registration No (Identity Number) -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12px; font-weight: 700; color: #94a3b8;">
                  Reg No. (Identity Number) :
                </label>
                <span style="font-size: 10px; background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e; padding: 1px 6px; border-radius: 4px; font-weight: 800;">
                  ✨ Auto Dynamic
                </span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="text" id="input-emp-reg-no" value="${toolService.getNextRegistrationNumber()}" readonly
                  style="width: 100%; background: #1e293b; color: #f59e0b; border: 1.5px solid #ca8a04; border-radius: 6px; padding: 8px 12px; font-size: 14px; font-family: monospace; font-weight: 900; letter-spacing: 0.5px;" />
                <button id="btn-refresh-emp-reg" title="Auto Check Next Dynamic Reg No" style="background: #eab308; color: #000; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                  🔄
                </button>
              </div>
            </div>

            <!-- Action Button -->
            <div>
              <button id="btn-proceed-to-tools" style="width: 100%; background: #22c55e; color: #000; border: 1px solid #16a34a; padding: 9px 16px; border-radius: 6px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <span>➕</span> Add User Info &amp; Proceed
              </button>
            </div>

          </div>
        </div>
      </div>

      <!-- Section Title: Last Ten (10) Registration List -->
      <div style="background: #1e293b; border-radius: 8px; border: 1.5px solid #0284c7; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
        <div style="background: #0284c7; color: #fff; padding: 8px 14px; font-weight: 800; font-size: 14px; text-align: center; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
          <span>Last Ten (10) Registration List</span>
          <span style="font-size: 11.5px; font-weight: 600; background: rgba(0,0,0,0.25); padding: 2px 8px; border-radius: 4px;">
            Showing ${recentRegistrations.length} Records
          </span>
        </div>

        <div style="overflow-x: auto; max-height: 440px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;">
            <thead style="position: sticky; top: 0; z-index: 25;">
              <tr style="background: #0f172a; color: #cbd5e1;">
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: center; width: 110px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Last Reg. No</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: center; width: 110px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Issue Date</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: left; width: 140px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">ID Number</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">User Name</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Job Title</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Working Area</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 12px; text-align: center; width: 180px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${recentRegistrations.length === 0 ? `
                <tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8;">No past registration records found.</td></tr>
              ` : recentRegistrations.map((r, idx) => `
                <tr style="border-bottom: 1px solid #334155; background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.5)' : 'transparent'};">
                  <td style="padding: 10px 12px; text-align: center; font-family: monospace; font-weight: 800; color: #f59e0b;">
                    #${r.regNo}
                  </td>
                  <td style="padding: 10px 12px; text-align: center; color: #94a3b8; font-family: monospace; font-weight: 700;">
                    ${toolService.formatDateDMY(r.issueDate)}
                  </td>
                  <td style="padding: 10px 12px; font-family: monospace; font-weight: 700; color: #38bdf8;">
                    ${r.userId}
                  </td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #f1f5f9;">
                    ${r.userName}
                  </td>
                  <td style="padding: 10px 12px; color: #cbd5e1;">
                    ${r.jobTitle}
                  </td>
                  <td style="padding: 10px 12px; color: #cbd5e1;">
                    ${r.workingArea}
                  </td>
                  <td style="padding: 10px 12px; text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                      <button class="btn-load-reg-tools" data-reg="${r.regNo}" title="Open in Tools Add Form" style="background: #0284c7; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                        🛠️ Add/Edit
                      </button>
                      <button class="btn-view-user-hist-row" data-user="${r.userId}" title="View Mechanic Tool Change History" style="background: #7c3aed; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
                        📜 History
                      </button>
                      <button class="btn-print-reg-slip" data-reg="${r.regNo}" title="Print SOP Receipt Slip" style="background: #10b981; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                        🖨️ Print
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// =========================================================================
// SCREEN 2: TOOLS ADD FORM (EQUIPMENT ADD FORM / ALLOCATION FORM)
// =========================================================================
function renderScreen2ToolsAddForm() {
  const masterTools = toolService.getAllMasterTools();
  const masterAccessories = toolService.getAllMasterAccessories();
  const allCatalogItems = getAllCatalogItems(screen2CategoryFilter);
  const catalogCounts = {
    all: getAllCatalogItems('ALL').length,
    tools: masterTools.length,
    accs: masterAccessories.length,
    spares: (historyService.getSparePartsMaster() || []).length
  };

  // Initialize dynamic next registration number if not already set
  if (!currentRegNo) {
    currentRegNo = toolService.getNextRegistrationNumber();
    activeUserForm.regNo = currentRegNo;
  }

  return `
    <div class="screen-tools-add" style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Top Title Bar -->
      <div style="background: linear-gradient(90deg, #84cc16, #a3e635); color: #000; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 15px; border: 1px solid #4d7c0f; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <span style="display: flex; align-items: center; gap: 8px;">
          <span>🛠️ Tools Allocation Form:</span>
          <span style="font-size: 11px; font-weight: 700; background: #0f172a; color: #fde047; padding: 2px 8px; border-radius: 4px; border: 1px solid #ca8a04;">
            Active Reg #${currentRegNo}
          </span>
        </span>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button id="btn-open-ocr-import-modal" style="background: linear-gradient(135deg, #7c3aed, #9333ea); color: #fff; border: 1px solid #c084fc; padding: 5px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(124,58,237,0.4);" title="Copy and paste ERP PDF table rows (Ctrl+V) to auto-extract items from Item Name column">
            <span>📋</span> ERP PDF Table Importer (Auto-Fill)
          </button>
          <button id="btn-open-batch-tools-modal" style="background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; border: 1px solid #38bdf8; padding: 5px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(2,132,199,0.4);" title="Select Multiple Tools at once from full checklist">
            <span>📋</span> Batch Select Multiple Tools
          </button>
          <button id="btn-open-excel-import-form" style="background: #15803d; color: #fff; border: 1px solid #166534; padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Import previous tool allocations from Excel">
            <span>📥</span> Import Excel Data
          </button>
          <button id="btn-load-standard-kit" style="background: #0f172a; color: #fbbf24; border: 1px solid #f59e0b; padding: 5px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            ⚡ 1-Click Load Standard 28 Tools
          </button>
          <button id="btn-clear-queue" style="background: #dc2626; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
            🧹 Clear Table
          </button>
        </div>
      </div>

      <!-- Main Input Canvas Box (Blue Theme matching screenshot) -->
      <div style="background: #1e293b; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; box-shadow: 0 6px 12px rgba(0,0,0,0.3);">
        
        <!-- Tab Registration No Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed #475569;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13.5px; font-weight: 800; color: #f1f5f9;">Registration No (Identity Number) :</span>
            <input type="text" id="input-tab-reg-no" value="${currentRegNo}" 
              style="width: 110px; background: #eab308; color: #000; font-family: monospace; font-weight: 900; font-size: 16px; text-align: center; border: 2px solid #ca8a04; border-radius: 4px; padding: 4px 8px;" />
            <button id="btn-generate-next-reg" title="Generate Next Dynamic Unique Sequential Reg No" style="background: #f59e0b; color: #000; border: 1px solid #d97706; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 4px;">
              <span>🔄</span> Next Sequential
            </button>
            <button id="btn-load-reg-data" style="background: #2563eb; color: #fff; border: none; padding: 5px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
              Load Reg
            </button>
          </div>
          <div>
            ${toolService.isRegistrationNumberAvailable(currentRegNo, activeUserForm.userId) ? `
              <span style="background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 800;">
                ✨ Auto Dynamic Reg No #${currentRegNo} (Guaranteed Unique)
              </span>
            ` : `
              <span style="background: rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid #ca8a04; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 800;">
                ✏️ Editing Existing Registration #${currentRegNo}
              </span>
            `}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.1fr 1.35fr 130px; gap: 16px; align-items: start;">
          
          <!-- Left Column: Employee Info Display/Edit -->
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">ID Number :</span>
              <div style="position: relative; display: flex; gap: 4px;">
                <input type="text" id="input-add-user-id" value="${activeUserForm.userId || ''}" placeholder="Enter Card/ID (e.g. 142472)"
                  style="width: 100%; background: #0f172a; color: #38bdf8; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px; font-weight: 700; font-family: monospace;" />
                <button id="btn-search-staff-tools-add" title="Search from Manpower Database" style="background: #2563eb; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                  🔍
                </button>
                <button id="btn-clear-emp-fields" title="Clear Employee Fields" style="background: #475569; color: #cbd5e1; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                  🧹 Clear
                </button>
                <div id="staff-typeahead-dropdown-screen2" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #1e293b; border: 1.5px solid #3b82f6; border-radius: 6px; z-index: 100; max-height: 200px; overflow-y: auto; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);"></div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">User Name :</span>
              <input type="text" id="input-add-user-name" value="${activeUserForm.userName || ''}" placeholder="Enter Mechanic Name"
                style="background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px; font-weight: 700;" />
            </div>

            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Job Title :</span>
              <input type="text" id="input-add-job-title" value="${activeUserForm.jobTitle || ''}" placeholder="Job Title (e.g. Senior Mechanic)"
                style="background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px;" />
            </div>

            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Working Area :</span>
              <input type="text" id="input-add-working-area" value="${activeUserForm.workingArea || ''}" placeholder="Working Area / Floor (e.g. Sewing - Jamuna)"
                style="background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px;" />
            </div>

            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Issue Date :</span>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="text" id="input-add-issue-date" value="${toolService.formatDateDMY(activeUserForm.issueDate || new Date().toISOString().split('T')[0])}" placeholder="DD-MM-YYYY"
                  style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 30px 5px 8px; font-family: monospace; font-weight: 700;" />
                <input type="date" id="picker-add-issue-date" style="position: absolute; right: 4px; opacity: 0; width: 24px; height: 24px; cursor: pointer;" title="Choose date from calendar" />
                <span style="position: absolute; right: 8px; pointer-events: none; font-size: 12px;">📅</span>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Registration No :</span>
              <input type="text" id="input-add-reg-no" value="${currentRegNo}" readonly
                style="background: #0f172a; color: #f59e0b; font-weight: 800; font-family: monospace; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px;" />
            </div>

            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Requisition No :</span>
              <input type="text" id="input-add-requisition-no" value="${activeUserForm.requisitionNo || ''}" placeholder="ERP Requisition (e.g. IR2507318801)"
                style="background: #0f172a; color: #38bdf8; font-weight: 800; font-family: monospace; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px;" />
            </div>
          </div>

          <!-- Middle Column: Tool & Spare Parts Selector with Live Details Card (User Friendly UX) -->
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; background: rgba(15, 23, 42, 0.5); border: 1px solid #334155; border-radius: 8px; padding: 12px;">
            
            <!-- Category Pills Filter Bar -->
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; border-bottom: 1px dashed #334155; padding-bottom: 6px;">
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button type="button" class="btn-tool-cat-pill ${screen2CategoryFilter === 'ALL' ? 'active' : ''}" data-cat="ALL" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid ${screen2CategoryFilter === 'ALL' ? '#38bdf8' : '#475569'}; background: ${screen2CategoryFilter === 'ALL' ? '#0284c7' : '#1e293b'}; color: #fff;">
                  ✨ All (${catalogCounts.all})
                </button>
                <button type="button" class="btn-tool-cat-pill ${screen2CategoryFilter === 'TOOL' ? 'active' : ''}" data-cat="TOOL" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid ${screen2CategoryFilter === 'TOOL' ? '#38bdf8' : '#475569'}; background: ${screen2CategoryFilter === 'TOOL' ? '#0284c7' : '#1e293b'}; color: #fff;">
                  🔧 Tools (${catalogCounts.tools})
                </button>
                <button type="button" class="btn-tool-cat-pill ${screen2CategoryFilter === 'ACCESSORY' ? 'active' : ''}" data-cat="ACCESSORY" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid ${screen2CategoryFilter === 'ACCESSORY' ? '#ec4899' : '#475569'}; background: ${screen2CategoryFilter === 'ACCESSORY' ? '#db2777' : '#1e293b'}; color: #fff;">
                  📦 Accessories (${catalogCounts.accs})
                </button>
                <button type="button" class="btn-tool-cat-pill ${screen2CategoryFilter === 'SPARE_PART' ? 'active' : ''}" data-cat="SPARE_PART" style="padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1px solid ${screen2CategoryFilter === 'SPARE_PART' ? '#10b981' : '#475569'}; background: ${screen2CategoryFilter === 'SPARE_PART' ? '#059669' : '#1e293b'}; color: #fff;">
                  ⚙️ Spare Parts (${catalogCounts.spares})
                </button>
              </div>

              <!-- Quick Shortcut to Batch Modal -->
              <button id="btn-middle-batch-add" type="button" title="Select multiple tools at once from interactive checklist" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; border: 1px solid #a78bfa; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                ⚡ Batch Select
              </button>
            </div>

            <!-- Smart Searchable Dropdown with Floating Autocomplete -->
            <div style="position: relative;">
              <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
                <span style="color: #94a3b8; font-weight: 700; text-align: right;">Select Item :</span>
                <div style="position: relative; display: flex; align-items: center;">
                  <input type="text" id="input-tool-smart-search" placeholder="🔍 Type tool or spare part name, code (e.g. 001, screw, SP-01)..." 
                    value="${screen2SelectedCatalogItem ? `${screen2SelectedCatalogItem.code} - ${screen2SelectedCatalogItem.name}` : ''}"
                    autocomplete="off"
                    style="width: 100%; background: #0f172a; color: #38bdf8; border: 1.5px solid #0284c7; border-radius: 4px; padding: 6px 28px 6px 8px; font-weight: 700; font-size: 12px;" />
                  <span id="btn-toggle-tool-dropdown" style="position: absolute; right: 8px; cursor: pointer; color: #94a3b8; font-size: 11px;" title="Show all items">▼</span>
                </div>
              </div>

              <!-- Hidden Fallback Select for DOM compatibility -->
              <select id="select-tool-item" style="display: none;">
                <option value="">-- Select Tool --</option>
                ${allCatalogItems.map(it => `<option value="${it.code}" data-id="${it.id}" data-type="${it.type}" data-name="${it.name}" data-unit="${it.unit}" data-qty="${it.defaultQty}" data-stock="${it.totalStock}" data-cat="${it.category}" data-remarks="${it.remarks}" ${screen2SelectedCatalogItem?.code === it.code ? 'selected' : ''}>${it.code}. ${it.name}</option>`).join('')}
              </select>

              <!-- Floating Autocomplete Suggestion Panel -->
              <div id="tool-autocomplete-results" style="display: none; position: absolute; top: calc(100% + 3px); left: 118px; right: 0; background: #0b1329; border: 2px solid #0284c7; border-radius: 6px; max-height: 240px; overflow-y: auto; z-index: 1000; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
              </div>
            </div>

            <!-- LIVE TOOL / SPARE PART DETAILS CARD (Matching Spare Parts Details design) -->
            <div id="tool-details-preview-card" style="background: ${screen2SelectedCatalogItem ? 'rgba(2, 132, 199, 0.12)' : 'rgba(30, 41, 59, 0.3)'}; border: 1px solid ${screen2SelectedCatalogItem ? '#0284c7' : '#334155'}; border-radius: 6px; padding: 8px 10px; font-size: 11.5px;">
              ${screen2SelectedCatalogItem ? `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: #0284c7; color: #fff; font-family: monospace; font-weight: 900; font-size: 11px; padding: 2px 6px; border-radius: 3px;">
                      ${screen2SelectedCatalogItem.code}
                    </span>
                    <strong style="color: #f8fafc; font-size: 12.5px;">${screen2SelectedCatalogItem.name}</strong>
                  </div>
                  <span style="font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 800; background: ${screen2SelectedCatalogItem.type === 'TOOL' ? 'rgba(56, 189, 248, 0.2); color: #38bdf8;' : screen2SelectedCatalogItem.type === 'ACCESSORY' ? 'rgba(236, 72, 153, 0.2); color: #f472b6;' : 'rgba(52, 211, 153, 0.2); color: #34d399;'};">
                    ${screen2SelectedCatalogItem.typeLabel || screen2SelectedCatalogItem.type}
                  </span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 6px; color: #cbd5e1; font-size: 11px; background: rgba(15, 23, 42, 0.6); padding: 5px 8px; border-radius: 4px;">
                  <div><span style="color: #94a3b8;">Category:</span> <strong>${screen2SelectedCatalogItem.category || 'General'}</strong></div>
                  <div><span style="color: #94a3b8;">Unit:</span> <strong>${screen2SelectedCatalogItem.unit || 'Pcs'}</strong></div>
                  <div>
                    <span style="color: #94a3b8;">Central Stock:</span> 
                    <strong style="color: ${screen2SelectedCatalogItem.totalStock > 0 ? '#34d399' : '#ef4444'};">
                      ${screen2SelectedCatalogItem.totalStock > 0 ? `🟢 ${screen2SelectedCatalogItem.totalStock} ${screen2SelectedCatalogItem.unit}` : '🔴 Out of Stock'}
                    </strong>
                  </div>
                </div>
                ${screen2SelectedCatalogItem.remarks ? `
                  <div style="margin-top: 4px; color: #94a3b8; font-size: 10.5px;">
                    <em>📝 Specs: ${screen2SelectedCatalogItem.remarks}</em>
                  </div>
                ` : ''}
              ` : `
                <div style="color: #64748b; text-align: center; padding: 4px; font-style: italic;">
                  💡 Select an item above or click "⚡ Batch Select" to pick multiple tools at once
                </div>
              `}
            </div>

            <!-- Quantity with Quick Stepper & Presets -->
            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Quantity :</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button type="button" id="btn-qty-minus" style="background: #1e293b; color: #fff; border: 1px solid #475569; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; font-weight: 900;">−</button>
                <input type="number" id="input-item-qty" value="${screen2SelectedCatalogItem?.defaultQty || '1'}" min="1"
                  style="width: 60px; text-align: center; background: #0f172a; color: #22c55e; font-weight: 800; border: 1px solid #475569; border-radius: 4px; padding: 4px 6px; font-size: 13px;" />
                <button type="button" id="btn-qty-plus" style="background: #1e293b; color: #fff; border: 1px solid #475569; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; font-weight: 900;">+</button>
                <div style="display: flex; gap: 4px; margin-left: 6px;">
                  <button type="button" class="btn-quick-qty" data-qty="1" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 2px 7px; border-radius: 3px; font-size: 10.5px; cursor: pointer;">1</button>
                  <button type="button" class="btn-quick-qty" data-qty="2" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 2px 7px; border-radius: 3px; font-size: 10.5px; cursor: pointer;">2</button>
                  <button type="button" class="btn-quick-qty" data-qty="5" style="background: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 2px 7px; border-radius: 3px; font-size: 10.5px; cursor: pointer;">5</button>
                </div>
              </div>
            </div>

            <!-- Change Status Dropdown -->
            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Change Status :</span>
              <div style="display: flex; gap: 6px;">
                <select id="select-item-status" style="flex: 1; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px;">
                  <option value="NEW_ISSUE">New Issue</option>
                  <option value="REPLACED">Replaced (Broken/Change)</option>
                  <option value="RETURNED">Returned to Store</option>
                </select>
                <input type="date" id="input-change-date" style="display: none; width: 120px; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 4px 6px; font-size: 11px;" title="Date of Change/Replacement" />
              </div>
            </div>

            <!-- Remarks -->
            <div style="display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 8px;">
              <span style="color: #94a3b8; font-weight: 700; text-align: right;">Remarks :</span>
              <input type="text" id="input-item-remarks" placeholder="Optional tool remarks or serial"
                value="${screen2SelectedCatalogItem?.remarks || ''}"
                style="background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px;" />
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 4px; padding-top: 6px; border-top: 1px dashed #334155;">
              <button id="btn-delete-selected-item" type="button" style="background: #eab308; color: #000; border: 1px solid #ca8a04; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer;" title="Reset selection">
                Clear
              </button>
              <button id="btn-open-batch-middle" type="button" style="background: #8b5cf6; color: #fff; border: 1px solid #7c3aed; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Select multiple tools at once">
                <span>📋</span> Multi-Select
              </button>
              <button id="btn-add-to-list" type="button" style="background: #22c55e; color: #000; border: 1px solid #16a34a; padding: 6px 18px; border-radius: 6px; font-weight: 800; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <span>➕</span> Add Tool To List
              </button>
            </div>
          </div>

          <!-- Right Column: Big 3D SAVE Button matching screenshot -->
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <button id="btn-save-allocation-batch" style="width: 100%; min-height: 120px; background: linear-gradient(145deg, #4ade80, #15803d); color: #ffffff; border: 3px solid #bbf7d0; border-radius: 12px; font-weight: 900; font-size: 24px; letter-spacing: 1.5px; cursor: pointer; box-shadow: 0 8px 16px -2px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.4); text-shadow: 0 2px 4px rgba(0,0,0,0.4); transition: transform 0.1s, box-shadow 0.1s;">
              SAVE
            </button>
            <span style="font-size: 11px; color: #94a3b8; margin-top: 6px; text-align: center;">Commit to Database</span>
          </div>

        </div>
      </div>

      <!-- Live Data Table (Yellow / Golden Header Bar matching screenshot) -->
      <div style="background: #1e293b; border-radius: 8px; border: 1.5px solid #ca8a04; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
        <div style="background: #eab308; color: #000; padding: 6px 12px; font-weight: 800; font-size: 13.5px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span>Tools Allocated to Mechanic in Current Registration: (${liveAllocationQueue.length} Tools)</span>
            <button id="btn-batch-add-shortcut" style="background: #0f172a; color: #38bdf8; border: 1px solid #0284c7; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <span>➕</span> Batch Add Multiple Tools
            </button>
          </div>
          <span style="font-size: 12px; font-weight: 600;">Double-check quantities before saving</span>
        </div>

        <div style="overflow-x: auto; max-height: 380px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
            <thead style="position: sticky; top: 0; z-index: 30;">
              <tr style="background: #f59e0b; color: #000;">
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: center; width: 65px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Reg. No</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: center; width: 135px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">ERP Req #</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Issue Date</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: left; width: 110px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">ID Number</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: left; width: 130px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">User Name</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: left; width: 120px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Job Title</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: left; width: 120px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Working Area</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: left; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Equipment / Tool Name</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: center; width: 75px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Quantity</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: center; width: 115px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Status</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: left; width: 180px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Remarks</th>
                <th style="position: sticky; top: 0; z-index: 30; background: #f59e0b; color: #000; padding: 8px 10px; text-align: center; width: 65px; border-bottom: 2px solid #b45309; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Action</th>
              </tr>
            </thead>
            <tbody id="allocation-queue-tbody">
              ${liveAllocationQueue.length === 0 ? `
                <tr><td colspan="12" style="padding: 30px; text-align: center; color: #94a3b8;">No tools added yet. Select tools above or click "📋 Batch Select Multiple Tools" to load multiple items at once.</td></tr>
              ` : liveAllocationQueue.map((item, idx) => `
                <tr style="border-bottom: 1px dashed #334155; background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                  <td style="padding: 6px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #f59e0b;">
                    ${item.regNo || currentRegNo}
                  </td>
                  <td style="padding: 6px 10px; text-align: center;">
                    ${(item.requisitionNo || activeUserForm.requisitionNo) ? `
                      <span style="display: inline-block; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-family: monospace; font-weight: 800; font-size: 11.5px; padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.4); letter-spacing: 0.5px;">
                        #${item.requisitionNo || activeUserForm.requisitionNo}
                      </span>
                    ` : `<span style="color: #64748b; font-size: 11px;">-</span>`}
                  </td>
                  <td style="padding: 6px 10px; text-align: center; font-family: monospace; color: #cbd5e1; font-weight: 700;">
                    ${toolService.formatDateDMY(item.issueDate || activeUserForm.issueDate || '25-10-2025')}
                  </td>
                  <td style="padding: 6px 10px; font-family: monospace; font-weight: 700; color: #38bdf8;">
                    ${item.userId || activeUserForm.userId}
                  </td>
                  <td style="padding: 6px 10px; font-weight: 600; color: #f1f5f9;">
                    ${item.userName || activeUserForm.userName}
                  </td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">
                    ${item.jobTitle || activeUserForm.jobTitle}
                  </td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">
                    ${item.workingArea || activeUserForm.workingArea}
                  </td>
                  <td style="padding: 6px 10px; font-weight: 700; color: #38bdf8;">
                    ${item.itemType === 'ACCESSORY' ? '📦' : item.itemType === 'SPARE_PART' ? '⚙️' : '🔧'} ${item.itemCode ? `${item.itemCode}. ` : ''}${item.itemName}
                  </td>
                  <td style="padding: 6px 10px; text-align: center;">
                    <input type="number" min="1" class="inp-queue-qty" data-index="${idx}" value="${item.quantity || 1}" 
                      style="width: 55px; text-align: center; background: #0f172a; color: #22c55e; font-weight: 800; border: 1px solid #334155; border-radius: 4px; padding: 2px 4px; font-size: 12px;" />
                  </td>
                  <td style="padding: 6px 10px; text-align: center;">
                    <select class="sel-queue-status" data-index="${idx}" style="background: #0f172a; color: ${item.changeStatus === 'REPLACED' ? '#fde047' : (item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED') ? '#fca5a5' : '#86efac'}; font-weight: 700; border: 1px solid #334155; border-radius: 4px; padding: 2px 4px; font-size: 11px;">
                      <option value="NEW_ISSUE" ${item.changeStatus === 'NEW_ISSUE' ? 'selected' : ''}>New Issue</option>
                      <option value="REPLACED" ${item.changeStatus === 'REPLACED' ? 'selected' : ''}>Replaced</option>
                      <option value="LOST" ${(item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED') ? 'selected' : ''}>⚠️ Lost (Harao)</option>
                    </select>
                    ${item.changeDate ? `<div style="font-size: 9.5px; color: #94a3b8; font-family: monospace; margin-top: 2px;">${item.changeDate}</div>` : ''}
                  </td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">
                    <input type="text" class="inp-queue-remarks" data-index="${idx}" value="${item.remarks || ''}" placeholder="Remarks" title="${item.remarks || ''}"
                      style="width: 100%; min-width: 160px; background: #0f172a; color: #cbd5e1; border: 1px solid #334155; border-radius: 4px; padding: 3px 6px; font-size: 11px;" />
                  </td>
                  <td style="padding: 6px 10px; text-align: center;">
                    <button class="btn-remove-queue-item" data-index="${idx}" title="Remove item" style="background: transparent; color: #ef4444; border: none; cursor: pointer; font-size: 15px;">
                      🗑️
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  `;
}

// =========================================================================
// SCREEN 3: PRINT PAGE (A4 FULL PAGE SOP SHEET & POCKET BAG SLIP)
// =========================================================================
function renderScreen3PrintPage() {
  // If no registration is currently selected, auto-select the latest recorded allocation
  if (!currentPrintRegNo) {
    const allAllocs = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    if (allAllocs.length > 0) {
      const last = allAllocs[allAllocs.length - 1];
      if (last && (last.regNo || last.userId)) {
        currentPrintRegNo = String(last.regNo || last.userId).replace(/^[#\s]+/, '').trim();
      }
    }
  }

  const regDetails = currentPrintRegNo ? toolService.getRegistrationDetails(currentPrintRegNo) : null;

  const tools = regDetails ? (regDetails.tools || []) : [];
  const accessories = regDetails ? (regDetails.accessories || []) : [];

  // Split tools into 2 columns for A4 SOP format
  const leftTools = tools.slice(0, 20);
  const rightTools = tools.slice(20);

  // Sync pocketCustomSettings with stored template config if not yet customized in this session
  const tpl = toolService.getPrintTemplateConfig();
  if (tpl.pocket && !pocketCustomSettings._userModified) {
    if (tpl.pocket.cardWidth) pocketCustomSettings.width = Number(tpl.pocket.cardWidth) || 125;
    if (tpl.pocket.cardHeight) pocketCustomSettings.height = Number(tpl.pocket.cardHeight) || 170;
    if (tpl.pocket.sizePreset) pocketCustomSettings.preset = tpl.pocket.sizePreset;
    if (tpl.pocket.signatureMarginTop) pocketCustomSettings.sigGap = tpl.pocket.signatureMarginTop;
  }

  return `
    <div class="screen-print-page" style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Top Green Title & Search Filter Toolbar (Sticky Below Navigation Tabs) -->
      <div style="position: sticky; top: 62px; z-index: 800; background: #090d16; padding-bottom: 6px;">
        <div style="background: linear-gradient(90deg, #65a30d, #84cc16); color: #000; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 15px; border: 1px solid #4d7c0f; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <span>Printable Page:</span>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 12.5px; font-weight: 800;">Mechanic ID / Card / Reg :</span>
            <div style="position: relative; display: inline-block;">
              <input type="text" id="input-print-reg-no" value="${currentPrintRegNo || ''}" placeholder="Card #, Reg # or Name" autocomplete="off"
                style="width: 195px; background: #fff; color: #000; font-family: monospace; font-weight: 800; font-size: 13px; text-align: center; border: 1.5px solid #000; border-radius: 4px; padding: 4px 8px;" />
              <div id="print-search-suggestions" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; min-width: 330px; max-width: 390px; max-height: 280px; overflow-y: auto; background: #0f172a; border: 2px solid #38bdf8; border-radius: 6px; z-index: 1200; box-shadow: 0 12px 30px rgba(0,0,0,0.6);"></div>
            </div>
            <button id="btn-search-print-reg" style="background: #0f172a; color: #fff; border: 1px solid #334155; padding: 4px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer;">
              Search
            </button>
            <button id="btn-sync-manpower-print" style="background: #0284c7; color: #fff; border: 1px solid #0369a1; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Sync with latest Manpower records (promotions, floor changes, card formats)">
              <span class="sync-icon">🔄</span> Sync Manpower
            </button>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <!-- Format Switcher (Only Full A4 Form and Pocket Bag Slip) -->
            <div style="display: flex; background: #0f172a; border-radius: 6px; padding: 2px; border: 1px solid #334155;">
              <button id="btn-format-a4" class="btn-print-fmt ${currentPrintFormat === 'A4' ? 'active' : ''}" style="background: ${currentPrintFormat === 'A4' ? '#2563eb' : 'transparent'}; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
                📄 Full Page A4 Form (PDF Pg 1)
              </button>
              <button id="btn-format-pocket" class="btn-print-fmt ${currentPrintFormat === 'POCKET' ? 'active' : ''}" style="background: ${currentPrintFormat === 'POCKET' ? '#2563eb' : 'transparent'}; color: #fff; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
                🏷️ Pocket Bag Slip
              </button>
            </div>

            <!-- Admin Template Customizer Button -->
            <button id="btn-open-template-customizer" style="background: #eab308; color: #000; border: 1px solid #ca8a04; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Admin can customize left-side fixed Extra Accessories and SOP text">
              <span>⚙️</span> Customize Template
            </button>

            <button id="btn-trigger-print" style="background: #059669; color: #fff; border: 1px solid #047857; padding: 4px 16px; border-radius: 4px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              🖨️ Print Document
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Custom Height x Width & Layout Bar (Interactive for Pocket Bag Slip) -->
      ${currentPrintFormat === 'POCKET' ? `
      <div id="pocket-quick-settings-bar" style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1.5px solid #eab308; border-radius: 8px; padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; color: #facc15; font-size: 12.5px; display: flex; align-items: center; gap: 4px;">
              <span>🪪</span> Card Presets:
            </span>
            <select id="sel-quick-pocket-preset" style="background: #0f172a; color: #f8fafc; border: 1.5px solid #ca8a04; border-radius: 5px; padding: 4px 8px; font-weight: 700; font-size: 12px; cursor: pointer;">
              <option value="standard" ${pocketCustomSettings.preset === 'standard' ? 'selected' : ''}>Standard Pocket (125 × 170 mm)</option>
              <option value="a6" ${pocketCustomSettings.preset === 'a6' ? 'selected' : ''}>A6 Pocket Slip (105 × 148 mm)</option>
              <option value="badge" ${pocketCustomSettings.preset === 'badge' ? 'selected' : ''}>ID Badge Medium (100 × 75 mm)</option>
              <option value="cr80" ${pocketCustomSettings.preset === 'cr80' ? 'selected' : ''}>ID Card CR-80 (86 × 54 mm)</option>
              <option value="custom" ${pocketCustomSettings.preset === 'custom' ? 'selected' : ''}>Custom (W × H)</option>
            </select>
          </div>

          <!-- Custom Width & Height Inputs (Directly on screen!) -->
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 6px; border: 1px solid #334155;">
            <label for="inp-quick-pocket-width" style="font-size: 11.5px; font-weight: 800; color: #38bdf8;">Card Width:</label>
            <input type="number" id="inp-quick-pocket-width" value="${pocketCustomSettings.width}" min="50" max="250" step="1" 
              style="width: 58px; background: #0f172a; color: #38bdf8; border: 1.5px solid #0284c7; border-radius: 4px; padding: 3px 6px; font-weight: 900; font-size: 13px; text-align: center;" />
            <span style="font-size: 11px; color: #94a3b8; font-weight: 700;">mm</span>

            <span style="color: #64748b; font-weight: 900; margin: 0 4px;">×</span>

            <label for="inp-quick-pocket-height" style="font-size: 11.5px; font-weight: 800; color: #38bdf8;">Height:</label>
            <input type="number" id="inp-quick-pocket-height" value="${pocketCustomSettings.height}" min="40" max="300" step="1" 
              style="width: 58px; background: #0f172a; color: #38bdf8; border: 1.5px solid #0284c7; border-radius: 4px; padding: 3px 6px; font-weight: 900; font-size: 13px; text-align: center;" />
            <span style="font-size: 11px; color: #94a3b8; font-weight: 700;">mm</span>
          </div>

          <!-- Signature Spacing / Positioning -->
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 6px; border: 1px solid #334155;">
            <label for="sel-quick-pocket-sig-gap" style="font-size: 11.5px; font-weight: 800; color: #fbbf24;">✍️ Signature Spacing:</label>
            <select id="sel-quick-pocket-sig-gap" style="background: #0f172a; color: #fef08a; border: 1px solid #ca8a04; border-radius: 4px; padding: 3px 8px; font-weight: 700; font-size: 12px; cursor: pointer;">
              <option value="15px" ${pocketCustomSettings.sigGap === '15px' ? 'selected' : ''}>15mm (Compact)</option>
              <option value="25px" ${pocketCustomSettings.sigGap === '25px' ? 'selected' : ''}>25mm (Standard)</option>
              <option value="35px" ${pocketCustomSettings.sigGap === '35px' ? 'selected' : ''}>35mm (Spacious)</option>
              <option value="50px" ${pocketCustomSettings.sigGap === '50px' ? 'selected' : ''}>50mm (Deep / Extra Low)</option>
            </select>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-save-pocket-quick" style="background: #eab308; color: #000; border: 1px solid #ca8a04; padding: 5px 14px; border-radius: 5px; font-size: 12px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(234,179,8,0.3);" title="Save current custom dimensions & signature spacing as default">
            <span>💾</span> Save Dimensions
          </button>
        </div>
      </div>
      ` : ''}

      <!-- Notice Banner for User and Admin Roles -->
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 6px; padding: 6px 12px; font-size: 12px; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: #38bdf8;">Dynamic Right Side:</strong> Tools Descriptions (1-28) &amp; Personal Info change per selected mechanic.
          <span style="margin: 0 8px; color: #64748b;">|</span>
          <strong style="color: #fbbf24;">Fixed Left Side:</strong> Extra Accessories &amp; SOP box follow factory template.
        </div>
        <div style="font-size: 11.5px; color: #94a3b8;">
          Admin can click <strong style="color: #eab308;">"⚙️ Customize Template"</strong> to edit default left-side items &amp; SOP text.
        </div>
      </div>

      <!-- PRINTABLE CANVAS PREVIEW (Matches exactly the attached layout) -->
      <div id="printable-sheet-wrapper" style="background: #475569; padding: 20px; border-radius: 8px; display: flex; justify-content: center; overflow-x: auto;">
        
        ${!currentPrintRegNo || !regDetails ? `
          <div style="background: #1e293b; border: 2px dashed #64748b; border-radius: 12px; padding: 50px 30px; text-align: center; max-width: 600px; margin: 30px auto; color: #cbd5e1; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
            <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
            <div style="font-size: 19px; font-weight: 800; color: #f8fafc; margin-bottom: 8px;">No Mechanic Selected</div>
            <div style="font-size: 13.5px; color: #94a3b8; max-width: 480px; margin: 0 auto 16px auto; line-height: 1.6;">
              Please enter a <strong>Mechanic ID</strong>, <strong>Card Number</strong> (e.g. <code style="background:#0f172a; padding:2px 6px; border-radius:4px; color:#38bdf8;">AMG-0147075</code>), or <strong>Reg #</strong> (e.g. <code style="background:#0f172a; padding:2px 6px; border-radius:4px; color:#38bdf8;">1196</code>) above and click <strong style="color: #84cc16;">Search</strong> to display the document.
            </div>
            <div style="font-size: 12px; color: #64748b;">
              💡 You can also search by name, or click <strong>Print Slip</strong> from the Database tab.
            </div>
          </div>
        ` : (currentPrintFormat === 'POCKET' ? renderFormatPocket(regDetails, leftTools, rightTools, accessories) : renderFormatA4(regDetails, leftTools, rightTools, accessories))}

      </div>

    </div>
  `;
}

// FORMAT A: OFFICIAL STANDARD FORM (PDF PAGE 1 - FULL 28 TOOLS ON RIGHT, ACCESSORIES & SOP ON LEFT, 3 SIGNATURES AT BOTTOM)
function renderFormatA4(reg, leftTools, rightTools, accessories) {
  const allTools = reg.tools || [];
  const tpl = toolService.getPrintTemplateConfig();

  // Default list of 28 standard tools if none allocated for this user
  const standard28 = [
    { code: '001', name: 'Flat Screw Driver (Large)', qty: '1' },
    { code: '002', name: 'Flat Screw Driver (Medium)', qty: '1' },
    { code: '003', name: 'Flat Screw Driver (Small)', qty: '1' },
    { code: '014', name: 'Pliers (Long Nose)', qty: '1' },
    { code: '015', name: 'Pliers (Long Nose)', qty: '1' },
    { code: '021', name: 'Hex Allen Key (01.50mm)', qty: '1' },
    { code: '022', name: 'Hex Allen Key (01.50mm)', qty: '1' },
    { code: '023', name: 'Hex Allen Key (02mm)', qty: '1' },
    { code: '024', name: 'Hex Allen Key (02.50mm)', qty: '1' },
    { code: '025', name: 'Hex Allen Key (03mm)', qty: '1' },
    { code: '026', name: 'Hex Allen Key (03.50mm)', qty: '1' },
    { code: '027', name: 'Hex Allen Key (04mm)', qty: '1' },
    { code: '028', name: 'Hex Allen Key (04.50mm)', qty: '1' },
    { code: '029', name: 'Hex Allen Key (05mm)', qty: '1' },
    { code: '037', name: 'Hex Allen Key (06mm)', qty: '1' },
    { code: '038', name: 'T-Handle Allen Key (02.50mm)', qty: '1' },
    { code: '039', name: 'T-Handle Allen Key (03mm)', qty: '1' },
    { code: '040', name: 'T-Handle Allen Key (04mm)', qty: '1' },
    { code: '045', name: 'T-Handle Allen Key (05mm)', qty: '1' },
    { code: '051', name: 'Needle Allen Key (01.58mm)', qty: '1' },
    { code: '064', name: 'Open End Spanner (10-11mm)', qty: '1' },
    { code: '070', name: 'Open End Spanner (12-13mm)', qty: '1' },
    { code: '091', name: 'Combination Spanner (05mm)', qty: '1' },
    { code: '092', name: 'Combination Spanner (06mm)', qty: '1' },
    { code: '093', name: 'Combination Spanner (07mm)', qty: '1' },
    { code: '094', name: 'Combination Spanner (08mm)', qty: '1' },
    { code: '095', name: 'Combination Spanner (09mm)', qty: '1' },
    { code: '111', name: 'File (Dimond File)', qty: '1' }
  ];

  const displayTools = allTools.length > 0 ? allTools : standard28;
  const displayAccs = tpl.accessories && tpl.accessories.length > 0 ? tpl.accessories : [];
  const sopEng = (tpl.sopEnglish || '').replace(/\n/g, '<br>');
  const sopBen = (tpl.sopBengali || '').replace(/\n/g, '<br>');
  const signatories = tpl.signatories && tpl.signatories.length === 3 ? tpl.signatories : [
    { title: 'Registered By' },
    { title: 'AGM/Sr. AGM' },
    { title: 'General Manager' }
  ];

  const paperDimensions = {
    'A4': { width: '210mm', minHeight: '297mm' },
    'Letter': { width: '216mm', minHeight: '279mm' },
    'Legal': { width: '216mm', minHeight: '356mm' }
  };
  const a4Cfg = tpl.a4 || {};
  const orientation = a4Cfg.orientation || tpl.orientation || 'portrait';
  const paperKey = a4Cfg.paperSize || tpl.paperSize || 'A4';
  const baseDim = paperDimensions[paperKey] || paperDimensions['A4'];
  const docWidth = orientation === 'landscape' ? baseDim.minHeight : baseDim.width;
  const docMinHeight = (a4Cfg.autoHeight === false && a4Cfg.docMinHeight) ? a4Cfg.docMinHeight : 'auto';
  const sigMarginTop = a4Cfg.signatureMarginTop || tpl.signatureMarginTop || '0.2in';

  const fontScaleKey = a4Cfg.fontScaling || tpl.fontScaling || 'standard';
  const marginKey = a4Cfg.marginSize || tpl.marginSize || 'standard';
  const padMap = {
    'tight': '6mm 8mm',
    'standard': '10mm 12mm',
    'wide': '14mm 16mm'
  };
  const fontScaleMap = {
    'compact': { base: '9.5px', table: '8.5px', pad: padMap[marginKey] || '6mm 8mm', lh: '1.35' },
    'standard': { base: '10.5px', table: '9.5px', pad: padMap[marginKey] || '10mm 12mm', lh: '1.5' },
    'large': { base: '12px', table: '11px', pad: padMap[marginKey] || '12mm 14mm', lh: '1.65' }
  };
  const scale = fontScaleMap[fontScaleKey] || fontScaleMap['standard'];
  const extraBlankRows = typeof a4Cfg.extraBlankRows === 'number' ? a4Cfg.extraBlankRows : (typeof tpl.extraBlankRows === 'number' ? tpl.extraBlankRows : 3);
  const showStampBox = a4Cfg.showStampBox !== undefined ? a4Cfg.showStampBox : (tpl.showStampBox !== false);
  const colSplit = a4Cfg.columnSplit === '50-50' ? '50% 50%' : a4Cfg.columnSplit === '40-60' ? '40% 60%' : '46% 54%';
  const headerInfo = toolService.getResolvedCompanyHeader(reg.userId || activeUserForm.userId, tpl);

  return `
    <div id="printable-a4-document" class="printable-doc" style="width: ${docWidth}; min-height: ${docMinHeight}; background: #ffffff; color: #000000; font-family: 'Inter', Arial, sans-serif; padding: ${scale.pad}; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 2px; box-sizing: border-box; position: relative; font-size: ${scale.base};">
      
      <!-- Company Header (Dynamic from Employee Card / Unit) -->
      <div style="border-bottom: 2px solid #000000; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.2px; color: #000;">${headerInfo.companyName}</div>
          <div style="font-size: 11px; font-weight: 700; color: #000; margin-top: 1px;">${headerInfo.companySubtitle}</div>
          <div style="font-size: 10.5px; font-weight: 500; color: #000; margin-top: 1px;">${headerInfo.companyAddress}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 14px; font-weight: 900; color: #000;">${headerInfo.listTitle}</div>
          <div style="font-size: 11.5px; font-weight: 800; color: #000; margin-top: 2px;">${headerInfo.departmentName}</div>
        </div>
      </div>

      <!-- Main 2-Column Body Layout (Left: Info & Accs & SOP, Right: All 28 Tools) -->
      <div style="display: grid; grid-template-columns: ${colSplit}; gap: 12px; align-items: start;">
        
        <!-- LEFT COLUMN: Fixed / Admin-Customizable Template Items -->
        <div style="display: flex; flex-direction: column;">
          
          <!-- Personal Information Block (Dynamic User Info) -->
          <div style="margin-bottom: 8px; font-size: ${scale.base}; line-height: ${scale.lh};">
            <div style="font-weight: 800; font-size: 11.5px; margin-bottom: 3px;">Personal Information:</div>
            
            <div style="display: grid; grid-template-columns: 86px 1fr; row-gap: 2px; align-items: center;">
              <span style="font-weight: 700; text-align: right; padding-right: 6px;">User Name :</span>
              <span style="font-weight: 800; color: #000;">${reg.userName || ''}</span>

              <span style="font-weight: 700; text-align: right; padding-right: 6px;">ID Number :</span>
              <span style="font-weight: 800; font-family: monospace; color: #000;">${reg.userId || ''}</span>

              <span style="font-weight: 700; text-align: right; padding-right: 6px;">Job Title :</span>
              <span style="font-weight: 800; color: #000;">${reg.jobTitle || ''}</span>

              <span style="font-weight: 700; text-align: right; padding-right: 6px;">Working Area :</span>
              <span style="font-weight: 800; color: #000;">${reg.workingArea || ''}</span>

              <span style="font-weight: 700; text-align: right; padding-right: 6px;">Issue Date:</span>
              <span style="font-weight: 800; font-family: monospace; color: #000;">${reg.issueDate ? toolService.formatDateDMY(reg.issueDate) : ''}</span>

              <span style="font-weight: 700; text-align: right; padding-right: 6px;">Reg. No:</span>
              <span style="font-weight: 900; font-family: monospace; font-size: 12px; color: #000;">${reg.regNo || ''}</span>
            </div>
          </div>

          <!-- Extra Accessories (if any) Table (Admin Customizable Template) -->
          <div style="font-weight: 800; font-size: 11px; margin-bottom: 2px; color: #000000;">Extra Accessories (if any) :</div>
          <table style="width: 100%; border-collapse: collapse; font-size: ${scale.table}; border: 1.5px solid #000; margin-bottom: 8px; color: #000000;">
            <thead>
              <tr style="background: #ffffff; border-bottom: 1.5px solid #000; color: #000000;">
                <th style="border-right: 1px solid #000; padding: 3px 6px; text-align: center; font-weight: 800; color: #000000;">Accessories</th>
                <th style="border-right: 1px solid #000; padding: 3px 4px; text-align: center; width: 62px; font-weight: 800; color: #000000;">Qty.</th>
                <th style="padding: 3px 4px; text-align: center; width: 55px; font-weight: 800; color: #000000;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${displayAccs.map((a) => `
                <tr style="border-bottom: 1px dotted #000; color: #000000;">
                  <td style="border-right: 1px solid #000; padding: 2px 6px; font-weight: 600; color: #000000;">${a.itemName || a.name}</td>
                  <td style="border-right: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: 600; color: #000000;">${a.quantity || a.qty || '01 Pcs'}</td>
                  <td style="padding: 2px 4px; text-align: center; font-family: monospace; font-weight: 600; color: #000000;">${a.remarks || ''}</td>
                </tr>
              `).join('')}
              ${Array.from({ length: extraBlankRows }).map(() => `
                <tr style="border-bottom: 1px dotted #000; height: 16px; color: #000000;">
                  <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
                  <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
                  <td style="color: #000000;">&nbsp;</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- SOP Declaration Box (Admin Customizable) -->
          <div style="border: 1.5px solid #000; padding: 7px 10px; text-align: center; margin-bottom: 10px; background: #ffffff; color: #000000;">
            <div style="font-size: 10px; font-weight: 800; color: #000000; line-height: 1.4;">
              ${sopEng || 'Follow the SOP and use tools and equipment, maintaining a good working environment.'}
            </div>
            ${sopBen ? `
              <div style="font-size: 9.5px; font-weight: 700; color: #000000; margin-top: 3px; line-height: 1.35;">
                ${sopBen}
              </div>
            ` : ''}
          </div>

          <!-- Register Note & User Signature (Clean, Stamp Removed) -->
          <div style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; color: #000000;">
            <div style="font-size: 10.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: #000000;">
              <span style="white-space: nowrap; color: #000000;">Register Note (if any):</span>
              <span style="border-bottom: 1px dotted #000; flex: 1; height: 16px;"></span>
            </div>
            <div style="font-size: 10.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: #000000;">
              <span style="white-space: nowrap; color: #000000;">User Signature:</span>
              <span style="border-bottom: 1.5px solid #000; width: 150px; height: 16px;"></span>
              <span style="font-size: 9.5px; color: #000000; font-weight: 600; margin-left: auto;">Date: ____/____/20____</span>
            </div>
          </div>

        </div>

        <!-- RIGHT COLUMN: Dynamic Tools Descriptions (1 to 28+) -->
        <div>
          <div style="font-weight: 800; font-size: 11px; margin-bottom: 2px; color: #000000;">Tools Descriptions:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: ${scale.table}; border: 1.5px solid #000; color: #000000;">
            <thead>
              <tr style="background: #ffffff; border-bottom: 1.5px solid #000; color: #000000;">
                <th style="border-right: 1px solid #000; padding: 3px 4px; text-align: center; width: 44px; font-weight: 800; color: #000000;">Sl. No.</th>
                <th style="border-right: 1px solid #000; padding: 3px 6px; text-align: center; font-weight: 800; color: #000000;">Equipment Name</th>
                <th style="border-right: 1px solid #000; padding: 3px 4px; text-align: center; width: 38px; font-weight: 800; color: #000000;">Qty.</th>
                <th style="padding: 3px 4px; text-align: center; width: 55px; font-weight: 800; color: #000000;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${displayTools.map((t, idx) => `
                <tr style="border-bottom: 1px dotted #000; color: #000000;">
                  <td style="border-right: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace; font-weight: 700; color: #000000;">${String(idx + 1).padStart(2, '0')}</td>
                  <td style="border-right: 1px solid #000; padding: 2px 6px; font-weight: 600; color: #000000;">${t.itemName || t.name}</td>
                  <td style="border-right: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: 700; color: #000000;">${t.quantity || t.qty || 1}</td>
                  <td style="padding: 2px 4px; text-align: center; font-family: monospace; color: #000000;">${t.remarks || ''}</td>
                </tr>
              `).join('')}
              ${Array.from({ length: Math.max(0, 20 - displayTools.length) }).map((_, i) => `
                <tr style="border-bottom: 1px dotted #000; height: 18px; color: #000000;">
                  <td style="border-right: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace; color: #94a3b8; font-size: 8.5px;">${String(displayTools.length + i + 1).padStart(2, '0')}</td>
                  <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
                  <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
                  <td style="color: #000000;">&nbsp;</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>

      <!-- Bottom Official Signatories Section (User friendly lowered positioning: niche sin ar gor namao) -->
      <div style="margin-top: ${sigMarginTop || '35px'}; padding-top: 14px; display: grid; grid-template-columns: repeat(${signatories.length}, 1fr); text-align: center; font-size: 11px; font-weight: 800; page-break-inside: avoid; color: #000000;">
        ${signatories.map(s => `
          <div style="padding: 0 10px;">
            <div style="width: 140px; max-width: 90%; border-top: 1.5px solid #000; margin: 0 auto 6px auto;"></div>
            <div style="font-weight: 800; color: #000;">${s.title}</div>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px; font-weight: 600;">Signature &amp; Date</div>
          </div>
        `).join('')}
      </div>

    </div>
  `;
}

// FORMAT B: POCKET BAG SLIP (EXACT 2-CARD SIDE-BY-SIDE FORMAT MATCHING ATTACHED DESIGN)
function renderFormatPocket(reg, leftTools, rightTools, accessories) {
  const allTools = reg.tools || [];
  const tpl = toolService.getPrintTemplateConfig();

  const standard30 = [
    { code: '001', name: 'Flat Screw Driver (Large)', qty: '1' },
    { code: '002', name: 'Flat Screw Driver (Medium)', qty: '1' },
    { code: '003', name: 'Flat Screw Driver (Small)', qty: '1' },
    { code: '004', name: 'Star Screw Driver (Large)', qty: '1' },
    { code: '005', name: 'Pliers (Long Nose)', qty: '1' },
    { code: '006', name: 'Hex Allen Key (01.50mm)', qty: '1' },
    { code: '007', name: 'Hex Allen Key (02mm)', qty: '1' },
    { code: '008', name: 'Hex Allen Key (02.50mm)', qty: '1' },
    { code: '009', name: 'Hex Allen Key (03mm)', qty: '1' },
    { code: '010', name: 'Hex Allen Key (03.50mm)', qty: '1' },
    { code: '011', name: 'Hex Allen Key (04mm)', qty: '1' },
    { code: '012', name: 'Hex Allen Key (04.50mm)', qty: '1' },
    { code: '013', name: 'Hex Allen Key (05mm)', qty: '1' },
    { code: '014', name: 'Hex Allen Key (06mm)', qty: '1' },
    { code: '015', name: 'T-Handle Allen Key (02mm)', qty: '1' },
    { code: '016', name: 'T-Handle Allen Key (03mm)', qty: '1' },
    { code: '017', name: 'T-Handle Allen Key (04mm)', qty: '1' },
    { code: '018', name: 'Needle Allen Key (01.58mm)', qty: '1' },
    { code: '019', name: 'Adjustable Wrench (10inch)', qty: '1' },
    { code: '020', name: 'Open End Spanner (07mm)', qty: '1' },
    { code: '021', name: 'Open End Spanner (08-10mm)', qty: '1' },
    { code: '022', name: 'Open End Spanner (10-11mm)', qty: '1' },
    { code: '023', name: 'Open End Spanner (12-13mm)', qty: '1' },
    { code: '024', name: 'Open End Spanner (12-14mm)', qty: '1' },
    { code: '025', name: 'Open End Spanner (14-17mm)', qty: '1' },
    { code: '026', name: 'Combination Spanner (05mm)', qty: '1' },
    { code: '027', name: 'Combination Spanner (06mm)', qty: '1' },
    { code: '028', name: 'Combination Spanner (07mm)', qty: '1' },
    { code: '029', name: 'Combination Spanner (09mm)', qty: '1' },
    { code: '030', name: 'File (Dimond File)', qty: '1' }
  ];

  const pCfg = tpl.pocket || {};
  const cardWidthNum = Number(pocketCustomSettings.width) || Number(pCfg.cardWidth) || 125;
  const cardHeightNum = Number(pocketCustomSettings.height) || Number(pCfg.cardHeight) || 170;
  const cardWidth = `${cardWidthNum}mm`;
  const cardHeight = `${cardHeightNum}mm`;
  const borderRadius = typeof pCfg.cardBorderRadius === 'number' ? `${pCfg.cardBorderRadius}px` : '10px';
  const splitCount = 20;

  // Responsive font scaling based on card height
  let pScale;
  if (cardHeightNum <= 80) {
    pScale = { header: '10.5px', sub: '8px', text: '7px', table: '6.5px', accTable: '6px', pad: '4px 6px', lineHeight: '1.2' };
  } else if (cardHeightNum <= 150) {
    pScale = { header: '12px', sub: '8.5px', text: '8px', table: '7.5px', accTable: '7px', pad: '6px 8px', lineHeight: '1.25' };
  } else {
    pScale = { header: '13.5px', sub: '9px', text: '8.5px', table: '8px', accTable: '7px', pad: '7px 9px', lineHeight: '1.3' };
  }

  let col1Tools = [];
  let col2Tools = [];
  if (allTools.length > 0) {
    col1Tools = allTools.slice(0, splitCount);
    col2Tools = allTools.slice(splitCount);
  } else {
    col1Tools = standard30.slice(0, splitCount);
    col2Tools = standard30.slice(splitCount, 30);
  }

  // Generate blank dotted rows for Card 1 if fewer than splitCount tools
  const card1BlankNeeded = Math.max(0, splitCount - col1Tools.length);
  const card1BlankRows = Array.from({ length: card1BlankNeeded }).map((_, i) => {
    const sl = String(col1Tools.length + i + 1).padStart(2, '0');
    return `
      <tr style="border-bottom: 1px dashed #000; height: 13px; color: #000000;">
        <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-family: monospace; color: #94a3b8; font-size: 7.5px;">${sl}</td>
        <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
        <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
        <td style="color: #000000;">&nbsp;</td>
      </tr>
    `;
  }).join('');

  const defaultPocketAccessories = [
    { name: 'Super Glue', qty: '01 Pcs', remarks: '±01' },
    { name: 'Sand Paper', qty: 'Required', remarks: '' },
    { name: 'Take-up spring', qty: '05 Pcs', remarks: '±02' },
    { name: 'Wiper Stick', qty: '02 Pcs', remarks: '±03' },
    { name: 'Eye/Safety Guard', qty: '01 Pcs', remarks: '±01' },
    { name: 'Safety Glass', qty: '01 Pcs', remarks: '±01' },
    { name: 'Screw, Nut, Bolt, & Washer', qty: '10 Pcs', remarks: '±10' },
    { name: 'Cable Tie', qty: 'Required', remarks: 'Small/400' },
    { name: 'P/M Needle Plate', qty: '02 Pcs', remarks: '±01' },
    { name: 'P/M Feed Dog', qty: '02 Pcs', remarks: '±01' }
  ];

  const displayAccs = (tpl.accessories && tpl.accessories.length > 0) ? tpl.accessories.slice(0, 10) : defaultPocketAccessories;
  const headerInfo = toolService.getResolvedCompanyHeader(reg.userId || activeUserForm.userId, tpl);

  // Generate blank dotted rows for Card 2 to balance height matching screenshot
  const blankRowsNeeded = Math.max(0, 10 - col2Tools.length);
  const card2BlankRows = Array.from({ length: blankRowsNeeded }).map((_, i) => {
    const sl = String(splitCount + col2Tools.length + i + 1).padStart(2, '0');
    return `
      <tr style="border-bottom: 1px dashed #000; height: 13px; color: #000000;">
        <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-family: monospace; color: #94a3b8; font-size: 7.5px;">${sl}</td>
        <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
        <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
        <td style="color: #000000;">&nbsp;</td>
      </tr>
    `;
  }).join('');

  return `
    <div id="printable-pocket-document" class="printable-doc" style="width: auto; max-width: 100%; background: transparent; color: #000000; font-family: 'Inter', Arial, sans-serif; box-sizing: border-box; display: flex; flex-direction: row; justify-content: center; align-items: stretch; margin: 0 auto; gap: 14px;">
      
      <!-- LEFT CARD (Card 1: Company Header, Personal Info, Tools 01 to 20) -->
      <div class="pocket-card pocket-card-front" style="width: ${cardWidth}; min-height: ${cardHeight}; background: #ffffff; border: 2px solid #000000; border-radius: ${borderRadius}; padding: ${pScale.pad}; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-start; position: relative;">
        <div>
          <!-- Company Header -->
          <div style="margin-bottom: 2px;">
            <div style="font-size: ${pScale.header}; font-weight: 900; color: #000; line-height: 1.2;">${headerInfo.companyName || 'A.K.M Knit Wear Ltd.'}</div>
            <div style="font-size: ${pScale.sub}; font-weight: 700; color: #000; margin-top: 1px; line-height: 1.2;">${headerInfo.companySubtitle || '(A sister concern of Al-Muslim Group)'}</div>
            <div style="font-size: ${pScale.sub}; font-weight: 800; color: #000; margin-top: 1px; line-height: 1.2;">${headerInfo.companyAddress || '14, Gadda, Karnapara, Ulail, Savar, Dhaka.'}</div>
          </div>
          <div style="border-bottom: 2px solid #000000; margin-bottom: 4px;"></div>

          <!-- Personal Information (Plain white background, clean format without underlines) -->
          <div style="margin-bottom: 4px; font-size: ${pScale.text}; line-height: 1.35;">
            <div style="font-weight: 800; font-size: 9.5px; margin-bottom: 2px; color: #000;">Personal Information:</div>
            <table style="width: 100%; border-collapse: collapse; font-size: ${pScale.text}; line-height: 1.35;">
              <tr>
                <td style="width: 86px; font-weight: 700; text-align: right; padding: 1px 4px 1px 0; white-space: nowrap; color: #000;">User Name :</td>
                <td style="font-weight: 800; padding: 1px 2px; color: #000;">${reg.userName || ''}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; text-align: right; padding: 1px 4px 1px 0; white-space: nowrap; color: #000;">ID Number :</td>
                <td style="font-weight: 900; font-family: monospace; padding: 1px 2px; color: #000;">${reg.userId || ''}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; text-align: right; padding: 1px 4px 1px 0; white-space: nowrap; color: #000;">Job Title :</td>
                <td style="font-weight: 800; padding: 1px 2px; color: #000;">${reg.jobTitle || ''}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; text-align: right; padding: 1px 4px 1px 0; white-space: nowrap; color: #000;">Working Area :</td>
                <td style="font-weight: 800; padding: 1px 2px; color: #000;">${reg.workingArea || ''}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; text-align: right; padding: 1px 4px 1px 0; white-space: nowrap; color: #000;">Issue Date :</td>
                <td style="font-weight: 800; font-family: monospace; padding: 1px 2px; color: #000;">${reg.issueDate ? toolService.formatDateDMY(reg.issueDate) : ''}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; text-align: right; padding: 1px 4px 1px 0; white-space: nowrap; color: #000;">Reg. No:</td>
                <td style="font-weight: 900; font-family: monospace; padding: 1px 2px; color: #000;">${reg.regNo || ''}</td>
              </tr>
            </table>
          </div>

          <!-- Tools Descriptions (01 to 20) -->
          <div style="font-weight: 800; font-size: 9.5px; margin-bottom: 2px; color: #000000;">Tools Descriptions:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: ${pScale.table}; border: 1.5px solid #000; color: #000000;">
            <thead>
              <tr style="background: #ffffff; border-bottom: 1.5px solid #000; color: #000000;">
                <th style="border-right: 1px solid #000; padding: 1.5px 2px; text-align: center; width: 34px; font-weight: 800; color: #000000;">Sl. No.</th>
                <th style="border-right: 1px solid #000; padding: 1.5px 4px; text-align: center; font-weight: 800; color: #000000;">Equipment Name</th>
                <th style="border-right: 1px solid #000; padding: 1.5px 2px; text-align: center; width: 30px; font-weight: 800; color: #000000;">Qty.</th>
                <th style="padding: 1.5px 2px; text-align: center; width: 44px; font-weight: 800; color: #000000;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${col1Tools.map((t, idx) => `
                <tr style="border-bottom: 1px dashed #000; height: 13px; color: #000000;">
                  <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-family: monospace; font-weight: 700; color: #000000;">${String(idx + 1).padStart(2, '0')}</td>
                  <td style="border-right: 1px solid #000; padding: 1px 4px; font-weight: 600; color: #000000;">${t.itemName || t.name}</td>
                  <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-weight: 700; color: #000000;">${t.quantity || t.qty || 1}</td>
                  <td style="padding: 1px 2px; text-align: center; font-size: 7.5px; color: #000000;">${t.remarks || ''}</td>
                </tr>
              `).join('')}
              ${card1BlankRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- RIGHT CARD (Card 2: Tools 21 to 30+, Extra Accessories & STAMP / SIGNATURE Box) -->
      <div class="pocket-card pocket-card-back" style="width: ${cardWidth}; min-height: ${cardHeight}; background: #ffffff; border: 2px solid #000000; border-radius: ${borderRadius}; padding: ${pScale.pad}; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
        <div>
          <!-- Header of Card 2 -->
          <div style="font-weight: 800; font-size: 9.5px; margin-bottom: 2px; color: #000000;">Tools Descriptions:</div>
          <table style="width: 100%; border-collapse: collapse; font-size: ${pScale.table}; border: 1.5px solid #000; margin-bottom: 5px; color: #000000;">
            <thead>
              <tr style="background: #ffffff; border-bottom: 1.5px solid #000; color: #000000;">
                <th style="border-right: 1px solid #000; padding: 1.5px 2px; text-align: center; width: 34px; font-weight: 800; color: #000000;">Sl. No.</th>
                <th style="border-right: 1px solid #000; padding: 1.5px 4px; text-align: center; font-weight: 800; color: #000000;">Equipment Name</th>
                <th style="border-right: 1px solid #000; padding: 1.5px 2px; text-align: center; width: 30px; font-weight: 800; color: #000000;">Qty.</th>
                <th style="padding: 1.5px 2px; text-align: center; width: 44px; font-weight: 800; color: #000000;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${col2Tools.map((t, idx) => `
                <tr style="border-bottom: 1px dashed #000; height: 13px; color: #000000;">
                  <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-family: monospace; font-weight: 700; color: #000000;">${String(splitCount + idx + 1).padStart(2, '0')}</td>
                  <td style="border-right: 1px solid #000; padding: 1px 4px; font-weight: 600; color: #000000;">${t.itemName || t.name}</td>
                  <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-weight: 700; color: #000000;">${t.quantity || t.qty || 1}</td>
                  <td style="padding: 1px 2px; text-align: center; font-size: 7.5px; color: #000000;">${t.remarks || ''}</td>
                </tr>
              `).join('')}
              ${card2BlankRows}
            </tbody>
          </table>

          <!-- Bottom Section: Extra Accessories (Left ~58%) + STAMP & SIGNATURE (Right ~42%) -->
          <div style="display: flex; flex-direction: row; gap: 8px; align-items: stretch; margin-top: 5px;">
            <!-- Left Column: Extra Accessories (if any) : -->
            <div style="flex: 1.35;">
              <div style="font-weight: 800; font-size: 8.5px; margin-bottom: 2px; color: #000000;">Extra Accessories (if any) :</div>
              <table style="width: 100%; border-collapse: collapse; font-size: ${pScale.accTable}; border: 1.5px solid #000; color: #000000;">
                <thead>
                  <tr style="background: #ffffff; border-bottom: 1.5px solid #000; color: #000000;">
                    <th style="border-right: 1px solid #000; padding: 1.5px 3px; text-align: center; font-weight: 800; color: #000000;">Accessories</th>
                    <th style="border-right: 1px solid #000; padding: 1.5px 2px; text-align: center; width: 38px; font-weight: 800; color: #000000;">Qty.</th>
                    <th style="padding: 1.5px 2px; text-align: center; width: 34px; font-weight: 800; color: #000000;">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayAccs.map((a) => `
                    <tr style="border-bottom: 1px dashed #000; height: 11.5px; color: #000000;">
                      <td style="border-right: 1px solid #000; padding: 1px 3px; font-weight: 600; color: #000000;">${a.itemName || a.name}</td>
                      <td style="border-right: 1px solid #000; padding: 1px 2px; text-align: center; font-weight: 600; color: #000000;">${a.quantity || a.qty || '01 Pcs'}</td>
                      <td style="padding: 1px 2px; text-align: center; font-family: monospace; font-size: 7px; color: #000000;">${a.remarks || ''}</td>
                    </tr>
                  `).join('')}
                  <tr style="border-bottom: 1px dashed #000; height: 11px; color: #000000;">
                    <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
                    <td style="border-right: 1px solid #000; color: #000000;">&nbsp;</td>
                    <td style="color: #000000;">&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Right Column: STAMP & SIGNATURE Box (Matching Screenshot exactly) -->
            <div style="flex: 0.95; border: 1.5px solid #cbd5e1; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; box-sizing: border-box; background: #ffffff;">
              <div style="font-size: 13px; font-weight: 800; color: #cbd5e1; letter-spacing: 1.5px; text-align: center; line-height: 1.55; font-family: 'Inter', Arial, sans-serif; user-select: none;">
                STAMP<br>
                &amp;<br>
                SIGNATURE
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;
}

// =========================================================================
// SCREEN 4: FIND & SELECT (SEARCH & HISTORICAL TRACKING)
// =========================================================================
function renderScreen4FindAndSelect() {
  const allStaff = employeeService.getAllEmployees() || [];
  const allocations = toolService.getAllocations(findFilters);
  const recentRegistrations = toolService.getRecentRegistrations(0);

  const totalAllocations = allocations.length;
  const uniqueMechanics = new Set(allocations.map(a => a.userId)).size;
  const replacedCount = allocations.filter(a => a.changeStatus === 'REPLACED').length;
  const returnedCount = allocations.filter(a => a.changeStatus === 'RETURNED' || a.changeStatus === 'LOST').length;

  return `
    <div class="screen-find-select" style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Top Title -->
      <div style="background: linear-gradient(90deg, #7c3aed, #a855f7); color: #fff; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span>Find &amp; Select — Historical Tracking &amp; Replacement Audit</span>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-open-user-history-find" style="background: #0284c7; color: #fff; border: 1px solid #0369a1; padding: 4px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="View Mechanic Tool Change Frequencies and Audit History">
            <span>📜</span> Tool Change History &amp; Frequency Logs
          </button>
          <button id="btn-open-excel-import-find" style="background: #16a34a; color: #fff; border: 1px solid #15803d; padding: 4px 14px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Import previous tool allocations or master catalog from Excel">
            <span>📥</span> Import Previous Excel Data
          </button>
          <button id="btn-export-find-excel" style="background: #0f172a; color: #fff; border: 1px solid #334155; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
            📤 Export Filtered Excel (.xlsx)
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        <div style="background: #1e293b; border-left: 4px solid #38bdf8; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Total Items Assigned</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${totalAllocations}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #22c55e; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Mechanics Holding Tools</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${uniqueMechanics}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #eab308; border-radius: 6px; padding: 12px 14px; cursor: pointer;" id="card-click-hist-replaced" title="Click to view tool change history">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Replaced / Changed Tools</div>
            <span style="font-size: 10px; background: #ca8a04; color: #000; padding: 1px 5px; border-radius: 3px; font-weight: 800;">View 📜</span>
          </div>
          <div style="font-size: 24px; font-weight: 900; color: #fde047; margin-top: 2px;">${replacedCount}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Lost / Missing Tools</div>
          <div style="font-size: 24px; font-weight: 900; color: #fca5a5; margin-top: 2px;">${returnedCount}</div>
        </div>
      </div>

      <!-- Search & Filter Controls -->
      <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; align-items: end;">
          
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Global Search:</label>
            <input type="text" id="find-search-input" value="${findFilters.search || ''}" placeholder="Name, ID, Reg No, Tool..." 
              style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px; font-size: 12.5px;" />
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Filter by Reg No:</label>
            <select id="find-select-reg" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 8px; font-size: 12.5px;">
              <option value="ALL">All Registrations</option>
              ${recentRegistrations.map(r => `<option value="${r.regNo}" ${findFilters.regNo === r.regNo ? 'selected' : ''}>#${r.regNo} - ${r.userName}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Filter by Employee:</label>
            <select id="find-select-emp" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 8px; font-size: 12.5px;">
              <option value="ALL">All Mechanics (Active & Inactive)</option>
              ${allStaff.map(s => `<option value="${s.cardNumber || s.id}" ${findFilters.userId === (s.cardNumber || s.id) ? 'selected' : ''}>${s.cardNumber} - ${s.name} (${s.status})</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Item Type:</label>
            <select id="find-select-type" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 8px; font-size: 12.5px;">
              <option value="ALL" ${findFilters.itemType === 'ALL' ? 'selected' : ''}>All Item Types</option>
              <option value="TOOL" ${findFilters.itemType === 'TOOL' ? 'selected' : ''}>Tools Only</option>
              <option value="ACCESSORY" ${findFilters.itemType === 'ACCESSORY' ? 'selected' : ''}>Accessories Only</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Change Status:</label>
            <select id="find-select-status" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 8px; font-size: 12.5px;">
              <option value="ALL" ${findFilters.changeStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
              <option value="NEW_ISSUE" ${findFilters.changeStatus === 'NEW_ISSUE' ? 'selected' : ''}>New Issue</option>
              <option value="REPLACED" ${findFilters.changeStatus === 'REPLACED' ? 'selected' : ''}>Replaced (Changed)</option>
              <option value="LOST" ${findFilters.changeStatus === 'LOST' ? 'selected' : ''}>Lost (Harao)</option>
            </select>
          </div>

          <div>
            <button id="btn-reset-find-filters" style="width: 100%; background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 6px 12px; border-radius: 4px; font-size: 12.5px; font-weight: 600; cursor: pointer;">
              Reset Filters
            </button>
          </div>

        </div>
      </div>

      <!-- Historical Records Table -->
      <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 0;">
        
        <!-- Admin Bulk Selection Action Bar -->
        ${findSelectedIds.size > 0 ? `
          <div style="background: #0f172a; border-bottom: 2px solid #ef4444; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.4);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #dc2626; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 11px; letter-spacing: 0.5px;">🔒 ADMIN CONTROL</span>
              <span style="font-size: 13.5px; font-weight: 800; color: #f1f5f9;">${findSelectedIds.size} allocation record${findSelectedIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button id="btn-admin-bulk-delete-find" style="background: #dc2626; color: #fff; border: 1px solid #b91c1c; padding: 6px 16px; border-radius: 5px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <span>🗑️</span> Delete Selected (${findSelectedIds.size})
              </button>
              <button id="btn-admin-bulk-replace-find" style="background: #d97706; color: #fff; border: 1px solid #b45309; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
                🔄 Mark Replaced
              </button>
              <button id="btn-admin-bulk-return-find" style="background: #475569; color: #fff; border: 1px solid #334155; padding: 6px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
                ↩️ Mark Returned
              </button>
              <button id="btn-clear-selection-find" style="background: #1e293b; color: #cbd5e1; border: 1px solid #475569; padding: 6px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                ✕ Deselect All
              </button>
            </div>
          </div>
        ` : ''}

        <div id="find-table-scroll-container" style="overflow-x: auto; max-height: calc(100vh - 310px); min-height: 280px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #0ea5e9 #1e293b;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12.5px;">
            <thead style="position: sticky; top: 0; z-index: 25;">
              <tr style="background: #0f172a; color: #cbd5e1;">
                <th style="position: sticky; top: 0; left: 0; z-index: 35; background: #0f172a; padding: 10px 8px; text-align: center; width: 40px; min-width: 40px; border-bottom: 2px solid #334155; box-shadow: 2px 2px 4px rgba(0,0,0,0.4);">
                  <input type="checkbox" id="check-all-find" ${allocations.length > 0 && allocations.every(a => findSelectedIds.has(a.id)) ? 'checked' : ''} title="Select All Filtered Rows" style="cursor: pointer;" />
                </th>
                <th style="position: sticky; top: 0; left: 40px; z-index: 35; background: #0f172a; padding: 10px 6px; text-align: center; width: 40px; min-width: 40px; border-bottom: 2px solid #334155; box-shadow: 2px 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">#</th>
                <th style="position: sticky; top: 0; left: 80px; z-index: 35; background: #0f172a; padding: 10px 8px; text-align: center; width: 85px; min-width: 85px; border-bottom: 2px solid #334155; border-right: 2px solid #38bdf8; box-shadow: 4px 2px 8px rgba(0,0,0,0.5); white-space: nowrap;">Reg No</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: center; width: 105px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Issue Date</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: left; width: 125px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">ID Number</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: left; width: 150px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Mechanic Name</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: left; width: 140px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Working Area</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 10px; text-align: left; min-width: 175px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Equipment / Accessory Name</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: center; width: 65px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Qty</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 10px; text-align: center; width: 150px; min-width: 140px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Status &amp; Frequency</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: center; width: 95px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Change Date</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: left; width: 100px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Remarks</th>
                <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 10px 8px; text-align: center; width: 175px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4); white-space: nowrap;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${allocations.length === 0 ? `
                <tr><td colspan="13" style="padding: 30px; text-align: center; color: #94a3b8;">No matching tool allocation records found.</td></tr>
              ` : allocations.map((a, idx) => {
    const repCount = a.replacementCount || toolService.getToolReplacementCount(a.userId, a.itemCode);
    const isSelected = findSelectedIds.has(a.id);
    const cellBg = isSelected ? '#3f1c24' : idx % 2 === 0 ? '#1b2537' : '#0f172a';
    return `
                  <tr style="border-bottom: 1px solid #334155; background: ${isSelected ? 'rgba(239, 68, 68, 0.12)' : idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                    <td style="position: sticky; left: 0; z-index: 15; background: ${cellBg}; padding: 8px 10px; text-align: center; width: 40px; min-width: 40px; box-shadow: 2px 0 4px rgba(0,0,0,0.3);">
                      <input type="checkbox" class="check-find-item" data-id="${a.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer;" />
                    </td>
                    <td style="position: sticky; left: 40px; z-index: 15; background: ${cellBg}; padding: 8px 6px; text-align: center; color: #64748b; white-space: nowrap; width: 40px; min-width: 40px; box-shadow: 2px 0 4px rgba(0,0,0,0.3);">${idx + 1}</td>
                    <td style="position: sticky; left: 80px; z-index: 15; background: ${cellBg}; padding: 8px 8px; text-align: center; white-space: nowrap; width: 85px; min-width: 85px; border-right: 2px solid #38bdf8; box-shadow: 4px 0 8px rgba(0,0,0,0.5);">
                      <div style="font-family: monospace; font-weight: 800; color: #f59e0b;">#${a.regNo}</div>
                      ${a.requisitionNo ? `<div style="font-size: 10px; color: #38bdf8; font-family: monospace; font-weight: 700; margin-top: 1px;" title="ERP Requisition Number">#${a.requisitionNo}</div>` : ''}
                    </td>
                    <td style="padding: 8px 8px; text-align: center; font-family: monospace; color: #cbd5e1; font-weight: 700; white-space: nowrap;">
                      ${toolService.formatDateDMY(a.issueDate)}
                    </td>
                    <td style="padding: 8px 8px; font-family: monospace; font-weight: 700; color: #38bdf8; white-space: nowrap;">
                      <span class="btn-view-user-hist-id" data-user="${a.userId}" style="cursor: pointer; text-decoration: underline;" title="Click to view full tool history">${a.userId}</span>
                    </td>
                    <td style="padding: 8px 8px; font-weight: 700; color: #f1f5f9; white-space: nowrap;">
                      <span class="btn-view-user-hist-id" data-user="${a.userId}" style="cursor: pointer;" title="Click to view full tool history">${a.userName}</span>
                    </td>
                    <td style="padding: 8px 8px; color: #cbd5e1; white-space: nowrap;">
                      ${a.workingArea}
                    </td>
                    <td style="padding: 8px 10px; font-weight: 600; color: #38bdf8; white-space: nowrap;">
                      ${a.itemType === 'TOOL' ? '🔧 ' : '📦 '}${a.itemCode ? `${a.itemCode}. ` : ''}${a.itemName}
                    </td>
                    <td style="padding: 8px 8px; text-align: center; font-weight: 800; color: #22c55e; white-space: nowrap;">
                      ${a.quantity}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; white-space: nowrap;">
                      ${a.changeStatus === 'REPLACED' ? `
                        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 800; ${repCount >= 3 ? 'background: rgba(239, 68, 68, 0.18); color: #fca5a5; border: 1px solid #ef4444; box-shadow: 0 1px 4px rgba(239,68,68,0.3);' : 'background: rgba(234, 179, 8, 0.18); color: #fde047; border: 1px solid #ca8a04; box-shadow: 0 1px 4px rgba(234,179,8,0.25);'}">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${repCount >= 3 ? '#ef4444' : '#eab308'}; display: inline-block;"></span>
                          Replaced ${repCount > 0 ? `(${repCount}x)` : ''}
                        </span>
                      ` : (a.changeStatus === 'RETURNED') ? `
                        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #0284c7; display: inline-block;"></span>
                          Returned
                        </span>
                      ` : (a.changeStatus === 'LOST') ? `
                        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
                          Lost / Missing
                        </span>
                      ` : `
                        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; padding: 3px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 1px 4px rgba(16,185,129,0.15);">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; display: inline-block;"></span>
                          New Issue
                        </span>
                      `}
                    </td>
                    <td style="padding: 8px 8px; text-align: center; font-family: monospace; color: #94a3b8; white-space: nowrap;">
                      ${a.changeDate || '-'}
                    </td>
                    <td style="padding: 8px 8px; color: #cbd5e1; font-size: 11.5px; white-space: nowrap;">
                      ${a.remarks || '-'}
                    </td>
                    <td style="padding: 8px 8px; text-align: center; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px; justify-content: center; align-items: center; white-space: nowrap;">
                        <button class="btn-log-replacement" data-id="${a.id}" title="Log Tool Replacement & Record History" style="background: #eab308; color: #000; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                          <span>🔄</span> Replace
                        </button>
                        <button class="btn-view-user-hist-row" data-user="${a.userId}" data-code="${a.itemCode}" title="View Mechanic Replacement History" style="background: #0284c7; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
                          <span>📜</span> History
                        </button>
                        <button class="btn-log-return" data-id="${a.id}" title="Log Return to Store" style="background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 4px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center;" title="Return item to central store">
                          📥
                        </button>
                        <button class="btn-del-alloc-find" data-id="${a.id}" title="Admin Delete Record" style="background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.3); padding: 4px 6px; border-radius: 4px; font-size: 11px; cursor: pointer;">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>

        <!-- STICKY HORIZONTAL SCROLLBAR CONTROLLER (PERMANENTLY PINNED AT BOTTOM OF SCREEN) -->
        <div id="find-sticky-hscroll-wrapper" style="position: sticky; bottom: 0; z-index: 40; background: #090d16; border-top: 2px solid #0284c7; padding: 7px 14px; display: flex; align-items: center; gap: 10px; box-shadow: 0 -4px 16px rgba(0,0,0,0.75); border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
          <!-- Quick Scroll Left -->
          <button type="button" id="btn-hscroll-find-left" title="Scroll Left (View ID & Mechanic)" style="background: #1e293b; color: #38bdf8; border: 1px solid #475569; width: 32px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; font-weight: 800; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
            ◀
          </button>

          <!-- Label -->
          <span style="font-size: 11px; font-weight: 800; color: #38bdf8; white-space: nowrap; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <span>↔</span> Fixed Scroll:
          </span>

          <!-- Sticky Synchronized Scroll Track -->
          <div id="find-sticky-hscroll-bar" style="flex: 1; overflow-x: auto; overflow-y: hidden; height: 16px; scrollbar-width: thin; scrollbar-color: #0ea5e9 #1e293b; background: #1e293b; border-radius: 8px; border: 1px solid #334155;">
            <div id="find-sticky-hscroll-dummy" style="height: 1px; width: 1450px;"></div>
          </div>

          <!-- Quick Scroll Right -->
          <button type="button" id="btn-hscroll-find-right" title="Scroll Right (View Status & Actions)" style="background: #1e293b; color: #38bdf8; border: 1px solid #475569; width: 32px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; font-weight: 800; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
            ▶
          </button>

          <!-- Quick Jump Buttons -->
          <button type="button" id="btn-hscroll-find-start" title="Jump to First Column" style="background: #0284c7; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; flex-shrink: 0; white-space: nowrap;">
            ⇤ First Col
          </button>
          <button type="button" id="btn-hscroll-find-end" title="Jump to Actions Column" style="background: #059669; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; flex-shrink: 0; white-space: nowrap;">
            Actions ⇥
          </button>
        </div>
      </div>

    </div>
  `;
}

// =========================================================================
// SCREEN 5: ACCESSORIES PAGE (MASTER CATALOG STOCK MANAGEMENT)
// =========================================================================
function renderScreen5AccessoriesPage() {
  const masterTools = toolService.getAllMasterTools(accessoriesTabCategory === 'TOOLS' ? 'TOOLS' : 'ALL', accessorySearch);
  const masterAccs = toolService.getAllMasterAccessories(accessorySearch);

  let combinedList = [];
  if (accessoriesTabCategory === 'ALL' || accessoriesTabCategory === 'TOOLS') {
    combinedList = combinedList.concat(masterTools.map(t => ({ ...t, itemType: 'TOOL' })));
  }
  if (accessoriesTabCategory === 'ALL' || accessoriesTabCategory === 'ACCESSORIES') {
    combinedList = combinedList.concat(masterAccs.map(a => ({ ...a, itemType: 'ACCESSORY' })));
  }

  const totalToolsStock = masterTools.reduce((s, t) => s + (t.totalStock || 0), 0);
  const totalAccsStock = masterAccs.reduce((s, a) => s + (Number(a.totalStock) || 0), 0);
  const lowStockCount = masterTools.filter(t => t.totalStock <= (t.minStock || 10)).length;

  return `
    <div class="screen-accessories-page" style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Top Title & Action Bar -->
      <div style="background: linear-gradient(90deg, #db2777, #f43f5e); color: #fff; padding: 8px 14px; border-radius: 6px; font-weight: 800; font-size: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span>Accessories &amp; Spare Parts Master Management:</span>
          ${masterSelectedIds.size > 0 ? `
            <span style="font-size: 11.5px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.4); padding: 2px 9px; border-radius: 12px; color: #fde047; font-weight: 800;">
              ✓ ${masterSelectedIds.size} Selected
            </span>
          ` : ''}
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          ${masterSelectedIds.size > 0 ? `
            <button id="btn-bulk-delete-master" style="background: #991b1b; color: #fff; border: 1.5px solid #f87171; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);" title="Delete selected items from master catalog (Admin Controlled)">
              <span>🗑️</span> Bulk Delete (${masterSelectedIds.size})
            </button>
            <button id="btn-clear-master-selection" style="background: rgba(0,0,0,0.3); color: #cbd5e1; border: 1px solid #64748b; padding: 4px 10px; border-radius: 4px; font-size: 11.5px; cursor: pointer;" title="Clear selected checkboxes">
              Deselect All
            </button>
          ` : ''}
          <button id="btn-open-excel-import-acc" style="background: #16a34a; color: #fff; border: 1px solid #15803d; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Import tools & accessories catalog from Excel">
            <span>📥</span> Import Catalog Excel
          </button>
          <button id="btn-add-master-item-modal" style="background: #0f172a; color: #fff; border: 1px solid #334155; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
            ➕ Add New Master Item
          </button>
          <button id="btn-export-master-excel" style="background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; cursor: pointer;">
            📤 Export Master Catalog (.xlsx)
          </button>
        </div>
      </div>

      <!-- Info Header Banner explaining fixed printout behavior -->
      <div style="background: rgba(236, 72, 153, 0.12); border: 1.5px solid #ec4899; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">📌</span>
          <div>
            <div style="font-weight: 800; font-size: 13px; color: #f472b6;">Fixed Accessories Master Data &amp; Spare Parts Catalog</div>
            <div style="font-size: 11.5px; color: #cbd5e1;">These master accessories (Super Glue, Tweezer, Oil Pot, etc.) remain fixed on the left column of all mechanic printouts. Tool allocation per mechanic is managed separately in the Tools Add Form.</div>
          </div>
        </div>
      </div>

      <!-- Inventory KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        <div style="background: #1e293b; border-left: 4px solid #ec4899; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Tools Catalog Items</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${masterTools.length} Varieties</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #38bdf8; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Total Tools Stock (Pcs)</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${totalToolsStock}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #10b981; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Accessories Stock Units</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${totalAccsStock}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid ${lowStockCount > 0 ? '#ef4444' : '#22c55e'}; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Low Stock Warning</div>
          <div style="font-size: 24px; font-weight: 900; color: ${lowStockCount > 0 ? '#fca5a5' : '#86efac'}; margin-top: 2px;">${lowStockCount} Items</div>
        </div>
      </div>

      <!-- Filter Tabs & Search -->
      <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
        <div style="display: flex; gap: 6px;">
          <button class="btn-acc-cat-filter ${accessoriesTabCategory === 'ALL' ? 'active' : ''}" data-cat="ALL" style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid #475569; background: ${accessoriesTabCategory === 'ALL' ? '#ec4899; color: #fff;' : '#1e293b; color: #cbd5e1;'}">
            All Inventory
          </button>
          <button class="btn-acc-cat-filter ${accessoriesTabCategory === 'TOOLS' ? 'active' : ''}" data-cat="TOOLS" style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid #475569; background: ${accessoriesTabCategory === 'TOOLS' ? '#0ea5e9; color: #fff;' : '#1e293b; color: #cbd5e1;'}">
            🔧 Tools Master
          </button>
          <button class="btn-acc-cat-filter ${accessoriesTabCategory === 'ACCESSORIES' ? 'active' : ''}" data-cat="ACCESSORIES" style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid #475569; background: ${accessoriesTabCategory === 'ACCESSORIES' ? '#8b5cf6; color: #fff;' : '#1e293b; color: #cbd5e1;'}">
            📦 Extra Accessories
          </button>
        </div>

        <div style="width: 280px;">
          <input type="text" id="acc-search-input" value="${accessorySearch || ''}" placeholder="Search tools or accessories..." 
            style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 6px; padding: 6px 12px; font-size: 12.5px;" />
        </div>
      </div>

      <!-- Master Inventory Table -->
      <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
        <div style="overflow-x: auto; max-height: 480px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #0f172a; color: #cbd5e1; border-bottom: 1.5px solid #334155;">
                <th style="padding: 10px; text-align: center; width: 40px;">
                  <input type="checkbox" id="chk-master-select-all" ${combinedList.length > 0 && combinedList.every(i => masterSelectedIds.has(i.id)) ? 'checked' : ''} style="cursor: pointer; transform: scale(1.1);" title="Select All Items" />
                </th>
                <th style="padding: 10px; text-align: center; width: 45px;">Sl</th>
                <th style="padding: 10px; text-align: center; width: 75px;">Code</th>
                <th style="padding: 10px; text-align: left;">Item / Tool Name</th>
                <th style="padding: 10px; text-align: center; width: 105px;">Category</th>
                <th style="padding: 10px; text-align: center; width: 95px;">Current Stock</th>
                <th style="padding: 10px; text-align: center; width: 65px;">Unit</th>
                <th style="padding: 10px; text-align: center; width: 85px;">Min Stock</th>
                <th style="padding: 10px; text-align: center; width: 90px;">Stock Status</th>
                <th style="padding: 10px; text-align: left; width: 150px;">Remarks</th>
                <th style="padding: 10px; text-align: center; width: 145px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${combinedList.length === 0 ? `
                <tr>
                  <td colspan="11" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
                    No master items found matching current filters.
                  </td>
                </tr>
              ` : combinedList.map((item, idx) => {
    const isLow = item.totalStock <= (item.minStock || 10);
    const isChecked = masterSelectedIds.has(item.id);
    return `
                  <tr style="border-bottom: 1px solid #334155; background: ${isChecked ? 'rgba(236, 72, 153, 0.18)' : idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                    <td style="padding: 8px 10px; text-align: center;">
                      <input type="checkbox" class="chk-master-row" data-id="${item.id}" data-type="${item.itemType}" data-name="${item.name}" data-code="${item.code}" ${isChecked ? 'checked' : ''} style="cursor: pointer; transform: scale(1.1);" />
                    </td>
                    <td style="padding: 8px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #f59e0b;">
                      ${item.code}
                    </td>
                    <td style="padding: 8px 10px; font-weight: 700; color: #f1f5f9;">
                      ${item.itemType === 'TOOL' ? '🔧 ' : '📦 '} ${item.name}
                    </td>
                    <td style="padding: 8px 10px; text-align: center;">
                      <span style="font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: ${item.itemType === 'TOOL' ? 'rgba(14, 165, 233, 0.15); color: #38bdf8;' : 'rgba(236, 72, 153, 0.15); color: #f472b6;'}">
                        ${item.itemType}
                      </span>
                    </td>
                    <td style="padding: 8px 10px; text-align: center; font-weight: 800; font-size: 13px; color: ${isLow ? '#f87171' : '#4ade80'};">
                      ${item.totalStock}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; color: #cbd5e1;">
                      ${item.unit || 'Pcs'}
                    </td>
                    <td style="padding: 8px 10px; text-align: center; color: #94a3b8; font-family: monospace;">
                      ${item.minStock || 10}
                    </td>
                    <td style="padding: 8px 10px; text-align: center;">
                      <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: ${isLow ? 'rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444;' : 'rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e;'}">
                        ${isLow ? '⚠️ LOW' : 'NORMAL'}
                      </span>
                    </td>
                    <td style="padding: 8px 10px; color: #94a3b8;">
                      ${item.remarks || item.defaultRemarks || '-'}
                    </td>
                    <td style="padding: 8px 10px; text-align: center;">
                      <div style="display: flex; gap: 5px; justify-content: center; align-items: center;">
                        <button class="btn-edit-master-stock" data-type="${item.itemType}" data-id="${item.id}" data-name="${item.name}" data-stock="${item.totalStock}" title="Update stock (Admin Controlled)" style="background: #2563eb; color: #fff; border: 1px solid #1d4ed8; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 3px;">
                          ✏️ Stock
                        </button>
                        <button class="btn-delete-master-item" data-type="${item.itemType}" data-id="${item.id}" data-name="${item.name}" data-code="${item.code}" title="Delete master item (Admin Controlled)" style="background: #dc2626; color: #fff; border: 1px solid #b91c1c; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 3px;">
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// =========================================================================
// SCREEN 6: DATABASE PAGE (RAW TABLES & DIRECT EXCEL IMPORT CENTER)
// =========================================================================
function renderScreen6DatabasePage() {
  const allAllocations = toolService.getAllocations() || [];
  const masterTools = toolService.getAllMasterTools('ALL', '') || [];
  const masterAccs = toolService.getAllMasterAccessories('') || [];
  const allToolChangeHistory = toolService.getToolChangeHistory() || [];

  const totalAllocations = allAllocations.length;
  const uniqueMechanics = new Set(allAllocations.map(a => a.userId)).size;
  const totalMasterTools = masterTools.length;
  const totalMasterAccs = masterAccs.length;

  // Filter current active table records based on search query
  let filteredRecords = [];
  const q = databaseSearch.toLowerCase().trim();

  if (databaseActiveTable === 'TOOL_ALLOCATIONS') {
    filteredRecords = allAllocations.filter(a => {
      if (!q) return true;
      return (
        String(a.regNo || '').toLowerCase().includes(q) ||
        String(a.userId || '').toLowerCase().includes(q) ||
        String(a.userName || '').toLowerCase().includes(q) ||
        String(a.itemName || '').toLowerCase().includes(q) ||
        String(a.workingArea || '').toLowerCase().includes(q) ||
        String(a.changeStatus || '').toLowerCase().includes(q)
      );
    });
  } else if (databaseActiveTable === 'TOOL_CHANGE_HISTORY') {
    filteredRecords = allToolChangeHistory.filter(h => {
      if (!q) return true;
      return (
        String(h.regNo || '').toLowerCase().includes(q) ||
        String(h.userId || '').toLowerCase().includes(q) ||
        String(h.userName || '').toLowerCase().includes(q) ||
        String(h.itemName || '').toLowerCase().includes(q) ||
        String(h.itemCode || '').toLowerCase().includes(q) ||
        String(h.reason || '').toLowerCase().includes(q) ||
        String(h.remarks || '').toLowerCase().includes(q) ||
        String(h.changeDate || '').toLowerCase().includes(q)
      );
    });
  } else if (databaseActiveTable === 'TOOLS_MASTER') {
    filteredRecords = masterTools.filter(t => {
      if (!q) return true;
      return (
        String(t.code || '').toLowerCase().includes(q) ||
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.category || '').toLowerCase().includes(q)
      );
    });
  } else if (databaseActiveTable === 'ACCESSORIES_MASTER') {
    filteredRecords = masterAccs.filter(acc => {
      if (!q) return true;
      return (
        String(acc.code || '').toLowerCase().includes(q) ||
        String(acc.name || '').toLowerCase().includes(q) ||
        String(acc.defaultQty || '').toLowerCase().includes(q)
      );
    });
  }

  return `
    <div class="screen-database-page" style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Top Title Bar -->
      <div style="background: linear-gradient(90deg, #059669, #10b981); color: #fff; padding: 10px 16px; border-radius: 8px; font-weight: 800; font-size: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🗄️</span>
          <div>
            <div>Database Management &amp; Excel Import Center</div>
            <div style="font-size: 11px; font-weight: 500; opacity: 0.9; margin-top: 1px;">Manage raw database tables, bulk import historical Excel files, search registrations, and backup system records.</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="btn-db-open-modal-center" style="background: #0f172a; color: #38bdf8; border: 1px solid #334155; padding: 5px 14px; border-radius: 5px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <span>📥</span> Open Full Import Modal
          </button>
          <button id="btn-db-export-active-table" style="background: #0f172a; color: #fff; border: 1px solid #334155; padding: 5px 14px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
            📤 Export Table to Excel (.xlsx)
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        <div style="background: #1e293b; border-left: 4px solid #38bdf8; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Total Stored Allocations</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${totalAllocations}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #22c55e; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Registered Mechanics</div>
          <div style="font-size: 24px; font-weight: 900; color: #f1f5f9; margin-top: 2px;">${uniqueMechanics}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #eab308; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Master Tools in DB</div>
          <div style="font-size: 24px; font-weight: 900; color: #fde047; margin-top: 2px;">${totalMasterTools}</div>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #ec4899; border-radius: 6px; padding: 12px 14px;">
          <div style="font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Master Accessories in DB</div>
          <div style="font-size: 24px; font-weight: 900; color: #f472b6; margin-top: 2px;">${totalMasterAccs}</div>
        </div>
      </div>

      <!-- SECTION A: DIRECT IN-PAGE EXCEL IMPORT CARD -->
      <div style="background: #1e293b; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">📥</span>
            <span style="font-size: 14px; font-weight: 800; color: #86efac;">Direct Excel File Data Input &amp; Bulk Import</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="btn-db-download-template" style="background: #0284c7; color: #fff; border: 1px solid #0369a1; padding: 4px 12px; border-radius: 4px; font-size: 11.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <span>📥</span> Download Sample Excel Template (.xlsx)
            </button>
          </div>
        </div>

        <!-- Target Data Type Tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          <button class="btn-db-imp-target ${databaseDirectImportType === 'ALLOCATIONS' ? 'active' : ''}" data-target="ALLOCATIONS"
            style="background: ${databaseDirectImportType === 'ALLOCATIONS' ? '#2563eb' : '#0f172a'}; color: #fff; border: 1px solid ${databaseDirectImportType === 'ALLOCATIONS' ? '#3b82f6' : '#334155'}; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
            🔧 1. Previous Tool Allocations (Mechanic Registrations)
          </button>
          <button class="btn-db-imp-target ${databaseDirectImportType === 'TOOLS' ? 'active' : ''}" data-target="TOOLS"
            style="background: ${databaseDirectImportType === 'TOOLS' ? '#2563eb' : '#0f172a'}; color: #fff; border: 1px solid ${databaseDirectImportType === 'TOOLS' ? '#3b82f6' : '#334155'}; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
            🛠️ 2. Master Tools Catalog (Inventory &amp; Stock)
          </button>
          <button class="btn-db-imp-target ${databaseDirectImportType === 'ACCESSORIES' ? 'active' : ''}" data-target="ACCESSORIES"
            style="background: ${databaseDirectImportType === 'ACCESSORIES' ? '#2563eb' : '#0f172a'}; color: #fff; border: 1px solid ${databaseDirectImportType === 'ACCESSORIES' ? '#3b82f6' : '#334155'}; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
            📦 3. Master Accessories Catalog (Catalog &amp; Stock)
          </button>
        </div>

        <!-- In-Page Dropzone -->
        <div id="db-drop-zone" style="border: 2px dashed ${databaseDirectFileName ? '#22c55e' : '#475569'}; border-radius: 6px; padding: 18px; text-align: center; background: ${databaseDirectFileName ? 'rgba(34, 197, 94, 0.05)' : '#0f172a'}; cursor: pointer; transition: all 0.2s;">
          <input type="file" id="db-file-input" accept=".xlsx, .xls, .csv" style="display: none;" />
          <div style="font-size: 28px; margin-bottom: 4px;">${databaseDirectFileName ? '📊' : '📁'}</div>
          <div style="font-size: 13.5px; font-weight: 800; color: #f1f5f9;">
            ${databaseDirectFileName ? `Selected File: <span style="color: #22c55e;">${databaseDirectFileName}</span> (${databaseDirectParsedRows.length} Rows Detected)` : 'Click here or Drag &amp; Drop your Excel (.xlsx, .xls, .csv) file to import'}
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">
            Target Table: <strong>${databaseDirectImportType === 'ALLOCATIONS' ? 'TOOL_ALLOCATIONS' : databaseDirectImportType === 'TOOLS' ? 'TOOLS_MASTER' : 'ACCESSORIES_MASTER'}</strong>
          </div>
        </div>

        <!-- Live Preview If File Parsed -->
        ${databaseDirectParsedRows.length > 0 ? `
          <div style="margin-top: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #38bdf8;">Data Preview (First ${Math.min(databaseDirectParsedRows.length, 8)} of ${databaseDirectParsedRows.length} rows):</span>
              <button id="btn-db-save-parsed-rows" style="background: #16a34a; color: #fff; border: none; padding: 6px 18px; border-radius: 5px; font-weight: 900; font-size: 12.5px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                <span>💾</span> Import ${databaseDirectParsedRows.length} Rows into Database Now
              </button>
            </div>
            <div style="max-height: 160px; overflow: auto; border: 1px solid #1e293b; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                  <tr style="background: #1e293b; color: #94a3b8; text-align: left; border-bottom: 1px solid #334155;">
                    <th style="padding: 5px 6px; width: 30px; text-align: center;">#</th>
                    ${Object.keys(databaseDirectParsedRows[0] || {}).slice(0, 6).map(k => `
                      <th style="padding: 5px 6px;">${k}</th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${databaseDirectParsedRows.slice(0, 8).map((row, idx) => `
                    <tr style="border-bottom: 1px solid #1e293b;">
                      <td style="padding: 4px 6px; text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
                      ${Object.values(row).slice(0, 6).map(val => `
                        <td style="padding: 4px 6px; color: #e2e8f0;">${val !== undefined && val !== null ? String(val) : '-'}</td>
                      `).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- SECTION B: RAW DATABASE TABLES INSPECTOR & EXPLORER -->
      <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
        
        <!-- Table Explorer Header & Controls -->
        <div style="background: #0f172a; padding: 12px 16px; border-bottom: 1.5px solid #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          
          <!-- Table Switcher Buttons -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn-db-table-switch ${databaseActiveTable === 'TOOL_ALLOCATIONS' ? 'active' : ''}" data-table="TOOL_ALLOCATIONS"
              style="background: ${databaseActiveTable === 'TOOL_ALLOCATIONS' ? '#2563eb' : '#1e293b'}; color: #fff; border: 1px solid #475569; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
              📋 Tool Allocations (${allAllocations.length})
            </button>
            <button class="btn-db-table-switch ${databaseActiveTable === 'TOOL_CHANGE_HISTORY' ? 'active' : ''}" data-table="TOOL_CHANGE_HISTORY"
              style="background: ${databaseActiveTable === 'TOOL_CHANGE_HISTORY' ? '#7c3aed' : '#1e293b'}; color: #fff; border: 1px solid #475569; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
              📜 Tool Change History (${allToolChangeHistory.length})
            </button>
            <button class="btn-db-table-switch ${databaseActiveTable === 'TOOLS_MASTER' ? 'active' : ''}" data-table="TOOLS_MASTER"
              style="background: ${databaseActiveTable === 'TOOLS_MASTER' ? '#2563eb' : '#1e293b'}; color: #fff; border: 1px solid #475569; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
              🛠️ Master Tools (${masterTools.length})
            </button>
            <button class="btn-db-table-switch ${databaseActiveTable === 'ACCESSORIES_MASTER' ? 'active' : ''}" data-table="ACCESSORIES_MASTER"
              style="background: ${databaseActiveTable === 'ACCESSORIES_MASTER' ? '#2563eb' : '#1e293b'}; color: #fff; border: 1px solid #475569; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: 700; cursor: pointer;">
              📦 Master Accessories (${masterAccs.length})
            </button>
          </div>

          <!-- Table Search Input -->
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="db-search-input" value="${databaseSearch}" placeholder="Search in this table..."
              style="background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 10px; font-size: 12px; width: 220px;" />
            <button id="btn-db-clear-search" style="background: #334155; color: #e2e8f0; border: none; padding: 5px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              Clear
            </button>
          </div>

        </div>

        <!-- Table Content -->
        <div id="db-table-scroll-container" style="overflow-x: auto; max-height: calc(100vh - 310px); min-height: 280px; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #0ea5e9 #1e293b;">
          
          <!-- Admin Bulk Action Bar in Database Screen -->
          ${dbSelectedIds.size > 0 && databaseActiveTable === 'TOOL_ALLOCATIONS' ? `
            <div style="background: #0f172a; border-bottom: 2px solid #ef4444; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.4);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="background: #dc2626; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 900; font-size: 11px; letter-spacing: 0.5px;">🔒 ADMIN CONTROL</span>
                <span style="font-size: 13.5px; font-weight: 800; color: #f1f5f9;">${dbSelectedIds.size} database record${dbSelectedIds.size > 1 ? 's' : ''} selected</span>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <button id="btn-admin-bulk-delete-db" style="background: #dc2626; color: #fff; border: 1px solid #b91c1c; padding: 6px 16px; border-radius: 5px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                  <span>🗑️</span> Admin Delete Selected Records (${dbSelectedIds.size})
                </button>
                <button id="btn-clear-selection-db" style="background: #1e293b; color: #cbd5e1; border: 1px solid #475569; padding: 6px 10px; border-radius: 5px; font-size: 12px; cursor: pointer;">
                  ✕ Deselect All
                </button>
              </div>
            </div>
          ` : ''}

          ${databaseActiveTable === 'TOOL_ALLOCATIONS' ? `
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
              <thead style="position: sticky; top: 0; z-index: 25;">
                <tr style="background: #0f172a; color: #cbd5e1;">
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 40px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                    <input type="checkbox" id="check-all-db" ${filteredRecords.length > 0 && filteredRecords.every(a => dbSelectedIds.has(a.id)) ? 'checked' : ''} title="Select All Rows" style="cursor: pointer;" />
                  </th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 45px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">#</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 75px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Reg No</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Date</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; width: 120px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">ID Number</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Mechanic Name</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Working Area</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Tool / Item Name</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 60px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Qty</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Status</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Remarks</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 75px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Action</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.length === 0 ? `
                  <tr><td colspan="12" style="padding: 30px; text-align: center; color: #94a3b8;">No records match your search filter.</td></tr>
                ` : filteredRecords.map((a, idx) => `
                  <tr style="border-bottom: 1px solid #334155; background: ${dbSelectedIds.has(a.id) ? 'rgba(239, 68, 68, 0.12)' : idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                    <td style="padding: 7px 10px; text-align: center;">
                      <input type="checkbox" class="check-db-item" data-id="${a.id}" ${dbSelectedIds.has(a.id) ? 'checked' : ''} style="cursor: pointer;" />
                    </td>
                    <td style="padding: 7px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #f59e0b;">
                      <span class="btn-print-reg-slip" data-reg="${a.regNo}" style="cursor: pointer; text-decoration: underline;" title="Click to view & print registration #${a.regNo}">#${a.regNo}</span>
                    </td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; color: #cbd5e1; font-weight: 700;">${toolService.formatDateDMY(a.issueDate)}</td>
                    <td style="padding: 7px 10px; font-family: monospace; font-weight: 700; color: #38bdf8;">${a.userId}</td>
                    <td style="padding: 7px 10px; font-weight: 700; color: #f1f5f9;">${a.userName}</td>
                    <td style="padding: 7px 10px; color: #cbd5e1;">${a.workingArea}</td>
                    <td style="padding: 7px 10px; font-weight: 600; color: #38bdf8;">${a.itemCode ? `${a.itemCode}. ` : ''}${a.itemName}</td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #22c55e;">${a.quantity}</td>
                    <td style="padding: 7px 10px; text-align: center; white-space: nowrap;">
                      <span style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: 700; background: ${a.changeStatus === 'REPLACED' ? 'rgba(234, 179, 8, 0.15); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.35);' : (a.changeStatus === 'RETURNED' || a.changeStatus === 'LOST') ? 'rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35);' : 'rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);'}">
                        <span style="width: 5px; height: 5px; border-radius: 50%; background: ${a.changeStatus === 'REPLACED' ? '#eab308' : (a.changeStatus === 'RETURNED' || a.changeStatus === 'LOST') ? '#ef4444' : '#10b981'};"></span>
                        ${a.changeStatus === 'NEW_ISSUE' ? 'New Issue' : a.changeStatus === 'REPLACED' ? 'Replaced' : a.changeStatus === 'LOST' ? 'Lost' : a.changeStatus === 'RETURNED' ? 'Returned' : a.changeStatus}
                      </span>
                    </td>
                    <td style="padding: 7px 10px; color: #94a3b8;">${a.remarks || '-'}</td>
                    <td style="padding: 7px 10px; text-align: center; white-space: nowrap;">
                      <button class="btn-print-reg-slip" data-reg="${a.regNo}" style="background: #10b981; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-flex; align-items: center; gap: 3px;" title="Print Registration Slip #${a.regNo}">
                        <span>🖨️</span> Print
                      </button>
                      <button class="btn-db-del-alloc" data-id="${a.id}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Admin Delete Record">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : databaseActiveTable === 'TOOLS_MASTER' ? `
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
              <thead style="position: sticky; top: 0; z-index: 25;">
                <tr style="background: #0f172a; color: #cbd5e1;">
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 45px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">#</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 80px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Code</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Tool Name</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 100px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Category</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Total Stock</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 70px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Unit</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.map((t, idx) => `
                  <tr style="border-bottom: 1px solid #334155; background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                    <td style="padding: 7px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #38bdf8;">${t.code}</td>
                    <td style="padding: 7px 10px; font-weight: 700; color: #f1f5f9;">${t.name}</td>
                    <td style="padding: 7px 10px; text-align: center; color: #cbd5e1;">${t.category}</td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #22c55e;">${t.totalStock}</td>
                    <td style="padding: 7px 10px; text-align: center; color: #94a3b8;">${t.unit}</td>
                    <td style="padding: 7px 10px; color: #94a3b8;">${t.remarks || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : databaseActiveTable === 'TOOL_CHANGE_HISTORY' ? `
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
              <thead style="position: sticky; top: 0; z-index: 25;">
                <tr style="background: #0f172a; color: #cbd5e1;">
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 45px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">#</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 95px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Date</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 75px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Reg No</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; width: 120px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">ID Number</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; width: 140px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Mechanic Name</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; width: 120px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Working Area</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Equipment / Tool</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Event #</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Reason for Change</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; width: 120px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Old Condition</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Store Remarks</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 80px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Admin</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.length === 0 ? `
                  <tr><td colspan="12" style="padding: 30px; text-align: center; color: #94a3b8;">No tool change history records found.</td></tr>
                ` : filteredRecords.map((h, idx) => `
                  <tr style="border-bottom: 1px solid #334155; background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                    <td style="padding: 7px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-weight: 700; color: #4ade80;">${h.changeDate}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #f59e0b;">#${h.regNo}</td>
                    <td style="padding: 7px 10px; font-family: monospace; font-weight: 700; color: #38bdf8;">
                      <span class="btn-view-user-hist-id" data-user="${h.userId}" style="cursor: pointer; text-decoration: underline;">${h.userId}</span>
                    </td>
                    <td style="padding: 7px 10px; font-weight: 700; color: #f1f5f9;">
                      <span class="btn-view-user-hist-id" data-user="${h.userId}" style="cursor: pointer;">${h.userName}</span>
                    </td>
                    <td style="padding: 7px 10px; color: #cbd5e1;">${h.workingArea}</td>
                    <td style="padding: 7px 10px; font-weight: 600; color: #38bdf8;">
                      <span style="font-family: monospace;">[${h.itemCode}]</span> ${h.itemName}
                    </td>
                    <td style="padding: 7px 10px; text-align: center;">
                      <span style="background: #ca8a04; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: 11px;">
                        #${h.replacementCount}
                      </span>
                    </td>
                    <td style="padding: 7px 10px; color: #fca5a5; font-weight: 600;">${h.reason}</td>
                    <td style="padding: 7px 10px; color: #cbd5e1; font-size: 11.5px;">${h.oldCondition || '-'}</td>
                    <td style="padding: 7px 10px; color: #cbd5e1; font-size: 11.5px;">${h.remarks || '-'}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; color: #94a3b8;">${h.changedBy || 'admin'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
              <thead style="position: sticky; top: 0; z-index: 25;">
                <tr style="background: #0f172a; color: #cbd5e1;">
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 45px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">#</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Code</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: left; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Accessory Name</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 110px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Default Qty</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 110px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Default Remarks</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 90px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Total Stock</th>
                  <th style="position: sticky; top: 0; z-index: 25; background: #0f172a; padding: 8px 10px; text-align: center; width: 70px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Unit</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.map((a, idx) => `
                  <tr style="border-bottom: 1px solid #334155; background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                    <td style="padding: 7px 10px; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #ec4899;">${a.code}</td>
                    <td style="padding: 7px 10px; font-weight: 700; color: #f1f5f9;">${a.name}</td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 700; color: #cbd5e1;">${a.defaultQty || '-'}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: monospace; color: #fbbf24;">${a.defaultRemarks || '-'}</td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #22c55e;">${a.totalStock}</td>
                    <td style="padding: 7px 10px; text-align: center; color: #94a3b8;">${a.unit || 'Pcs'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}

        </div>

      </div>

    </div>
  `;
}

// =========================================================================
// NAVBAR ACTIVE STATE & TAB NAVIGATION
// =========================================================================

export function updateToolsNavbarVisuals(activeTab) {
  const root = document.getElementById('tools-mgmt-root');
  if (!root) return;

  const resolvedTab = activeTab || currentActiveTab || 'user-id';
  currentActiveTab = resolvedTab;
  state.set('toolsActiveTab', resolvedTab);

  const buttons = root.querySelectorAll('.tools-tab-btn');
  buttons.forEach(btn => {
    const tabKey = btn.getAttribute('data-tab');
    const isCurrent = tabKey === resolvedTab;
    const cfg = TOOLS_TAB_CONFIG[tabKey] || TOOLS_TAB_CONFIG['user-id'];

    if (isCurrent) {
      btn.classList.add('active');
      btn.style.background = cfg.bgColor;
      btn.style.color = cfg.textColor;
      btn.style.borderColor = cfg.borderColor;
      btn.style.boxShadow = `0 0 16px ${cfg.glowColor}, 0 4px 8px rgba(0,0,0,0.5)`;
      btn.style.fontWeight = '800';
      btn.style.opacity = '1';
      btn.style.transform = 'translateY(-1px) scale(1.03)';
    } else {
      btn.classList.remove('active');
      btn.style.background = '#334155';
      btn.style.color = '#cbd5e1';
      btn.style.borderColor = '#475569';
      btn.style.boxShadow = 'none';
      btn.style.fontWeight = '600';
      btn.style.opacity = '0.9';
      btn.style.transform = 'translateY(0) scale(1)';
    }
  });

  // Update top active screen status badge & reg badge
  const activeCfg = TOOLS_TAB_CONFIG[resolvedTab] || TOOLS_TAB_CONFIG['user-id'];
  const screenBadge = document.getElementById('tools-current-screen-badge');
  const screenLabel = document.getElementById('tools-current-tab-label');
  if (screenBadge && activeCfg) {
    screenBadge.style.background = `${activeCfg.bgColor}25`;
    screenBadge.style.borderColor = activeCfg.borderColor;
    screenBadge.style.color = activeCfg.bgColor;
    screenBadge.style.boxShadow = `0 0 12px ${activeCfg.glowColor}`;
  }
  if (screenLabel && activeCfg) {
    screenLabel.textContent = `${activeCfg.icon} ${activeCfg.name}`;
  }

  const regBadge = document.getElementById('tools-current-reg-badge');
  if (regBadge) {
    regBadge.textContent = `#${currentRegNo}`;
  }
}

export function navigateToTab(tabName) {
  currentActiveTab = tabName;
  state.set('toolsActiveTab', tabName);
  updateToolsNavbarVisuals(tabName);
  const container = document.getElementById('tools-tab-content-container');
  if (container) {
    container.innerHTML = renderActiveTab(tabName);
    initToolsManagementEvents();
  }
}

// =========================================================================
// EVENT HANDLERS & BINDINGS
// =========================================================================

export function initToolsManagementEvents() {
  const root = document.getElementById('tools-mgmt-root');
  if (!root) return;

  // Always synchronize top navbar active visuals with currentActiveTab
  updateToolsNavbarVisuals(currentActiveTab);

  // 1. Tab Navigation Clicks
  root.querySelectorAll('.tools-tab-btn').forEach(btn => {
    btn.onclick = (e) => {
      const targetTab = btn.getAttribute('data-tab');
      navigateToTab(targetTab);
    };
  });

  // Shared Manual Manpower Sync Button Handler (Available on top navbar & print toolbar)
  const triggerManualSync = (btn) => {
    if (!btn) return;
    btn.disabled = true;
    btn.style.opacity = '0.75';
    const icon = btn.querySelector('.sync-icon') || btn.querySelector('span');
    if (icon) {
      icon.style.display = 'inline-block';
      icon.style.transition = 'transform 0.6s ease';
      icon.style.transform = 'rotate(360deg)';
    }

    try {
      const res = toolService.syncAllocationsWithManpower();

      // Refresh current tab content to reflect newly synced data immediately
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab(currentActiveTab);
        initToolsManagementEvents();
      }

      window.app?.showToast('Manpower Synced', `Successfully synced all tool records with live Manpower (${res.updatedCount} record(s) updated).`, 'success');
    } catch (err) {
      alert('Sync Error: ' + err.message);
    } finally {
      setTimeout(() => {
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
        if (icon) {
          icon.style.transform = 'none';
        }
      }, 400);
    }
  };

  const btnSyncTop = document.getElementById('btn-sync-manpower-top');
  if (btnSyncTop) {
    btnSyncTop.onclick = () => triggerManualSync(btnSyncTop);
  }

  const btnSyncPrint = document.getElementById('btn-sync-manpower-print');
  if (btnSyncPrint) {
    btnSyncPrint.onclick = () => triggerManualSync(btnSyncPrint);
  }

  // Helper: Auto-fill all employee input boxes across Screen 1 & Screen 2
  function autoFillEmployeeBoxes(emp) {
    if (!emp) return;
    activeUserForm.userId = emp.cardNumber || emp.id || '';
    activeUserForm.userName = emp.name || '';
    activeUserForm.jobTitle = emp.designation || '';
    activeUserForm.workingArea = emp.workingArea || emp.department || '';

    // Screen 1 inputs
    const empId = document.getElementById('input-emp-id');
    const empName = document.getElementById('input-emp-name');
    const empTitle = document.getElementById('input-emp-title');
    const empArea = document.getElementById('input-emp-area');
    if (empId) empId.value = activeUserForm.userId;
    if (empName) empName.value = activeUserForm.userName;
    if (empTitle) empTitle.value = activeUserForm.jobTitle;
    if (empArea) empArea.value = activeUserForm.workingArea;

    // Screen 2 inputs
    const addId = document.getElementById('input-add-user-id');
    const addName = document.getElementById('input-add-user-name');
    const addTitle = document.getElementById('input-add-job-title');
    const addArea = document.getElementById('input-add-working-area');
    if (addId) addId.value = activeUserForm.userId;
    if (addName) addName.value = activeUserForm.userName;
    if (addTitle) addTitle.value = activeUserForm.jobTitle;
    if (addArea) addArea.value = activeUserForm.workingArea;
  }

  // 2. Staff Autocomplete & Instant Auto-Fill in Screen 1 (ID Number)
  const empIdInput = document.getElementById('input-emp-id');
  const typeaheadBox = document.getElementById('staff-typeahead-dropdown');
  if (empIdInput && typeaheadBox) {
    const handleEmpLookup = () => {
      const q = empIdInput.value.trim();
      if (!q) {
        typeaheadBox.style.display = 'none';
        return;
      }
      // Instant auto-fill on exact card match
      const exactMatch = toolService.getStaffByIdOrCard(q);
      if (exactMatch) {
        autoFillEmployeeBoxes(exactMatch);
      }

      const matches = toolService.searchManpowerStaff(q);
      if (matches.length === 0) {
        typeaheadBox.innerHTML = '<div style="padding: 8px 12px; color: #94a3b8; font-size: 12px;">No matching staff in Manpower database</div>';
      } else {
        typeaheadBox.innerHTML = matches.slice(0, 8).map(m => `
          <div class="typeahead-item" data-id="${m.cardNumber || m.id}"
            style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #334155; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 800; color: #38bdf8; font-family: monospace;">${m.cardNumber || m.id}</span> — 
              <span style="color: #fff; font-weight: 700;">${m.name}</span>
            </div>
            <span style="color: #94a3b8; font-size: 11px;">${m.designation || 'Staff'} • ${m.workingArea || ''}</span>
          </div>
        `).join('');
      }
      typeaheadBox.style.display = 'block';

      typeaheadBox.querySelectorAll('.typeahead-item').forEach(item => {
        item.onclick = () => {
          const id = item.getAttribute('data-id');
          const emp = toolService.getStaffByIdOrCard(id);
          if (emp) autoFillEmployeeBoxes(emp);
          typeaheadBox.style.display = 'none';
        };
      });
    };

    empIdInput.oninput = handleEmpLookup;
    empIdInput.onchange = () => {
      const emp = toolService.getStaffByIdOrCard(empIdInput.value.trim());
      if (emp) autoFillEmployeeBoxes(emp);
    };
    empIdInput.onpaste = () => {
      setTimeout(() => {
        const emp = toolService.getStaffByIdOrCard(empIdInput.value.trim());
        if (emp) autoFillEmployeeBoxes(emp);
      }, 50);
    };
  }

  // 2b. Staff Autocomplete & Instant Auto-Fill in Screen 2 (ID Number)
  const addUserIdInput = document.getElementById('input-add-user-id');
  const typeaheadBoxScreen2 = document.getElementById('staff-typeahead-dropdown-screen2');
  if (addUserIdInput && typeaheadBoxScreen2) {
    const handleAddUserLookup = () => {
      const q = addUserIdInput.value.trim();
      if (!q) {
        typeaheadBoxScreen2.style.display = 'none';
        return;
      }
      const exactMatch = toolService.getStaffByIdOrCard(q);
      if (exactMatch) {
        autoFillEmployeeBoxes(exactMatch);
      }

      const matches = toolService.searchManpowerStaff(q);
      if (matches.length === 0) {
        typeaheadBoxScreen2.innerHTML = '<div style="padding: 8px 12px; color: #94a3b8; font-size: 12px;">No matching staff in Manpower database</div>';
      } else {
        typeaheadBoxScreen2.innerHTML = matches.slice(0, 8).map(m => `
          <div class="typeahead-item-screen2" data-id="${m.cardNumber || m.id}"
            style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #334155; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 800; color: #38bdf8; font-family: monospace;">${m.cardNumber || m.id}</span> — 
              <span style="color: #fff; font-weight: 700;">${m.name}</span>
            </div>
            <span style="color: #94a3b8; font-size: 11px;">${m.designation || 'Staff'} • ${m.workingArea || ''}</span>
          </div>
        `).join('');
      }
      typeaheadBoxScreen2.style.display = 'block';

      typeaheadBoxScreen2.querySelectorAll('.typeahead-item-screen2').forEach(item => {
        item.onclick = () => {
          const id = item.getAttribute('data-id');
          const emp = toolService.getStaffByIdOrCard(id);
          if (emp) autoFillEmployeeBoxes(emp);
          typeaheadBoxScreen2.style.display = 'none';
        };
      });
    };

    addUserIdInput.oninput = handleAddUserLookup;
    addUserIdInput.onchange = () => {
      const emp = toolService.getStaffByIdOrCard(addUserIdInput.value.trim());
      if (emp) autoFillEmployeeBoxes(emp);
    };
    addUserIdInput.onpaste = () => {
      setTimeout(() => {
        const emp = toolService.getStaffByIdOrCard(addUserIdInput.value.trim());
        if (emp) autoFillEmployeeBoxes(emp);
      }, 50);
    };
  }

  // 3. Search Staff Modal Buttons (Screen 1 & Screen 2)
  const btnSearchStaff = document.getElementById('btn-search-staff-modal');
  if (btnSearchStaff) {
    btnSearchStaff.onclick = () => {
      openStaffSelectorModal();
    };
  }
  const btnSearchStaffAdd = document.getElementById('btn-search-staff-tools-add');
  if (btnSearchStaffAdd) {
    btnSearchStaffAdd.onclick = () => {
      openStaffSelectorModal();
    };
  }

  // 3.1 Date Picker Sync for Screen 1
  const pickerEmp = document.getElementById('picker-emp-date');
  const inpEmpDate = document.getElementById('input-emp-date');
  if (pickerEmp && inpEmpDate) {
    pickerEmp.onchange = () => {
      if (pickerEmp.value) {
        inpEmpDate.value = toolService.formatDateDMY(pickerEmp.value);
        activeUserForm.issueDate = inpEmpDate.value;
      }
    };
    inpEmpDate.onchange = () => {
      inpEmpDate.value = toolService.formatDateDMY(inpEmpDate.value);
      activeUserForm.issueDate = inpEmpDate.value;
    };
  }

  // 3.2 Dynamic Reg No Refresh in Screen 1
  const btnRefreshEmpReg = document.getElementById('btn-refresh-emp-reg');
  if (btnRefreshEmpReg) {
    btnRefreshEmpReg.onclick = () => {
      const next = toolService.getNextRegistrationNumber();
      const inp = document.getElementById('input-emp-reg-no');
      if (inp) inp.value = next;
      currentRegNo = next;
      activeUserForm.regNo = next;
      window.app?.showToast('Dynamic Reg No Refreshed', `Next unique sequential Reg No is #${next}`, 'info');
    };
  }

  // 3.3 Employee Form Minimize / Expand Toggle in Screen 1
  const btnToggleEmpForm = document.getElementById('btn-toggle-emp-form-collapse');
  const empFormInputs = document.getElementById('emp-form-inputs-container');
  const txtToggleEmp = document.getElementById('txt-toggle-emp-form');
  if (btnToggleEmpForm && empFormInputs) {
    btnToggleEmpForm.onclick = () => {
      const isHidden = empFormInputs.style.display === 'none';
      empFormInputs.style.display = isHidden ? 'block' : 'none';
      if (txtToggleEmp) {
        txtToggleEmp.textContent = isHidden ? '🔼 Minimize' : '🔽 Expand';
      }
    };
  }

  // 4. Proceed to Tools Add Form
  const btnProceed = document.getElementById('btn-proceed-to-tools');
  if (btnProceed) {
    btnProceed.onclick = () => {
      activeUserForm.userId = document.getElementById('input-emp-id')?.value.trim() || activeUserForm.userId;
      activeUserForm.userName = document.getElementById('input-emp-name')?.value.trim() || activeUserForm.userName;
      activeUserForm.jobTitle = document.getElementById('input-emp-title')?.value.trim() || activeUserForm.jobTitle;
      activeUserForm.workingArea = document.getElementById('input-emp-area')?.value.trim() || activeUserForm.workingArea;
      activeUserForm.issueDate = toolService.formatDateDMY(document.getElementById('input-emp-date')?.value || activeUserForm.issueDate || '25-10-2025');

      // Always assign strictly unique sequential next registration number
      currentRegNo = toolService.getNextRegistrationNumber();
      activeUserForm.regNo = currentRegNo;
      liveAllocationQueue = [];

      navigateToTab('tools-add');
    };
  }

  // 5. Excel Import History Trigger
  const btnExcelImp = document.getElementById('btn-open-excel-import-modal');
  if (btnExcelImp) {
    btnExcelImp.onclick = () => {
      openExcelImportModal();
    };
  }

  // 6. Download Sample Excel Template
  const btnTemplate = document.getElementById('btn-download-sample-template');
  if (btnTemplate) {
    btnTemplate.onclick = () => {
      try {
        toolService.generateAllocationTemplateExcel();
        window.app?.showToast('Template Generated', 'Excel template downloaded successfully.', 'success');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // 7. Load Past Reg in Tools Add Form
  root.querySelectorAll('.btn-load-reg-tools').forEach(btn => {
    btn.onclick = () => {
      const reg = btn.getAttribute('data-reg');
      currentRegNo = reg;
      const details = toolService.getRegistrationDetails(reg);
      if (details) {
        activeUserForm = {
          userId: details.userId,
          userName: details.userName,
          jobTitle: details.jobTitle,
          workingArea: details.workingArea,
          issueDate: details.issueDate,
          regNo: details.regNo
        };
        liveAllocationQueue = details.items.map(i => ({ ...i }));
      }
      navigateToTab('tools-add');
    };
  });

  // 8. Print Past Reg Slip
  root.querySelectorAll('.btn-print-reg-slip').forEach(btn => {
    btn.onclick = () => {
      const reg = btn.getAttribute('data-reg');
      currentPrintRegNo = reg;
      navigateToTab('print-page');
    };
  });

  // 9. Tools Add Form: Generate Next Reg No
  const btnGenReg = document.getElementById('btn-generate-next-reg');
  if (btnGenReg) {
    btnGenReg.onclick = () => {
      currentRegNo = toolService.getNextRegistrationNumber();
      activeUserForm.regNo = currentRegNo;
      activeUserForm.userId = '';
      activeUserForm.userName = '';
      activeUserForm.jobTitle = '';
      activeUserForm.workingArea = '';
      liveAllocationQueue = [];
      navigateToTab('tools-add');
    };
  }

  // 9b. Clear Employee Fields Buttons (Screen 1 and Screen 2)
  const btnClearEmpScreen1 = document.getElementById('btn-clear-emp-screen1');
  if (btnClearEmpScreen1) {
    btnClearEmpScreen1.onclick = () => {
      activeUserForm.userId = '';
      activeUserForm.userName = '';
      activeUserForm.jobTitle = '';
      activeUserForm.workingArea = '';
      if (document.getElementById('input-emp-id')) document.getElementById('input-emp-id').value = '';
      if (document.getElementById('input-emp-name')) document.getElementById('input-emp-name').value = '';
      if (document.getElementById('input-emp-title')) document.getElementById('input-emp-title').value = '';
      if (document.getElementById('input-emp-area')) document.getElementById('input-emp-area').value = '';
    };
  }

  const btnClearEmpFields = document.getElementById('btn-clear-emp-fields');
  if (btnClearEmpFields) {
    btnClearEmpFields.onclick = () => {
      activeUserForm.userId = '';
      activeUserForm.userName = '';
      activeUserForm.jobTitle = '';
      activeUserForm.workingArea = '';
      activeUserForm.requisitionNo = '';
      if (document.getElementById('input-add-user-id')) document.getElementById('input-add-user-id').value = '';
      if (document.getElementById('input-add-user-name')) document.getElementById('input-add-user-name').value = '';
      if (document.getElementById('input-add-job-title')) document.getElementById('input-add-job-title').value = '';
      if (document.getElementById('input-add-working-area')) document.getElementById('input-add-working-area').value = '';
      if (document.getElementById('input-add-requisition-no')) document.getElementById('input-add-requisition-no').value = '';
    };
  }

  const inpScreen2ReqNo = document.getElementById('input-add-requisition-no');
  if (inpScreen2ReqNo) {
    inpScreen2ReqNo.oninput = () => {
      activeUserForm.requisitionNo = inpScreen2ReqNo.value.trim().toUpperCase();
    };
  }

  // 10. Load Specific Reg Button
  const btnLoadReg = document.getElementById('btn-load-reg-data');
  if (btnLoadReg) {
    btnLoadReg.onclick = () => {
      const reg = document.getElementById('input-tab-reg-no')?.value.trim();
      if (!reg) return;
      currentRegNo = reg;
      const details = toolService.getRegistrationDetails(reg);
      if (details) {
        activeUserForm = {
          userId: details.userId,
          userName: details.userName,
          jobTitle: details.jobTitle,
          workingArea: details.workingArea,
          issueDate: details.issueDate,
          regNo: details.regNo
        };
        liveAllocationQueue = details.items.map(i => ({ ...i }));
      } else {
        alert(`No existing records found for Reg No #${reg}. You can create a new allocation for this number.`);
      }
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('tools-add');
        initToolsManagementEvents();
      }
    };
  }

  // 11. Category Pill Filter in Add Form (Switch between All, Tools, Accessories, and Spare Parts)
  root.querySelectorAll('.btn-tool-cat-pill').forEach(btn => {
    btn.onclick = () => {
      screen2CategoryFilter = btn.getAttribute('data-cat') || 'ALL';
      screen2SelectedCatalogItem = null;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('tools-add');
        initToolsManagementEvents();
      }
    };
  });

  // 11.1 Smart Autocomplete Search & Dropdown for Single Item
  const inpSmartSearch = document.getElementById('input-tool-smart-search');
  const autoBox = document.getElementById('tool-autocomplete-results');
  const btnToggleDropdown = document.getElementById('btn-toggle-tool-dropdown');
  const qtyInp = document.getElementById('input-item-qty');
  const remInp = document.getElementById('input-item-remarks');

  const renderSmartSuggestions = (items) => {
    if (!autoBox) return;
    if (!items || items.length === 0) {
      autoBox.innerHTML = '<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 12px;">No matching tools or spare parts found.</div>';
      autoBox.style.display = 'block';
      return;
    }

    autoBox.innerHTML = items.slice(0, 30).map((it, idx) => `
      <div class="tool-suggest-row" data-index="${idx}" style="padding: 8px 12px; border-bottom: 1px solid #1e293b; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background: #0284c7; color: #fff; font-family: monospace; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 3px;">
            ${it.code}
          </span>
          <div>
            <div style="font-weight: 700; color: #f8fafc; font-size: 12px;">${it.name}</div>
            <div style="font-size: 10.5px; color: #94a3b8;">${it.category || 'General'} • Unit: ${it.unit || 'Pcs'}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 800; background: ${it.type === 'TOOL' ? 'rgba(56, 189, 248, 0.2); color: #38bdf8;' : it.type === 'ACCESSORY' ? 'rgba(236, 72, 153, 0.2); color: #f472b6;' : 'rgba(52, 211, 153, 0.2); color: #34d399;'};">
            ${it.typeLabel || it.type}
          </span>
          <div style="font-size: 10.5px; font-weight: 700; color: ${it.totalStock > 0 ? '#34d399' : '#ef4444'}; margin-top: 2px;">
            ${it.totalStock > 0 ? `${it.totalStock} in stock` : 'Out of stock'}
          </div>
        </div>
      </div>
    `).join('');

    autoBox.style.display = 'block';

    autoBox.querySelectorAll('.tool-suggest-row').forEach(row => {
      row.onmouseenter = () => { row.style.background = 'rgba(2, 132, 199, 0.25)'; };
      row.onmouseleave = () => { row.style.background = 'transparent'; };
      row.onclick = () => {
        const itemIdx = parseInt(row.getAttribute('data-index'), 10);
        const selected = items[itemIdx];
        if (selected) {
          screen2SelectedCatalogItem = selected;
          autoBox.style.display = 'none';
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('tools-add');
            initToolsManagementEvents();
            // Focus quantity field for rapid data entry
            document.getElementById('input-item-qty')?.focus({ preventScroll: true });
            document.getElementById('input-item-qty')?.select();
          }
        }
      };
    });
  };

  if (inpSmartSearch) {
    inpSmartSearch.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const all = getAllCatalogItems(screen2CategoryFilter);
      if (!q) {
        renderSmartSuggestions(all);
        return;
      }
      const matches = all.filter(it =>
        (it.name && it.name.toLowerCase().includes(q)) ||
        (it.code && String(it.code).toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        (it.remarks && it.remarks.toLowerCase().includes(q))
      );
      renderSmartSuggestions(matches);
    };

    inpSmartSearch.onfocus = () => {
      const all = getAllCatalogItems(screen2CategoryFilter);
      renderSmartSuggestions(all);
    };
  }

  if (btnToggleDropdown) {
    btnToggleDropdown.onclick = (e) => {
      e.stopPropagation();
      if (autoBox) {
        if (autoBox.style.display === 'block') {
          autoBox.style.display = 'none';
        } else {
          renderSmartSuggestions(getAllCatalogItems(screen2CategoryFilter));
        }
      }
    };
  }

  // Close floating autocomplete dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (autoBox && inpSmartSearch && !inpSmartSearch.contains(e.target) && !autoBox.contains(e.target) && !btnToggleDropdown?.contains(e.target)) {
      autoBox.style.display = 'none';
    }
  });

  // 11.2 Quantity Quick Buttons and Stepper
  const btnMinus = document.getElementById('btn-qty-minus');
  const btnPlus = document.getElementById('btn-qty-plus');
  if (btnMinus && qtyInp) {
    btnMinus.onclick = () => {
      let v = parseInt(qtyInp.value, 10) || 1;
      if (v > 1) qtyInp.value = v - 1;
    };
  }
  if (btnPlus && qtyInp) {
    btnPlus.onclick = () => {
      let v = parseInt(qtyInp.value, 10) || 1;
      qtyInp.value = v + 1;
    };
  }
  root.querySelectorAll('.btn-quick-qty').forEach(btn => {
    btn.onclick = () => {
      if (qtyInp) qtyInp.value = btn.getAttribute('data-qty');
    };
  });

  // 11.3 Clear Selected Item Button
  const btnClearSel = document.getElementById('btn-delete-selected-item');
  if (btnClearSel) {
    btnClearSel.onclick = () => {
      screen2SelectedCatalogItem = null;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('tools-add');
        initToolsManagementEvents();
      }
    };
  }

  // 11.4 Batch Multi-Select Modal Triggers
  const openBatchBtns = [
    document.getElementById('btn-open-batch-tools-modal'),
    document.getElementById('btn-middle-batch-add'),
    document.getElementById('btn-open-batch-middle'),
    document.getElementById('btn-batch-add-shortcut')
  ];
  openBatchBtns.forEach(b => {
    if (b) {
      b.onclick = () => openBatchToolsAllocationModal();
    }
  });

  // 11.5 Smart OCR / Screenshot Auto-Fill Modal Trigger
  const btnOpenOcr = document.getElementById('btn-open-ocr-import-modal');
  if (btnOpenOcr) {
    btnOpenOcr.onclick = () => openSmartOcrModal();
  }

  // Global Clipboard Paste Listener for Screenshots (Ctrl+V) on Screen 2
  if (!window.__toolsOcrPasteListenerAttached) {
    window.__toolsOcrPasteListenerAttached = true;
    window.addEventListener('paste', (e) => {
      // Only trigger if user is currently on Tools Allocation tab
      if (currentActiveTab !== 'tools-add') return;

      const activeEl = document.activeElement;
      const activeTag = activeEl ? activeEl.tagName.toLowerCase() : '';
      const isOcrModalOpen = !!document.getElementById('ocr-modal-root');

      // If user is pasting into a general text input outside OCR modal, don't hijack unless it looks like ERP PDF text
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      // 1. Check for pasted image screenshot (from Windows Snipping Tool, PrintScreen, etc.)
      const items = clipboardData.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              e.preventDefault();
              openSmartOcrModal(blob);
              return;
            }
          }
        }
      }

      // 2. Check for copied ERP PDF text snippet
      const pastedText = clipboardData.getData('text');
      if (pastedText && (/tools\s*user/i.test(pastedText) || (/item\s*name/i.test(pastedText) && /\[(change|new)\]/i.test(pastedText)))) {
        if (!isOcrModalOpen && activeTag !== 'textarea') {
          e.preventDefault();
          openSmartOcrModal(null, pastedText);
        }
      }
    });
  }

  // 12. Change Status Dropdown (Show/Hide Change Date)
  const selectStatus = document.getElementById('select-item-status');
  const changeDateInp = document.getElementById('input-change-date');
  if (selectStatus && changeDateInp) {
    selectStatus.onchange = () => {
      if (selectStatus.value === 'REPLACED' || selectStatus.value === 'RETURNED') {
        changeDateInp.style.display = 'block';
        changeDateInp.value = new Date().toISOString().split('T')[0];
      } else {
        changeDateInp.style.display = 'none';
      }
    };
  }

  // 12.1 Date Picker Sync for Screen 2
  const pickerAdd = document.getElementById('picker-add-issue-date');
  const inpAddDate = document.getElementById('input-add-issue-date');
  if (pickerAdd && inpAddDate) {
    pickerAdd.onchange = () => {
      if (pickerAdd.value) {
        inpAddDate.value = toolService.formatDateDMY(pickerAdd.value);
        activeUserForm.issueDate = inpAddDate.value;
      }
    };
    inpAddDate.onchange = () => {
      inpAddDate.value = toolService.formatDateDMY(inpAddDate.value);
      activeUserForm.issueDate = inpAddDate.value;
    };
  }

  // 13. 1-Click Load Full Standard Tools Kit (28 Tools)
  const btnLoadKit = document.getElementById('btn-load-standard-kit');
  if (btnLoadKit) {
    btnLoadKit.onclick = () => {
      const curIssueDate = toolService.formatDateDMY(document.getElementById('input-add-issue-date')?.value || activeUserForm.issueDate || '25-10-2025');
      const stdTools = toolService.getAllMasterTools();
      liveAllocationQueue = stdTools.map(t => ({
        regNo: currentRegNo,
        issueDate: curIssueDate,
        userId: document.getElementById('input-add-user-id')?.value.trim() || activeUserForm.userId,
        userName: document.getElementById('input-add-user-name')?.value.trim() || activeUserForm.userName,
        jobTitle: document.getElementById('input-add-job-title')?.value.trim() || activeUserForm.jobTitle,
        workingArea: document.getElementById('input-add-working-area')?.value.trim() || activeUserForm.workingArea,
        itemType: 'TOOL',
        itemCode: t.code,
        itemName: t.name,
        quantity: 1,
        changeStatus: 'NEW_ISSUE',
        remarks: ''
      }));

      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('tools-add');
        initToolsManagementEvents();
      }
      window.app?.showToast('Tools Loaded', 'Loaded standard 28 tools for mechanic.', 'info');
    };
  }

  // 14. Clear Queue Button (Admin Controlled)
  const btnClearQ = document.getElementById('btn-clear-queue');
  if (btnClearQ) {
    btnClearQ.onclick = () => {
      ensureAdminAccess('Clear Current Queue Table', () => {
        if (confirm('Clear all items and reset employee fields from current allocation table?')) {
          liveAllocationQueue = [];
          activeUserForm.userId = '';
          activeUserForm.userName = '';
          activeUserForm.jobTitle = '';
          activeUserForm.workingArea = '';
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('tools-add');
            initToolsManagementEvents();
          }
        }
      });
    };
  }

  // 15. Add Single Tool to Live Table
  const btnAddToList = document.getElementById('btn-add-to-list');
  if (btnAddToList) {
    btnAddToList.onclick = () => {
      // Determine selected item either from screen2SelectedCatalogItem or search input
      let item = screen2SelectedCatalogItem;
      if (!item) {
        const searchVal = document.getElementById('input-tool-smart-search')?.value.trim();
        if (searchVal) {
          const all = getAllCatalogItems('ALL');
          item = all.find(it => `${it.code} - ${it.name}`.toLowerCase() === searchVal.toLowerCase() || it.name.toLowerCase() === searchVal.toLowerCase() || String(it.code).toLowerCase() === searchVal.toLowerCase());
        }
      }

      if (!item) {
        alert('Please select a tool, accessory, or spare part first.');
        document.getElementById('input-tool-smart-search')?.focus({ preventScroll: true });
        return;
      }

      const code = item.code;
      const name = item.name;
      const itemType = item.type || 'TOOL';
      const qty = document.getElementById('input-item-qty')?.value.trim() || '1';
      const remarks = document.getElementById('input-item-remarks')?.value.trim() || '';
      const status = document.getElementById('select-item-status')?.value || 'NEW_ISSUE';
      const chgDate = document.getElementById('input-change-date')?.value || null;
      const curIssueDate = toolService.formatDateDMY(document.getElementById('input-add-issue-date')?.value || activeUserForm.issueDate || '25-10-2025');

      liveAllocationQueue.push({
        regNo: currentRegNo,
        issueDate: curIssueDate,
        userId: document.getElementById('input-add-user-id')?.value.trim() || activeUserForm.userId,
        userName: document.getElementById('input-add-user-name')?.value.trim() || activeUserForm.userName,
        jobTitle: document.getElementById('input-add-job-title')?.value.trim() || activeUserForm.jobTitle,
        workingArea: document.getElementById('input-add-working-area')?.value.trim() || activeUserForm.workingArea,
        itemType,
        itemCode: code,
        itemName: name,
        quantity: qty,
        changeStatus: status,
        changeDate: status !== 'NEW_ISSUE' ? chgDate : null,
        remarks
      });

      screen2SelectedCatalogItem = null;

      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('tools-add');
        initToolsManagementEvents();
      }
      window.app?.showToast('Item Added', `Added ${name} to allocation table.`, 'success');
    };
  }

  // 15.1 In-Table Live Editable Queue Listeners (Quantity, Status, Remarks)
  root.querySelectorAll('.inp-queue-qty').forEach(inp => {
    inp.onchange = () => {
      const idx = parseInt(inp.getAttribute('data-index'), 10);
      if (!isNaN(idx) && liveAllocationQueue[idx]) {
        const val = Math.max(1, parseInt(inp.value, 10) || 1);
        liveAllocationQueue[idx].quantity = String(val);
        inp.value = val;
      }
    };
  });

  root.querySelectorAll('.sel-queue-status').forEach(sel => {
    sel.onchange = () => {
      const idx = parseInt(sel.getAttribute('data-index'), 10);
      if (!isNaN(idx) && liveAllocationQueue[idx]) {
        liveAllocationQueue[idx].changeStatus = sel.value;
        if (sel.value !== 'NEW_ISSUE') {
          liveAllocationQueue[idx].changeDate = new Date().toISOString().split('T')[0];
        } else {
          liveAllocationQueue[idx].changeDate = null;
        }
        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab('tools-add');
          initToolsManagementEvents();
        }
      }
    };
  });

  root.querySelectorAll('.inp-queue-remarks').forEach(inp => {
    inp.onchange = () => {
      const idx = parseInt(inp.getAttribute('data-index'), 10);
      if (!isNaN(idx) && liveAllocationQueue[idx]) {
        liveAllocationQueue[idx].remarks = inp.value.trim();
      }
    };
  });

  // 16. Remove Single Queue Item
  root.querySelectorAll('.btn-remove-queue-item').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx)) {
        liveAllocationQueue.splice(idx, 1);
        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab('tools-add');
          initToolsManagementEvents();
        }
      }
    };
  });

  // 17. Big 3D SAVE Button (Commit to Database)
  const btnSaveBatch = document.getElementById('btn-save-allocation-batch');
  if (btnSaveBatch) {
    btnSaveBatch.onclick = async () => {
      try {
        const regNo = document.getElementById('input-tab-reg-no')?.value.trim() || currentRegNo;
        const userId = document.getElementById('input-add-user-id')?.value.trim() || activeUserForm.userId;
        const userName = document.getElementById('input-add-user-name')?.value.trim() || activeUserForm.userName;
        const jobTitle = document.getElementById('input-add-job-title')?.value.trim() || activeUserForm.jobTitle;
        const workingArea = document.getElementById('input-add-working-area')?.value.trim() || activeUserForm.workingArea;
        const issueDate = toolService.formatDateDMY(document.getElementById('input-add-issue-date')?.value || activeUserForm.issueDate || '25-10-2025');

        if (!regNo) throw new Error('Registration number is required.');
        if (!userId || !userName) throw new Error('Employee ID and User Name are required.');
        if (liveAllocationQueue.length === 0) throw new Error('Please add tools to the table before saving.');

        // Delete existing items for this regNo first to prevent duplicate stacking on updates
        await toolService.deleteRegistrationBatch(regNo);

        const reqNo = document.getElementById('input-add-requisition-no')?.value.trim() || activeUserForm.requisitionNo || '';
        liveAllocationQueue.forEach(item => {
          if (!item.requisitionNo && reqNo) item.requisitionNo = reqNo;
        });

        const cleanRegNo = String(regNo).replace(/^[#\s]+/, '').trim();
        const result = await toolService.saveAllocationBatch({
          regNo: cleanRegNo,
          issueDate,
          user: { userId, userName, jobTitle, workingArea, requisitionNo: reqNo },
          items: liveAllocationQueue
        });

        window.app?.showToast('Saved Successfully', `Saved ${result.count} items for Reg No #${cleanRegNo} (${userName})`, 'success');

        currentPrintRegNo = cleanRegNo;
        liveAllocationQueue = []; // Clean the queue after saving

        // Auto advance currentRegNo to next dynamic unique sequential number
        const nextSequentialReg = toolService.getNextRegistrationNumber();
        currentRegNo = nextSequentialReg;
        activeUserForm.regNo = nextSequentialReg;

        navigateToTab('print-page');
      } catch (err) {
        alert('Validation Error: ' + err.message);
      }
    };
  }

  // 18. Print Page: Search & Live Auto-Suggestions by Card Number, Reg No, or Mechanic Name
  const btnPrintSearch = document.getElementById('btn-search-print-reg');
  const inpPrintReg = document.getElementById('input-print-reg-no');
  const suggestionsBox = document.getElementById('print-search-suggestions');

  const selectPrintMechanic = (regNoOrCard, name) => {
    currentPrintRegNo = regNoOrCard;
    if (suggestionsBox) suggestionsBox.style.display = 'none';
    const container = document.getElementById('tools-tab-content-container');
    if (container) {
      container.innerHTML = renderActiveTab('print-page');
      initToolsManagementEvents();
    }
    window.app?.showToast('Registration Loaded', `Found & loaded ${name || regNoOrCard}`, 'success');
  };

  const performPrintSearch = () => {
    const q = inpPrintReg?.value.trim();
    if (suggestionsBox) suggestionsBox.style.display = 'none';
    if (!q) {
      currentPrintRegNo = '';
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('print-page');
        initToolsManagementEvents();
      }
      window.app?.showToast('Notice', 'Search cleared. Input is blank.', 'info');
      return;
    }
    const match = toolService.getRegistrationDetails(q);
    if (match) {
      currentPrintRegNo = match.regNo || match.userId || q;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('print-page');
        initToolsManagementEvents();
      }
      window.app?.showToast('Registration Loaded', `Found & loaded ${match.userName || match.userId} (${match.userId || match.regNo})`, 'success');
    } else {
      window.app?.showToast('Not Found', `No mechanic or allocation found for "${q}". Please verify the ID or Card #.`, 'warning');
    }
  };

  const renderSuggestions = () => {
    if (!inpPrintReg || !suggestionsBox) return;
    const q = inpPrintReg.value.trim();
    if (!q || q.length < 1) {
      suggestionsBox.style.display = 'none';
      return;
    }

    const matches = toolService.searchPrintMechanics(q);
    if (matches.length === 0) {
      suggestionsBox.innerHTML = `
        <div style="padding: 10px 14px; color: #94a3b8; font-size: 12px; text-align: center;">
          No matching mechanic found for "<strong>${q}</strong>"
        </div>
      `;
      suggestionsBox.style.display = 'block';
      return;
    }

    suggestionsBox.innerHTML = `
      <div style="padding: 6px 10px; font-size: 11px; font-weight: 800; color: #38bdf8; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between;">
        <span>MATCHING MECHANICS (${matches.length})</span>
        <span style="color: #94a3b8; font-size: 10px;">Click to select</span>
      </div>
      ${matches.map(m => `
        <div class="print-suggest-item" data-value="${m.regNo || m.userId}" data-name="${m.userName}"
          style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #1e293b; transition: background 0.15s; display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${m.regNo ? `
                <span style="background: #2563eb; color: #fff; padding: 1px 6px; border-radius: 3px; font-size: 11px; font-family: monospace; font-weight: 800;">
                  #${m.regNo}
                </span>
              ` : `
                <span style="background: #475569; color: #cbd5e1; padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 700;">
                  Staff
                </span>
              `}
              <span style="font-weight: 800; color: #38bdf8; font-family: monospace; font-size: 12.5px;">
                ${m.userId}
              </span>
            </div>
            <span style="color: #4ade80; font-size: 11px; font-weight: 700;">
              ${m.toolCount > 0 ? `🛠️ ${m.toolCount} Tools` : ''}
            </span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px;">
            <span style="color: #f8fafc; font-weight: 700;">${m.userName}</span>
            <span style="color: #94a3b8; font-size: 11px;">${m.jobTitle || 'Mechanic'}${m.workingArea ? ' • ' + m.workingArea : ''}</span>
          </div>
        </div>
      `).join('')}
    `;
    suggestionsBox.style.display = 'block';

    suggestionsBox.querySelectorAll('.print-suggest-item').forEach(item => {
      item.onmouseenter = () => { item.style.background = '#1e293b'; };
      item.onmouseleave = () => { item.style.background = 'transparent'; };
      item.onclick = (e) => {
        e.stopPropagation();
        const val = item.getAttribute('data-value');
        const name = item.getAttribute('data-name');
        selectPrintMechanic(val, name);
      };
    });
  };

  if (btnPrintSearch) {
    btnPrintSearch.onclick = performPrintSearch;
  }
  if (inpPrintReg && suggestionsBox) {
    inpPrintReg.oninput = renderSuggestions;
    inpPrintReg.onfocus = () => {
      if (inpPrintReg.value.trim().length >= 1) renderSuggestions();
    };
    inpPrintReg.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const firstItem = suggestionsBox.querySelector('.print-suggest-item');
        if (suggestionsBox.style.display !== 'none' && firstItem) {
          const val = firstItem.getAttribute('data-value');
          const name = firstItem.getAttribute('data-name');
          selectPrintMechanic(val, name);
        } else {
          performPrintSearch();
        }
      } else if (e.key === 'Escape') {
        suggestionsBox.style.display = 'none';
      }
    };

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#input-print-reg-no') && !e.target.closest('#print-search-suggestions')) {
        if (suggestionsBox) suggestionsBox.style.display = 'none';
      }
    });
  }

  // 19. Print Format Buttons
  const btnFmtA4 = document.getElementById('btn-format-a4');
  const btnFmtPkt = document.getElementById('btn-format-pocket');
  if (btnFmtA4) {
    btnFmtA4.onclick = () => {
      currentPrintFormat = 'A4';
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('print-page');
        initToolsManagementEvents();
      }
    };
  }
  if (btnFmtPkt) {
    btnFmtPkt.onclick = () => {
      currentPrintFormat = 'POCKET';
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('print-page');
        initToolsManagementEvents();
      }
    };
  }

  // 19b. Quick ID Card / Pocket Custom Dimensions & Preset Handlers
  function refreshPrintPreviewSheet() {
    const wrapper = document.getElementById('printable-sheet-wrapper');
    if (!wrapper) return;
    const regDetails = toolService.getRegistrationDetails(currentPrintRegNo) || {
      regNo: currentPrintRegNo,
      userId: activeUserForm.userId,
      userName: activeUserForm.userName,
      jobTitle: activeUserForm.jobTitle,
      workingArea: activeUserForm.workingArea,
      issueDate: activeUserForm.issueDate,
      tools: [],
      accessories: []
    };
    const tools = regDetails.tools || [];
    const accessories = regDetails.accessories || [];
    const leftTools = tools.slice(0, 20);
    const rightTools = tools.slice(20);
    wrapper.innerHTML = currentPrintFormat === 'POCKET'
      ? renderFormatPocket(regDetails, leftTools, rightTools, accessories)
      : renderFormatA4(regDetails, leftTools, rightTools, accessories);
  }

  const selPocketPreset = document.getElementById('sel-quick-pocket-preset');
  if (selPocketPreset) {
    selPocketPreset.onchange = () => {
      pocketCustomSettings.preset = selPocketPreset.value;
      pocketCustomSettings._userModified = true;
      if (selPocketPreset.value === 'standard') {
        pocketCustomSettings.width = 125;
        pocketCustomSettings.height = 170;
      } else if (selPocketPreset.value === 'a6') {
        pocketCustomSettings.width = 105;
        pocketCustomSettings.height = 148;
      } else if (selPocketPreset.value === 'badge') {
        pocketCustomSettings.width = 100;
        pocketCustomSettings.height = 75;
      } else if (selPocketPreset.value === 'cr80') {
        pocketCustomSettings.width = 86;
        pocketCustomSettings.height = 54;
      }
      const inpW = document.getElementById('inp-quick-pocket-width');
      const inpH = document.getElementById('inp-quick-pocket-height');
      if (inpW) inpW.value = pocketCustomSettings.width;
      if (inpH) inpH.value = pocketCustomSettings.height;
      refreshPrintPreviewSheet();
    };
  }

  const inpPocketW = document.getElementById('inp-quick-pocket-width');
  const inpPocketH = document.getElementById('inp-quick-pocket-height');
  if (inpPocketW) {
    inpPocketW.oninput = () => {
      const val = parseInt(inpPocketW.value, 10);
      if (val && val >= 40 && val <= 350) {
        pocketCustomSettings.width = val;
        pocketCustomSettings._userModified = true;
        if (selPocketPreset && !['standard', 'a6', 'badge', 'cr80'].includes(selPocketPreset.value)) {
          selPocketPreset.value = 'custom';
        }
        refreshPrintPreviewSheet();
      }
    };
  }
  if (inpPocketH) {
    inpPocketH.oninput = () => {
      const val = parseInt(inpPocketH.value, 10);
      if (val && val >= 30 && val <= 400) {
        pocketCustomSettings.height = val;
        pocketCustomSettings._userModified = true;
        if (selPocketPreset && !['standard', 'a6', 'badge', 'cr80'].includes(selPocketPreset.value)) {
          selPocketPreset.value = 'custom';
        }
        refreshPrintPreviewSheet();
      }
    };
  }

  const selPocketSigGap = document.getElementById('sel-quick-pocket-sig-gap');
  if (selPocketSigGap) {
    selPocketSigGap.onchange = () => {
      pocketCustomSettings.sigGap = selPocketSigGap.value;
      pocketCustomSettings._userModified = true;
      refreshPrintPreviewSheet();
    };
  }

  const btnSavePocketQuick = document.getElementById('btn-save-pocket-quick');
  if (btnSavePocketQuick) {
    btnSavePocketQuick.onclick = () => {
      const tpl = toolService.getPrintTemplateConfig();
      const updatedPocket = {
        ...(tpl.pocket || {}),
        cardWidth: pocketCustomSettings.width,
        cardHeight: pocketCustomSettings.height,
        sizePreset: pocketCustomSettings.preset,
        signatureMarginTop: pocketCustomSettings.sigGap,
        showStampBox: false
      };
      toolService.savePrintTemplateConfig({ pocket: updatedPocket });
      window.app?.showToast('Dimensions Saved', `Saved default ID card size: ${pocketCustomSettings.width}mm × ${pocketCustomSettings.height}mm`, 'success');
    };
  }

  // 20. Admin Template Customizer Modal Trigger
  const btnOpenTpl = document.getElementById('btn-open-template-customizer');
  if (btnOpenTpl) {
    btnOpenTpl.onclick = () => {
      renderAdminPrintTemplateModal();
    };
  }

  // 21. Trigger Print (Dedicated clean print frame/window to guarantee zero blank pages)
  const btnPrint = document.getElementById('btn-trigger-print');
  if (btnPrint) {
    btnPrint.onclick = () => {
      if (!currentPrintRegNo) {
        window.app?.showToast('Notice', 'Please search and select a mechanic first before printing.', 'warning');
        return;
      }

      const printSheet = document.getElementById('printable-sheet-wrapper');
      if (!printSheet) {
        window.print();
        return;
      }

      const printContent = printSheet.innerHTML;
      const isPocket = currentPrintFormat === 'POCKET';
      const printWin = window.open('', '_blank', 'width=1050,height=750');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Maintenance Tools Allocation - #${currentPrintRegNo}</title>
              <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">
              <style>
                @page {
                  size: ${isPocket ? 'landscape' : 'portrait'};
                  margin: ${isPocket ? '4mm' : '8mm 6mm'};
                }
                * {
                  box-sizing: border-box;
                }
                body {
                  margin: 0;
                  padding: 8px;
                  background: #ffffff !important;
                  color: #000000 !important;
                  font-family: 'Inter', Arial, sans-serif;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                table, tr, th, td, span, div, p {
                  color: #000000 !important;
                }
                th, td {
                  color: #000000 !important;
                  background-color: transparent !important;
                }
                .printable-doc {
                  box-shadow: none !important;
                  margin: 0 auto !important;
                  color: #000000 !important;
                  background: #ffffff !important;
                }
                #printable-pocket-document {
                  display: flex !important;
                  flex-direction: row !important;
                  justify-content: center !important;
                  align-items: stretch !important;
                  gap: 14px !important;
                  width: auto !important;
                }
                .pocket-card {
                  page-break-inside: avoid !important;
                }
                .pocket-card-divider {
                  display: flex !important;
                  visibility: visible !important;
                }
                @media print {
                  body {
                    padding: 0;
                  }
                  .no-print-bar {
                    display: none !important;
                  }
                }
              </style>
            </head>
            <body>
              <div class="no-print-bar" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 12px; font-family: sans-serif;">
                <span style="font-size: 13px; font-weight: bold; color: #334155;">Document Preview Ready (${isPocket ? 'Dual ID Card / Pocket Slip - Side-by-Side' : 'A4 Full Page Form'})</span>
                <button onclick="window.print()" style="background: #059669; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; font-weight: 800; font-size: 13px; cursor: pointer;">
                  🖨️ Print Now (or Save PDF)
                </button>
              </div>
              <div style="display: flex; justify-content: center; align-items: flex-start; width: 100%;">
                ${printContent}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                  }, 250);
                };
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        window.print();
      }
    };
  }

  // 21a. Find & Select Filter Handlers
  const findSearch = document.getElementById('find-search-input');
  if (findSearch) {
    findSearch.oninput = () => {
      findFilters.search = findSearch.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  const findSelectReg = document.getElementById('find-select-reg');
  if (findSelectReg) {
    findSelectReg.onchange = () => {
      findFilters.regNo = findSelectReg.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  const findSelectEmp = document.getElementById('find-select-emp');
  if (findSelectEmp) {
    findSelectEmp.onchange = () => {
      findFilters.userId = findSelectEmp.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  const findSelectType = document.getElementById('find-select-type');
  if (findSelectType) {
    findSelectType.onchange = () => {
      findFilters.itemType = findSelectType.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  const findSelectStatus = document.getElementById('find-select-status');
  if (findSelectStatus) {
    findSelectStatus.onchange = () => {
      findFilters.changeStatus = findSelectStatus.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  const btnResetFilters = document.getElementById('btn-reset-find-filters');
  if (btnResetFilters) {
    btnResetFilters.onclick = () => {
      findFilters = { search: '', regNo: 'ALL', userId: 'ALL', itemType: 'ALL', changeStatus: 'ALL', dateFrom: '', dateTo: '' };
      findSelectedIds.clear();
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  // 21b. Find & Select Checkbox Selection Events
  const checkAllFind = document.getElementById('check-all-find');
  if (checkAllFind) {
    checkAllFind.onchange = () => {
      const allocations = toolService.getAllocations(findFilters);
      if (checkAllFind.checked) {
        allocations.forEach(a => findSelectedIds.add(a.id));
      } else {
        findSelectedIds.clear();
      }
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  root.querySelectorAll('.check-find-item').forEach(chk => {
    chk.onchange = () => {
      const id = chk.getAttribute('data-id');
      if (chk.checked) findSelectedIds.add(id);
      else findSelectedIds.delete(id);
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  });

  // 21c. Admin Bulk Actions in Find & Select (Admin Controlled)
  const btnBulkDelFind = document.getElementById('btn-admin-bulk-delete-find');
  if (btnBulkDelFind) {
    btnBulkDelFind.onclick = () => {
      ensureAdminAccess(`Bulk Delete ${findSelectedIds.size} Tool Allocations`, () => {
        if (confirm(`Are you sure you want to permanently delete ${findSelectedIds.size} selected tool allocation records?`)) {
          const count = toolService.deleteAllocationsBatch(Array.from(findSelectedIds));
          findSelectedIds.clear();
          window.app?.showToast('Deleted', `Successfully deleted ${count} allocation records.`, 'info');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('find-select');
            initToolsManagementEvents();
          }
        }
      });
    };
  }

  const btnBulkRepFind = document.getElementById('btn-admin-bulk-replace-find');
  if (btnBulkRepFind) {
    btnBulkRepFind.onclick = () => {
      ensureAdminAccess(`Mark ${findSelectedIds.size} items as Replaced`, () => {
        const changeDate = prompt('Enter Replacement Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
        if (changeDate) {
          const remarks = prompt('Enter Replacement Reason / Remarks:', 'Periodic replacement / upgrade');
          findSelectedIds.forEach(id => {
            toolService.updateAllocationItem(id, {
              changeStatus: 'REPLACED',
              changeDate,
              remarks: remarks || 'Replaced by Admin'
            });
          });
          findSelectedIds.clear();
          window.app?.showToast('Bulk Replaced', 'Selected tools updated to Replaced.', 'success');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('find-select');
            initToolsManagementEvents();
          }
        }
      });
    };
  }

  const btnBulkRetFind = document.getElementById('btn-admin-bulk-return-find');
  if (btnBulkRetFind) {
    btnBulkRetFind.onclick = () => {
      ensureAdminAccess(`Mark ${findSelectedIds.size} items as Returned`, () => {
        if (confirm(`Mark ${findSelectedIds.size} selected tools as returned to central maintenance store?`)) {
          const today = new Date().toISOString().split('T')[0];
          findSelectedIds.forEach(id => {
            toolService.updateAllocationItem(id, {
              changeStatus: 'RETURNED',
              changeDate: today,
              remarks: 'Returned to store (Admin Bulk Action)'
            });
          });
          findSelectedIds.clear();
          window.app?.showToast('Bulk Returned', 'Selected tools returned to inventory.', 'info');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('find-select');
            initToolsManagementEvents();
          }
        }
      });
    };
  }

  const btnClearSelFind = document.getElementById('btn-clear-selection-find');
  if (btnClearSelFind) {
    btnClearSelFind.onclick = () => {
      findSelectedIds.clear();
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('find-select');
        initToolsManagementEvents();
      }
    };
  }

  // 21d. Single Item Delete in Find & Select (Admin Controlled)
  root.querySelectorAll('.btn-del-alloc-find').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      ensureAdminAccess('Delete Tool Allocation Record', () => {
        if (confirm('Delete this tool allocation record permanently?')) {
          toolService.deleteAllocationItem(id);
          findSelectedIds.delete(id);
          window.app?.showToast('Deleted', 'Record removed.', 'info');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('find-select');
            initToolsManagementEvents();
          }
        }
      });
    };
  });

  // 21e. Open Excel Import Center Modals
  const btnImpForm = document.getElementById('btn-open-excel-import-form');
  if (btnImpForm) {
    btnImpForm.onclick = () => renderExcelImportCenterModal('ALLOCATIONS');
  }
  const btnImpFind = document.getElementById('btn-open-excel-import-find');
  if (btnImpFind) {
    btnImpFind.onclick = () => renderExcelImportCenterModal('ALLOCATIONS');
  }
  const btnImpAcc = document.getElementById('btn-open-excel-import-acc');
  if (btnImpAcc) {
    btnImpAcc.onclick = () => renderExcelImportCenterModal('TOOLS');
  }

  // 22. Export Filtered History to Excel
  const btnExportFind = document.getElementById('btn-export-find-excel');
  if (btnExportFind) {
    btnExportFind.onclick = () => {
      try {
        toolService.exportAllocationsToExcel(findFilters);
        window.app?.showToast('Excel Exported', 'Allocation history downloaded.', 'success');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // 23. Log Tool Replacement / Change (Admin Controlled Modal)
  root.querySelectorAll('.btn-log-replacement').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const alloc = toolService.getAllocations().find(a => a.id === id);
      if (!alloc) return;
      ensureAdminAccess('Log Tool Replacement', () => {
        renderToolReplacementModal(alloc);
      });
    };
  });

  // 23b. Open User Tool History Modal (From Table Rows, Card ID, Name, Action Buttons)
  root.querySelectorAll('.btn-view-user-hist-row, .btn-view-user-hist-id').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const userId = btn.getAttribute('data-user');
      const code = btn.getAttribute('data-code') || null;
      renderUserToolHistoryModal(userId, code);
    };
  });

  // 23c. Open User Tool History Modal From Find & Select Header Button
  const btnOpenUserHistFind = document.getElementById('btn-open-user-history-find');
  if (btnOpenUserHistFind) {
    btnOpenUserHistFind.onclick = () => {
      renderUserToolHistoryModal(findFilters.userId && findFilters.userId !== 'ALL' ? findFilters.userId : null);
    };
  }

  // 23d. Open User Tool History From Replaced Metric Card
  const cardReplacedClick = document.getElementById('card-click-hist-replaced');
  if (cardReplacedClick) {
    cardReplacedClick.onclick = () => {
      renderUserToolHistoryModal(findFilters.userId && findFilters.userId !== 'ALL' ? findFilters.userId : null);
    };
  }

  // 24. Log Return to Store (Admin Controlled)
  root.querySelectorAll('.btn-log-return').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      ensureAdminAccess('Log Return to Central Store', () => {
        if (confirm('Mark this tool as returned to central maintenance store?')) {
          toolService.updateAllocationItem(id, {
            changeStatus: 'RETURNED',
            changeDate: new Date().toISOString().split('T')[0],
            remarks: 'Returned to store'
          });
          window.app?.showToast('Returned', 'Tool returned to inventory.', 'info');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('find-select');
            initToolsManagementEvents();
          }
        }
      });
    };
  });

  // 24b. Screen 4 Sticky Horizontal Scrollbar Controller Synchronization
  const findTableScroll = document.getElementById('find-table-scroll-container');
  const findStickyScroll = document.getElementById('find-sticky-hscroll-bar');
  const findStickyDummy = document.getElementById('find-sticky-hscroll-dummy');
  const btnScrollLeft = document.getElementById('btn-hscroll-find-left');
  const btnScrollRight = document.getElementById('btn-hscroll-find-right');
  const btnScrollStart = document.getElementById('btn-hscroll-find-start');
  const btnScrollEnd = document.getElementById('btn-hscroll-find-end');

  if (findTableScroll && findStickyScroll && findStickyDummy) {
    const updateStickyTrack = () => {
      const sw = findTableScroll.scrollWidth;
      findStickyDummy.style.width = sw + 'px';
      findStickyScroll.scrollLeft = findTableScroll.scrollLeft;
      const wrapper = document.getElementById('find-sticky-hscroll-wrapper');
      if (wrapper) {
        wrapper.style.display = sw > findTableScroll.clientWidth + 5 ? 'flex' : 'none';
      }
    };
    updateStickyTrack();
    setTimeout(updateStickyTrack, 100);

    let isSyncingFromTable = false;
    let isSyncingFromSticky = false;

    findTableScroll.addEventListener('scroll', () => {
      if (!isSyncingFromSticky) {
        isSyncingFromTable = true;
        findStickyScroll.scrollLeft = findTableScroll.scrollLeft;
        setTimeout(() => { isSyncingFromTable = false; }, 15);
      }
    });

    findStickyScroll.addEventListener('scroll', () => {
      if (!isSyncingFromTable) {
        isSyncingFromSticky = true;
        findTableScroll.scrollLeft = findStickyScroll.scrollLeft;
        setTimeout(() => { isSyncingFromSticky = false; }, 15);
      }
    });

    if (btnScrollLeft) {
      btnScrollLeft.onclick = () => {
        findTableScroll.scrollBy({ left: -240, behavior: 'smooth' });
      };
    }
    if (btnScrollRight) {
      btnScrollRight.onclick = () => {
        findTableScroll.scrollBy({ left: 240, behavior: 'smooth' });
      };
    }
    if (btnScrollStart) {
      btnScrollStart.onclick = () => {
        findTableScroll.scrollTo({ left: 0, behavior: 'smooth' });
      };
    }
    if (btnScrollEnd) {
      btnScrollEnd.onclick = () => {
        findTableScroll.scrollTo({ left: findTableScroll.scrollWidth, behavior: 'smooth' });
      };
    }
  }

  // 25. Accessories Page Category Filters
  root.querySelectorAll('.btn-acc-cat-filter').forEach(btn => {
    btn.onclick = () => {
      accessoriesTabCategory = btn.getAttribute('data-cat');
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('accessories-page');
        initToolsManagementEvents();
      }
    };
  });

  // 26. Accessories Search
  const accSearch = document.getElementById('acc-search-input');
  if (accSearch) {
    accSearch.oninput = () => {
      accessorySearch = accSearch.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('accessories-page');
        initToolsManagementEvents();
      }
    };
  }

  // 27. Export Master Catalog
  const btnExportMaster = document.getElementById('btn-export-master-excel');
  if (btnExportMaster) {
    btnExportMaster.onclick = () => {
      try {
        toolService.exportMasterStockToExcel();
        window.app?.showToast('Master Catalog Exported', 'Master tools & accessories catalog exported to Excel.', 'success');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // 28. Edit Master Stock Modal (Admin Controlled)
  root.querySelectorAll('.btn-edit-master-stock').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');
      const name = btn.getAttribute('data-name');
      const currentStock = btn.getAttribute('data-stock');

      ensureAdminAccess(`Update Stock for ${name}`, () => {
        const newStockStr = prompt(`Update Total Stock for "${name}":`, currentStock);
        if (newStockStr !== null) {
          const newStock = Number(newStockStr);
          if (isNaN(newStock) || newStock < 0) {
            alert('Please enter a valid non-negative number for stock.');
            return;
          }
          if (type === 'TOOL') {
            toolService.updateMasterTool(id, { totalStock: newStock });
          } else {
            toolService.updateMasterAccessory(id, { totalStock: newStock });
          }
          window.app?.showToast('Stock Updated', `Stock for ${name} updated to ${newStock}.`, 'success');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('accessories-page');
            initToolsManagementEvents();
          }
        }
      });
    };
  });

  // 29. Add Master Item Modal Trigger (Admin Controlled)
  const btnAddMaster = document.getElementById('btn-add-master-item-modal');
  if (btnAddMaster) {
    btnAddMaster.onclick = () => {
      ensureAdminAccess('Add Master Catalog Item', () => {
        openAddMasterItemModal();
      });
    };
  }

  // 29b. Master Items Selection Checkboxes
  const chkMasterSelectAll = document.getElementById('chk-master-select-all');
  if (chkMasterSelectAll) {
    chkMasterSelectAll.onchange = () => {
      const isChecked = chkMasterSelectAll.checked;
      root.querySelectorAll('.chk-master-row').forEach(chk => {
        const id = chk.getAttribute('data-id');
        if (isChecked) {
          masterSelectedIds.add(id);
        } else {
          masterSelectedIds.delete(id);
        }
      });
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('accessories-page');
        initToolsManagementEvents();
      }
    };
  }

  root.querySelectorAll('.chk-master-row').forEach(chk => {
    chk.onchange = () => {
      const id = chk.getAttribute('data-id');
      if (chk.checked) {
        masterSelectedIds.add(id);
      } else {
        masterSelectedIds.delete(id);
      }
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('accessories-page');
        initToolsManagementEvents();
      }
    };
  });

  const btnClearMasterSel = document.getElementById('btn-clear-master-selection');
  if (btnClearMasterSel) {
    btnClearMasterSel.onclick = () => {
      masterSelectedIds.clear();
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('accessories-page');
        initToolsManagementEvents();
      }
    };
  }

  // 29c. Delete Master Item (Admin Controlled)
  root.querySelectorAll('.btn-delete-master-item').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const type = btn.getAttribute('data-type');
      const name = btn.getAttribute('data-name');
      const code = btn.getAttribute('data-code');

      ensureAdminAccess(`Delete Master Item "${name}" (${code})`, () => {
        const allAllocations = toolService.getAllocations() || [];
        const activeAllocations = allAllocations.filter(a =>
          (a.itemCode && String(a.itemCode).toLowerCase() === String(code).toLowerCase()) ||
          (a.itemName && a.itemName.toLowerCase() === name.toLowerCase())
        );

        let warningMsg = '';
        if (activeAllocations.length > 0) {
          warningMsg = `\n\n⚠️ Caution: This item is currently allocated to ${activeAllocations.length} mechanic record(s). Deleting it from the master catalog will remove it from future issuance lists.`;
        }

        if (confirm(`🗑️ Delete Master Catalog Item?\n\nItem: ${name} [Code: ${code}]\nCategory: ${type}${warningMsg}\n\nAre you sure you want to permanently delete this item from the master catalog?`)) {
          try {
            if (type === 'TOOL') {
              toolService.deleteMasterTool(id);
            } else {
              toolService.deleteMasterAccessory(id);
            }
            masterSelectedIds.delete(id);
            window.app?.showToast('Master Item Deleted', `Successfully deleted "${name}" from master catalog.`, 'success');
            const container = document.getElementById('tools-tab-content-container');
            if (container) {
              container.innerHTML = renderActiveTab('accessories-page');
              initToolsManagementEvents();
            }
          } catch (err) {
            alert('Delete failed: ' + err.message);
          }
        }
      });
    };
  });

  // 29d. Bulk Delete Master Items (Admin Controlled)
  const btnBulkDeleteMaster = document.getElementById('btn-bulk-delete-master');
  if (btnBulkDeleteMaster) {
    btnBulkDeleteMaster.onclick = () => {
      if (masterSelectedIds.size === 0) {
        alert('Please select at least one item to delete.');
        return;
      }

      const count = masterSelectedIds.size;
      ensureAdminAccess(`Bulk Delete ${count} Master Catalog Items`, () => {
        if (confirm(`⚠️ Admin Authorization Required:\n\nAre you sure you want to permanently delete ${count} selected master catalog items?\n\nThis action cannot be undone.`)) {
          let deletedCount = 0;
          masterSelectedIds.forEach(itemId => {
            try {
              const tool = toolService.getMasterToolById(itemId);
              if (tool) {
                toolService.deleteMasterTool(itemId);
                deletedCount++;
              } else {
                const acc = toolService.getMasterAccessoryById(itemId);
                if (acc) {
                  toolService.deleteMasterAccessory(itemId);
                  deletedCount++;
                }
              }
            } catch (e) {
              console.warn('Error deleting master item:', e);
            }
          });
          masterSelectedIds.clear();
          window.app?.showToast('Bulk Delete Complete', `Successfully deleted ${deletedCount} master catalog items.`, 'success');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('accessories-page');
            initToolsManagementEvents();
          }
        }
      });
    };
  }

  // =========================================================================
  // 30. SCREEN 6 (DATABASE PAGE) EVENT BINDINGS
  // =========================================================================

  // Open Full Import Modal from Database screen
  const btnDbModalCenter = document.getElementById('btn-db-open-modal-center');
  if (btnDbModalCenter) {
    btnDbModalCenter.onclick = () => renderExcelImportCenterModal(databaseDirectImportType);
  }

  // Download Sample Template for Database screen
  const btnDbDownloadTpl = document.getElementById('btn-db-download-template');
  if (btnDbDownloadTpl) {
    btnDbDownloadTpl.onclick = () => {
      try {
        if (databaseDirectImportType === 'ALLOCATIONS') toolService.generateAllocationTemplateExcel();
        else if (databaseDirectImportType === 'TOOLS') toolService.generateMasterToolsTemplateExcel();
        else if (databaseDirectImportType === 'ACCESSORIES') toolService.generateMasterAccessoriesTemplateExcel();
        window.app?.showToast('Template Downloaded', `Sample Excel template for ${databaseDirectImportType} downloaded.`, 'info');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // Export Active Database Table
  const btnDbExportTable = document.getElementById('btn-db-export-active-table');
  if (btnDbExportTable) {
    btnDbExportTable.onclick = () => {
      try {
        if (databaseActiveTable === 'TOOL_ALLOCATIONS') {
          toolService.exportAllocationsToExcel();
        } else {
          toolService.exportMasterStockToExcel();
        }
        window.app?.showToast('Export Complete', `Table ${databaseActiveTable} exported to Excel.`, 'success');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // Switch Import Category in Database screen
  root.querySelectorAll('.btn-db-imp-target').forEach(btn => {
    btn.onclick = () => {
      databaseDirectImportType = btn.getAttribute('data-target');
      databaseDirectParsedRows = [];
      databaseDirectFileName = '';
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
      }
    };
  });

  // Direct In-Page File Dropzone Click
  const dbDropZone = document.getElementById('db-drop-zone');
  const dbFileInput = document.getElementById('db-file-input');
  if (dbDropZone && dbFileInput) {
    dbDropZone.onclick = () => dbFileInput.click();

    dbDropZone.ondragover = (e) => {
      e.preventDefault();
      dbDropZone.style.borderColor = '#22c55e';
    };
    dbDropZone.ondragleave = () => {
      dbDropZone.style.borderColor = databaseDirectFileName ? '#22c55e' : '#475569';
    };
    dbDropZone.ondrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleDbDirectFile(e.dataTransfer.files[0]);
      }
    };
    dbFileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleDbDirectFile(e.target.files[0]);
      }
    };
  }

  function handleDbDirectFile(file) {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS (XLSX) library is loading. Please try again in a moment.');
      return;
    }
    databaseDirectFileName = file.name;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
          alert('No data rows found in this sheet.');
          databaseDirectFileName = '';
          databaseDirectParsedRows = [];
        } else {
          databaseDirectParsedRows = jsonData;
        }

        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab('database-page');
          initToolsManagementEvents();
        }
      } catch (err) {
        alert('Failed to parse Excel file: ' + err.message);
        databaseDirectFileName = '';
        databaseDirectParsedRows = [];
      }
    };
    reader.readAsBinaryString(file);
  }

  // Save Direct Parsed Rows (Admin Controlled)
  const btnDbSaveParsed = document.getElementById('btn-db-save-parsed-rows');
  if (btnDbSaveParsed && databaseDirectParsedRows.length > 0) {
    btnDbSaveParsed.onclick = () => {
      ensureAdminAccess('Import Excel Records into Database', () => {
        try {
          let res = {};
          if (databaseDirectImportType === 'ALLOCATIONS') {
            res = toolService.importAllocationsFromExcel(databaseDirectParsedRows);
            window.app?.showToast('Allocations Saved', `Imported ${res.inserted} allocations into database!`, 'success');
          } else if (databaseDirectImportType === 'TOOLS') {
            res = toolService.importMasterToolsFromExcel(databaseDirectParsedRows);
            window.app?.showToast('Master Tools Saved', `Imported ${res.inserted} new tools, updated ${res.updated} tools.`, 'success');
          } else if (databaseDirectImportType === 'ACCESSORIES') {
            res = toolService.importMasterAccessoriesFromExcel(databaseDirectParsedRows);
            window.app?.showToast('Accessories Saved', `Imported ${res.inserted} new accessories, updated ${res.updated} accessories.`, 'success');
          }

          databaseDirectParsedRows = [];
          databaseDirectFileName = '';

          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('database-page');
            initToolsManagementEvents();
          }
        } catch (err) {
          alert('Import Error: ' + err.message);
        }
      });
    };
  }

  // Switch Active Table Explorer Tab
  root.querySelectorAll('.btn-db-table-switch').forEach(btn => {
    btn.onclick = () => {
      databaseActiveTable = btn.getAttribute('data-table');
      databaseSearch = '';
      dbSelectedIds.clear();
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
      }
    };
  });

  // Table Search Box
  const dbSearchInput = document.getElementById('db-search-input');
  if (dbSearchInput) {
    dbSearchInput.oninput = () => {
      databaseSearch = dbSearchInput.value;
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
        const inputAfter = document.getElementById('db-search-input');
        if (inputAfter) {
          inputAfter.focus({ preventScroll: true });
          inputAfter.setSelectionRange(inputAfter.value.length, inputAfter.value.length);
        }
      }
    };
  }

  const btnDbClearSearch = document.getElementById('btn-db-clear-search');
  if (btnDbClearSearch) {
    btnDbClearSearch.onclick = () => {
      databaseSearch = '';
      dbSelectedIds.clear();
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
      }
    };
  }

  // Screen 6 Database Checkbox Selection Events
  const checkAllDb = document.getElementById('check-all-db');
  if (checkAllDb) {
    checkAllDb.onchange = () => {
      const allAllocations = toolService.getAllocations() || [];
      if (checkAllDb.checked) {
        allAllocations.forEach(a => dbSelectedIds.add(a.id));
      } else {
        dbSelectedIds.clear();
      }
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
      }
    };
  }

  root.querySelectorAll('.check-db-item').forEach(chk => {
    chk.onchange = () => {
      const id = chk.getAttribute('data-id');
      if (chk.checked) dbSelectedIds.add(id);
      else dbSelectedIds.delete(id);
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
      }
    };
  });

  // Admin Bulk Delete in Screen 6 Database (Admin Controlled)
  const btnBulkDelDb = document.getElementById('btn-admin-bulk-delete-db');
  if (btnBulkDelDb) {
    btnBulkDelDb.onclick = () => {
      ensureAdminAccess(`Bulk Delete ${dbSelectedIds.size} Database Records`, () => {
        if (confirm(`Permanently delete ${dbSelectedIds.size} selected records from database?`)) {
          const count = toolService.deleteAllocationsBatch(Array.from(dbSelectedIds));
          dbSelectedIds.clear();
          window.app?.showToast('Deleted', `Permanently removed ${count} records from database.`, 'info');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('database-page');
            initToolsManagementEvents();
          }
        }
      });
    };
  }

  const btnClearSelDb = document.getElementById('btn-clear-selection-db');
  if (btnClearSelDb) {
    btnClearSelDb.onclick = () => {
      dbSelectedIds.clear();
      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('database-page');
        initToolsManagementEvents();
      }
    };
  }

  // Delete Allocation Row in Table Explorer (Admin Controlled)
  root.querySelectorAll('.btn-db-del-alloc').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      ensureAdminAccess('Delete Database Record', () => {
        if (confirm('Delete this tool allocation record permanently from database?')) {
          toolService.deleteAllocationItem(id);
          dbSelectedIds.delete(id);
          window.app?.showToast('Deleted', 'Record removed from database.', 'info');
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('database-page');
            initToolsManagementEvents();
          }
        }
      });
    };
  });

  // Screen 6 Database Sticky Horizontal Scrollbar Controller Synchronization
  const dbTableScroll = document.getElementById('db-table-scroll-container');
  const dbStickyScroll = document.getElementById('db-sticky-hscroll-bar');
  const dbStickyDummy = document.getElementById('db-sticky-hscroll-dummy');
  const btnDbScrollLeft = document.getElementById('btn-hscroll-db-left');
  const btnDbScrollRight = document.getElementById('btn-hscroll-db-right');
  const btnDbScrollStart = document.getElementById('btn-hscroll-db-start');
  const btnDbScrollEnd = document.getElementById('btn-hscroll-db-end');

  if (dbTableScroll && dbStickyScroll && dbStickyDummy) {
    const updateDbStickyTrack = () => {
      const sw = dbTableScroll.scrollWidth;
      dbStickyDummy.style.width = sw + 'px';
      dbStickyScroll.scrollLeft = dbTableScroll.scrollLeft;
      const wrapper = document.getElementById('db-sticky-hscroll-wrapper');
      if (wrapper) {
        wrapper.style.display = sw > dbTableScroll.clientWidth + 5 ? 'flex' : 'none';
      }
    };
    updateDbStickyTrack();
    setTimeout(updateDbStickyTrack, 100);

    let isDbSyncingFromTable = false;
    let isDbSyncingFromSticky = false;

    dbTableScroll.addEventListener('scroll', () => {
      if (!isDbSyncingFromSticky) {
        isDbSyncingFromTable = true;
        dbStickyScroll.scrollLeft = dbTableScroll.scrollLeft;
        setTimeout(() => { isDbSyncingFromTable = false; }, 15);
      }
    });

    dbStickyScroll.addEventListener('scroll', () => {
      if (!isDbSyncingFromTable) {
        isDbSyncingFromSticky = true;
        dbTableScroll.scrollLeft = dbStickyScroll.scrollLeft;
        setTimeout(() => { isDbSyncingFromSticky = false; }, 15);
      }
    });

    if (btnDbScrollLeft) {
      btnDbScrollLeft.onclick = () => {
        dbTableScroll.scrollBy({ left: -240, behavior: 'smooth' });
      };
    }
    if (btnDbScrollRight) {
      btnDbScrollRight.onclick = () => {
        dbTableScroll.scrollBy({ left: 240, behavior: 'smooth' });
      };
    }
    if (btnDbScrollStart) {
      btnDbScrollStart.onclick = () => {
        dbTableScroll.scrollTo({ left: 0, behavior: 'smooth' });
      };
    }
    if (btnDbScrollEnd) {
      btnDbScrollEnd.onclick = () => {
        dbTableScroll.scrollTo({ left: dbTableScroll.scrollWidth, behavior: 'smooth' });
      };
    }
  }
}

// =========================================================================
// MODAL DIALOGS (Staff Selector, Excel Import, Add Master Item)
// =========================================================================

function openStaffSelectorModal() {
  const modalLayer = document.getElementById('modal-layer');
  if (!modalLayer) return;

  const allStaff = employeeService.getAllEmployees() || [];

  modalLayer.innerHTML = `
    <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
      <div style="background: #1e293b; border: 1.5px solid #3b82f6; border-radius: 12px; width: 100%; max-width: 650px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6);">
        
        <div style="background: #0284c7; color: #fff; padding: 12px 18px; font-weight: 800; font-size: 15px; display: flex; justify-content: space-between; align-items: center;">
          <span>Select Employee from Manpower Module</span>
          <button id="btn-close-staff-modal" style="background: transparent; color: #fff; border: none; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 12px 16px; border-bottom: 1px solid #334155;">
          <input type="text" id="modal-staff-search" placeholder="Filter by Name, ID, Designation, Area..." 
            style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 6px; padding: 8px 12px; font-size: 13px;" />
        </div>

        <div id="modal-staff-list" style="flex: 1; overflow-y: auto; padding: 8px;">
          ${allStaff.map(s => `
            <div class="staff-modal-item" data-id="${s.cardNumber || s.id}" data-name="${s.name}" data-title="${s.designation}" data-area="${s.workingArea}"
              style="padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; background: #0f172a; border: 1px solid #334155; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; color: #f1f5f9; font-size: 13.5px;">${s.name}</div>
                <div style="font-size: 11.5px; color: #94a3b8; margin-top: 2px;">
                  <span style="font-family: monospace; color: #38bdf8; font-weight: 700;">${s.cardNumber || s.id}</span> • ${s.designation} • ${s.workingArea}
                </div>
              </div>
              <div>
                <span style="font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: ${s.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.2); color: #86efac;' : 'rgba(239, 68, 68, 0.2); color: #fca5a5;'}">
                  ${s.status}
                </span>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="padding: 10px 16px; background: #0f172a; border-top: 1px solid #334155; text-align: right;">
          <button id="btn-cancel-staff-modal" style="background: #334155; color: #cbd5e1; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12.5px;">Cancel</button>
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-close-staff-modal').onclick = () => { modalLayer.innerHTML = ''; };
  document.getElementById('btn-cancel-staff-modal').onclick = () => { modalLayer.innerHTML = ''; };

  const searchInp = document.getElementById('modal-staff-search');
  const staffList = document.getElementById('modal-staff-list');
  if (searchInp && staffList) {
    searchInp.oninput = () => {
      const q = searchInp.value.toLowerCase().trim();
      const filtered = allStaff.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.cardNumber && String(s.cardNumber).toLowerCase().includes(q)) ||
        (s.designation && s.designation.toLowerCase().includes(q)) ||
        (s.workingArea && s.workingArea.toLowerCase().includes(q))
      );
      staffList.innerHTML = filtered.map(s => `
        <div class="staff-modal-item" data-id="${s.cardNumber || s.id}" data-name="${s.name}" data-title="${s.designation}" data-area="${s.workingArea}"
          style="padding: 10px 14px; border-radius: 6px; margin-bottom: 6px; background: #0f172a; border: 1px solid #334155; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: #f1f5f9; font-size: 13.5px;">${s.name}</div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 2px;">
              <span style="font-family: monospace; color: #38bdf8; font-weight: 700;">${s.cardNumber || s.id}</span> • ${s.designation} • ${s.workingArea}
            </div>
          </div>
          <div>
            <span style="font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: ${s.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.2); color: #86efac;' : 'rgba(239, 68, 68, 0.2); color: #fca5a5;'}">
              ${s.status}
            </span>
          </div>
        </div>
      `).join('');
      bindStaffModalClicks();
    };
  }

  function bindStaffModalClicks() {
    modalLayer.querySelectorAll('.staff-modal-item').forEach(item => {
      item.onclick = () => {
        const id = item.getAttribute('data-id');
        const emp = toolService.getStaffByIdOrCard(id) || {
          cardNumber: id,
          name: item.getAttribute('data-name'),
          designation: item.getAttribute('data-title'),
          workingArea: item.getAttribute('data-area')
        };
        activeUserForm.userId = emp.cardNumber || emp.id || '';
        activeUserForm.userName = emp.name || '';
        activeUserForm.jobTitle = emp.designation || '';
        activeUserForm.workingArea = emp.workingArea || emp.department || '';
        modalLayer.innerHTML = '';

        // Screen 1
        if (document.getElementById('input-emp-id')) document.getElementById('input-emp-id').value = activeUserForm.userId;
        if (document.getElementById('input-emp-name')) document.getElementById('input-emp-name').value = activeUserForm.userName;
        if (document.getElementById('input-emp-title')) document.getElementById('input-emp-title').value = activeUserForm.jobTitle;
        if (document.getElementById('input-emp-area')) document.getElementById('input-emp-area').value = activeUserForm.workingArea;

        // Screen 2
        if (document.getElementById('input-add-user-id')) document.getElementById('input-add-user-id').value = activeUserForm.userId;
        if (document.getElementById('input-add-user-name')) document.getElementById('input-add-user-name').value = activeUserForm.userName;
        if (document.getElementById('input-add-job-title')) document.getElementById('input-add-job-title').value = activeUserForm.jobTitle;
        if (document.getElementById('input-add-working-area')) document.getElementById('input-add-working-area').value = activeUserForm.workingArea;

        window.app?.showToast('Employee Assigned', `Auto-filled details for ${activeUserForm.userName} (${activeUserForm.userId})`, 'success');
      };
    });
  }
  bindStaffModalClicks();
}

function openExcelImportModal() {
  const modalLayer = document.getElementById('modal-layer');
  if (!modalLayer) return;

  modalLayer.innerHTML = `
    <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
      <div style="background: #1e293b; border: 1.5px solid #10b981; border-radius: 12px; width: 100%; max-width: 580px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6);">
        
        <div style="background: #059669; color: #fff; padding: 12px 18px; font-weight: 800; font-size: 15px; display: flex; justify-content: space-between; align-items: center;">
          <span>Bulk Import Tool Allocations from Excel / CSV</span>
          <button id="btn-close-imp-modal" style="background: transparent; color: #fff; border: none; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 20px; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
          <p style="margin-bottom: 12px;">
            Upload an Excel (.xlsx) or CSV file containing historical tool allocation records. The system will automatically map user IDs to the Manpower database, parse equipment names and standard codes, and populate the allocation registry.
          </p>

          <div style="border: 2px dashed #475569; border-radius: 8px; padding: 24px; text-align: center; background: #0f172a; margin-bottom: 16px;">
            <div style="font-size: 36px; margin-bottom: 8px;">📊</div>
            <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;" />
            <button onclick="document.getElementById('excel-file-input').click()" style="background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer;">
              Choose Excel / CSV File
            </button>
            <div id="selected-file-label" style="font-size: 12px; color: #94a3b8; margin-top: 8px;">No file selected</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button id="btn-dl-tmpl-from-modal" style="background: transparent; color: #38bdf8; border: 1px solid #0284c7; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
              📄 Download Template (.xlsx)
            </button>
            <button id="btn-exec-excel-import" style="background: #10b981; color: #000; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 800; font-size: 13px; cursor: pointer;" disabled>
              Import Data Now
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-close-imp-modal').onclick = () => { modalLayer.innerHTML = ''; };
  document.getElementById('btn-dl-tmpl-from-modal').onclick = () => {
    toolService.generateAllocationTemplateExcel();
  };

  const fileInput = document.getElementById('excel-file-input');
  const fileLabel = document.getElementById('selected-file-label');
  const importBtn = document.getElementById('btn-exec-excel-import');
  let parsedRows = [];

  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileLabel.innerText = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
          importBtn.disabled = false;
          fileLabel.innerText += ` • ${parsedRows.length} rows found`;
        } catch (err) {
          alert('Error parsing Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };
  }

  if (importBtn) {
    importBtn.onclick = () => {
      try {
        if (parsedRows.length === 0) {
          alert('No data rows found in selected file.');
          return;
        }
        const res = toolService.importAllocationsFromExcel(parsedRows);
        modalLayer.innerHTML = '';
        window.app?.showToast('Import Complete', `Successfully imported ${res.inserted} tool allocations into database.`, 'success');

        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab(currentActiveTab);
          initToolsManagementEvents();
        }
      } catch (err) {
        alert('Import Error: ' + err.message);
      }
    };
  }
}

function openAddMasterItemModal() {
  const modalLayer = document.getElementById('modal-layer');
  if (!modalLayer) return;

  modalLayer.innerHTML = `
    <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
      <div style="background: #1e293b; border: 1.5px solid #ec4899; border-radius: 12px; width: 100%; max-width: 500px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.6);">
        
        <div style="background: #db2777; color: #fff; padding: 12px 18px; font-weight: 800; font-size: 15px; display: flex; justify-content: space-between; align-items: center;">
          <span>Add New Master Tool / Accessory</span>
          <button id="btn-close-add-master" style="background: transparent; color: #fff; border: none; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 18px; display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Item Type :</label>
            <select id="modal-new-item-type" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px;">
              <option value="TOOL">🔧 Mechanic Tool</option>
              <option value="ACCESSORY">📦 Extra Accessory</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Item Code (e.g. 030 or ACC-11) :</label>
            <input type="text" id="modal-new-code" placeholder="030" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px;" />
          </div>

          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Item Name :</label>
            <input type="text" id="modal-new-name" placeholder="e.g. Torx Key T10" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Total Initial Stock :</label>
              <input type="number" id="modal-new-stock" value="100" min="0" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px;" />
            </div>
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Unit :</label>
              <input type="text" id="modal-new-unit" value="Pcs" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Remarks / Specs :</label>
            <input type="text" id="modal-new-remarks" placeholder="Optional description" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 6px 10px;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button id="btn-cancel-add-master" style="background: #334155; color: #cbd5e1; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="btn-save-new-master" style="background: #ec4899; color: #fff; border: none; padding: 7px 18px; border-radius: 6px; font-weight: 800; cursor: pointer;">Save Master Item</button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-close-add-master').onclick = () => { modalLayer.innerHTML = ''; };
  document.getElementById('btn-cancel-add-master').onclick = () => { modalLayer.innerHTML = ''; };

  document.getElementById('btn-save-new-master').onclick = () => {
    try {
      const type = document.getElementById('modal-new-item-type').value;
      const code = document.getElementById('modal-new-code').value.trim();
      const name = document.getElementById('modal-new-name').value.trim();
      const stock = Number(document.getElementById('modal-new-stock').value) || 0;
      const unit = document.getElementById('modal-new-unit').value.trim() || 'Pcs';
      const remarks = document.getElementById('modal-new-remarks').value.trim();

      if (!code || !name) throw new Error('Code and Name are required.');

      if (type === 'TOOL') {
        toolService.addMasterTool({ code, name, category: 'TOOLS', totalStock: stock, unit, remarks });
      } else {
        toolService.addMasterAccessory({ code, name, defaultQty: '01 Pcs', defaultRemarks: remarks, unit, totalStock: stock });
      }

      modalLayer.innerHTML = '';
      window.app?.showToast('Item Created', `Added ${name} to master catalog.`, 'success');

      const container = document.getElementById('tools-tab-content-container');
      if (container) {
        container.innerHTML = renderActiveTab('accessories-page');
        initToolsManagementEvents();
      }
    } catch (err) {
      alert(err.message);
    }
  };
}

// =========================================================================
// ADMIN PRINT TEMPLATE CUSTOMIZER MODAL (LEFT-SIDE FIXED MASTER DATA & PAGE SETUP)
// =========================================================================
function renderAdminPrintTemplateModal() {
  let modalLayer = document.getElementById('tools-modal-layer') || document.getElementById('modal-layer');
  if (!modalLayer) {
    modalLayer = document.createElement('div');
    modalLayer.id = 'tools-modal-layer';
    document.body.appendChild(modalLayer);
  }

  const tpl = toolService.getPrintTemplateConfig();
  let editAccessories = JSON.parse(JSON.stringify(tpl.accessories || []));
  let currentModalTab = 'page-setup'; // 'page-setup' | 'header-info' | 'accessories' | 'sop-policy' | 'signatories'

  function renderModalInner() {
    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(5px); overflow-y: auto;">
        <div style="background: #1e293b; border: 2px solid #ca8a04; border-radius: 12px; width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.7);">
          
          <!-- Modal Header -->
          <div style="background: linear-gradient(90deg, #ca8a04, #eab308); color: #000; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">⚙️</span>
              <div>
                <h3 style="font-size: 16px; font-weight: 900; margin: 0; letter-spacing: 0.3px;">Print Template &amp; Page Size Customizer</h3>
                <div style="font-size: 11.5px; font-weight: 700; opacity: 0.9;">Configure paper size, layout, company header, fixed extra accessories, SOP rules, and signatories.</div>
              </div>
            </div>
            <button id="btn-close-template-modal" style="background: transparent; border: none; font-size: 22px; font-weight: bold; cursor: pointer; color: #000;">✕</button>
          </div>

          <!-- Section Switcher Tabs -->
          <div style="background: #0f172a; padding: 8px 16px; border-bottom: 1.5px solid #334155; display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0;">
            <button class="btn-tpl-tab ${currentModalTab === 'page-setup' ? 'active' : ''}" data-tab="page-setup"
              style="padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid ${currentModalTab === 'page-setup' ? '#ca8a04' : '#334155'}; background: ${currentModalTab === 'page-setup' ? '#ca8a04; color: #000;' : '#1e293b; color: #cbd5e1;'}">
              📄 1. Page Size &amp; Layout
            </button>
            <button class="btn-tpl-tab ${currentModalTab === 'header-info' ? 'active' : ''}" data-tab="header-info"
              style="padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid ${currentModalTab === 'header-info' ? '#ca8a04' : '#334155'}; background: ${currentModalTab === 'header-info' ? '#ca8a04; color: #000;' : '#1e293b; color: #cbd5e1;'}">
              🏢 2. Company &amp; Header
            </button>
            <button class="btn-tpl-tab ${currentModalTab === 'accessories' ? 'active' : ''}" data-tab="accessories"
              style="padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid ${currentModalTab === 'accessories' ? '#ca8a04' : '#334155'}; background: ${currentModalTab === 'accessories' ? '#ca8a04; color: #000;' : '#1e293b; color: #cbd5e1;'}">
              📦 3. Fixed Accessories (${editAccessories.length})
            </button>
            <button class="btn-tpl-tab ${currentModalTab === 'sop-policy' ? 'active' : ''}" data-tab="sop-policy"
              style="padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid ${currentModalTab === 'sop-policy' ? '#ca8a04' : '#334155'}; background: ${currentModalTab === 'sop-policy' ? '#ca8a04; color: #000;' : '#1e293b; color: #cbd5e1;'}">
              📜 4. SOP &amp; Policy
            </button>
            <button class="btn-tpl-tab ${currentModalTab === 'signatories' ? 'active' : ''}" data-tab="signatories"
              style="padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; border: 1px solid ${currentModalTab === 'signatories' ? '#ca8a04' : '#334155'}; background: ${currentModalTab === 'signatories' ? '#ca8a04; color: #000;' : '#1e293b; color: #cbd5e1;'}">
              ✍️ 5. Signatories &amp; Stamp
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div style="padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 12.5px; color: #e2e8f0; flex: 1; min-height: 0;">
            
            <!-- SECTION 1: PAGE SIZE & PRINT LAYOUT (A4 & POCKET SEPARATE CONTROLS) -->
            <div id="tab-sec-page-setup" style="display: ${currentModalTab === 'page-setup' ? 'flex' : 'none'}; flex-direction: column; gap: 16px;">
              
              <!-- SUB-SECTION 1: A4 FULL PAGE FORM -->
              <div style="background: #0f172a; border: 1.5px solid #3b82f6; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="font-weight: 800; font-size: 14px; color: #60a5fa; display: flex; align-items: center; gap: 6px;">
                    <span>📄</span> 1. A4 Full Page Form Settings (Format A / PDF Page 1):
                  </div>
                  <span style="background: #1e3a8a; color: #93c5fd; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                    Full Sheet Mode
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Paper Dimensions :</label>
                    <select id="inp-tpl-a4-paper-size" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="A4" ${(tpl.a4?.paperSize || tpl.paperSize) === 'A4' ? 'selected' : ''}>A4 (210 × 297 mm) — Standard Sheet</option>
                      <option value="Letter" ${(tpl.a4?.paperSize || tpl.paperSize) === 'Letter' ? 'selected' : ''}>US Letter (8.5 × 11 in / 216 × 279 mm)</option>
                      <option value="Legal" ${(tpl.a4?.paperSize || tpl.paperSize) === 'Legal' ? 'selected' : ''}>Legal (8.5 × 14 in / 216 × 356 mm)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Print Orientation :</label>
                    <select id="inp-tpl-a4-orientation" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="portrait" ${(tpl.a4?.orientation || tpl.orientation) === 'portrait' ? 'selected' : ''}>Portrait (Vertical — Factory Standard)</option>
                      <option value="landscape" ${(tpl.a4?.orientation || tpl.orientation) === 'landscape' ? 'selected' : ''}>Landscape (Horizontal)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Font Scaling / Row Density :</label>
                    <select id="inp-tpl-a4-font-scale" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="compact" ${(tpl.a4?.fontScaling || tpl.fontScaling) === 'compact' ? 'selected' : ''}>Compact (9.5px — Fits more lines)</option>
                      <option value="standard" ${(tpl.a4?.fontScaling || tpl.fontScaling) === 'standard' || !(tpl.a4?.fontScaling || tpl.fontScaling) ? 'selected' : ''}>Standard (10.5px — Factory Default)</option>
                      <option value="large" ${(tpl.a4?.fontScaling || tpl.fontScaling) === 'large' ? 'selected' : ''}>Large (12px — High Readability)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Margins &amp; Padding :</label>
                    <select id="inp-tpl-a4-margins" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="tight" ${(tpl.a4?.marginSize || tpl.marginSize) === 'tight' ? 'selected' : ''}>Tight (6mm × 8mm)</option>
                      <option value="standard" ${(tpl.a4?.marginSize || tpl.marginSize) === 'standard' || !(tpl.a4?.marginSize || tpl.marginSize) ? 'selected' : ''}>Standard (10mm × 12mm)</option>
                      <option value="wide" ${(tpl.a4?.marginSize || tpl.marginSize) === 'wide' ? 'selected' : ''}>Wide (14mm × 16mm)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Extra Blank Dotted Rows :</label>
                    <input type="number" id="inp-tpl-a4-blank-rows" value="${typeof tpl.a4?.extraBlankRows === 'number' ? tpl.a4.extraBlankRows : (typeof tpl.extraBlankRows === 'number' ? tpl.extraBlankRows : 3)}" min="0" max="12"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;" />
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">2-Column Split Ratio :</label>
                    <select id="inp-tpl-a4-split" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="46-54" ${(tpl.a4?.columnSplit || '46-54') === '46-54' ? 'selected' : ''}>46% Left - 54% Right (Standard Factory)</option>
                      <option value="50-50" ${(tpl.a4?.columnSplit) === '50-50' ? 'selected' : ''}>50% Left - 50% Right (Equal 2 Columns)</option>
                      <option value="40-60" ${(tpl.a4?.columnSplit) === '40-60' ? 'selected' : ''}>40% Left - 60% Right (Extra Wide Tools)</option>
                    </select>
                  </div>
                </div>

                <div style="margin-top: 6px; padding-top: 8px; border-top: 1px solid #1e293b; display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" id="inp-tpl-a4-show-stamp" ${tpl.a4?.showStampBox !== false && tpl.showStampBox !== false ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
                  <label for="inp-tpl-a4-show-stamp" style="font-weight: 700; cursor: pointer; color: #f1f5f9; font-size: 12px;">Show Official Factory STAMP &amp; SIGN Box on A4 Sheet</label>
                </div>
              </div>

              <!-- SUB-SECTION 2: POCKET SIZE BAG SLIP (2-CARD SIDE-BY-SIDE ID CARD) -->
              <div style="background: #0f172a; border: 1.5px solid #eab308; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="font-weight: 800; font-size: 14px; color: #facc15; display: flex; align-items: center; gap: 6px;">
                    <span>🏷️</span> 2. Pocket Size Bag Slip Settings (Format B / 2-Card ID Card Layout):
                  </div>
                  <span style="background: #713f12; color: #fef08a; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                    Dual ID Card Mode (Side-by-Side)
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">ID Card / Pocket Preset :</label>
                    <select id="inp-tpl-pocket-preset" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="standard" ${(tpl.pocket?.sizePreset || 'standard') === 'standard' ? 'selected' : ''}>Standard Pocket (125 × 170 mm)</option>
                      <option value="a6" ${(tpl.pocket?.sizePreset) === 'a6' ? 'selected' : ''}>A6 Pocket Slip (105 × 148 mm)</option>
                      <option value="badge" ${(tpl.pocket?.sizePreset) === 'badge' ? 'selected' : ''}>ID Badge Medium (100 × 75 mm)</option>
                      <option value="cr80" ${(tpl.pocket?.sizePreset) === 'cr80' ? 'selected' : ''}>ID Card CR-80 (86 × 54 mm)</option>
                      <option value="custom" ${(tpl.pocket?.sizePreset) === 'custom' ? 'selected' : ''}>Custom (Height × Width)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #38bdf8; margin-bottom: 4px;">Card Width (mm) :</label>
                    <input type="number" id="inp-tpl-pocket-width" value="${tpl.pocket?.cardWidth || 125}" min="50" max="250" step="1"
                      style="width: 100%; background: #1e293b; color: #38bdf8; border: 1.5px solid #0284c7; border-radius: 5px; padding: 7px 10px; font-size: 13px; font-weight: 800;" />
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #38bdf8; margin-bottom: 4px;">Card Height (mm) :</label>
                    <input type="number" id="inp-tpl-pocket-height" value="${tpl.pocket?.cardHeight || 170}" min="40" max="300" step="1"
                      style="width: 100%; background: #1e293b; color: #38bdf8; border: 1.5px solid #0284c7; border-radius: 5px; padding: 7px 10px; font-size: 13px; font-weight: 800;" />
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #fbbf24; margin-bottom: 4px;">Signature Spacing :</label>
                    <select id="inp-tpl-pocket-sig-gap" style="width: 100%; background: #1e293b; color: #fef08a; border: 1px solid #ca8a04; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="15px" ${(tpl.pocket?.signatureMarginTop || '25px') === '15px' ? 'selected' : ''}>15mm (Compact)</option>
                      <option value="25px" ${(tpl.pocket?.signatureMarginTop || '25px') === '25px' ? 'selected' : ''}>25mm (Standard)</option>
                      <option value="35px" ${(tpl.pocket?.signatureMarginTop) === '35px' ? 'selected' : ''}>35mm (Spacious)</option>
                      <option value="50px" ${(tpl.pocket?.signatureMarginTop) === '50px' ? 'selected' : ''}>50mm (Deep / Extra Low)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Card Border Radius :</label>
                    <select id="inp-tpl-pocket-radius" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="8" ${(tpl.pocket?.cardBorderRadius || 8) === 8 ? 'selected' : ''}>Soft Rounded (8px — Standard)</option>
                      <option value="0" ${(tpl.pocket?.cardBorderRadius) === 0 ? 'selected' : ''}>Square Sharp (0px)</option>
                      <option value="14" ${(tpl.pocket?.cardBorderRadius) === 14 ? 'selected' : ''}>Rounded (14px)</option>
                      <option value="20" ${(tpl.pocket?.cardBorderRadius) === 20 ? 'selected' : ''}>Extra Rounded (20px)</option>
                    </select>
                  </div>

                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Tools on Card 1 Split :</label>
                    <select id="inp-tpl-pocket-split" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="20" ${(tpl.pocket?.toolsSplitCount || 20) === 20 ? 'selected' : ''}>20 Tools on Card 1 (Standard)</option>
                      <option value="18" ${(tpl.pocket?.toolsSplitCount) === 18 ? 'selected' : ''}>18 Tools on Card 1</option>
                      <option value="22" ${(tpl.pocket?.toolsSplitCount) === 22 ? 'selected' : ''}>22 Tools on Card 1</option>
                    </select>
                  </div>
                </div>

                <div style="margin-top: 6px; padding-top: 8px; border-top: 1px solid #1e293b; display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="inp-tpl-pocket-show-stamp" ${tpl.pocket?.showStampBox === true ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
                    <label for="inp-tpl-pocket-show-stamp" style="font-weight: 700; cursor: pointer; color: #f1f5f9; font-size: 12px;">Show STAMP &amp; SIGNATURE Box (Off by default)</label>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="inp-tpl-pocket-show-accs" ${tpl.pocket?.showAccessories !== false ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
                    <label for="inp-tpl-pocket-show-accs" style="font-weight: 700; cursor: pointer; color: #f1f5f9; font-size: 12px;">Show Extra Accessories on Pocket Card 2</label>
                  </div>
                </div>
              </div>

            </div>

            <!-- SECTION 2: COMPANY & HEADER DETAILS -->
            <div id="tab-sec-header-info" style="display: ${currentModalTab === 'header-info' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 14px;">
                <div style="font-weight: 800; font-size: 14px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
                  <span>🏢 Factory Header &amp; Dynamic Unit Configuration:</span>
                  <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">Card Number $\rightarrow$ Group Manpower Unit</span>
                </div>

                <!-- Dynamic Employee Unit Resolution Banner -->
                <div style="background: rgba(14, 165, 233, 0.12); border: 1.5px solid #0284c7; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="checkbox" id="inp-tpl-dynamic-unit" ${tpl.useDynamicEmployeeUnit !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
                      <label for="inp-tpl-dynamic-unit" style="font-weight: 800; font-size: 13px; color: #38bdf8; cursor: pointer;">
                        ⚡ Dynamic Factory Unit from Employee Card Number (Group Manpower)
                      </label>
                    </div>
                    <span style="background: #0369a1; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">
                      Active (Recommended)
                    </span>
                  </div>
                  <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
                    When enabled, print headers automatically fetch and display the mechanic's assigned Factory Unit (e.g. <b>A.K.M Knit Wear Ltd.</b>, <b>Pacific Blue (Jeans Wear) Ltd.</b>, <b>Al-Muslim Apparels Ltd.</b>) from the Group Manpower Database based on their Card Number.
                  </div>
                  <div style="background: #0f172a; padding: 8px 12px; border-radius: 6px; border: 1px dashed #38bdf8; font-size: 11.5px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                    <span style="color: #94a3b8;">Current Card (${activeUserForm.userId || 'AMG-0147075'}) Resolved Unit:</span>
                    <span style="font-weight: 800; color: #4ade80;">🏢 ${toolService.getResolvedCompanyHeader(activeUserForm.userId || currentPrintRegNo, tpl).companyName} <span style="color: #94a3b8; font-weight: 600;">${toolService.getResolvedCompanyHeader(activeUserForm.userId || currentPrintRegNo, tpl).companySubtitle}</span></span>
                  </div>
                </div>
                
                <div style="font-weight: 700; font-size: 12px; color: #fbbf24; margin-top: 4px;">Fallback / Custom Company Information (used if no employee unit is found):</div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Default Company Name :</label>
                    <input type="text" id="inp-tpl-comp-name" value="${tpl.companyName || 'A.K.M Knit Wear Ltd.'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Company Subtitle / Sister Concern :</label>
                    <input type="text" id="inp-tpl-comp-sub" value="${tpl.companySubtitle || '(A sister concern of Al-Muslim Group)'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px;" />
                  </div>
                </div>

                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Factory Physical Address :</label>
                  <input type="text" id="inp-tpl-comp-addr" value="${tpl.companyAddress || '14, Gadda, Karnapara, Ulail, Savar, Dhaka.'}"
                    style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px;" />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Department Name :</label>
                    <input type="text" id="inp-tpl-dept-name" value="${tpl.departmentName || 'Maintenance Department'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Document Header Title :</label>
                    <input type="text" id="inp-tpl-list-title" value="${tpl.listTitle || 'Maintenance Tools / Equipment List'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px;" />
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 3: FIXED EXTRA ACCESSORIES MASTER LIST -->
            <div id="tab-sec-accessories" style="display: ${currentModalTab === 'accessories' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div>
                    <span style="font-weight: 800; font-size: 14px; color: #fbbf24;">📦 Standard Extra Accessories List (Left Side Table):</span>
                    <div style="font-size: 11.5px; color: #94a3b8;">These default items appear on the left column for every mechanic.</div>
                  </div>
                  <button id="btn-modal-add-acc-row" style="background: #16a34a; color: #fff; border: none; padding: 6px 14px; border-radius: 5px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    <span>➕</span> Add New Accessory
                  </button>
                </div>

                <div style="max-height: 280px; overflow-y: auto; border: 1px solid #1e293b; border-radius: 6px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                      <tr style="background: #1e293b; color: #94a3b8; text-align: left; border-bottom: 1.5px solid #334155;">
                        <th style="padding: 8px 10px; width: 40px; text-align: center;">#</th>
                        <th style="padding: 8px 10px;">Accessory Name</th>
                        <th style="padding: 8px 10px; width: 130px;">Default Quantity</th>
                        <th style="padding: 8px 10px; width: 130px;">Variance / Remarks</th>
                        <th style="padding: 8px 10px; width: 60px; text-align: center;">Action</th>
                      </tr>
                    </thead>
                    <tbody id="template-accessories-tbody">
                      ${editAccessories.map((acc, idx) => `
                        <tr style="border-bottom: 1px solid #1e293b; background: ${idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent'};">
                          <td style="padding: 6px 8px; text-align: center; color: #64748b; font-family: monospace; font-weight: 700;">${idx + 1}</td>
                          <td style="padding: 6px 8px;">
                            <input type="text" class="inp-tpl-acc-name" data-index="${idx}" value="${acc.name || acc.itemName || ''}" placeholder="e.g. Super Glue"
                              style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px; font-size: 12px;" />
                          </td>
                          <td style="padding: 6px 8px;">
                            <input type="text" class="inp-tpl-acc-qty" data-index="${idx}" value="${acc.qty || acc.quantity || ''}" placeholder="01 Pcs"
                              style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px; font-size: 12px;" />
                          </td>
                          <td style="padding: 6px 8px;">
                            <input type="text" class="inp-tpl-acc-rem" data-index="${idx}" value="${acc.remarks || ''}" placeholder="±01 or #01"
                              style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 4px; padding: 5px 8px; font-size: 12px;" />
                          </td>
                          <td style="padding: 6px 8px; text-align: center;">
                            <button class="btn-del-tpl-acc" data-index="${idx}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 3px 7px; border-radius: 4px; cursor: pointer; font-size: 11px;" title="Delete row">
                              🗑️
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- SECTION 4: SOP DECLARATION & RULES -->
            <div id="tab-sec-sop-policy" style="display: ${currentModalTab === 'sop-policy' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div style="font-weight: 800; font-size: 14px; color: #a855f7;">📜 Factory SOP Declaration Box &amp; Policy:</div>
                
                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Main SOP Statement (English) :</label>
                  <textarea id="inp-tpl-sop-eng" rows="3" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 8px 10px; font-size: 12.5px; resize: vertical;">${tpl.sopEnglish || ''}</textarea>
                </div>

                <div>
                  <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Secondary SOP Note / Factory Declaration :</label>
                  <textarea id="inp-tpl-sop-ben" rows="2" placeholder="Optional sub-note or factory policy details" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 8px 10px; font-size: 12.5px; resize: vertical;">${tpl.sopBengali || ''}</textarea>
                </div>
              </div>
            </div>

            <!-- SECTION 5: SIGNATORIES & STAMP -->
            <div id="tab-sec-signatories" style="display: ${currentModalTab === 'signatories' ? 'flex' : 'none'}; flex-direction: column; gap: 14px;">
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div style="font-weight: 800; font-size: 14px; color: #86efac;">✍️ Bottom Official Signatories Configuration:</div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Signatory 1 Title :</label>
                    <input type="text" id="inp-tpl-sig-1" value="${(tpl.signatories && tpl.signatories[0]?.title) || 'Registered By'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Signatory 2 Title :</label>
                    <input type="text" id="inp-tpl-sig-2" value="${(tpl.signatories && tpl.signatories[1]?.title) || 'AGM/Sr. AGM'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Signatory 3 Title :</label>
                    <input type="text" id="inp-tpl-sig-3" value="${(tpl.signatories && tpl.signatories[2]?.title) || 'General Manager'}"
                      style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;" />
                  </div>
                </div>

                <!-- Signature Distance Below Table Setting (niche sin ar gor namao) -->
                <div style="margin-top: 10px; padding-top: 12px; border-top: 1px dashed #334155; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: center;">
                  <div>
                    <label style="display: block; font-size: 11.5px; font-weight: 700; color: #fbbf24; margin-bottom: 4px;">
                      Signature Distance Below Table End (Gap) :
                    </label>
                    <select id="inp-tpl-sig-gap" style="width: 100%; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                      <option value="35px" ${(tpl.a4?.signatureMarginTop === '35px' || tpl.signatureMarginTop === '35px' || !tpl.signatureMarginTop) ? 'selected' : ''}>35 mm / ~1.4 in (Lowered &amp; Spacious - Recommended)</option>
                      <option value="25px" ${(tpl.a4?.signatureMarginTop === '25px' || tpl.signatureMarginTop === '25px') ? 'selected' : ''}>25 mm / ~1.0 in (Standard Distance)</option>
                      <option value="50px" ${(tpl.a4?.signatureMarginTop === '50px' || tpl.signatureMarginTop === '50px') ? 'selected' : ''}>50 mm / ~2.0 in (Deep Lowered)</option>
                      <option value="15px" ${(tpl.a4?.signatureMarginTop === '15px' || tpl.signatureMarginTop === '15px' || tpl.signatureMarginTop === '0.2in') ? 'selected' : ''}>15 mm / ~0.6 in (Compact Distance)</option>
                    </select>
                  </div>
                  <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.4;">
                    Controls the vertical gap spacing below the tables and SOP box to give ample physical room for manager signatures and date stamps.
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Modal Footer Actions -->
          <div style="background: #0f172a; border-top: 1.5px solid #334155; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <button id="btn-reset-factory-template" style="background: #334155; color: #f1f5f9; border: 1px solid #475569; padding: 7px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">
              ↺ Reset to Factory Default
            </button>

            <div style="display: flex; gap: 8px;">
              <button id="btn-cancel-template-modal" style="background: #1e293b; color: #cbd5e1; border: 1px solid #475569; padding: 7px 16px; border-radius: 6px; cursor: pointer; font-size: 12.5px;">
                Cancel
              </button>
              <button id="btn-save-template-modal" style="background: #ca8a04; color: #000; border: 1px solid #eab308; padding: 7px 24px; border-radius: 6px; font-weight: 900; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(202,138,4,0.4);">
                <span>💾</span> Save Template &amp; Apply
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function bindModalEvents() {
    modalLayer.innerHTML = renderModalInner();

    // Close & Cancel
    document.getElementById('btn-close-template-modal').onclick = () => { modalLayer.innerHTML = ''; };
    document.getElementById('btn-cancel-template-modal').onclick = () => { modalLayer.innerHTML = ''; };

    // Section Tab Switching
    modalLayer.querySelectorAll('.btn-tpl-tab').forEach(btn => {
      btn.onclick = () => {
        syncInputsToState();
        currentModalTab = btn.getAttribute('data-tab');
        bindModalEvents();
      };
    });

    // Add Accessory Row
    const btnAddAccRow = document.getElementById('btn-modal-add-acc-row');
    if (btnAddAccRow) {
      btnAddAccRow.onclick = () => {
        syncInputsToState();
        editAccessories.push({ name: 'New Accessory', qty: '01 Pcs', remarks: '±01' });
        bindModalEvents();
      };
    }

    // Delete Accessory Row
    modalLayer.querySelectorAll('.btn-del-tpl-acc').forEach(btn => {
      btn.onclick = () => {
        syncInputsToState();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx)) {
          editAccessories.splice(idx, 1);
          bindModalEvents();
        }
      };
    });

    function syncInputsToState() {
      modalLayer.querySelectorAll('.inp-tpl-acc-name').forEach(inp => {
        const i = parseInt(inp.getAttribute('data-index'), 10);
        if (editAccessories[i]) editAccessories[i].name = inp.value.trim();
      });
      modalLayer.querySelectorAll('.inp-tpl-acc-qty').forEach(inp => {
        const i = parseInt(inp.getAttribute('data-index'), 10);
        if (editAccessories[i]) editAccessories[i].qty = inp.value.trim();
      });
      modalLayer.querySelectorAll('.inp-tpl-acc-rem').forEach(inp => {
        const i = parseInt(inp.getAttribute('data-index'), 10);
        if (editAccessories[i]) editAccessories[i].remarks = inp.value.trim();
      });
    }

    // Reset Factory Default
    const btnReset = document.getElementById('btn-reset-factory-template');
    if (btnReset) {
      btnReset.onclick = () => {
        if (confirm('Reset template to standard factory default (Original 10 accessories, standard A4 layout & default SOP)?')) {
          toolService.resetPrintTemplateConfig();
          modalLayer.innerHTML = '';
          window.app?.showToast('Template Reset', 'Print template restored to factory defaults.', 'info');

          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab('print-page');
            initToolsManagementEvents();
          }
        }
      };
    }

    // Save Template
    const btnSave = document.getElementById('btn-save-template-modal');
    if (btnSave) {
      btnSave.onclick = () => {
        syncInputsToState();

        // 1. A4 Full Page Settings
        const a4PaperSize = document.getElementById('inp-tpl-a4-paper-size')?.value || tpl.a4?.paperSize || 'A4';
        const a4Orientation = document.getElementById('inp-tpl-a4-orientation')?.value || tpl.a4?.orientation || 'portrait';
        const a4FontScaling = document.getElementById('inp-tpl-a4-font-scale')?.value || tpl.a4?.fontScaling || 'standard';
        const a4MarginSize = document.getElementById('inp-tpl-a4-margins')?.value || tpl.a4?.marginSize || 'standard';
        const a4BlankRows = Number(document.getElementById('inp-tpl-a4-blank-rows')?.value) || 0;
        const a4ColumnSplit = document.getElementById('inp-tpl-a4-split')?.value || tpl.a4?.columnSplit || '46-54';
        const a4ShowStamp = document.getElementById('inp-tpl-a4-show-stamp') ? document.getElementById('inp-tpl-a4-show-stamp').checked : false;

        // 2. Pocket Size Slip Settings (Custom W x H & ID Card)
        const pocketPreset = document.getElementById('inp-tpl-pocket-preset')?.value || tpl.pocket?.sizePreset || 'standard';
        const pocketWidth = Number(document.getElementById('inp-tpl-pocket-width')?.value) || tpl.pocket?.cardWidth || 125;
        const pocketHeight = Number(document.getElementById('inp-tpl-pocket-height')?.value) || tpl.pocket?.cardHeight || 170;
        const pocketSigGap = document.getElementById('inp-tpl-pocket-sig-gap')?.value || tpl.pocket?.signatureMarginTop || '25px';
        const pocketRadius = Number(document.getElementById('inp-tpl-pocket-radius')?.value) || 8;
        const pocketSplit = Number(document.getElementById('inp-tpl-pocket-split')?.value) || 20;
        const pocketGap = Number(document.getElementById('inp-tpl-pocket-gap')?.value) || 8;
        const pocketShowStamp = document.getElementById('inp-tpl-pocket-show-stamp') ? document.getElementById('inp-tpl-pocket-show-stamp').checked : false;
        const pocketShowAccs = document.getElementById('inp-tpl-pocket-show-accs') ? document.getElementById('inp-tpl-pocket-show-accs').checked : true;

        // Sync local pocketCustomSettings
        pocketCustomSettings.preset = pocketPreset;
        pocketCustomSettings.width = pocketWidth;
        pocketCustomSettings.height = pocketHeight;
        pocketCustomSettings.sigGap = pocketSigGap;
        pocketCustomSettings.splitCount = pocketSplit;
        pocketCustomSettings._userModified = true;

        const compName = document.getElementById('inp-tpl-comp-name')?.value.trim() || tpl.companyName || 'A.K.M Knit Wear Ltd.';
        const compSub = document.getElementById('inp-tpl-comp-sub')?.value.trim() || tpl.companySubtitle || '(A sister concern of Al-Muslim Group)';
        const compAddr = document.getElementById('inp-tpl-comp-addr')?.value.trim() || tpl.companyAddress || '14, Gadda, Karnapara, Ulail, Savar, Dhaka.';
        const deptName = document.getElementById('inp-tpl-dept-name')?.value.trim() || tpl.departmentName || 'Maintenance Department';
        const listTitle = document.getElementById('inp-tpl-list-title')?.value.trim() || tpl.listTitle || 'Maintenance Tools / Equipment List';

        const sopEng = document.getElementById('inp-tpl-sop-eng')?.value || tpl.sopEnglish || '';
        const sopBen = document.getElementById('inp-tpl-sop-ben')?.value || tpl.sopBengali || '';

        const sig1 = document.getElementById('inp-tpl-sig-1')?.value.trim() || (tpl.signatories && tpl.signatories[0]?.title) || 'Registered By';
        const sig2 = document.getElementById('inp-tpl-sig-2')?.value.trim() || (tpl.signatories && tpl.signatories[1]?.title) || 'AGM/Sr. AGM';
        const sig3 = document.getElementById('inp-tpl-sig-3')?.value.trim() || (tpl.signatories && tpl.signatories[2]?.title) || 'General Manager';
        const sigGap = document.getElementById('inp-tpl-sig-gap')?.value || tpl.a4?.signatureMarginTop || tpl.signatureMarginTop || '35px';
        const dynamicUnit = document.getElementById('inp-tpl-dynamic-unit') ? document.getElementById('inp-tpl-dynamic-unit').checked : (tpl.useDynamicEmployeeUnit !== false);

        const newConfig = {
          // A4 Page Customization
          a4: {
            paperSize: a4PaperSize,
            orientation: a4Orientation,
            fontScaling: a4FontScaling,
            marginSize: a4MarginSize,
            extraBlankRows: a4BlankRows,
            columnSplit: a4ColumnSplit,
            showStampBox: a4ShowStamp,
            signatureMarginTop: sigGap
          },
          // Pocket Slip Customization
          pocket: {
            cardDimensions: pocketPreset,
            sizePreset: pocketPreset,
            cardWidth: pocketWidth,
            cardHeight: pocketHeight,
            cardBorderRadius: pocketRadius,
            fontScaling: 'standard',
            toolsSplitCount: pocketSplit,
            cardGap: pocketGap,
            signatureMarginTop: pocketSigGap,
            showStampBox: pocketShowStamp,
            showAccessories: pocketShowAccs,
            showSignatures: true
          },
          // Root fallbacks
          paperSize: a4PaperSize,
          orientation: a4Orientation,
          fontScaling: a4FontScaling,
          marginSize: a4MarginSize,
          extraBlankRows: a4BlankRows,
          showStampBox: a4ShowStamp,
          signatureMarginTop: sigGap,

          useDynamicEmployeeUnit: dynamicUnit,
          companyName: compName,
          companySubtitle: compSub,
          companyAddress: compAddr,
          departmentName: deptName,
          listTitle,
          sopEnglish: sopEng,
          sopBengali: sopBen,
          accessories: editAccessories,
          signatories: [
            { title: sig1 },
            { title: sig2 },
            { title: sig3 }
          ]
        };

        toolService.savePrintTemplateConfig(newConfig);
        modalLayer.innerHTML = '';
        window.app?.showToast('Template Saved', 'Admin custom template & page settings updated successfully.', 'success');

        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab('print-page');
          initToolsManagementEvents();
        }
      };
    }
  }

  bindModalEvents();
}

// =========================================================================
// EXCEL DATA IMPORT CENTER MODAL (PREVIOUS ALLOCATIONS & MASTER CATALOG)
// =========================================================================
function renderExcelImportCenterModal(initialTarget = 'ALLOCATIONS') {
  const modalLayer = document.getElementById('tools-modal-layer');
  if (!modalLayer) return;

  let activeImportTab = initialTarget; // 'ALLOCATIONS' | 'TOOLS' | 'ACCESSORIES'
  let parsedDataRows = [];
  let selectedFileName = '';
  let isParsing = false;

  function renderModalInner() {
    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; backdrop-filter: blur(5px); overflow-y: auto;">
        <div style="background: #1e293b; border: 1.5px solid #16a34a; border-radius: 12px; width: 100%; max-width: 920px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.7);">
          
          <!-- Header -->
          <div style="background: linear-gradient(90deg, #15803d, #22c55e); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📥</span>
              <div>
                <h3 style="font-size: 16px; font-weight: 900; margin: 0; letter-spacing: 0.3px;">Excel Data Import Center</h3>
                <div style="font-size: 11.5px; opacity: 0.9; margin-top: 1px;">Import previous mechanic tool registrations, allocations, or master stock from .xlsx, .xls, or .csv files.</div>
              </div>
            </div>
            <button id="btn-close-excel-modal" style="background: transparent; border: none; font-size: 22px; font-weight: bold; cursor: pointer; color: #fff;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 12.5px; color: #e2e8f0; flex: 1; min-height: 0;">
            
            <!-- Tab Selector -->
            <div style="display: flex; gap: 8px; border-bottom: 2px solid #334155; padding-bottom: 8px;">
              <button class="btn-imp-tab ${activeImportTab === 'ALLOCATIONS' ? 'active' : ''}" data-tab="ALLOCATIONS"
                style="background: ${activeImportTab === 'ALLOCATIONS' ? '#2563eb' : '#0f172a'}; color: #fff; border: 1px solid ${activeImportTab === 'ALLOCATIONS' ? '#3b82f6' : '#334155'}; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                🔧 Previous Tool Allocations (Mechanic Registrations)
              </button>
              <button class="btn-imp-tab ${activeImportTab === 'TOOLS' ? 'active' : ''}" data-tab="TOOLS"
                style="background: ${activeImportTab === 'TOOLS' ? '#2563eb' : '#0f172a'}; color: #fff; border: 1px solid ${activeImportTab === 'TOOLS' ? '#3b82f6' : '#334155'}; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                🛠️ Master Tools List (Tools Catalog)
              </button>
              <button class="btn-imp-tab ${activeImportTab === 'ACCESSORIES' ? 'active' : ''}" data-tab="ACCESSORIES"
                style="background: ${activeImportTab === 'ACCESSORIES' ? '#2563eb' : '#0f172a'}; color: #fff; border: 1px solid ${activeImportTab === 'ACCESSORIES' ? '#3b82f6' : '#334155'}; padding: 6px 14px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                📦 Master Accessories List (Accessories Catalog)
              </button>
            </div>

            <!-- Step 1: Download Template Helper -->
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="font-weight: 800; font-size: 12px; color: #fbbf24;">💡 Need a standard format?</div>
                <div style="font-size: 11.5px; color: #94a3b8; margin-top: 2px;">Download our pre-formatted Excel template with sample rows to format your historical data quickly.</div>
              </div>
              <button id="btn-download-import-template" style="background: #0284c7; color: #fff; border: 1px solid #0369a1; padding: 5px 12px; border-radius: 5px; font-weight: 700; font-size: 11.5px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <span>📥</span> Download Sample Excel Template (.xlsx)
              </button>
            </div>

            <!-- Step 2: File Upload / Drag and Drop Area -->
            <div id="excel-drop-zone" style="border: 2px dashed ${selectedFileName ? '#22c55e' : '#475569'}; border-radius: 8px; padding: 24px 16px; text-align: center; background: ${selectedFileName ? 'rgba(34, 197, 94, 0.05)' : '#0f172a'}; cursor: pointer; transition: all 0.2s;">
              <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;" />
              <div style="font-size: 36px; margin-bottom: 6px;">${selectedFileName ? '📊' : '📁'}</div>
              <div style="font-size: 14px; font-weight: 800; color: #f1f5f9;">
                ${selectedFileName ? `Selected: <span style="color: #22c55e;">${selectedFileName}</span>` : 'Click here or Drag &amp; Drop your Excel (.xlsx, .xls, .csv) file'}
              </div>
              <div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">
                ${selectedFileName ? `${parsedDataRows.length} data rows successfully parsed and ready for import.` : 'Supports files up to 10MB'}
              </div>
            </div>

            <!-- Step 3: Live Preview Table -->
            ${parsedDataRows.length > 0 ? `
              <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 800; font-size: 12px; color: #38bdf8;">
                    Data Preview (First ${Math.min(parsedDataRows.length, 10)} of ${parsedDataRows.length} rows):
                  </span>
                  <span style="background: #16a34a; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">
                    ✓ ${parsedDataRows.length} Valid Rows
                  </span>
                </div>
                <div style="max-height: 200px; overflow: auto; border: 1px solid #1e293b; border-radius: 4px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                      <tr style="background: #1e293b; color: #94a3b8; text-align: left; border-bottom: 1px solid #334155;">
                        <th style="padding: 6px 8px; width: 35px; text-align: center;">#</th>
                        ${Object.keys(parsedDataRows[0] || {}).slice(0, 6).map(k => `
                          <th style="padding: 6px 8px;">${k}</th>
                        `).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${parsedDataRows.slice(0, 10).map((row, idx) => `
                        <tr style="border-bottom: 1px solid #1e293b;">
                          <td style="padding: 4px 6px; text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
                          ${Object.values(row).slice(0, 6).map(val => `
                            <td style="padding: 4px 6px; color: #e2e8f0;">${val !== undefined && val !== null ? String(val) : '-'}</td>
                          `).join('')}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}

          </div>

          <!-- Footer Actions -->
          <div style="background: #0f172a; border-top: 1px solid #334155; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
            <button id="btn-cancel-excel-modal" style="background: #334155; color: #cbd5e1; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;">
              Cancel
            </button>
            <button id="btn-execute-import" ${parsedDataRows.length === 0 ? 'disabled' : ''}
              style="background: ${parsedDataRows.length === 0 ? '#475569' : '#16a34a'}; color: ${parsedDataRows.length === 0 ? '#94a3b8' : '#fff'}; border: none; padding: 7px 22px; border-radius: 6px; font-weight: 800; font-size: 13px; cursor: ${parsedDataRows.length === 0 ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
              <span>📥</span> Import ${parsedDataRows.length > 0 ? `${parsedDataRows.length} Rows to System` : 'Data to System'}
            </button>
          </div>

        </div>
      </div>
    `;
  }

  function bindModalEvents() {
    modalLayer.innerHTML = renderModalInner();

    // Close & Cancel
    document.getElementById('btn-close-excel-modal').onclick = () => { modalLayer.innerHTML = ''; };
    document.getElementById('btn-cancel-excel-modal').onclick = () => { modalLayer.innerHTML = ''; };

    // Tab Switching
    modalLayer.querySelectorAll('.btn-imp-tab').forEach(btn => {
      btn.onclick = () => {
        activeImportTab = btn.getAttribute('data-tab');
        parsedDataRows = [];
        selectedFileName = '';
        bindModalEvents();
      };
    });

    // Download Template
    document.getElementById('btn-download-import-template').onclick = () => {
      try {
        if (activeImportTab === 'ALLOCATIONS') {
          toolService.generateAllocationTemplateExcel();
        } else if (activeImportTab === 'TOOLS') {
          toolService.generateMasterToolsTemplateExcel();
        } else if (activeImportTab === 'ACCESSORIES') {
          toolService.generateMasterAccessoriesTemplateExcel();
        }
        window.app?.showToast('Template Downloaded', `Sample template downloaded for ${activeImportTab}.`, 'info');
      } catch (err) {
        alert(err.message);
      }
    };

    // File Dropzone Click
    const dropZone = document.getElementById('excel-drop-zone');
    const fileInput = document.getElementById('excel-file-input');

    dropZone.onclick = () => {
      fileInput.click();
    };

    // Drag and drop handlers
    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#38bdf8';
      dropZone.style.background = 'rgba(56, 189, 248, 0.08)';
    };

    dropZone.ondragleave = () => {
      dropZone.style.borderColor = selectedFileName ? '#22c55e' : '#475569';
      dropZone.style.background = selectedFileName ? 'rgba(34, 197, 94, 0.05)' : '#0f172a';
    };

    dropZone.ondrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    };

    function handleFileSelect(file) {
      if (typeof XLSX === 'undefined') {
        alert('SheetJS (XLSX) library is loading. Please try again in a moment.');
        return;
      }

      selectedFileName = file.name;
      const reader = new FileReader();

      reader.onload = (evt) => {
        try {
          const data = evt.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!Array.isArray(jsonData) || jsonData.length === 0) {
            alert('No data rows found in this sheet.');
            selectedFileName = '';
            parsedDataRows = [];
          } else {
            parsedDataRows = jsonData;
          }
          bindModalEvents();
        } catch (err) {
          alert('Failed to parse Excel file: ' + err.message);
          selectedFileName = '';
          parsedDataRows = [];
          bindModalEvents();
        }
      };

      reader.readAsBinaryString(file);
    }

    // Execute Import Button
    const btnExecute = document.getElementById('btn-execute-import');
    if (btnExecute && parsedDataRows.length > 0) {
      btnExecute.onclick = () => {
        try {
          let result = {};
          if (activeImportTab === 'ALLOCATIONS') {
            result = toolService.importAllocationsFromExcel(parsedDataRows);
            window.app?.showToast('Allocations Imported', `Successfully imported ${result.inserted} tool allocations!`, 'success');
          } else if (activeImportTab === 'TOOLS') {
            result = toolService.importMasterToolsFromExcel(parsedDataRows);
            window.app?.showToast('Master Tools Imported', `Imported ${result.inserted} new tools, updated ${result.updated} tools.`, 'success');
          } else if (activeImportTab === 'ACCESSORIES') {
            result = toolService.importMasterAccessoriesFromExcel(parsedDataRows);
            window.app?.showToast('Accessories Imported', `Imported ${result.inserted} new accessories, updated ${result.updated} accessories.`, 'success');
          }

          modalLayer.innerHTML = '';

          // Refresh current tab view
          const container = document.getElementById('tools-tab-content-container');
          if (container) {
            container.innerHTML = renderActiveTab(currentActiveTab);
            initToolsManagementEvents();
          }
        } catch (err) {
          alert('Import failed: ' + err.message);
        }
      };
    }
  }

  bindModalEvents();
}

// =========================================================================
// 8. INTERACTIVE TOOL REPLACEMENT MODAL
// =========================================================================
function renderToolReplacementModal(item) {
  if (!item) return;
  let modalLayer = document.getElementById('tools-modal-layer') || document.getElementById('modal-layer');
  if (!modalLayer) {
    modalLayer = document.createElement('div');
    modalLayer.id = 'tools-modal-layer';
    document.body.appendChild(modalLayer);
  }

  const userId = item.userId || activeUserForm.userId;
  const itemCode = item.itemCode;
  const priorCount = toolService.getToolReplacementCount(userId, itemCode);
  const nextCount = priorCount + 1;
  const initialDate = toolService.formatDateDMY(new Date().toISOString().split('T')[0]);

  modalLayer.innerHTML = `
    <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(5px); overflow-y: auto;">
      <div style="background: #1e293b; border: 1.5px solid #eab308; border-radius: 12px; width: 100%; max-width: 620px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); display: flex; flex-direction: column; min-height: 0; overflow: hidden; max-height: 90vh;">
        
        <!-- Modal Header -->
        <div style="background: linear-gradient(90deg, #ca8a04, #eab308); color: #000; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">🔄</span>
            <div>
              <h3 style="font-size: 16px; font-weight: 900; margin: 0; letter-spacing: 0.3px;">Log Tool Replacement &amp; Audit Change</h3>
              <div style="font-size: 11px; font-weight: 700; opacity: 0.9;">Record broken tool exchange &amp; audit history for mechanic</div>
            </div>
          </div>
          <button id="btn-close-replace-modal" style="background: transparent; border: none; font-size: 22px; font-weight: bold; cursor: pointer; color: #000;">✕</button>
        </div>

        <!-- Modal Body -->
        <div style="padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; font-size: 12.5px; color: #e2e8f0; flex: 1; min-height: 0;">
          
          <!-- Tool & Mechanic Info Banner -->
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <div style="font-size: 11px; color: #94a3b8; font-weight: 700;">MECHANIC / USER:</div>
              <div style="font-size: 13.5px; font-weight: 800; color: #38bdf8; margin-top: 2px;">${item.userName || 'N/A'}</div>
              <div style="font-size: 11.5px; font-family: monospace; color: #cbd5e1;">Card ID: <b>${item.userId}</b> | Reg #${item.regNo}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Area: ${item.workingArea}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #94a3b8; font-weight: 700;">EQUIPMENT / TOOL:</div>
              <div style="font-size: 13.5px; font-weight: 800; color: #facc15; margin-top: 2px;">
                ${item.itemType === 'TOOL' ? '🔧 ' : '📦 '}${item.itemCode ? `${item.itemCode}. ` : ''}${item.itemName}
              </div>
              <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 2px;">Qty: <b>${item.quantity || 1}</b> | Current Status: <b>${item.changeStatus}</b></div>
            </div>
          </div>

          <!-- Prior Replacement History Alert Badge -->
          <div style="background: ${priorCount > 0 ? 'rgba(234, 179, 8, 0.12)' : 'rgba(34, 197, 94, 0.12)'}; border: 1.5px solid ${priorCount > 0 ? '#ca8a04' : '#22c55e'}; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div>
              <div style="font-weight: 800; font-size: 12.5px; color: ${priorCount > 0 ? '#fbbf24' : '#4ade80'};">
                ${priorCount > 0 ? `⚠️ Prior Replacements: This user has replaced this tool ${priorCount} time(s) before.` : `✨ First Replacement: This will be the 1st replacement (#1) for this tool.`}
              </div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">
                ${priorCount > 0 ? `This action will be logged as <b>Replacement #${nextCount}</b> in the mechanic's history profile.` : `Tracking will start with <b>Replacement #1</b>.`}
              </div>
            </div>
            <span style="background: ${priorCount > 0 ? '#ca8a04' : '#16a34a'}; color: #fff; padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 13px; white-space: nowrap;">
              #${nextCount} Replacement
            </span>
          </div>

          <!-- Replacement Input Form -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Date of Change -->
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">
                Date of Replacement / Change (day-mm-yyyy) :
              </label>
              <div style="display: flex; gap: 6px; align-items: center;">
                <input type="text" id="inp-modal-rep-date" value="${initialDate}" placeholder="DD-MM-YYYY (e.g. 25-10-2025)"
                  style="flex: 1; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px; font-family: monospace; font-weight: 700;" />
                <input type="date" id="inp-modal-rep-date-picker" style="width: 38px; height: 34px; padding: 2px; background: #334155; border: 1px solid #475569; border-radius: 5px; cursor: pointer; color: #fff;" />
              </div>
            </div>

            <!-- Reason for Replacement -->
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">
                Reason for Tool Replacement / Change :
              </label>
              <select id="inp-modal-rep-reason" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                <option value="Broken blade / damaged tip during operation">Broken blade / chipped tip during operation</option>
                <option value="Stripped / rounded head from heavy torque">Stripped / rounded head from heavy torque</option>
                <option value="Worn out from heavy usage / normal wear">Worn out from heavy usage / normal wear</option>
                <option value="Bent shaft / damaged grip handle">Bent shaft / damaged grip handle</option>
                <option value="Lost / misplaced by mechanic">Lost / misplaced by mechanic</option>
                <option value="Size / specification upgrade for production line">Size / specification upgrade for production line</option>
                <option value="Routine preventive maintenance exchange">Routine preventive maintenance exchange</option>
                <option value="OTHER">Other Reason (Custom)</option>
              </select>
            </div>

            <!-- Old Tool Condition & Admin -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Old Tool Condition :</label>
                <select id="inp-modal-rep-condition" style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;">
                  <option value="Broken (Returned to store)">Broken (Returned to store)</option>
                  <option value="Damaged (Scrap / Dispose)">Damaged (Scrap / Dispose)</option>
                  <option value="Worn Out">Worn Out (Exchange)</option>
                  <option value="Lost (Deduction/Fine logged)">Lost (Deduction / Fine logged)</option>
                  <option value="Repaired & Recycled">Repaired &amp; Recycled</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">Processed By (Admin / Supervisor) :</label>
                <input type="text" id="inp-modal-rep-admin" value="admin"
                  style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;" />
              </div>
            </div>

            <!-- Store Remarks -->
            <div>
              <label style="display: block; font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 4px;">
                Store Remarks / New Tool Serial / Notes :
              </label>
              <input type="text" id="inp-modal-rep-remarks" placeholder="e.g. New heavy duty chrome vanadium driver issued"
                style="width: 100%; background: #0f172a; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 12.5px;" />
            </div>

          </div>

        </div>

        <!-- Modal Footer -->
        <div style="background: #0f172a; border-top: 1px solid #334155; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
          <button id="btn-cancel-replace-modal" style="background: #334155; color: #cbd5e1; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;">
            Cancel
          </button>
          <button id="btn-confirm-replace-modal" style="background: #eab308; color: #000; border: none; padding: 7px 22px; border-radius: 6px; font-weight: 900; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(234,179,8,0.4);">
            <span>🔄</span> Confirm #${nextCount} Replacement &amp; Save History
          </button>
        </div>

      </div>
    </div>
  `;

  // Events
  document.getElementById('btn-close-replace-modal').onclick = () => { modalLayer.innerHTML = ''; };
  document.getElementById('btn-cancel-replace-modal').onclick = () => { modalLayer.innerHTML = ''; };

  const inpDate = document.getElementById('inp-modal-rep-date');
  const datePicker = document.getElementById('inp-modal-rep-date-picker');
  if (datePicker && inpDate) {
    datePicker.onchange = (e) => {
      if (e.target.value) {
        inpDate.value = toolService.formatDateDMY(e.target.value);
      }
    };
  }

  document.getElementById('btn-confirm-replace-modal').onclick = () => {
    const rawDate = inpDate.value.trim();
    const reason = document.getElementById('inp-modal-rep-reason')?.value || 'Broken / Worn Out';
    const condition = document.getElementById('inp-modal-rep-condition')?.value || 'Broken';
    const remarks = document.getElementById('inp-modal-rep-remarks')?.value.trim() || '';
    const admin = document.getElementById('inp-modal-rep-admin')?.value.trim() || 'admin';

    const result = toolService.recordToolChangeHistory({
      allocationId: item.id,
      regNo: item.regNo,
      userId: item.userId,
      userName: item.userName,
      workingArea: item.workingArea,
      itemType: item.itemType || 'TOOL',
      itemCode: item.itemCode,
      itemName: item.itemName,
      changeType: 'REPLACED',
      changeDate: rawDate,
      reason,
      oldCondition: condition,
      remarks,
      changedBy: admin
    });

    modalLayer.innerHTML = '';
    window.app?.showToast('Replacement Recorded', `Tool replacement #${result.replacementCount} logged for ${item.userName}.`, 'success');

    const container = document.getElementById('tools-tab-content-container');
    if (container) {
      container.innerHTML = renderActiveTab(currentActiveTab);
      initToolsManagementEvents();
    }
  };
}

// =========================================================================
// 9. USER TOOL CHANGE HISTORY & FREQUENCY DASHBOARD MODAL
// =========================================================================
function renderUserToolHistoryModal(userIdOrCard = null, initialItemCode = null) {
  let modalLayer = document.getElementById('tools-modal-layer') || document.getElementById('modal-layer');
  if (!modalLayer) {
    modalLayer = document.createElement('div');
    modalLayer.id = 'tools-modal-layer';
    document.body.appendChild(modalLayer);
  }

  const allStaff = employeeService.getAllEmployees() || [];
  let selectedUserId = userIdOrCard || activeUserForm.userId || (allStaff[0] ? allStaff[0].cardNumber || allStaff[0].id : 'AMG-0147075');
  let selectedItemCode = initialItemCode || 'ALL';

  function renderHistoryInner() {
    const summary = toolService.getUserToolChangeSummary(selectedUserId);
    const historyEvents = selectedItemCode === 'ALL'
      ? summary.history
      : summary.history.filter(h => String(h.itemCode || '').trim() === String(selectedItemCode).trim());

    return `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(5px);">
        <div style="background: #1e293b; border: 1.5px solid #38bdf8; border-radius: 12px; width: 100%; max-width: 960px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); display: flex; flex-direction: column; overflow: hidden; max-height: 92vh;">
          
          <!-- Header -->
          <div style="background: linear-gradient(90deg, #0284c7, #38bdf8); color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📜</span>
              <div>
                <h3 style="font-size: 16px; font-weight: 900; margin: 0; letter-spacing: 0.3px;">Mechanic Tool Change &amp; Replacement History</h3>
                <div style="font-size: 11.5px; opacity: 0.95; margin-top: 1px;">Track replacement frequencies, repeated broken tools &amp; historical change logs</div>
              </div>
            </div>
            <button id="btn-close-hist-modal" style="background: transparent; border: none; font-size: 22px; font-weight: bold; cursor: pointer; color: #fff;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 12.5px; color: #e2e8f0; flex: 1;">
            
            <!-- User Selector & Action Bar -->
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 280px;">
                <label style="font-weight: 700; color: #94a3b8; font-size: 12px; white-space: nowrap;">Select Mechanic:</label>
                <select id="hist-select-user" style="flex: 1; background: #1e293b; color: #fff; border: 1px solid #475569; border-radius: 5px; padding: 7px 10px; font-size: 13px; font-weight: 700;">
                  ${allStaff.map(s => `
                    <option value="${s.cardNumber || s.id}" ${(s.cardNumber || s.id) === selectedUserId ? 'selected' : ''}>
                      ${s.name} (${s.cardNumber || s.id}) — ${s.workingArea || s.department}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div style="display: flex; gap: 8px;">
                <button id="btn-export-user-history" style="background: #16a34a; color: #fff; border: 1px solid #15803d; padding: 6px 14px; border-radius: 5px; font-weight: 800; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <span>📤</span> Export History (.xlsx)
                </button>
              </div>
            </div>

            <!-- KPI Metric Cards for Selected User -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px;">
              <div style="background: #0f172a; border-left: 4px solid #38bdf8; border-radius: 6px; padding: 10px 14px;">
                <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Total Tools Issued</div>
                <div style="font-size: 22px; font-weight: 900; color: #38bdf8; margin-top: 2px;">${summary.totalAllocated} Tools</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Registered in kit</div>
              </div>

              <div style="background: #0f172a; border-left: 4px solid #eab308; border-radius: 6px; padding: 10px 14px;">
                <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Lifetime Tool Changes</div>
                <div style="font-size: 22px; font-weight: 900; color: #fde047; margin-top: 2px;">${summary.totalReplacements} Times</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Across ${summary.distinctToolsChanged} different tools</div>
              </div>

              <div style="background: #0f172a; border-left: 4px solid #ef4444; border-radius: 6px; padding: 10px 14px;">
                <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Most Frequent Change</div>
                <div style="font-size: 14px; font-weight: 900; color: #fca5a5; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${summary.mostReplacedTool ? `${summary.mostReplacedTool.itemName}` : 'None'}
                </div>
                <div style="font-size: 11px; color: #f87171; font-weight: 700; margin-top: 1px;">
                  ${summary.mostReplacedTool ? `⚠️ Changed ${summary.mostReplacedTool.replaceCount} times` : 'No replacements logged'}
                </div>
              </div>

              <div style="background: #0f172a; border-left: 4px solid #22c55e; border-radius: 6px; padding: 10px 14px;">
                <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Last Change Date</div>
                <div style="font-size: 20px; font-weight: 900; color: #86efac; margin-top: 2px; font-family: monospace;">
                  ${summary.history[0]?.changeDate || 'N/A'}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
                  ${summary.history[0] ? summary.history[0].reason.substring(0, 22) + '...' : 'No activity'}
                </div>
              </div>
            </div>

            <!-- SECTION 1: Tool-by-Tool Replacement Frequency Analysis Table -->
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="font-weight: 800; font-size: 13px; color: #fbbf24; display: flex; align-items: center; justify-content: space-between;">
                <span>📊 Tool Replacement Frequency Breakdown (How many times each tool was changed):</span>
                <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">Sorted by highest change count</span>
              </div>

              ${summary.toolBreakdown.length > 0 ? `
                <div style="overflow-x: auto; border: 1px solid #1e293b; border-radius: 6px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                      <tr style="background: #1e293b; color: #94a3b8; text-align: left; border-bottom: 1.5px solid #334155;">
                        <th style="padding: 6px 10px; width: 40px; text-align: center;">Sl.</th>
                        <th style="padding: 6px 10px; width: 70px; text-align: center;">Code</th>
                        <th style="padding: 6px 10px;">Equipment / Tool Name</th>
                        <th style="padding: 6px 10px; text-align: center; width: 140px;">Times Changed</th>
                        <th style="padding: 6px 10px; text-align: center; width: 120px;">Last Change Date</th>
                        <th style="padding: 6px 10px;">Last Reason</th>
                        <th style="padding: 6px 10px; text-align: center; width: 100px;">Filter Events</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${summary.toolBreakdown.map((t, idx) => `
                        <tr style="border-bottom: 1px solid #1e293b; background: ${selectedItemCode === t.itemCode ? 'rgba(56, 189, 248, 0.08)' : 'transparent'};">
                          <td style="padding: 6px 10px; text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
                          <td style="padding: 6px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #38bdf8;">${t.itemCode}</td>
                          <td style="padding: 6px 10px; font-weight: 700; color: #f1f5f9;">${t.itemName}</td>
                          <td style="padding: 6px 10px; text-align: center;">
                            <span style="padding: 3px 10px; border-radius: 12px; font-weight: 900; font-size: 11.5px; background: ${t.replaceCount >= 3 ? 'rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444;' : t.replaceCount === 2 ? 'rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid #ca8a04;' : 'rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e;'};">
                              ${t.replaceCount}x ${t.replaceCount >= 3 ? '🔴 High Freq' : t.replaceCount === 2 ? '🟡 Moderate' : '🟢 Normal'}
                            </span>
                          </td>
                          <td style="padding: 6px 10px; text-align: center; font-family: monospace; color: #cbd5e1; font-weight: 700;">
                            ${t.lastChangeDate || '-'}
                          </td>
                          <td style="padding: 6px 10px; color: #cbd5e1; font-size: 11.5px;">
                            ${t.lastReason || '-'}
                          </td>
                          <td style="padding: 6px 10px; text-align: center;">
                            <button class="btn-filter-tool-hist" data-code="${t.itemCode}"
                              style="background: ${selectedItemCode === t.itemCode ? '#0284c7' : '#334155'}; color: #fff; border: 1px solid #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
                              ${selectedItemCode === t.itemCode ? 'Showing' : 'View Logs'}
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div style="text-align: center; padding: 20px; color: #94a3b8;">
                  No tool replacement events recorded yet for this mechanic.
                </div>
              `}
            </div>

            <!-- SECTION 2: Chronological Replacement Event Timeline / Detailed Log -->
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="font-weight: 800; font-size: 13px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
                <span>📜 Chronological Replacement Event Log (${historyEvents.length} records):</span>
                ${selectedItemCode !== 'ALL' ? `
                  <button id="btn-clear-tool-filter" style="background: #334155; color: #38bdf8; border: 1px solid #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
                    ✕ Clear Filter (Show All Tools)
                  </button>
                ` : ''}
              </div>

              ${historyEvents.length > 0 ? `
                <div style="overflow-x: auto; border: 1px solid #1e293b; border-radius: 6px; max-height: 240px; overflow-y: auto;">
                  <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11.5px;">
                    <thead style="position: sticky; top: 0; z-index: 40;">
                      <tr style="background: #1e293b;">
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; width: 35px; text-align: center; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">#</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; width: 90px; text-align: center; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Date</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; width: 60px; text-align: center; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Reg #</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Equipment / Tool</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; text-align: center; width: 80px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Event #</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Replacement Reason</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Condition</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Store Remarks</th>
                        <th style="position: sticky; top: 0; z-index: 40; background: #1e293b; color: #94a3b8; padding: 7px 8px; width: 70px; text-align: center; border-bottom: 2px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${historyEvents.map((h, idx) => `
                        <tr style="border-bottom: 1px solid #1e293b;">
                          <td style="padding: 6px 8px; text-align: center; color: #64748b; font-family: monospace;">${idx + 1}</td>
                          <td style="padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700; color: #4ade80;">${h.changeDate}</td>
                          <td style="padding: 6px 8px; text-align: center; font-family: monospace; color: #fbbf24;">#${h.regNo}</td>
                          <td style="padding: 6px 8px; font-weight: 700; color: #f1f5f9;">
                            <span style="color: #38bdf8; font-family: monospace;">[${h.itemCode}]</span> ${h.itemName}
                          </td>
                          <td style="padding: 6px 8px; text-align: center;">
                            <span style="background: #ca8a04; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: 900; font-size: 10.5px;">
                              #${h.replacementCount} Change
                            </span>
                          </td>
                          <td style="padding: 6px 8px; color: #fca5a5; font-weight: 600;">${h.reason}</td>
                          <td style="padding: 6px 8px; color: #cbd5e1; font-size: 11px;">${h.oldCondition || '-'}</td>
                          <td style="padding: 6px 8px; color: #cbd5e1; font-size: 11px;">${h.remarks || '-'}</td>
                          <td style="padding: 6px 8px; text-align: center; color: #94a3b8; font-family: monospace;">${h.changedBy || 'admin'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `
                <div style="text-align: center; padding: 20px; color: #94a3b8;">
                  No event records match the current filter.
                </div>
              `}
            </div>

          </div>

          <!-- Footer -->
          <div style="background: #0f172a; border-top: 1px solid #334155; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: #94a3b8;">
              Logged in as: <b style="color: #fff;">${authService.getCurrentUser()?.username || 'admin'}</b>
            </span>
            <button id="btn-close-hist-footer" style="background: #334155; color: #cbd5e1; border: none; padding: 6px 16px; border-radius: 6px; font-size: 12.5px; cursor: pointer;">
              Close
            </button>
          </div>

        </div>
      </div>
    `;
  }

  function bindHistEvents() {
    modalLayer.innerHTML = renderHistoryInner();

    document.getElementById('btn-close-hist-modal').onclick = () => { modalLayer.innerHTML = ''; };
    document.getElementById('btn-close-hist-footer').onclick = () => { modalLayer.innerHTML = ''; };

    const userSelect = document.getElementById('hist-select-user');
    if (userSelect) {
      userSelect.onchange = (e) => {
        selectedUserId = e.target.value;
        selectedItemCode = 'ALL';
        bindHistEvents();
      };
    }

    modalLayer.querySelectorAll('.btn-filter-tool-hist').forEach(btn => {
      btn.onclick = () => {
        const code = btn.getAttribute('data-code');
        selectedItemCode = (selectedItemCode === code) ? 'ALL' : code;
        bindHistEvents();
      };
    });

    const btnClearFilter = document.getElementById('btn-clear-tool-filter');
    if (btnClearFilter) {
      btnClearFilter.onclick = () => {
        selectedItemCode = 'ALL';
        bindHistEvents();
      };
    }

    const btnExport = document.getElementById('btn-export-user-history');
    if (btnExport) {
      btnExport.onclick = () => {
        try {
          const summary = toolService.getUserToolChangeSummary(selectedUserId);
          toolService.exportAllocationsToExcel({ search: selectedUserId });
          window.app?.showToast('History Exported', `Change history exported for ${summary.userName}.`, 'success');
        } catch (err) {
          alert('Export failed: ' + err.message);
        }
      };
    }
  }

  bindHistEvents();
}

/**
 * BATCH MULTI-SELECT TOOLS & EQUIPMENT MODAL
 * Solves the repetitive one-by-one tool entry by allowing mechanics/supervisors
 * to check off 10-30 tools at once, adjust quantities, and insert all in 1 click.
 */
export function openBatchToolsAllocationModal() {
  let modalLayer = document.getElementById('tools-modal-layer') || document.getElementById('modal-layer');
  if (!modalLayer) {
    modalLayer = document.createElement('div');
    modalLayer.id = 'tools-modal-layer';
    document.body.appendChild(modalLayer);
  }

  let batchCategory = 'ALL'; // 'ALL' | 'TOOL' | 'ACCESSORY' | 'SPARE_PART'
  let batchSearch = '';
  // Map of selected items: key = item.id, value = { item, quantity: 1, changeStatus: 'NEW_ISSUE' }
  const selectedMap = new Map();

  function renderBatchInner() {
    const allItems = getAllCatalogItems(batchCategory);
    const q = batchSearch.toLowerCase().trim();
    const filtered = allItems.filter(it => {
      if (!q) return true;
      return (it.name && it.name.toLowerCase().includes(q)) ||
        (it.code && String(it.code).toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q));
    });

    const totalSelected = selectedMap.size;
    const totalSelectedQty = Array.from(selectedMap.values()).reduce((sum, v) => sum + (parseInt(v.quantity, 10) || 1), 0);

    const counts = {
      all: getAllCatalogItems('ALL').length,
      tools: getAllCatalogItems('TOOL').length,
      accs: getAllCatalogItems('ACCESSORY').length,
      spares: getAllCatalogItems('SPARE_PART').length
    };

    return `
      <div class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; backdrop-filter: blur(6px);">
        <div style="background: #0f172a; border: 2px solid #38bdf8; border-radius: 12px; width: 100%; max-width: 960px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.9);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #1d4ed8); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #38bdf8;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 24px;">📋</span>
              <div>
                <div style="font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.3px;">
                  Batch Allocate Multiple Tools &amp; Equipment
                </div>
                <div style="font-size: 11.5px; color: #bae6fd; margin-top: 1px;">
                  Mechanic: <strong style="color: #fff;">${activeUserForm.userName || 'Ashraful Alam Shahed'}</strong> (${activeUserForm.userId || 'AMG-0147075'}) • Registration #${currentRegNo}
                </div>
              </div>
            </div>
            <button id="btn-close-batch-tools-modal" style="background: transparent; border: none; color: #fff; font-size: 22px; font-weight: bold; cursor: pointer;">✕</button>
          </div>

          <!-- Controls Bar (Filter Tabs & Search) -->
          <div style="padding: 12px 20px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              
              <!-- Category Tabs -->
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="btn-batch-cat-tab ${batchCategory === 'ALL' ? 'active' : ''}" data-cat="ALL" style="padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid ${batchCategory === 'ALL' ? '#38bdf8' : '#475569'}; background: ${batchCategory === 'ALL' ? '#0284c7' : '#0f172a'}; color: #fff;">
                  ✨ All Items (${counts.all})
                </button>
                <button class="btn-batch-cat-tab ${batchCategory === 'TOOL' ? 'active' : ''}" data-cat="TOOL" style="padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid ${batchCategory === 'TOOL' ? '#38bdf8' : '#475569'}; background: ${batchCategory === 'TOOL' ? '#0284c7' : '#0f172a'}; color: #fff;">
                  🔧 Tools Master (${counts.tools})
                </button>
                <button class="btn-batch-cat-tab ${batchCategory === 'ACCESSORY' ? 'active' : ''}" data-cat="ACCESSORY" style="padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid ${batchCategory === 'ACCESSORY' ? '#ec4899' : '#475569'}; background: ${batchCategory === 'ACCESSORY' ? '#db2777' : '#0f172a'}; color: #fff;">
                  📦 Accessories (${counts.accs})
                </button>
                <button class="btn-batch-cat-tab ${batchCategory === 'SPARE_PART' ? 'active' : ''}" data-cat="SPARE_PART" style="padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; border: 1px solid ${batchCategory === 'SPARE_PART' ? '#10b981' : '#475569'}; background: ${batchCategory === 'SPARE_PART' ? '#059669' : '#0f172a'}; color: #fff;">
                  ⚙️ Spare Parts (${counts.spares})
                </button>
              </div>

              <!-- Quick Selection Presets -->
              <div style="display: flex; gap: 6px; align-items: center;">
                <button id="btn-batch-select-kit28" style="background: #f59e0b; color: #000; border: none; padding: 5px 12px; border-radius: 5px; font-size: 11.5px; font-weight: 800; cursor: pointer;" title="Select all 28 Standard Mechanic Kit tools in 1 click">
                  ⚡ Select Standard 28 Kit
                </button>
                <button id="btn-batch-select-all-filtered" style="background: #334155; color: #fff; border: 1px solid #475569; padding: 5px 10px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
                  ☑️ Select Filtered (${filtered.length})
                </button>
                <button id="btn-batch-clear-all" style="background: #334155; color: #fca5a5; border: 1px solid #475569; padding: 5px 10px; border-radius: 5px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
                  ⬜ Clear
                </button>
              </div>
            </div>

            <!-- Live Search Bar -->
            <div style="position: relative;">
              <input type="text" id="inp-batch-search" value="${batchSearch}" placeholder="🔍 Live filter by tool name, code (e.g. 001, Screw Driver, Pliers, Belt)..." 
                style="width: 100%; background: #0f172a; color: #fff; border: 1.5px solid #475569; border-radius: 6px; padding: 7px 12px; font-size: 12.5px;" />
            </div>
          </div>

          <!-- Interactive Checklist Table -->
          <div style="flex: 1; overflow-y: auto; padding: 0 20px 12px 20px; background: #0f172a;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px;">
              <thead style="position: sticky; top: 0; z-index: 50;">
                <tr style="background: #1e293b;">
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: center; width: 45px; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">
                    <input type="checkbox" id="chk-batch-select-all-header" title="Select / Deselect All Filtered" style="cursor: pointer; width: 16px; height: 16px;" ${filtered.length > 0 && filtered.every(it => selectedMap.has(it.id)) ? 'checked' : ''} />
                  </th>
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: center; width: 65px; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-weight: 800;">Code</th>
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: left; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-weight: 800;">Item / Equipment Name</th>
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: left; width: 140px; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-weight: 800;">Category</th>
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: center; width: 100px; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-weight: 800;">Central Stock</th>
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: center; width: 85px; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-weight: 800;">Alloc. Qty</th>
                  <th style="position: sticky; top: 0; z-index: 50; background: #1e293b; color: #94a3b8; padding: 10px 10px; text-align: center; width: 120px; border-bottom: 2px solid #38bdf8; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-weight: 800;">Change Status</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr><td colspan="7" style="padding: 30px; text-align: center; color: #94a3b8;">No tools found matching "${batchSearch}".</td></tr>
                ` : filtered.map(it => {
      const isChecked = selectedMap.has(it.id);
      const selData = selectedMap.get(it.id) || { quantity: it.defaultQty || '1', changeStatus: 'NEW_ISSUE' };
      const alreadyInQueue = liveAllocationQueue.some(q => String(q.itemCode).trim() === String(it.code).trim());

      return `
                    <tr style="border-bottom: 1px solid #1e293b; background: ${isChecked ? 'rgba(2, 132, 199, 0.15)' : 'transparent'};">
                      <td style="padding: 7px 10px; text-align: center;">
                        <input type="checkbox" class="chk-batch-item" data-id="${it.id}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;" />
                      </td>
                      <td style="padding: 7px 10px; text-align: center; font-family: monospace; font-weight: 800; color: #38bdf8;">
                        ${it.code}
                      </td>
                      <td style="padding: 7px 10px;">
                        <div style="font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
                          <span>${it.type === 'ACCESSORY' ? '📦' : it.type === 'SPARE_PART' ? '⚙️' : '🔧'}</span>
                          <span>${it.name}</span>
                          ${alreadyInQueue ? `<span style="font-size: 10px; background: rgba(234,179,8,0.2); color: #fde047; padding: 1px 5px; border-radius: 3px; font-weight: bold;">(In Table)</span>` : ''}
                        </div>
                        <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">${it.remarks || ''}</div>
                      </td>
                      <td style="padding: 7px 10px; color: #cbd5e1;">
                        <span style="font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 800; background: ${it.type === 'TOOL' ? 'rgba(56, 189, 248, 0.2); color: #38bdf8;' : it.type === 'ACCESSORY' ? 'rgba(236, 72, 153, 0.2); color: #f472b6;' : 'rgba(52, 211, 153, 0.2); color: #34d399;'};">
                          ${it.category || it.type}
                        </span>
                      </td>
                      <td style="padding: 7px 10px; text-align: center;">
                        <span style="font-weight: 700; color: ${it.totalStock > 0 ? '#34d399' : '#ef4444'}; font-size: 11px;">
                          ${it.totalStock > 0 ? `${it.totalStock} ${it.unit}` : 'Out'}
                        </span>
                      </td>
                      <td style="padding: 7px 10px; text-align: center;">
                        <input type="number" min="1" class="inp-batch-item-qty" data-id="${it.id}" value="${selData.quantity}" 
                          style="width: 50px; text-align: center; background: #0f172a; color: #22c55e; font-weight: 800; border: 1px solid #334155; border-radius: 4px; padding: 3px;" />
                      </td>
                      <td style="padding: 7px 10px; text-align: center;">
                        <select class="sel-batch-item-status" data-id="${it.id}" style="background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px; padding: 3px 4px; font-size: 11px;">
                          <option value="NEW_ISSUE" ${selData.changeStatus === 'NEW_ISSUE' ? 'selected' : ''}>New Issue</option>
                          <option value="REPLACED" ${selData.changeStatus === 'REPLACED' ? 'selected' : ''}>Replaced</option>
                          <option value="LOST" ${(selData.changeStatus === 'LOST' || selData.changeStatus === 'RETURNED') ? 'selected' : ''}>⚠️ Lost (Harao)</option>
                        </select>
                      </td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div style="padding: 12px 20px; background: #1e293b; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 13px; font-weight: 800; color: #38bdf8;">
                ✓ Selected: <span style="color: #fff;">${totalSelected}</span> items (Total Qty: <span style="color: #86efac;">${totalSelectedQty}</span>)
              </span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="btn-cancel-batch-modal" style="background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer;">
                Cancel
              </button>
              <button id="btn-confirm-batch-allocation" style="background: linear-gradient(135deg, #22c55e, #15803d); color: #fff; border: 1px solid #86efac; padding: 8px 22px; border-radius: 6px; font-weight: 900; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(34,197,94,0.4); display: flex; align-items: center; gap: 6px;">
                <span>➕</span> Add Selected Tools to List (${totalSelected})
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function bindBatchEvents() {
    modalLayer.innerHTML = renderBatchInner();

    const closeBtn = document.getElementById('btn-close-batch-tools-modal');
    const cancelBtn = document.getElementById('btn-cancel-batch-modal');
    const close = () => { modalLayer.innerHTML = ''; };
    if (closeBtn) closeBtn.onclick = close;
    if (cancelBtn) cancelBtn.onclick = close;

    // Category Tabs
    modalLayer.querySelectorAll('.btn-batch-cat-tab').forEach(btn => {
      btn.onclick = () => {
        batchCategory = btn.getAttribute('data-cat') || 'ALL';
        bindBatchEvents();
      };
    });

    // Search input
    const searchInp = document.getElementById('inp-batch-search');
    if (searchInp) {
      searchInp.oninput = (e) => {
        batchSearch = e.target.value;
        bindBatchEvents();
        // Restore focus to end of search input
        const refreshed = document.getElementById('inp-batch-search');
        if (refreshed) {
          refreshed.focus({ preventScroll: true });
          refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
        }
      };
    }

    // Header select all checkbox
    const chkSelectAllHeader = document.getElementById('chk-batch-select-all-header');
    if (chkSelectAllHeader) {
      chkSelectAllHeader.onchange = (e) => {
        if (e.target.checked) {
          filtered.forEach(it => {
            if (!selectedMap.has(it.id)) {
              selectedMap.set(it.id, { item: it, quantity: it.defaultQty || '1', changeStatus: 'NEW_ISSUE' });
            }
          });
        } else {
          filtered.forEach(it => {
            selectedMap.delete(it.id);
          });
        }
        bindBatchEvents();
      };
    }

    // Checkbox toggles
    modalLayer.querySelectorAll('.chk-batch-item').forEach(chk => {
      chk.onchange = () => {
        const id = chk.getAttribute('data-id');
        const allItems = getAllCatalogItems('ALL');
        const it = allItems.find(x => x.id === id);
        if (!it) return;

        if (chk.checked) {
          const qtyVal = document.querySelector(`.inp-batch-item-qty[data-id="${id}"]`)?.value || it.defaultQty || '1';
          const statVal = document.querySelector(`.sel-batch-item-status[data-id="${id}"]`)?.value || 'NEW_ISSUE';
          selectedMap.set(id, { item: it, quantity: qtyVal, changeStatus: statVal });
        } else {
          selectedMap.delete(id);
        }
        bindBatchEvents();
      };
    });

    // Quantity in-line edits
    modalLayer.querySelectorAll('.inp-batch-item-qty').forEach(inp => {
      inp.onchange = () => {
        const id = inp.getAttribute('data-id');
        if (selectedMap.has(id)) {
          selectedMap.get(id).quantity = inp.value || '1';
        }
      };
    });

    // Status in-line edits
    modalLayer.querySelectorAll('.sel-batch-item-status').forEach(sel => {
      sel.onchange = () => {
        const id = sel.getAttribute('data-id');
        if (selectedMap.has(id)) {
          selectedMap.get(id).changeStatus = sel.value;
        }
      };
    });

    // Select Standard 28 Kit Shortcut
    const btnSelectKit = document.getElementById('btn-batch-select-kit28');
    if (btnSelectKit) {
      btnSelectKit.onclick = () => {
        const stdTools = toolService.getAllMasterTools();
        stdTools.forEach(t => {
          const uItem = {
            id: t.id || `tool-${t.code}`,
            type: 'TOOL',
            code: String(t.code || '').padStart(3, '0'),
            name: t.name,
            category: t.category || 'TOOLS',
            unit: t.unit || 'Pcs',
            totalStock: Number(t.totalStock) || 0,
            defaultQty: '1',
            remarks: t.remarks || ''
          };
          selectedMap.set(uItem.id, { item: uItem, quantity: '1', changeStatus: 'NEW_ISSUE' });
        });
        bindBatchEvents();
      };
    }

    // Select All Filtered
    const btnSelectFiltered = document.getElementById('btn-batch-select-all-filtered');
    if (btnSelectFiltered) {
      btnSelectFiltered.onclick = () => {
        const allItems = getAllCatalogItems(batchCategory);
        const q = batchSearch.toLowerCase().trim();
        const filtered = allItems.filter(it => {
          if (!q) return true;
          return (it.name && it.name.toLowerCase().includes(q)) ||
            (it.code && String(it.code).toLowerCase().includes(q)) ||
            (it.category && it.category.toLowerCase().includes(q));
        });
        filtered.forEach(it => {
          selectedMap.set(it.id, { item: it, quantity: it.defaultQty || '1', changeStatus: 'NEW_ISSUE' });
        });
        bindBatchEvents();
      };
    }

    // Clear All
    const btnClearAll = document.getElementById('btn-batch-clear-all');
    if (btnClearAll) {
      btnClearAll.onclick = () => {
        selectedMap.clear();
        bindBatchEvents();
      };
    }

    // Confirm Batch Allocation Button
    const btnConfirm = document.getElementById('btn-confirm-batch-allocation');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        if (selectedMap.size === 0) {
          alert('Please check at least one tool or equipment item to add.');
          return;
        }

        const curIssueDate = toolService.formatDateDMY(document.getElementById('input-add-issue-date')?.value || activeUserForm.issueDate || '25-10-2025');
        const uId = document.getElementById('input-add-user-id')?.value.trim() || activeUserForm.userId;
        const uName = document.getElementById('input-add-user-name')?.value.trim() || activeUserForm.userName;
        const jTitle = document.getElementById('input-add-job-title')?.value.trim() || activeUserForm.jobTitle;
        const wArea = document.getElementById('input-add-working-area')?.value.trim() || activeUserForm.workingArea;

        selectedMap.forEach(sel => {
          const it = sel.item;
          liveAllocationQueue.push({
            regNo: currentRegNo,
            issueDate: curIssueDate,
            userId: uId,
            userName: uName,
            jobTitle: jTitle,
            workingArea: wArea,
            itemType: it.type || 'TOOL',
            itemCode: it.code,
            itemName: it.name,
            quantity: String(sel.quantity || '1'),
            changeStatus: sel.changeStatus || 'NEW_ISSUE',
            changeDate: sel.changeStatus !== 'NEW_ISSUE' ? new Date().toISOString().split('T')[0] : null,
            remarks: it.remarks || ''
          });
        });

        const addedCount = selectedMap.size;
        close();

        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab('tools-add');
          initToolsManagementEvents();
        }

        window.app?.showToast('Batch Tools Allocated', `Successfully loaded ${addedCount} tools for ${uName}.`, 'success');
      };
    }
  }

  bindBatchEvents();
}

// =========================================================================
// 12. STREAMLINED SMART ERP PDF IMPORT & AUTO-FILL ENGINE
// =========================================================================

/**
 * Common Garments Factory Mechanical & Tool Aliases
 * Used to translate raw ERP PDF naming variations into standardized catalog items
 */
const OCR_FACTORY_ALIASES = [
  { regex: /tools?\s*ba[gcq68]|tools?\s*b[a-z0-9]{1,3}\b/i, targetName: 'Tools Bag (Canvas / Leather)' },
  { regex: /needle\s*(?:ln|allen|l-?n)[\s\-]*key.*1\.58/i, targetName: 'Needle Allen Key (01.58mm)' },
  { regex: /needle\s*(?:ln|allen|l-?n)[\s\-]*key.*1\.5/i, targetName: 'Hex Allen Key (01.50mm)' },
  { regex: /t[\s\-]*ln[\s\-]*key.*(?:2|2\.5)\s*mm/i, targetName: 'T-Handle Allen Key (02.50mm)' },
  { regex: /t[\s\-]*ln[\s\-]*key.*3\s*mm/i, targetName: 'T-Handle Allen Key (03mm)' },
  { regex: /t[\s\-]*ln[\s\-]*key.*4\s*mm/i, targetName: 'T-Handle Allen Key (04mm)' },
  { regex: /t[\s\-]*ln[\s\-]*key.*5\s*mm/i, targetName: 'T-Handle Allen Key (05mm)' },
  { regex: /star\s*screw\s*driver.*(?:10|large|10["”'°])|star.*screw/i, targetName: 'Flat Screw Driver (Large)' },
  { regex: /nose\s*(?:pleir|plier|pliar|ple|plir|pleer)/i, targetName: 'Pliers (Long Nose)' },
  { regex: /long\s*nose/i, targetName: 'Pliers (Long Nose)' },
  { regex: /(?:cutting|combination)\s*(?:pleir|plier|pliar)/i, targetName: 'Pliers (Combination / Cutting)' },
  { regex: /flat\s*screw\s*driver.*(?:10|large|10["”'°])/i, targetName: 'Flat Screw Driver (Large)' },
  { regex: /flat\s*screw\s*driver.*(?:8|med)/i, targetName: 'Flat Screw Driver (Medium)' },
  { regex: /flat\s*screw\s*driver.*(?:small|4|6)/i, targetName: 'Flat Screw Driver (Small)' },
  { regex: /combination\s*spanner.*5\s*mm/i, targetName: 'Combination Spanner (05mm)' },
  { regex: /combination\s*spanner.*6\s*mm/i, targetName: 'Combination Spanner (06mm)' },
  { regex: /combination\s*spanner.*7\s*mm/i, targetName: 'Combination Spanner (07mm)' },
  { regex: /combination\s*spanner.*8\s*mm/i, targetName: 'Combination Spanner (08mm)' },
  { regex: /combination\s*spanner.*9\s*mm/i, targetName: 'Combination Spanner (09mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*1\.5\s*mm/i, targetName: 'Hex Allen Key (01.50mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*2\s*mm/i, targetName: 'Hex Allen Key (02mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*2\.5\s*mm/i, targetName: 'Hex Allen Key (02.50mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*3\s*mm/i, targetName: 'Hex Allen Key (03mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*3\.5\s*mm/i, targetName: 'Hex Allen Key (03.50mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*4\s*mm/i, targetName: 'Hex Allen Key (04mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*4\.5\s*mm/i, targetName: 'Hex Allen Key (04.50mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*5\s*mm/i, targetName: 'Hex Allen Key (05mm)' },
  { regex: /l[\s\-]*n[\s\-]*key.*6\s*mm/i, targetName: 'Hex Allen Key (06mm)' },
  { regex: /hex\s*allen\s*key/i, targetName: 'Hex Allen Key' },
  { regex: /adjustable\s*wrench|wrench\s*10|slide\s*wrench/i, targetName: 'Adjustable Wrench (10inch)' },
  { regex: /dim?ond\s*file|diamond\s*file|file\s*junior/i, targetName: 'File (Diamond File)' },
  { regex: /open\s*end\s*spanner.*14[\s\-]*17/i, targetName: 'Open End Spanner (14-17mm)' },
  { regex: /open\s*end\s*spanner.*10[\s\-]*11/i, targetName: 'Open End Spanner (10-11mm)' },
  { regex: /open\s*end\s*spanner.*12[\s\-]*13/i, targetName: 'Open End Spanner (12-13mm)' },
  { regex: /super\s*glue/i, targetName: 'Super Glue' },
  { regex: /sand\s*paper/i, targetName: 'Sand Paper' },
  { regex: /take-?up\s*spring/i, targetName: 'Take-up Spring' },
  { regex: /wiper\s*stick/i, targetName: 'Wiper Stick' },
  { regex: /(?:eye|safety)\s*guard/i, targetName: 'Eye/Safety Guard' },
  { regex: /safety\s*glass/i, targetName: 'Safety Glass' },
  { regex: /cable\s*tie/i, targetName: 'Cable Tie' },
  { regex: /needle\s*plate/i, targetName: 'Needle Plate' },
  { regex: /feed\s*dog/i, targetName: 'Needle Feed Dog' },
  { regex: /needle\s*bar/i, targetName: 'Needle Bar' },
  { regex: /rotary\s*hook|shuttle/i, targetName: 'Rotary Hook / Shuttle' },
  { regex: /bobbin\s*case|bobbin/i, targetName: 'Bobbin Case & Bobbin' },
  { regex: /motor\s*belt|v-?belt/i, targetName: 'Motor Belt' },
  { regex: /motor\s*pulley/i, targetName: 'Motor Pulley' },
  { regex: /motor\s*coupling/i, targetName: 'Motor Coupling' },
  { regex: /pcb\s*board|control\s*pcb/i, targetName: 'Main Control PCB Board' },
  { regex: /knife\s*blade/i, targetName: 'Upper & Lower Knife Blades' },
  { regex: /presser\s*foot/i, targetName: 'Presser Foot (Heavy Duty)' }
];

/**
 * Matches an extracted raw item name against local inventory catalog items
 */
function matchItemToCatalog(rawName, catalogList) {
  const cleanRaw = (rawName || '').trim();
  if (!cleanRaw) return { item: null, confidence: 0, method: 'NONE' };

  // 1. Check Factory Aliases first
  for (const alias of OCR_FACTORY_ALIASES) {
    if (alias.regex.test(cleanRaw)) {
      const match = catalogList.find(c => c.name.toLowerCase().includes(alias.targetName.toLowerCase()));
      if (match) {
        return { item: match, confidence: 0.98, method: 'FACTORY_ALIAS' };
      }
    }
  }

  // 2. Dimension extraction (e.g. Hex Allen Key 4mm, 04mm, 10-11mm)
  const mmMatch = cleanRaw.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mmMatch) {
    const val = mmMatch[1];
    const padded = val.includes('.') ? val.padStart(5, '0') : val.padStart(2, '0');
    const match = catalogList.find(c => {
      const n = c.name.toLowerCase();
      return (n.includes('allen key') || n.includes('spanner')) && (n.includes(`(${val}mm)`) || n.includes(`(${padded}mm)`) || n.includes(val));
    });
    if (match) return { item: match, confidence: 0.95, method: 'DIMENSION' };
  }

  // 3. Exact normalized string equality
  const normRaw = cleanRaw.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const exact = catalogList.find(c => {
    const normName = c.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    return normName === normRaw;
  });
  if (exact) return { item: exact, confidence: 1.0, method: 'EXACT' };

  // 4. Substring matching
  const sub = catalogList.find(c => {
    const normName = c.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    return normName.includes(normRaw) || normRaw.includes(normName);
  });
  if (sub) return { item: sub, confidence: 0.85, method: 'SUBSTRING' };

  // 5. Token overlap & fuzzy typo tolerance
  const rawWords = new Set(normRaw.split(' ').filter(w => w.length > 1));
  let best = null;
  let bestScore = 0;

  catalogList.forEach(c => {
    const catWords = new Set(c.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1));
    let common = 0;
    rawWords.forEach(rw => {
      if (catWords.has(rw)) common += 1;
      else {
        catWords.forEach(cw => {
          if (Math.abs(rw.length - cw.length) <= 1 && (rw.startsWith(cw.slice(0, 3)) || cw.startsWith(rw.slice(0, 3)))) {
            common += 0.8;
          }
        });
      }
    });
    const score = (2 * common) / (rawWords.size + catWords.size);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });

  if (best && bestScore >= 0.40) {
    return { item: best, confidence: Math.round(bestScore * 100) / 100, method: 'FUZZY_TOKEN' };
  }

  return { item: null, confidence: 0, method: 'NONE' };
}

/**
 * Validates and cleans a detected requisition number string.
 * Strictly guarantees that header labels, factory jargon, and non-numeric strings
 * (e.g. 'REQUISITIONFROM', 'MAINTENANCE', 'STATUS') are never accepted.
 */
export function cleanAndValidateReqNo(val) {
  if (!val || typeof val !== 'string') return '';
  let clean = val.replace(/[\*\s\-_"']/g, '').toUpperCase();
  if (/^[1|l]R/i.test(clean)) clean = 'IR' + clean.slice(2);

  // Length sanity check
  if (clean.length < 5 || clean.length > 25) return '';

  // MUST contain at least 3 digits (Requisition numbers always have numbers, e.g. IR2507318801, 142472)
  const digits = (clean.match(/\d/g) || []).length;
  if (digits < 3) return '';

  // Reject any string containing known ERP keywords / field labels
  const blacklisted = [
    'REQUISITION', 'REQFROM', 'REQTO', 'MAINTENANCE', 'SEWING', 'CUTTING', 'FINISHING',
    'WAITING', 'APPROVED', 'PENDING', 'REJECTED', 'STATUS', 'DEPARTMENT', 'SECTION',
    'STORE', 'LOCATION', 'FACTORY', 'COMPANY', 'REMARKS', 'COMMENTS', 'ISSUED',
    'TOTAL', 'OPENING', 'CLOSING', 'STOCK', 'QUANTITY'
  ];
  if (blacklisted.some(kw => clean.includes(kw))) return '';

  // Match legitimate factory requisition patterns
  if (/^(?:IR|PR|MR|SR|REQ|TR|WO)[A-Z0-9]{3,20}$/i.test(clean)) return clean;
  if (/^\d{5,14}$/.test(clean)) return clean;
  if (/^[A-Z]{1,4}\d{4,14}$/i.test(clean)) return clean;
  if (digits >= 4) return clean;

  return '';
}

/**
 * Universal ERP PDF Parser
 * Filters out all unwanted columns (SL No, Item Id, Requisition To, Opening Stock, etc.)
 * and extracts ONLY data from the 'Item Name' column cell containing:
 * - Tool Name (e.g. NEEDLE LN-KEY 1.58MM, T-Ln-Key 2Mm(Bat), COMBINATION SPANNER 5MM, etc.)
 * - Tools User - [Name] - [CardNumber] [[Status]]
 */
export function parseRealErpPdfData(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return { detectedUser: {}, detectedRequisitionNo: '', items: [] };

  const detectedUser = { name: '', idNumber: '', cardNumber: '', jobTitle: 'Senior Mechanic', workingArea: 'Sewing - Jamuna', empId: '' };
  let detectedRequisitionNo = '';
  const items = [];

  let text = rawInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Pre-normalize common OCR hallucinations and typo patterns
  text = text.replace(/(?:weeds?\s*wiser|tools?\s*wiser|tools?user|tool\s*user|tols\s*user)/gi, 'Tools User');
  text = text.replace(/\[\s*(?:1a\s*eee|new|ncw|now|rew)\s*\]?/gi, '[New]');
  text = text.replace(/\[\s*(?:change|charge|changc|chg|chge)\s*\]?/gi, '[Change]');
  text = text.replace(/\[\s*(?:return|ret|retum)\s*\]?/gi, '[Return]');
  text = text.replace(/\bPog\b/gi, 'Madhob');
  text = text.replace(/\bNa1mul\b/gi, 'Najmul');

  // 2. Auto-Detect ERP Internal Requisition Number (e.g. "Requisition No : IR2512385720" or "Req No : * I R2512385720 *")
  // Priority 1: Barcode star/quote/tilde pattern e.g. "*IR2512385720*" or "* IR2512385720 *" or "*IR25 12385720\""
  const starMatches = text.matchAll(/[\*~`"']\s*([A-Za-z0-9\s\-]{5,25})\s*[\*~`"']/g);
  for (const sm of starMatches) {
    const candidate = cleanAndValidateReqNo(sm[1]);
    if (candidate) {
      detectedRequisitionNo = candidate;
      break;
    }
  }

  // Priority 2: Direct Requisition No label on SAME LINE (flexible punctuation : . = ; - or whitespace)
  if (!detectedRequisitionNo) {
    const sameLineMatch = text.match(/(?:requisition\s*(?:no\.?|num(?:ber)?|#)|req\.?\s*(?:no\.?|#))[^\S\r\n]*[:\-–—=\.\t ;]*[^\S\r\n]*\*?\s*([A-Za-z0-9\-_]{4,25})/i);
    if (sameLineMatch) {
      const candidate = cleanAndValidateReqNo(sameLineMatch[1]);
      if (candidate) {
        detectedRequisitionNo = candidate;
      }
    }
  }

  // Priority 3: Direct Requisition No label followed by newline and number on next line
  if (!detectedRequisitionNo) {
    const nextLineMatch = text.match(/(?:requisition\s*(?:no\.?|num(?:ber)?|#)|req\.?\s*(?:no\.?|#))[^\S\r\n]*[:\-–—=\.\t ;]*\r?\n\s*\*?\s*([A-Za-z0-9\-_]{4,25})/i);
    if (nextLineMatch) {
      const candidate = cleanAndValidateReqNo(nextLineMatch[1]);
      if (candidate) {
        detectedRequisitionNo = candidate;
      }
    }
  }

  // Priority 4: Standalone IR / PR / MR / REQ code anywhere in document e.g. IR2512385720 or IR260227649
  if (!detectedRequisitionNo) {
    const standaloneMatch = text.match(/\b([1I|l]R[\-\s]?[0-9]{6,14}|(?:PR|MR|SR|REQ|TR|WO)[\-\s]?[0-9]{4,14})\b/i);
    if (standaloneMatch) {
      const candidate = cleanAndValidateReqNo(standaloneMatch[1]);
      if (candidate) {
        detectedRequisitionNo = candidate;
      }
    }
  }

  // 3. Resolve mechanic against Manpower (employeeService)
  const allEmps = (typeof employeeService !== 'undefined' ? employeeService.getAllEmployees() : []) || [];

  const userMatch = text.match(/Tools\s*User\s*[-–—:]*\s*([^\-]+?)\s*[-–—:]\s*([0-9a-zA-Z]{4,10})/i);
  if (userMatch) {
    const rawUName = userMatch[1].trim();
    const rawUDigits = userMatch[2].replace(/[^\d]/g, '');
    const cleanName = rawUName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Search employee in Manpower: check exact card, fuzzy 1-digit card (OCR 182472 -> 142472), or name alias
    const matched = allEmps.find(e => {
      const empDigits = (e.cardNumber || '').replace(/[^\d]/g, '');
      if (rawUDigits.length >= 5 && empDigits) {
        let diff = 0;
        for (let i = 0; i < Math.min(rawUDigits.length, empDigits.length); i++) {
          if (rawUDigits[i] !== empDigits[i]) diff++;
        }
        if (diff <= 1 && Math.abs(rawUDigits.length - empDigits.length) <= 1) return true;
      }
      if (cleanName && e.name) {
        const empClean = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanName.includes(empClean) || empClean.includes(cleanName)) return true;
      }
      return false;
    });

    if (matched) {
      detectedUser.empId = matched.id;
      detectedUser.name = matched.name;
      detectedUser.cardNumber = matched.cardNumber;
      detectedUser.idNumber = matched.cardNumber.replace(/^AMG-?0*/i, '') || matched.cardNumber;
      detectedUser.jobTitle = matched.designation || 'Senior Mechanic';
      detectedUser.workingArea = matched.workingArea || matched.department || 'Sewing - Jamuna';
    } else {
      detectedUser.name = rawUName;
      detectedUser.idNumber = rawUDigits;
    }
  }

  // 4. Extract tool lines: Works for both Tab-delimited copied PDF text and raw OCR text lines
  const catalogAll = getAllCatalogItems('ALL');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Helper: Robust Multi-Criteria Status Detector (Tolerant to OCR Typos)
  function detectStatus(str) {
    if (!str) return null;
    const s = String(str);
    // 1. Bracketed tags (highest priority, handles OCR typos like [Chanqe], [Charge], [l0st], etc.)
    if (/\[\s*(?:ch[a-z]{1,5}g[a-z]{0,2}|replace[a-z]*|rep|chg|charge|changc|chanqe|cnanqe|chge|chonge|clange|exchange|exchanged)\s*\]/i.test(s)) return 'REPLACED';
    if (/\[\s*(?:lost|l0st|last|losi|lose|missing|harao|harano|damage[a-z]*|return|ret|retum)\s*\]/i.test(s)) return 'LOST';
    if (/\[\s*(?:new|ncw|now|rew|1a\s*eee|fresh|nev|naw)\s*\]/i.test(s)) return 'NEW_ISSUE';

    // 2. Parenthesized or curly braced tags: (Change), (Lost), (New)
    if (/\(\s*(?:change|charge|changc|chanqe|chg|replace|replaced)\s*\)/i.test(s)) return 'REPLACED';
    if (/\(\s*(?:lost|l0st|last|lose|missing|harao|harano|return)\s*\)/i.test(s)) return 'LOST';
    if (/\(\s*(?:new|ncw|now|rew|fresh)\s*\)/i.test(s)) return 'NEW_ISSUE';

    // 3. Keyword word boundaries (Change, Lost, Return, New)
    if (/\b(?:change|changed|replaced|replacement|exchange|exchanged|চেঞ্জ|পরিবর্তন)\b/i.test(s)) return 'REPLACED';
    if (/\b(?:lost|missing|harao|harano|damaged?|হারানো|হারাই)\b/i.test(s)) return 'LOST';
    if (/\b(?:new|fresh|new\s*issue|নতুন)\b/i.test(s)) return 'NEW_ISSUE';

    return null;
  }

  // Pre-extract sequential table status tags from table rows following the header
  const tableStatusTags = [];
  let passedHeader = false;
  for (const l of lines) {
    if (/^(?:sl|item\s*id|item\s*name|opening|requisition\s*to)/i.test(l)) {
      passedHeader = true;
    }
    if (passedHeader) {
      const st = detectStatus(l);
      if (st) tableStatusTags.push(st);
    }
  }

  const hasToolKeyword = (l) => {
    return /tools?\s*ba[gcq68]|tools?\s*b[a-z0-9]{1,3}\b|screw\s*driver|pleir|plier|allen\s*key|ln[\s\-]*key|spanner|wrench|file|scissors|shuttle|hook|bobbin|knife|blade|presser\s*foot|cable\s*tie|sand\s*paper|glue/i.test(l);
  };

  const isHeaderOrJunk = (l) => {
    // NEVER discard if line contains a real tool keyword!
    if (hasToolKeyword(l)) return false;

    if (/^(sl\.?|item\s*id|item\s*name|requisition|opening|req\s*qty|closing|uom|gpaning|app\s*qty|issue\s*qty)\b/i.test(l)) return true;
    if (/^(internal\s*requisition|date\s*:|requisition\s*from|floor\s*:|line\s*:|cost\s*center|status\s*:|req\s*no|comments\s*:|machine\s*:|pi\s*no|sales\s*order|lot\s*no|fab\s*code|total\s*:)/i.test(l)) return true;
    if (/^[\d\-]{10,35}$/.test(l)) return true; // pure item ID
    if (/^\d+$/.test(l)) return true; // pure number
    if (/^tools\s*user/i.test(l)) return true;
    if (/^(pcs|pc)$/i.test(l)) return true;
    if (/^(odor\s*\d+|084\s*2\-080|adzb\d+|ones|neo|on1a|ae\s*a\s*tr|zs\s*ae|a)$/i.test(l)) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    let origLine = lines[i];
    if (isHeaderOrJunk(origLine)) continue;

    let line = origLine;

    // 1. If line has a pipe | separating Item ID column and Item Name column, strip everything before pipe
    if (line.includes('|')) {
      line = line.replace(/^.*?\|\s*/, '');
    } else {
      // Strip leading header artifacts, serial numbers, and 8-40 char item codes
      line = line.replace(/^(?:sl\.?\s*(?:no\.?)?|item\s*(?:id|name)|requisition\s*to|opening|req\s*qty|closing|uom)[\s\t:]*/gi, '');
      line = line.replace(/^\d+[\s\t\.\)]+/, '');
      line = line.replace(/^[0-9a-zA-Z\.\-]{8,40}[\s\t]+/i, '');
      line = line.replace(/^[\|\!\/\\I\.\s\t\-]+/, '');
    }

    // 2. Strip trailing columns/store names ("SPARE PARTS STORE (AKM)...", "39 PCS", etc.)
    line = line.replace(/[\s\t]*SPARE\s*PARTS\s*STORE.*$/i, '');
    line = line.replace(/[\s\t]*Tools\s*User.*$/i, '');
    line = line.replace(/[\s\t]*\d+[\s\t]+PCS.*$/i, '');
    line = line.replace(/^[\|\s\t]+|[\|\s\t]+$/g, '');
    line = line.trim();

    if (!line || line.length < 3 || isHeaderOrJunk(line)) continue;

    const match = matchItemToCatalog(line, catalogAll);
    if (match.item) {
      // Multi-line Context Window Status Detection
      let detectedItemStatus = null;

      // Check forward lines up to 4 lines (without bleeding into next tool line)
      for (let offset = 0; offset <= 4; offset++) {
        const idx = i + offset;
        if (idx >= lines.length) break;
        if (offset > 0 && hasToolKeyword(lines[idx])) break;
        const st = detectStatus(lines[idx]);
        if (st) {
          detectedItemStatus = st;
          break;
        }
      }

      // Check backward lines up to 2 lines
      if (!detectedItemStatus) {
        for (let offset = 1; offset <= 2; offset++) {
          const idx = i - offset;
          if (idx < 0) break;
          if (hasToolKeyword(lines[idx])) break;
          const st = detectStatus(lines[idx]);
          if (st) {
            detectedItemStatus = st;
            break;
          }
        }
      }

      // Sequential Fallback: Map by table tag index if available
      if (!detectedItemStatus) {
        const itemIdx = items.length;
        if (itemIdx < tableStatusTags.length) {
          detectedItemStatus = tableStatusTags[itemIdx];
        }
      }

      const changeStatus = detectedItemStatus || 'NEW_ISSUE';

      items.push({
        rawItemName: line,
        userName: detectedUser.name || 'Mechanic',
        userId: detectedUser.idNumber || '',
        changeStatus,
        quantity: 1
      });
    }
  }

  return { detectedUser, detectedRequisitionNo, items };
}

/**
 * Performs high-resolution Tesseract OCR on an image source with bicubic smoothing and contrast
 */
async function runOcrOnImage(imageSource, onProgress) {
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract OCR library is not available in browser runtime.');
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image file.'));
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource);
    }
  });

  // Scale with high-quality bicubic smoothing and generous clean white margins (padding)
  // Tesseract LSTM requires white space around text boundaries to properly detect
  // top/bottom text baselines and avoid dropping header lines touching image edges.
  const scale = 3.0;
  const pad = 80;
  const scaledW = Math.round(img.naturalWidth * scale);
  const scaledH = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = scaledW + pad * 2;
  canvas.height = scaledH + pad * 2;
  const ctx = canvas.getContext('2d');

  // Fill entire canvas with pure white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, pad, pad, scaledW, scaledH);

  // Gentle contrast stretch & border neutralization
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Erase any solid horizontal line in top 15 pixels of original image (e.g. cut boundary line above requisition line)
  for (let y = pad; y < pad + Math.round(15 * scale); y++) {
    let darkCount = 0;
    for (let x = pad; x < pad + scaledW; x++) {
      const idx = (y * w + x) * 4;
      if (d[idx] < 120 && d[idx + 1] < 120 && d[idx + 2] < 120) darkCount++;
    }
    if (darkCount > scaledW * 0.30) {
      for (let x = pad; x < pad + scaledW; x++) {
        const idx = (y * w + x) * 4;
        d[idx] = 255; d[idx + 1] = 255; d[idx + 2] = 255;
      }
    }
  }

  // Also erase any solid vertical line on left 1-8 pixels of original image
  for (let x = pad; x < pad + Math.round(8 * scale); x++) {
    let darkCount = 0;
    for (let y = pad; y < pad + scaledH; y++) {
      const idx = (y * w + x) * 4;
      if (d[idx] < 120 && d[idx + 1] < 120 && d[idx + 2] < 120) darkCount++;
    }
    if (darkCount > scaledH * 0.50) {
      for (let y = pad; y < pad + scaledH; y++) {
        const idx = (y * w + x) * 4;
        d[idx] = 255; d[idx + 1] = 255; d[idx + 2] = 255;
      }
    }
  }

  // Crisp text contrast
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum > 200) {
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
    } else if (lum < 90) {
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 0;
    } else {
      const adjusted = Math.min(255, Math.max(0, (lum - 128) * 1.6 + 128));
      d[i] = adjusted; d[i + 1] = adjusted; d[i + 2] = adjusted;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const res = await Tesseract.recognize(canvas, 'eng', {
    workerPath: 'lib/tesseract-worker.min.js',
    corePath: 'lib/tesseract-core-simd-lstm.wasm.js',
    langPath: 'lib',
    gzip: true,
    logger: m => {
      if (onProgress && typeof onProgress === 'function') onProgress(m);
    }
  });

  return res.data.text || '';
}

/**
 * Opens the Streamlined Smart ERP PDF Import Modal
 * Direct paste (Ctrl+V) from PDF copy or screenshot; extracts only 'Item Name' column data!
 */
export function openSmartOcrModal(initialBlob = null, initialText = '') {
  let modalLayer = document.getElementById('tools-modal-layer') || document.getElementById('modal-layer');
  if (!modalLayer) {
    modalLayer = document.createElement('div');
    modalLayer.id = 'tools-modal-layer';
    document.body.appendChild(modalLayer);
  }

  let rawPastedText = initialText || '';
  let currentInputMode = initialBlob ? 'image' : 'text'; // 'text' | 'image' | 'templates'
  let isProcessing = false;
  let statusNotice = '';
  let mechanicFilterText = '';
  let detectedRequisitionNo = '';

  // allEmps is fetched fresh each render so it always has latest Manpower data
  let allEmps = (typeof employeeService !== 'undefined' ? employeeService.getAllEmployees({ status: 'ACTIVE' }) : []) || [];

  let detectedMechanic = {
    empId: '',
    name: '',
    idNumber: '',
    cardNumber: '',
    jobTitle: 'Senior Mechanic',
    workingArea: 'Sewing - Jamuna'
  };
  let parsedToolList = [];

  const catalogAll = getAllCatalogItems('ALL');

  // 1. Real Factory Example Dataset from Screenshot 2 (Dipok - 4 Tools - IR2507318801)
  const DIPOK_FACTORY_DEMO_TEXT = `A.K.M Knit Wear Ltd.
Internal Requisition
Requisition No : IR2507318801
Date : 21/07/25 12:14:23
Requisition From : MAINTENANCE
Floor : Sample
Line : Sample Floor
Req No : * I R2507318801 *
Comments : Tools User - Dipok - 0143446 [New]
SL No\tItem Id\tItem Name\tRequisition To\tOpening Stock Qty\tReq QTY\tApp Qty\tIssue Qty\tClosing Stock\tUOM
1\t0004-0012-0022-0042-0080\tFLAT SCREW DRIVER 10"\nTools User - Dipok - 0143446 [New]\tSPARE PARTS STORE (AKM)\t37\t1\t1\t\tPCS
2\t0004-0014-0003-0026-0343\tstar screw Driver 10"\nTools User - Dipok - 0143446 [New]\tSPARE PARTS STORE (AKM)\t19\t1\t1\t\tPCS
3\t0004-0012-0034-0008-0051\tT-Ln-Key 3Mm(Bat)\nTools User - Dipok - 0143446 [New]\tSPARE PARTS STORE (AKM)\t18\t1\t1\t\tPC
4\t0004-0012-0034-0008-0052\tT-Ln-Key 4Mm(Bat)\nTools User - Dipok - 0143446 [New]\tSPARE PARTS STORE (AKM)\t30\t1\t1\t\tPC`;

  // 2. Real Factory Example Dataset (Madhob - 17 Tools from Requisition IR260227649)
  const REAL_FACTORY_DEMO_TEXT = `Internal Requisition
Requisition No : IR260227649
SL No\tItem Id\tItem Name\tRequisition To\tOpening Stock Qty\tReq QTY\tApp Qty\tIssue Qty\tClosing Stock\tUOM
1\t0004-0012-0034-0019\tNEEDLE LN-KEY 1.58MM\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t53\t1\t1\t\tPCS
2\t0004-0012-0034-0018\tNEEDLE LN-KEY 1.50MM\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t146\t1\t1\t\tPCS
3\t0004-0014-0003-0026-0343\tstar screw Driver 10"\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t27\t1\t1\t\tPCS
4\t0004-0012-0034-0008-0050\tT-Ln-Key 2Mm(Bat)\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t89\t1\t1\t\tPC
5\t0004-0012-0034-0008-0051\tT-Ln-Key 3Mm(Bat)\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t87\t1\t1\t\tPC
6\t0004-0012-0034-0008-0052\tT-Ln-Key 4Mm(Bat)\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t29\t1\t1\t\tPC
7\t0004-0012-0034-0008-0053\tT-Ln-Key 5Mm(Bat)\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t20\t1\t1\t\tPC
8\t0004-0012-0034-0020\tCOMBINATION SPANNER 5MM\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t13\t1\t1\t\tPCS
9\t0004-0012-0034-0021\tCOMBINATION SPANNER 6MM\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t44\t1\t1\t\tPCS
10\t0004-0012-0034-0022\tCOMBINATION SPANNER 7MM\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t39\t1\t1\t\tPCS
11\t0004-0012-0034-0023\tCOMBINATION SPANNER 8MM\nTools User -Madhob - 147291 [New]Tools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t32\t1\t1\t\tPCS
12\t0004-0012-0034-0008-0018\tL-N-Key 1.5Mm\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t40\t1\t1\t\tPC
13\t0004-0012-0034-0008-0020\tL-N-Key 2Mm\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t33\t1\t1\t\tPC
14\t0004-0012-0034-0008-0021\tL-N-Key 3Mm\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t38\t1\t1\t\tPC
15\t0004-0012-0034-0008-0022\tL-N-Key 4Mm\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t46\t1\t1\t\tPC
16\t0004-0012-0034-0008-0023\tL-N-Key 5Mm\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t48\t1\t1\t\tPC
17\t0004-0012-0034-0008-0024\tL-N-Key 6Mm\nTools User -Madhob - 147291 [New]\tSPARE PARTS STORE (AKM)\t53\t1\t1\t\tPC`;

  // 3. Real Factory Example Dataset (Najmul - 10 Tools)
  const NAJMUL_FACTORY_DEMO_TEXT = `Internal Requisition
Requisition No : IR2507142472
SL No\tItem Id\tItem Name\tRequisition To\tOpening Stock Qty\tReq QTY\tApp Qty\tIssue Qty\tClosing Stock\tUOM
1\t0004-0012-0034-0008-0127\tTOOLS BAG\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t10\t1\t1\t\tPCS
2\t0004-0012-0022-0042-0080\tFLAT SCREW DRIVER 10"\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t53\t1\t1\t\tPCS
3\t0004-0014-0003-0026-0343\tstar screw Driver 10"\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t29\t1\t1\t\tPCS
4\t0004-0012-0022-0024-0541\tDIMOND FILE JUNIOR\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t34\t1\t1\t\tPCS
5\t0004-0012-0034-0022\tCOMBINATION SPANNER 7MM\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t16\t1\t1\t\tPCS
6\t0004-0012-0034-0023\tCOMBINATION SPANNER 8MM\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t4\t1\t1\t\tPCS
7\t0004-0012-0034-0029\tOPEN END SPANNER 14-17MM\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t44\t1\t1\t\tPCS
8\t0004-0012-0034-0027\tOPEN END SPANNER 10-11MM\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t44\t1\t1\t\tPCS
9\t0004-0012-0034-0019\tNEEDLE LN-KEY 1.58MM\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t12\t1\t1\t\tPCS
10\t0004-0012-0034-0018\tNEEDLE LN-KEY 1.50MM\nTools User - Najmul - 142472 [New]\tSPARE PARTS STORE (AKM)\t146\t1\t1\t\tPCS`;

  // 4. Real Factory Example Dataset (Shojib - 3 Tools with Change & New)
  const SHOJIB_FACTORY_DEMO_TEXT = `Internal Requisition
Requisition No : IR2507132694
Item Name
TOOLS BAG
Tools User - Shojib - 132694 [Change]
NOSE PLEIR 6" SEWING
Tools User - Shojib - 132694 [New]
FLAT SCREW DRIVER 10"
Tools User - Shojib - 132694 [New]`;

  function executeParse(text) {
    rawPastedText = text || '';
    const res = parseRealErpPdfData(rawPastedText);

    if (res.detectedRequisitionNo) {
      detectedRequisitionNo = res.detectedRequisitionNo;
    }

    // Update detected mechanic from parser
    if (res.detectedUser.empId) detectedMechanic.empId = res.detectedUser.empId;
    if (res.detectedUser.name) detectedMechanic.name = res.detectedUser.name;
    if (res.detectedUser.idNumber) detectedMechanic.idNumber = res.detectedUser.idNumber;
    if (res.detectedUser.cardNumber) detectedMechanic.cardNumber = res.detectedUser.cardNumber;
    if (res.detectedUser.jobTitle) detectedMechanic.jobTitle = res.detectedUser.jobTitle;
    if (res.detectedUser.workingArea) detectedMechanic.workingArea = res.detectedUser.workingArea;

    // Fallback search in Manpower if empId is not yet resolved
    if (!detectedMechanic.empId && (detectedMechanic.idNumber || detectedMechanic.name)) {
      const searchNum = (detectedMechanic.idNumber || '').replace(/[^\d]/g, '');
      const searchNam = (detectedMechanic.name || '').trim().toLowerCase();
      const found = allEmps.find(e => {
        const empNum = (e.cardNumber || '').replace(/[^\d]/g, '');
        const nMatch = searchNam && e.name && (e.name.toLowerCase().includes(searchNam) || searchNam.includes(e.name.toLowerCase()));
        const idMatch = searchNum.length >= 4 && empNum && (empNum.includes(searchNum) || searchNum.includes(empNum));
        return idMatch || nMatch;
      });
      if (found) {
        detectedMechanic.empId = found.id;
        detectedMechanic.name = found.name;
        detectedMechanic.cardNumber = found.cardNumber;
        detectedMechanic.idNumber = found.cardNumber.replace(/^AMG-?0*/i, '') || found.cardNumber;
        detectedMechanic.jobTitle = found.designation || 'Senior Mechanic';
        detectedMechanic.workingArea = found.workingArea || found.department || 'Sewing - Jamuna';
      }
    }

    const reqTag = detectedRequisitionNo ? `ERP Req #${detectedRequisitionNo}` : 'ERP PDF';
    parsedToolList = res.items.map((it, idx) => {
      const match = matchItemToCatalog(it.rawItemName, catalogAll);
      return {
        id: 'real-item-' + (idx + 1),
        rawName: it.rawItemName,
        matchedItem: match.item,
        confidence: match.confidence,
        quantity: it.quantity || 1,
        changeStatus: it.changeStatus || 'NEW_ISSUE',
        remarks: `${reqTag}: ${detectedMechanic.name || ''} (${detectedMechanic.idNumber || ''})`
      };
    });

    if (parsedToolList.length > 0) {
      statusNotice = `✅ Successfully extracted ${parsedToolList.length} tools${detectedRequisitionNo ? ` from Requisition ${detectedRequisitionNo}` : ''} for ${detectedMechanic.name || 'Mechanic'} (${detectedMechanic.idNumber || '-'})!`;
    }
  }

  if (initialText) {
    executeParse(initialText);
  }

  function renderModalUI() {
    // Always fetch fresh Manpower data on each render
    allEmps = (typeof employeeService !== 'undefined' ? employeeService.getAllEmployees({ status: 'ACTIVE' }) : []) || [];

    const qFilter = mechanicFilterText.toLowerCase().trim();
    const filteredEmps = allEmps.filter(e => {
      if (!qFilter) return true;
      const nm  = (e.name        || '').toLowerCase();
      const cd  = (e.cardNumber  || '').toLowerCase();
      const deg = (e.designation || '').toLowerCase();
      const dep = (e.department  || '').toLowerCase();
      const ph  = (e.phone       || '').toLowerCase();
      return nm.includes(qFilter) || cd.includes(qFilter) ||
             deg.includes(qFilter) || dep.includes(qFilter) || ph.includes(qFilter);
    });

    // AUTO-SELECT LOGIC: If filtering, automatically select the first match so badges update instantly
    if (qFilter && filteredEmps.length > 0) {
      const currentStillMatches = filteredEmps.some(e => e.id === detectedMechanic.empId);
      if (!currentStillMatches) {
        const autoSel = filteredEmps[0];
        detectedMechanic.empId = autoSel.id;
        detectedMechanic.name = autoSel.name;
        detectedMechanic.cardNumber = autoSel.cardNumber;
        detectedMechanic.idNumber = (autoSel.cardNumber || '').replace(/^AMG-?0*/i, '') || autoSel.cardNumber || autoSel.id;
        detectedMechanic.jobTitle = autoSel.designation || 'Mechanic';
        detectedMechanic.workingArea = autoSel.workingArea || autoSel.department || 'General';
      }
    }

    modalLayer.innerHTML = `
      <div id="ocr-modal-root" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(3, 7, 18, 0.94); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 12px; backdrop-filter: blur(10px);">
        <div style="background: #0f172a; border: 2px solid #38bdf8; border-radius: 14px; width: 100%; max-width: 1120px; max-height: 95vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px -12px rgba(56, 189, 248, 0.4);">
          
          <!-- Modal Header -->
          <div style="background: linear-gradient(135deg, #0284c7, #1d4ed8); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #38bdf8;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 26px;">📋</span>
              <div>
                <div style="font-size: 16.5px; font-weight: 800; color: #fff; letter-spacing: 0.3px;">
                  Smart ERP PDF Table Importer &amp; Auto-Fill
                </div>
                <div style="font-size: 11.5px; color: #bae6fd; margin-top: 2px;">
                  Fast, accurate auto-import from garments factory ERP Requisition PDF — strictly extracts from <strong>Item Name</strong> column
                </div>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <button id="btn-close-ocr-clean-modal" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; padding: 4px 10px;" title="Close Modal">✕</button>
            </div>
          </div>

          <!-- Modal Body Scroll Container -->
          <div style="padding: 14px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #0b1329;">
            
            <!-- STEP 1: MANPOWER MECHANIC ASSIGNMENT -->
            <div style="background: #172554; border: 1.5px solid #38bdf8; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="font-size: 13px; font-weight: 800; color: #93c5fd; display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 16px;">👤</span> Step 1: Assigned Mechanic from Manpower:
                </div>
                <span style="font-size: 11px; color: #86efac; font-weight: 700; background: rgba(34,197,94,0.15); border: 1px solid #22c55e; padding: 2px 8px; border-radius: 4px;">
                  ⚡ Auto-Detects from PDF or Select Below
                </span>
              </div>

              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <!-- Quick Filter Input -->
                <input type="text" id="inp-search-modal-emp" value="${mechanicFilterText}" placeholder="🔍 Filter mechanic (e.g. Najmul, 142472)..."
                  style="width: 220px; background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8; border-radius: 6px; padding: 6px 10px; font-size: 12px; font-weight: 600;" />

                <!-- Mechanic Dropdown -->
                <select id="sel-modal-manpower-emp" style="flex: 2; min-width: 280px; background: #0f172a; color: #fff; border: 1px solid #38bdf8; border-radius: 6px; padding: 6px 10px; font-size: 12.5px; font-weight: 700;">
                  <option value="">-- Choose or Search Mechanic from Manpower --</option>
                  ${filteredEmps.length === 0 ? `<option value="" disabled>— No matching employees found —</option>` : ''}
                  ${filteredEmps.map(emp => {
      const isSel = (detectedMechanic.empId && detectedMechanic.empId === emp.id) ||
        (detectedMechanic.idNumber && emp.cardNumber && emp.cardNumber.includes(detectedMechanic.idNumber)) ||
        (detectedMechanic.name && emp.name && (emp.name.toLowerCase().includes(detectedMechanic.name.toLowerCase()) || detectedMechanic.name.toLowerCase().includes(emp.name.toLowerCase())));
      const cardNum = (emp.cardNumber || '').replace(/^AMG-?0*/i, '') || emp.cardNumber || emp.id;
      const area = emp.workingArea || emp.lineName || emp.floorName || emp.department || '';
      return `<option value="${emp.id}" ${isSel ? 'selected' : ''}>
                      ${emp.name} (${cardNum}) — ${emp.designation || 'Mechanic'}${area ? ' | ' + area : ''}
                    </option>`;
    }).join('')}
                </select>

                <!-- Mechanic Badges Preview -->
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="background: #0f172a; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 11.5px; color: #cbd5e1;">
                    Card: <strong id="lbl-modal-card" style="color: #fde047; font-family: monospace;">${detectedMechanic.idNumber || '-'}</strong>
                  </span>
                  <span style="background: #0f172a; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 11.5px; color: #cbd5e1;">
                    Title: <strong id="lbl-modal-title" style="color: #fff;">${detectedMechanic.jobTitle || 'Senior Mechanic'}</strong>
                  </span>
                  <span style="background: #0f172a; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 11.5px; color: #cbd5e1;">
                    Area: <strong id="lbl-modal-area" style="color: #38bdf8;">${detectedMechanic.workingArea || 'Sewing - Jamuna'}</strong>
                  </span>
                </div>
              </div>
            </div>

            <!-- STEP 2: INPUT ERP PDF DATA TABS -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <button id="btn-tab-text-paste" style="background: ${currentInputMode === 'text' ? '#0284c7' : '#0f172a'}; color: #fff; border: 1px solid ${currentInputMode === 'text' ? '#38bdf8' : '#475569'}; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <span>📋</span> Method 1: Copy-Paste PDF Text (100% Accurate)
                  </button>
                  <button id="btn-tab-image-paste" style="background: ${currentInputMode === 'image' ? '#7c3aed' : '#0f172a'}; color: #fff; border: 1px solid ${currentInputMode === 'image' ? '#c084fc' : '#475569'}; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <span>📸</span> Method 2: Screenshot Image / Scan (AI OCR)
                  </button>
                  <button id="btn-tab-templates" style="background: ${currentInputMode === 'templates' ? '#059669' : '#0f172a'}; color: #fff; border: 1px solid ${currentInputMode === 'templates' ? '#34d399' : '#475569'}; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <span>⚡</span> Method 3: Factory Quick Templates (1-Click Test)
                  </button>
                </div>

                <!-- Requisition No Option (Replaces Presets) -->
                <div style="display: flex; align-items: center; gap: 8px; background: #0f172a; border: 1.5px solid #0284c7; border-radius: 8px; padding: 4px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                  <span style="font-size: 12px; font-weight: 800; color: #93c5fd; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
                    <span>📄</span> Requisition No :
                  </span>
                  <input type="text" id="inp-modal-requisition-no" value="${detectedRequisitionNo || ''}" placeholder="e.g. IR2507318801"
                    style="background: #0b1329; color: #fde047; font-family: monospace; font-size: 13px; font-weight: 900; border: 1.5px solid #38bdf8; border-radius: 5px; padding: 4px 10px; width: 160px; letter-spacing: 0.5px; outline: none;" 
                    title="Garments Factory ERP Requisition Number (Auto-detected from PDF/OCR or enter manually)" />
                  ${detectedRequisitionNo ? `
                    <span id="badge-modal-req-status" style="font-size: 10.5px; color: #86efac; background: rgba(34,197,94,0.2); border: 1px solid #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 800; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                      ⚡ Auto-Detected
                    </span>
                  ` : `
                    <span id="badge-modal-req-status" style="font-size: 10.5px; color: #64748b; font-style: italic; white-space: nowrap;">
                      ⚡ Auto-Detects from PDF
                    </span>
                  `}
                </div>
              </div>

              ${currentInputMode === 'text' ? `
                <div>
                  <div style="font-size: 12px; color: #38bdf8; margin-bottom: 6px; background: rgba(2,132,199,0.12); padding: 7px 12px; border-radius: 6px; border-left: 3px solid #38bdf8; display: flex; align-items: center; gap: 8px;">
                    <span>💡</span>
                    <span><strong>Easy 3 Steps:</strong> 1. Open your Requisition PDF ➔ 2. Select table rows and copy (<kbd style="background: #0369a1; padding: 1px 5px; border-radius: 3px; color: #fff;">Ctrl+C</kbd>) ➔ 3. Paste into the box below (<kbd style="background: #0369a1; padding: 1px 5px; border-radius: 3px; color: #fff;">Ctrl+V</kbd>) — automatically extracts all tools!</span>
                  </div>
                  <textarea id="unified-raw-input" rows="4" placeholder="Paste copied table rows from your ERP PDF here (Ctrl+V)..."
                    style="width: 100%; background: #0f172a; color: #f8fafc; border: 1.5px solid #475569; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 12px; resize: vertical;">${rawPastedText || ''}</textarea>
                </div>
              ` : currentInputMode === 'image' ? `
                <div>
                  <div id="ocr-image-dropzone" style="border: 2px dashed #a855f7; background: #0f172a; border-radius: 8px; padding: 22px 14px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
                    <div style="font-size: 32px; margin-bottom: 4px;">📸</div>
                    <div style="font-size: 13.5px; font-weight: 700; color: #c084fc;">
                      Click to Browse Image File or Press <kbd style="background: #581c87; padding: 2px 7px; border-radius: 4px; color: #fff;">Ctrl+V</kbd> to Paste Screenshot
                    </div>
                    <div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">
                      High-resolution AI OCR will recognize text and extract tools strictly from the Item Name column
                    </div>
                    <input type="file" id="inp-modal-ocr-file" accept="image/*" style="display: none;" />
                  </div>
                  ${rawPastedText ? `
                    <div style="margin-top: 8px;">
                      <label style="font-size: 11.5px; color: #94a3b8; font-weight: 600;">Recognized OCR Text:</label>
                      <textarea id="unified-raw-input" rows="3" style="width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 11.5px; resize: vertical;">${rawPastedText || ''}</textarea>
                    </div>
                  ` : ''}
                </div>
              ` : `
                <!-- TEMPLATES TAB -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                  <div id="card-tpl-dipok" style="background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="color: #38bdf8; font-size: 13px;">📄 Dipok Requisition (4 Tools)</strong>
                      <span style="background: #0369a1; color: #e0f2fe; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">IR2507318801</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">
                      Flat Screwdriver 10", Star Screwdriver 10", T-Ln-Key 3mm, T-Ln-Key 4mm [Sample Floor]
                    </div>
                    <div style="font-size: 11px; color: #38bdf8; font-weight: 700; margin-top: 4px;">👉 Click to Load AKM Internal Requisition</div>
                  </div>

                  <div id="card-tpl-najmul" style="background: #0f172a; border: 1.5px solid #10b981; border-radius: 8px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="color: #6ee7b7; font-size: 13px;">⚡ Najmul Requisition (10 Tools)</strong>
                      <span style="background: #064e3b; color: #a7f3d0; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">142472</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">
                      Tools Bag, Flat Screwdriver, Star Screwdriver, Diamond File, Spanners (7mm, 8mm, 10-11mm, 14-17mm), Needle Keys
                    </div>
                    <div style="font-size: 11px; color: #34d399; font-weight: 700; margin-top: 4px;">👉 Click to Load Najmul Dataset</div>
                  </div>

                  <div id="card-tpl-madhob" style="background: #0f172a; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="color: #fcd34d; font-size: 13px;">🧪 Madhob Requisition (17 Tools)</strong>
                      <span style="background: #78350f; color: #fde68a; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">147291</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">
                      Needle Allen Keys, T-Handle Keys (2mm, 3mm, 4mm, 5mm), Combination Spanners (5mm to 8mm), L-N-Keys (1.5mm to 6mm)
                    </div>
                    <div style="font-size: 11px; color: #fbbf24; font-weight: 700; margin-top: 4px;">👉 Click to Load Madhob Dataset</div>
                  </div>

                  <div id="card-tpl-shojib" style="background: #0f172a; border: 1.5px solid #a855f7; border-radius: 8px; padding: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="color: #d8b4fe; font-size: 13px;">🔄 Shojib Requisition (3 Tools)</strong>
                      <span style="background: #581c87; color: #e9d5ff; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 700;">132694</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8;">
                      Tools Bag [Change], Nose Plier 6" [New], Flat Screwdriver 10" [New]
                    </div>
                    <div style="font-size: 11px; color: #c084fc; font-weight: 700; margin-top: 4px;">👉 Click to Load Shojib Dataset</div>
                  </div>
                </div>
              `}

              <!-- Status Notice & Action Trigger Buttons -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div id="lbl-status-notice" style="font-size: 12px; color: ${statusNotice.includes('✅') ? '#86efac' : '#38bdf8'}; font-weight: 700;">
                  ${statusNotice || 'Ready. Copy rows from your ERP PDF (Ctrl+C) and paste (Ctrl+V) above.'}
                </div>
                <div style="display: flex; gap: 8px;">
                  <button id="btn-manual-parse-trigger" style="background: #0284c7; color: #fff; border: none; padding: 5px 14px; border-radius: 5px; font-size: 11.5px; font-weight: 800; cursor: pointer;">
                    ⚡ Extract From Item Name
                  </button>
                  <button id="btn-clear-paste-input" style="background: #475569; color: #fff; border: none; padding: 5px 12px; border-radius: 5px; font-size: 11.5px; cursor: pointer;">
                    🧹 Clear
                  </button>
                </div>
              </div>
            </div>

            <!-- STEP 3: EXTRACTED TOOLS & STOCK MATCH PREVIEW TABLE -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-size: 13px; font-weight: 800; color: #f1f5f9;">
                    🛠️ Step 3: Extracted Tools &amp; Stock Match Preview:
                  </span>
                  <span style="background: rgba(34,197,94,0.2); border: 1px solid #22c55e; color: #86efac; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;">
                    ${parsedToolList.length} Items Detected
                  </span>
                  <span style="font-size: 11px; color: #94a3b8;">
                    Registration: <strong style="color: #fde047;">#${currentRegNo}</strong>
                  </span>
                  ${detectedRequisitionNo ? `
                    <span style="font-size: 11px; color: #cbd5e1; background: #0f172a; padding: 2px 8px; border-radius: 4px; border: 1px solid #0284c7;">
                      Requisition: <strong id="lbl-modal-preview-req" style="color: #38bdf8; font-family: monospace; font-weight: 800;">${detectedRequisitionNo}</strong>
                    </span>
                  ` : ''}
                </div>

                <div style="display: flex; align-items: center; gap: 6px;">
                  <button id="btn-manual-add-row" style="background: #0284c7; color: #fff; border: 1px solid #38bdf8; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Add an extra tool manually to this list">
                    <span>➕</span> Add Item Manually
                  </button>
                  <button id="btn-clear-extracted-table" style="background: #475569; color: #cbd5e1; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;" title="Clear all rows">
                    🧹 Clear Table
                  </button>
                </div>
              </div>

              ${parsedToolList.length === 0 ? `
                <div style="text-align: center; padding: 28px 12px; color: #94a3b8; font-size: 12.5px; background: #0f172a; border-radius: 8px; border: 1px dashed #334155; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                  <div style="font-size: 28px;">📦</div>
                  <div><strong>No tools detected yet.</strong> Copy table rows from your ERP PDF and paste (Ctrl+V) above, or upload a screenshot/scan.</div>
                  <div style="font-size: 11.5px; color: #64748b;">The system automatically identifies the Mechanic, Requisition No, and Tools strictly from the Item Name column.</div>
                </div>
              ` : `
                <div style="overflow-x: auto; max-height: 360px; border: 1px solid #334155; border-radius: 6px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                      <tr style="background: #0f172a; color: #94a3b8; border-bottom: 2px solid #334155; font-size: 11px; text-transform: uppercase;">
                        <th style="padding: 8px 10px; width: 35px; text-align: center;">#</th>
                        <th style="padding: 8px 10px; width: 220px;">PDF Extracted Item Name</th>
                        <th style="padding: 8px 10px;">Matched Local Stock Item</th>
                        <th style="padding: 8px 10px; width: 85px; text-align: center;">Qty</th>
                        <th style="padding: 8px 10px; width: 135px;">Issue Status</th>
                        <th style="padding: 8px 10px; width: 35px; text-align: center;">Del</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${parsedToolList.map((item, idx) => {
      return `
                          <tr style="border-bottom: 1px solid #334155; background: ${idx % 2 === 0 ? '#1e293b' : '#172554'};">
                            <td style="padding: 6px 10px; text-align: center; font-weight: 700; color: #94a3b8;">
                              ${idx + 1}
                            </td>
                            
                            <!-- PDF Raw Item Name -->
                            <td style="padding: 6px 10px;">
                              <div style="font-weight: 800; color: #fff; font-family: monospace; font-size: 12px;">
                                ${item.rawName}
                              </div>
                            </td>

                            <!-- Matched Catalog Item Dropdown -->
                            <td style="padding: 6px 10px;">
                              <select class="sel-clean-matched-item" data-id="${item.id}" 
                                style="width: 100%; background: #0f172a; color: #f8fafc; border: 1.5px solid ${item.matchedItem ? '#22c55e' : '#f59e0b'}; border-radius: 4px; padding: 4px 8px; font-size: 12px; font-weight: 600;">
                                <option value="" ${!item.matchedItem ? 'selected' : ''}>⚠️ Please Select / Verify Stock Item</option>
                                <optgroup label="Tools &amp; Equipment (Master Tools)">
                                  ${catalogAll.filter(c => c.type === 'TOOL').map(c => `
                                    <option value="${c.id}" ${item.matchedItem && item.matchedItem.id === c.id ? 'selected' : ''}>
                                      [TOOL] ${c.code ? c.code + ' - ' : ''}${c.name}
                                    </option>
                                  `).join('')}
                                </optgroup>
                                <optgroup label="Accessories &amp; Consumables">
                                  ${catalogAll.filter(c => c.type === 'ACCESSORY').map(c => `
                                    <option value="${c.id}" ${item.matchedItem && item.matchedItem.id === c.id ? 'selected' : ''}>
                                      [ACC] ${c.code ? c.code + ' - ' : ''}${c.name}
                                    </option>
                                  `).join('')}
                                </optgroup>
                                <optgroup label="Machine Spare Parts (20 Master Spares)">
                                  ${catalogAll.filter(c => c.type === 'SPARE_PART').map(c => `
                                    <option value="${c.id}" ${item.matchedItem && item.matchedItem.id === c.id ? 'selected' : ''}>
                                      [SPARE] ${c.code ? c.code + ' - ' : ''}${c.name}
                                    </option>
                                  `).join('')}
                                </optgroup>
                              </select>
                            </td>

                            <!-- Quantity with Stepper -->
                            <td style="padding: 6px 10px; text-align: center;">
                              <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                                <button type="button" class="btn-clean-qty-minus" data-id="${item.id}" style="background: #0f172a; color: #fff; border: 1px solid #475569; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">−</button>
                                <input type="number" class="inp-clean-qty" data-id="${item.id}" min="1" max="999" value="${item.quantity || 1}" 
                                  style="width: 36px; background: #0f172a; color: #22c55e; font-weight: 800; text-align: center; border: 1px solid #475569; border-radius: 3px; padding: 2px; font-size: 12px;" />
                                <button type="button" class="btn-clean-qty-plus" data-id="${item.id}" style="background: #0f172a; color: #fff; border: 1px solid #475569; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold;">+</button>
                              </div>
                            </td>

                            <!-- Status (New vs Replaced vs Lost) -->
                            <td style="padding: 6px 10px;">
                              <select class="sel-clean-status" data-id="${item.id}" 
                                style="width: 100%; background: ${item.changeStatus === 'REPLACED' ? '#7f1d1d' : (item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED') ? '#7c2d12' : '#064e3b'}; color: ${item.changeStatus === 'REPLACED' ? '#fca5a5' : (item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED') ? '#fed7aa' : '#6ee7b7'}; border: 1px solid ${item.changeStatus === 'REPLACED' ? '#ef4444' : (item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED') ? '#ea580c' : '#10b981'}; border-radius: 4px; padding: 4px 6px; font-size: 11px; font-weight: 800;">
                                <option value="NEW_ISSUE" ${item.changeStatus === 'NEW_ISSUE' ? 'selected' : ''}>🆕 New [New]</option>
                                <option value="REPLACED" ${item.changeStatus === 'REPLACED' ? 'selected' : ''}>🔄 Replaced [Change]</option>
                                <option value="LOST" ${(item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED') ? 'selected' : ''}>⚠️ Lost [Lost]</option>
                              </select>
                            </td>

                            <!-- Delete Row -->
                            <td style="padding: 6px 10px; text-align: center;">
                              <button class="btn-clean-del-row" data-id="${item.id}" style="background: transparent; border: none; color: #ef4444; font-size: 16px; cursor: pointer;" title="Delete this row">
                                🗑️
                              </button>
                            </td>
                          </tr>
                        `;
    }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

          </div>

          <!-- Modal Footer -->
          <div style="background: #0f172a; padding: 12px 20px; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div id="lbl-modal-footer-summary" style="font-size: 12.5px; color: #cbd5e1;">
              Ready to Allocate: <strong style="color: #38bdf8;">${parsedToolList.length} Items</strong> for 
              <strong style="color: #fff;">${detectedMechanic.name || 'Mechanic'}</strong> (${detectedMechanic.idNumber || '-'})
              ${detectedRequisitionNo ? ` • Req: <strong style="color: #fde047; font-family: monospace;">#${detectedRequisitionNo}</strong>` : ''}
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <button id="btn-cancel-ocr-clean" style="background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 7px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer;">
                Cancel
              </button>
              <button id="btn-apply-clean-autofill" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: 1px solid #34d399; padding: 7px 24px; border-radius: 6px; font-size: 13.5px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(16,185,129,0.4);">
                <span>🚀</span> Apply &amp; Fill Allocation Table
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    bindCleanEvents();
  }

  function bindCleanEvents() {
    const close = () => { modalLayer.innerHTML = ''; };
    const btnClose = document.getElementById('btn-close-ocr-clean-modal');
    const btnCancel = document.getElementById('btn-cancel-ocr-clean');
    if (btnClose) btnClose.onclick = close;
    if (btnCancel) btnCancel.onclick = close;

    // Method Tabs
    const btnTabText = document.getElementById('btn-tab-text-paste');
    const btnTabImg = document.getElementById('btn-tab-image-paste');
    const btnTabTpl = document.getElementById('btn-tab-templates');
    if (btnTabText) {
      btnTabText.onclick = () => {
        currentInputMode = 'text';
        renderModalUI();
      };
    }
    if (btnTabImg) {
      btnTabImg.onclick = () => {
        currentInputMode = 'image';
        renderModalUI();
      };
    }
    if (btnTabTpl) {
      btnTabTpl.onclick = () => {
        currentInputMode = 'templates';
        renderModalUI();
      };
    }

    // Mechanic search filter — re-render dropdown with matched results
    const inpSearch = document.getElementById('inp-search-modal-emp');
    if (inpSearch) {
      inpSearch.oninput = () => {
        mechanicFilterText = inpSearch.value;
        renderModalUI();
        // After re-render, restore focus to the search input
        const newInp = document.getElementById('inp-search-modal-emp');
        if (newInp) {
          newInp.focus();
          // Move cursor to end
          const len = newInp.value.length;
          newInp.setSelectionRange(len, len);
        }
      };
    }

    // Textarea input
    const textarea = document.getElementById('unified-raw-input');
    if (textarea) {
      textarea.oninput = () => {
        executeParse(textarea.value);
        renderModalUI();
      };
      textarea.onpaste = () => {
        setTimeout(() => {
          executeParse(textarea.value);
          renderModalUI();
        }, 50);
      };
    }

    // Dropzone & File Input for Image OCR
    const dropzone = document.getElementById('ocr-image-dropzone');
    const fileInput = document.getElementById('inp-modal-ocr-file');
    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      fileInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImageProcessing(file);
      };
    }

    // Manpower Mechanic Selection Dropdown
    const selEmp = document.getElementById('sel-modal-manpower-emp');
    if (selEmp) {
      selEmp.onchange = () => {
        const chosen = allEmps.find(e => e.id === selEmp.value);
        if (chosen) {
          detectedMechanic.empId = chosen.id;
          detectedMechanic.name = chosen.name;
          detectedMechanic.cardNumber = chosen.cardNumber;
          detectedMechanic.idNumber = chosen.cardNumber.replace(/^AMG-?0*/i, '') || chosen.cardNumber;
          detectedMechanic.jobTitle = chosen.designation || 'Senior Mechanic';
          detectedMechanic.workingArea = chosen.workingArea || chosen.department || 'Sewing - Jamuna';

          // Update label elements
          const c = document.getElementById('lbl-modal-card');
          const t = document.getElementById('lbl-modal-title');
          const a = document.getElementById('lbl-modal-area');
          if (c) c.textContent = detectedMechanic.idNumber;
          if (t) t.textContent = detectedMechanic.jobTitle;
          if (a) a.textContent = detectedMechanic.workingArea;

          // Update remarks on parsed items
          const reqTag = detectedRequisitionNo ? `ERP Req #${detectedRequisitionNo}` : 'ERP PDF';
          parsedToolList.forEach(pi => {
            pi.remarks = `${reqTag}: ${detectedMechanic.name} (${detectedMechanic.idNumber})`;
          });

          const foot = document.getElementById('lbl-modal-footer-summary');
          if (foot) {
            foot.innerHTML = `Ready to Allocate: <strong style="color: #38bdf8;">${parsedToolList.length} Items</strong> for <strong style="color: #fff;">${detectedMechanic.name}</strong> (${detectedMechanic.idNumber})${detectedRequisitionNo ? ` • Req: <strong style="color: #fde047; font-family: monospace;">#${detectedRequisitionNo}</strong>` : ''}`;
          }
        }
      };
    }

    // Requisition No manual edit input
    const inpReqNo = document.getElementById('inp-modal-requisition-no');
    if (inpReqNo) {
      inpReqNo.oninput = () => {
        detectedRequisitionNo = inpReqNo.value.trim().toUpperCase();
        const lblPreviewReq = document.getElementById('lbl-modal-preview-req');
        if (lblPreviewReq) lblPreviewReq.textContent = detectedRequisitionNo || 'None';
        const reqTag = detectedRequisitionNo ? `ERP Req #${detectedRequisitionNo}` : 'ERP PDF';
        parsedToolList.forEach(pi => {
          pi.remarks = `${reqTag}: ${detectedMechanic.name || 'Mechanic'} (${detectedMechanic.idNumber || '-'})`;
        });

        // Update footer summary
        const foot = document.getElementById('lbl-modal-footer-summary');
        if (foot) {
          foot.innerHTML = `Ready to Allocate: <strong style="color: #38bdf8;">${parsedToolList.length} Items</strong> for <strong style="color: #fff;">${detectedMechanic.name || 'Mechanic'}</strong> (${detectedMechanic.idNumber || '-'})${detectedRequisitionNo ? ` • Req: <strong style="color: #fde047; font-family: monospace;">#${detectedRequisitionNo}</strong>` : ''}`;
        }

        // Update status badge
        const badge = document.getElementById('badge-modal-req-status');
        if (badge) {
          if (detectedRequisitionNo) {
            badge.style.color = '#86efac';
            badge.style.background = 'rgba(34,197,94,0.2)';
            badge.style.border = '1px solid #22c55e';
            badge.textContent = '⚡ Set';
          } else {
            badge.style.color = '#64748b';
            badge.style.background = 'transparent';
            badge.style.border = 'none';
            badge.textContent = '⚡ Auto-Detects from PDF';
          }
        }
      };
    }

    const btnClear = document.getElementById('btn-clear-paste-input');
    if (btnClear) {
      btnClear.onclick = () => {
        rawPastedText = '';
        parsedToolList = [];
        detectedRequisitionNo = '';
        statusNotice = 'Input cleared.';
        renderModalUI();
      };
    }

    const btnClearTable = document.getElementById('btn-clear-extracted-table');
    if (btnClearTable) {
      btnClearTable.onclick = () => {
        parsedToolList = [];
        statusNotice = 'Table cleared.';
        renderModalUI();
      };
    }

    const btnTrigger = document.getElementById('btn-manual-parse-trigger');
    if (btnTrigger && textarea) {
      btnTrigger.onclick = () => {
        executeParse(textarea.value);
        renderModalUI();
      };
    }

    // Manual Add Item button
    const btnAddManual = document.getElementById('btn-manual-add-row');
    if (btnAddManual) {
      btnAddManual.onclick = () => {
        const reqTag = detectedRequisitionNo ? `ERP Req #${detectedRequisitionNo}` : 'ERP PDF';
        parsedToolList.push({
          id: 'manual-item-' + Date.now(),
          rawName: 'Manual Entry Item',
          matchedItem: null,
          confidence: 1,
          quantity: 1,
          changeStatus: 'NEW_ISSUE',
          remarks: `${reqTag}: ${detectedMechanic.name || 'Mechanic'}`
        });
        renderModalUI();
      };
    }

    // Quick Template Cards (Method 3)
    const loadDipok = () => {
      currentInputMode = 'text';
      executeParse(DIPOK_FACTORY_DEMO_TEXT);
      statusNotice = '✅ Loaded 4 Items from Garments Factory ERP Requisition (IR2507318801) for Dipok (0143446)!';
      renderModalUI();
    };

    const loadNajmul = () => {
      currentInputMode = 'text';
      executeParse(NAJMUL_FACTORY_DEMO_TEXT);
      statusNotice = '✅ Loaded 10 Items from Garments Factory ERP Requisition (IR2507142472) for Najmul (142472)!';
      renderModalUI();
    };

    const loadMadhob = () => {
      currentInputMode = 'text';
      executeParse(REAL_FACTORY_DEMO_TEXT);
      statusNotice = '✅ Loaded 17 Items from Garments Factory ERP Requisition (IR260227649) for Madhob (147291)!';
      renderModalUI();
    };

    const loadShojib = () => {
      currentInputMode = 'text';
      executeParse(SHOJIB_FACTORY_DEMO_TEXT);
      statusNotice = '✅ Loaded 3 Items with [Change] status (IR2507132694) for Shojib (132694)!';
      renderModalUI();
    };

    const cardDipok = document.getElementById('card-tpl-dipok');
    if (cardDipok) cardDipok.onclick = loadDipok;

    const cardNajmul = document.getElementById('card-tpl-najmul');
    if (cardNajmul) cardNajmul.onclick = loadNajmul;

    const cardMadhob = document.getElementById('card-tpl-madhob');
    if (cardMadhob) cardMadhob.onclick = loadMadhob;

    const cardShojib = document.getElementById('card-tpl-shojib');
    if (cardShojib) cardShojib.onclick = loadShojib;

    // Row updates: Dropdown
    document.querySelectorAll('.sel-clean-matched-item').forEach(sel => {
      sel.onchange = () => {
        const id = sel.dataset.id;
        const item = parsedToolList.find(p => p.id === id);
        if (item) {
          const catItem = catalogAll.find(c => c.id === sel.value);
          item.matchedItem = catItem || null;
          sel.style.borderColor = item.matchedItem ? '#22c55e' : '#f59e0b';
        }
      };
    });

    // Row updates: Qty inputs
    document.querySelectorAll('.inp-clean-qty').forEach(inp => {
      inp.oninput = () => {
        const id = inp.dataset.id;
        const item = parsedToolList.find(p => p.id === id);
        if (item) item.quantity = parseInt(inp.value, 10) || 1;
      };
    });

    // Row updates: Qty stepper minus
    document.querySelectorAll('.btn-clean-qty-minus').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const item = parsedToolList.find(p => p.id === id);
        if (item && item.quantity > 1) {
          item.quantity--;
          const inp = document.querySelector(`.inp-clean-qty[data-id="${id}"]`);
          if (inp) inp.value = item.quantity;
        }
      };
    });

    // Row updates: Qty stepper plus
    document.querySelectorAll('.btn-clean-qty-plus').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const item = parsedToolList.find(p => p.id === id);
        if (item) {
          item.quantity = (item.quantity || 1) + 1;
          const inp = document.querySelector(`.inp-clean-qty[data-id="${id}"]`);
          if (inp) inp.value = item.quantity;
        }
      };
    });

    // Row updates: Status
    document.querySelectorAll('.sel-clean-status').forEach(sel => {
      sel.onchange = () => {
        const id = sel.dataset.id;
        const item = parsedToolList.find(p => p.id === id);
        if (item) {
          item.changeStatus = sel.value;
          const isRep = item.changeStatus === 'REPLACED';
          const isLost = item.changeStatus === 'LOST' || item.changeStatus === 'RETURNED';
          sel.style.background = isRep ? '#7f1d1d' : isLost ? '#7c2d12' : '#064e3b';
          sel.style.color = isRep ? '#fca5a5' : isLost ? '#fed7aa' : '#6ee7b7';
          sel.style.borderColor = isRep ? '#ef4444' : isLost ? '#ea580c' : '#10b981';
        }
      };
    });

    // Row Action: Delete
    document.querySelectorAll('.btn-clean-del-row').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        parsedToolList = parsedToolList.filter(p => p.id !== id);
        renderModalUI();
      };
    });

    // APPLY & AUTO-FILL BUTTON
    const btnApply = document.getElementById('btn-apply-clean-autofill');
    if (btnApply) {
      btnApply.onclick = () => {
        if (parsedToolList.length === 0) {
          alert('No tools detected. Please copy and paste table rows from your ERP PDF.');
          return;
        }

        // 1. Sync User info into active form
        const uId = detectedMechanic.idNumber || activeUserForm.userId;
        const uName = detectedMechanic.name || activeUserForm.userName;
        const jTitle = detectedMechanic.jobTitle || activeUserForm.jobTitle;
        const wArea = detectedMechanic.workingArea || activeUserForm.workingArea;
        const curIssueDate = toolService.formatDateDMY(activeUserForm.issueDate || '25-10-2025');
        const reqNoToSave = detectedRequisitionNo || activeUserForm.requisitionNo || '';

        activeUserForm.userId = uId;
        activeUserForm.userName = uName;
        activeUserForm.jobTitle = jTitle;
        activeUserForm.workingArea = wArea;
        activeUserForm.requisitionNo = reqNoToSave;

        // 2. Update Screen 2 DOM inputs
        const domId = document.getElementById('input-add-user-id');
        const domName = document.getElementById('input-add-user-name');
        const domTitle = document.getElementById('input-add-job-title');
        const domArea = document.getElementById('input-add-working-area');
        const domReqNo = document.getElementById('input-add-requisition-no');

        if (domId) domId.value = uId;
        if (domName) domName.value = uName;
        if (domTitle) domTitle.value = jTitle;
        if (domArea) domArea.value = wArea;
        if (domReqNo) domReqNo.value = reqNoToSave;

        // 3. Populate liveAllocationQueue
        parsedToolList.forEach(pi => {
          const it = pi.matchedItem || {
            type: 'TOOL',
            code: 'CUSTOM',
            name: pi.rawName
          };

          liveAllocationQueue.push({
            regNo: currentRegNo,
            requisitionNo: reqNoToSave,
            issueDate: curIssueDate,
            userId: uId,
            userName: uName,
            jobTitle: jTitle,
            workingArea: wArea,
            itemType: it.type || 'TOOL',
            itemCode: it.code || 'CUSTOM',
            itemName: it.name || pi.rawName,
            quantity: String(pi.quantity || '1'),
            changeStatus: pi.changeStatus || 'NEW_ISSUE',
            changeDate: pi.changeStatus !== 'NEW_ISSUE' ? new Date().toISOString().split('T')[0] : null,
            remarks: pi.remarks || (reqNoToSave ? `ERP Req #${reqNoToSave}: ${uName} - ${uId}` : `Auto-imported from ERP PDF: ${uName} - ${uId}`)
          });
        });

        const count = parsedToolList.length;
        close();

        // 4. Refresh Screen 2 Live Table
        const container = document.getElementById('tools-tab-content-container');
        if (container) {
          container.innerHTML = renderActiveTab('tools-add');
          initToolsManagementEvents();
        }

        window.app?.showToast(
          '✨ Auto-Fill Successful!',
          `Successfully loaded ${count} items for ${uName} (${uId})${reqNoToSave ? ` [Req: #${reqNoToSave}]` : ''} into Live Allocation Table.`,
          'success'
        );
      };
    }
  }

  function handleImageProcessing(imageSource) {
    statusNotice = '🔍 Scanning screenshot with High-Res AI OCR...';
    renderModalUI();
    runOcrOnImage(imageSource, (prog) => {
      if (prog && prog.status) {
        statusNotice = `Processing AI OCR (${Math.round((prog.progress || 0) * 100)}%)...`;
        const n = document.querySelector('#ocr-image-dropzone div:last-child');
        if (n) n.textContent = statusNotice;
      }
    }).then(txt => {
      executeParse(txt);
      statusNotice = `✅ AI OCR Complete! Extracted ${parsedToolList.length} items.`;
      renderModalUI();
    }).catch(err => {
      console.warn('OCR error:', err);
      statusNotice = '⚠️ Image OCR failed. Please copy text from PDF and paste directly.';
      renderModalUI();
    });
  }

  // Initial render
  renderModalUI();

  // If initial image blob was supplied (from global paste)
  if (initialBlob) {
    handleImageProcessing(initialBlob);
  }
}

