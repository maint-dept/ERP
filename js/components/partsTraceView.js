/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Parts Trace & Spare Parts Issue Intelligence View Component
 * Smart Traceability: ERP No -> Spare Part -> Machine -> Technician -> Date & Location
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { INITIAL_DATA } from '../db/initialData.js';
import { authService } from '../services/authService.js';
import { masterDataService } from '../services/masterDataService.js';
import { employeeService } from '../services/employeeService.js';
import { notificationService } from '../services/notificationService.js';
import { partsTraceService } from '../services/partsTraceService.js';
import { state } from '../state.js';

let activeTab = 'dashboard'; // 'dashboard' | 'upload' | 'review' | 'parts-master' | 'history' | 'reports'
let activeDraftRows = [];
let uploadedPdfMetadata = null;
let reviewFilter = 'ALL'; // 'ALL' | 'AUTO_MATCHED' | 'REVIEW_REQUIRED' | 'ERROR'
let reviewSearch = '';
let historySearch = '';
let historyFilters = { dateFrom: '', dateTo: '', floorId: '', partCode: '' };
let masterSearch = '';
let masterCategory = 'ALL';
let masterCurrentPage = 1;
const MASTER_PAGE_SIZE = 50;
let masterSelectedPartIds = new Set();

// Modal states
let manualIssueModalOpen = false;
let addPartModalOpen = false;
let editingPartData = null;
let importExcelModalOpen = false;
let selectedTraceIssue = null;
let selectedMachineDraftId = null;
let selectedTechDraftId = null;
let selectedPartDraftId = null;
let activeReportType = 'issue-summary';

export function renderPartsTraceView() {
  const stats = partsTraceService.getDashboardStats();
  const canUpload = authService.isSuperAdmin() || authService.isAdmin() || authService.hasAccess('parts_trace', 'UPLOAD_PDF');
  const canManageMaster = authService.isSuperAdmin() || authService.isAdmin() || authService.hasAccess('parts_trace', 'MANAGE_MASTER');

  return `
    <div class="page-view parts-trace-view-root" id="parts-trace-root">
      
      <!-- Top Navigation Header Bar -->
      <div class="parts-trace-nav-card">
        <div class="parts-trace-title-area">
          <div class="parts-trace-icon">🔩</div>
          <div>
            <h1 class="parts-trace-main-title">Parts Trace &amp; ERP Spare Parts System</h1>
            <div class="parts-trace-sub-title">Daily Issue Extraction &bull; Intelligent Auto-Matching &bull; Full Traceability</div>
          </div>
        </div>

        <!-- Tab Pills -->
        <div class="parts-trace-tabs-bar">
          <button type="button" class="btn-trace-tab ${activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
            📊 Dashboard
          </button>
          <button type="button" class="btn-trace-tab ${activeTab === 'upload' ? 'active' : ''}" data-tab="upload">
            📄 Upload ERP PDF
          </button>
          <button type="button" class="btn-trace-tab ${activeTab === 'review' ? 'active' : ''}" data-tab="review">
            🔍 Review Drafts ${activeDraftRows.length > 0 ? `<span class="badge badge-idle" style="background:#0284c7;color:#fff;font-size:10px;margin-left:4px;">${activeDraftRows.length}</span>` : ''}
          </button>
          <button type="button" class="btn-trace-tab ${activeTab === 'parts-master' ? 'active' : ''}" data-tab="parts-master">
            🗄️ Parts Master
          </button>
          <button type="button" class="btn-trace-tab ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
            📜 Traceability History
          </button>
          <button type="button" class="btn-trace-tab ${activeTab === 'reports' ? 'active' : ''}" data-tab="reports">
            📈 Reports
          </button>
        </div>

        <!-- Right Quick Action -->
        <div style="margin-left: auto; display: flex; gap: 6px; align-items: center;">
          <button type="button" id="btn-trace-add-manual" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11.5px; height: 28px; padding: 4px 10px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1px solid #38bdf8;">
            ➕ Add Manual Issue
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div id="parts-trace-content-area" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        ${renderActiveTab(stats, canUpload, canManageMaster)}
      </div>

      <!-- Modals Container -->
      <div id="parts-trace-modal-container">
        ${renderManualIssueModal()}
        ${renderAddPartModal()}
        ${renderImportExcelModal()}
        ${renderTraceabilityDetailsModal()}
        ${renderSmartMachineModal()}
        ${renderSmartTechnicianModal()}
        ${renderSmartPartModal()}
      </div>

    </div>

    <!-- Scoped High-Density CSS -->
    <style>
      .parts-trace-view-root {
        padding: 8px 12px 24px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        font-family: var(--font-main);
      }

      .parts-trace-nav-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 6px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-height: 40px;
      }

      .parts-trace-title-area {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .parts-trace-icon {
        font-size: 16px;
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid #38bdf8;
        border-radius: 6px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .parts-trace-main-title {
        font-size: 14px;
        font-weight: 800;
        color: #fff;
        margin: 0;
        line-height: 1.1;
      }

      .parts-trace-sub-title {
        font-size: 10.5px;
        color: #38bdf8;
        margin-top: 1px;
      }

      .parts-trace-tabs-bar {
        display: flex;
        gap: 4px;
        align-items: center;
        overflow-x: auto;
      }

      .btn-trace-tab {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 14px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        transition: all 0.2s ease;
      }

      .btn-trace-tab:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .btn-trace-tab.active {
        background: #0284c7;
        border-color: #38bdf8;
        color: #fff;
        box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4);
      }

      /* KPI Cards Grid */
      .parts-trace-kpi-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
      }

      .parts-trace-kpi-box {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 8px 10px;
        text-align: center;
        border-left: 3px solid #38bdf8;
      }

      .parts-trace-kpi-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .parts-trace-kpi-val {
        font-size: 18px;
        font-weight: 900;
        color: #fff;
        margin-top: 2px;
        font-family: var(--font-mono);
      }

      /* High-Density Crisp Table Styling */
      .parts-trace-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }

      .parts-trace-table th {
        background: #080e1a;
        color: #38bdf8;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 8px 10px;
        border-bottom: 2px solid rgba(56, 189, 248, 0.3);
        text-align: left;
        white-space: nowrap;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .parts-trace-table td {
        padding: 8px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
        vertical-align: middle;
      }

      .parts-trace-table tr:hover td {
        background: rgba(56, 189, 248, 0.06);
      }

      /* Smart Dropdown & Combobox Controls */
      .smart-dropdown-trigger {
        background: #090e1a;
        border: 1.5px solid rgba(56, 189, 248, 0.25);
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        width: 100%;
        text-align: left;
        transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        color: #ffffff;
      }

      .smart-dropdown-trigger:hover {
        border-color: #38bdf8;
        background: rgba(56, 189, 248, 0.12);
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);
      }

      .smart-dropdown-trigger.has-val {
        border-color: rgba(56, 189, 248, 0.45);
        background: #0d1527;
      }

      .smart-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        border-radius: 12px;
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.35);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .smart-chip:hover {
        background: #0284c7;
        color: #fff;
        border-color: #38bdf8;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
      }

      .smart-item-row {
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .smart-item-row:hover {
        background: rgba(56, 189, 248, 0.18);
        border-color: #38bdf8;
        transform: translateX(2px);
        box-shadow: 0 2px 10px rgba(56, 189, 248, 0.2);
      }

      .smart-dropdown-popover {
        position: fixed;
        background: #080d18;
        border: 1.5px solid #38bdf8;
        border-radius: 10px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.95), 0 0 25px rgba(56, 189, 248, 0.25);
        z-index: 10080;
        overflow: hidden;
        animation: dropFadeIn 0.15s ease-out;
      }

      @keyframes dropFadeIn {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @media (max-width: 768px) {
        .parts-trace-kpi-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }
    </style>
  `;
}

function renderActiveTab(stats, canUpload, canManageMaster) {
  if (activeTab === 'upload') {
    return renderUploadTab();
  } else if (activeTab === 'review') {
    return renderReviewTab();
  } else if (activeTab === 'parts-master') {
    return renderPartsMasterTab();
  } else if (activeTab === 'history') {
    return renderHistoryTab();
  } else if (activeTab === 'reports') {
    return renderReportsTab();
  } else {
    return renderDashboardTab(stats);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. DASHBOARD TAB
// ─────────────────────────────────────────────────────────────
function renderDashboardTab(stats) {
  const recentIssues = partsTraceService.getAllIssues().slice(0, 15);

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
      
      <!-- Summary KPI Cards -->
      <div class="parts-trace-kpi-grid">
        <div class="parts-trace-kpi-box" style="border-left-color: #38bdf8;">
          <div class="parts-trace-kpi-label">Today's Issues</div>
          <div class="parts-trace-kpi-val" style="color: #38bdf8;">${stats.todayCount}</div>
        </div>
        <div class="parts-trace-kpi-box" style="border-left-color: #34d399;">
          <div class="parts-trace-kpi-label">Total Parts Issued</div>
          <div class="parts-trace-kpi-val" style="color: #34d399;">${stats.totalPartsIssued}</div>
        </div>
        <div class="parts-trace-kpi-box" style="border-left-color: #fbbf24;">
          <div class="parts-trace-kpi-label">Machines Affected</div>
          <div class="parts-trace-kpi-val" style="color: #fbbf24;">${stats.distinctMachinesCount}</div>
        </div>
        <div class="parts-trace-kpi-box" style="border-left-color: #a78bfa;">
          <div class="parts-trace-kpi-label">Total Transactions</div>
          <div class="parts-trace-kpi-val" style="color: #a78bfa;">${stats.totalCount}</div>
        </div>
        <div class="parts-trace-kpi-box" style="border-left-color: #34d399;">
          <div class="parts-trace-kpi-label">Auto Matched</div>
          <div class="parts-trace-kpi-val" style="color: #34d399;">${stats.autoMatchedCount}</div>
        </div>
        <div class="parts-trace-kpi-box" style="border-left-color: #f87171;">
          <div class="parts-trace-kpi-label">Review Required</div>
          <div class="parts-trace-kpi-val" style="color: #f87171;">${stats.reviewRequiredCount}</div>
        </div>
      </div>

      <!-- Action Shortcuts Toolbar -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-sm btn-nav-to-tab" data-target="upload" style="font-weight: 800; font-size: 11.5px; height: 28px; padding: 4px 12px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1px solid #38bdf8;">
            📄 Upload ERP PDF
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-nav-to-tab" data-target="parts-master" style="font-weight: 700; font-size: 11.5px; height: 28px; padding: 4px 10px; border: 1px solid rgba(255,255,255,0.2);">
            🗄️ Manage Parts Master (5k+)
          </button>
          <button type="button" id="btn-quick-sample-load" class="btn btn-ghost btn-sm" style="font-weight: 800; font-size: 11px; height: 28px; padding: 4px 10px; color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); background: rgba(52, 211, 153, 0.08);" title="Load reference report (8 items)">
            ⚡ Load Sample ERP Report
          </button>
        </div>

        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" id="btn-export-issues-excel" class="btn btn-outline btn-sm" style="color: #34d399; border-color: rgba(52, 211, 153, 0.4); font-size: 11px; height: 28px; padding: 2px 8px; font-weight: 700;">
            📊 Export Excel
          </button>
        </div>
      </div>

      <!-- Recent Issues Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
        <div style="padding: 6px 10px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 800; color: #fff;">
            Recent Spare Parts Issues (${recentIssues.length})
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">
            ERP &bull; Part &bull; Machine &bull; Technician
          </span>
        </div>

        <div style="flex: 1; overflow: auto;">
          <table class="parts-trace-table">
            <thead>
              <tr>
                <th>ERP No</th>
                <th>Issue Date</th>
                <th>Part Name &amp; Code</th>
                <th>Qty</th>
                <th>Machine</th>
                <th>Technician</th>
                <th>Floor &amp; Line</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${recentIssues.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                    <div style="font-size: 28px; margin-bottom: 6px;">📦</div>
                    <div style="font-weight: 700; color: #fff;">No Spare Parts Issues Recorded Yet</div>
                    <div style="font-size: 11.5px; margin-top: 4px;">Click <strong>Upload ERP PDF</strong> or <strong>Load Sample ERP Report</strong> to start.</div>
                  </td>
                </tr>
              ` : recentIssues.map(iss => `
                <tr>
                  <td>
                    <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">${iss.erpNo}</span>
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 11px;">${iss.issueDate}</td>
                  <td>
                    <div style="font-weight: 700; color: #fff;">${iss.partName}</div>
                    <div style="font-size: 10px; color: #94a3b8; font-family: var(--font-mono);">${iss.partCode || '—'}</div>
                  </td>
                  <td>
                    <span style="font-weight: 800; color: #34d399;">${iss.issueQty} ${iss.uom}</span>
                  </td>
                  <td>
                    ${iss.machineSerial ? `
                      <span style="font-family: var(--font-mono); font-weight: 800; color: #fbbf24; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.25); padding: 1px 5px; border-radius: 4px;">
                        ${iss.machineSerial}
                      </span>
                      <div style="font-size: 9.5px; color: var(--text-muted);">${iss.machineName || ''}</div>
                    ` : '<span style="color: #64748b;">—</span>'}
                  </td>
                  <td>
                    ${iss.technicianName ? `
                      <div style="font-weight: 600; color: #cbd5e1;">${iss.technicianName}</div>
                    ` : '<span style="color: #64748b;">—</span>'}
                  </td>
                  <td>
                    <span style="color: #e2e8f0;">${iss.floorName}</span>
                    <span style="color: var(--text-muted); font-size: 10.5px;">/ ${iss.lineName}</span>
                  </td>
                  <td>
                    <span class="badge badge-active" style="font-size: 9.5px; padding: 2px 6px;">${iss.status}</span>
                  </td>
                  <td style="text-align: right;">
                    <button type="button" class="btn btn-ghost btn-sm btn-view-trace-details" data-id="${iss.id}" style="font-size: 11px; padding: 2px 6px; color: #38bdf8;" title="View Complete Traceability">
                      🔍 Trace
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm btn-delete-issue" data-id="${iss.id}" style="font-size: 11px; padding: 2px 6px; color: #f87171;" title="Delete Issue">
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

// ─────────────────────────────────────────────────────────────
// 2. UPLOAD ERP PDF TAB
// ─────────────────────────────────────────────────────────────
function renderUploadTab() {
  return `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; max-width: 720px; margin: 0 auto; width: 100%; box-sizing: border-box;">
      
      <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>📄</span> Upload Daily Main ERP Spare Parts Issue PDF
          </h2>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
            Auto-extracts Cost Center, Store, Issue Date, ERP numbers, parts, and machine data.
          </div>
        </div>
        <button type="button" id="btn-upload-load-sample" class="btn btn-secondary btn-sm" style="font-size: 11px; font-weight: 700; color: #34d399; border-color: rgba(52,211,153,0.3);">
          ⚡ Load Sample (8 Items)
        </button>
      </div>

      <!-- Drag & Drop Zone -->
      <div id="dropzone-pdf-upload" style="border: 2px dashed rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.04); border-radius: 10px; padding: 28px 20px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
        <input type="file" id="inp-trace-pdf-file" accept=".pdf,.png,.jpg,.jpeg,.webp" style="display: none;" />
        <div style="font-size: 38px; margin-bottom: 6px;">📑</div>
        <div style="font-size: 14px; font-weight: 800; color: #fff;">
          Drag &amp; Drop Main ERP PDF or Click to Browse
        </div>
        <div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">
          Supports Multi-Page PDFs, Scanned PDF reports, Screenshots (JPG, PNG) &bull; Max 25MB
        </div>
        <button type="button" id="btn-browse-pdf" class="btn btn-primary btn-sm" style="margin-top: 12px; font-weight: 800; font-size: 12px; padding: 6px 16px; background: #0284c7; border: 1px solid #38bdf8;">
          📂 Select PDF File
        </button>
      </div>

      <!-- File Details Card (Shown after selection) -->
      <div id="selected-pdf-meta-box" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">📑</span>
            <div>
              <div id="pdf-file-name" style="font-weight: 800; color: #fff; font-size: 13px;">file.pdf</div>
              <div id="pdf-file-size" style="font-size: 11px; color: var(--text-muted);">142 KB &bull; PDF Document</div>
            </div>
          </div>
          <button type="button" id="btn-process-selected-pdf" class="btn btn-primary" style="font-weight: 800; font-size: 13px; padding: 8px 18px; background: #059669; border-color: #34d399; box-shadow: 0 2px 8px rgba(5,150,105,0.4);">
            🚀 Process &amp; Extract Data
          </button>
        </div>
      </div>

      <!-- Progress Indicator -->
      <div id="pdf-processing-progress-box" style="display: none; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
          <span id="pdf-progress-status" style="color: #38bdf8; font-weight: 700;">Processing PDF structures...</span>
          <span id="pdf-progress-pct" style="color: #fff; font-weight: 800;">50%</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
          <div id="pdf-progress-bar-fill" style="height: 100%; width: 50%; background: linear-gradient(90deg, #38bdf8, #34d399); transition: width 0.2s ease;"></div>
        </div>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 3. DRAFT REVIEW & AUTO-MATCH TABLE TAB
// ─────────────────────────────────────────────────────────────
function renderReviewTab() {
  if (activeDraftRows.length === 0) {
    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 30px; text-align: center; color: var(--text-muted); max-width: 600px; margin: 20px auto;">
        <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
        <div style="font-size: 15px; font-weight: 800; color: #fff;">No Active Extracted Drafts</div>
        <div style="font-size: 12px; margin-top: 4px; color: #94a3b8;">
          Please upload an ERP Issue PDF or click <strong>Load Sample Report</strong> to populate drafts for review.
        </div>
        <button type="button" class="btn btn-primary btn-sm btn-nav-to-tab" data-target="upload" style="margin-top: 14px; font-weight: 800; font-size: 12px; padding: 6px 16px;">
          📄 Go to PDF Upload
        </button>
      </div>
    `;
  }

  const autoCount = activeDraftRows.filter(r => r.status === 'AUTO_MATCHED').length;
  const reviewCount = activeDraftRows.filter(r => r.status === 'REVIEW_REQUIRED').length;
  const errCount = activeDraftRows.filter(r => r.status === 'ERROR').length;

  let filtered = activeDraftRows;
  if (reviewFilter === 'AUTO_MATCHED') filtered = filtered.filter(r => r.status === 'AUTO_MATCHED');
  if (reviewFilter === 'REVIEW_REQUIRED') filtered = filtered.filter(r => r.status === 'REVIEW_REQUIRED');
  if (reviewFilter === 'ERROR') filtered = filtered.filter(r => r.status === 'ERROR');

  if (reviewSearch && reviewSearch.trim()) {
    const q = reviewSearch.trim().toLowerCase();
    filtered = filtered.filter(r =>
      (r.erpNo && r.erpNo.toLowerCase().includes(q)) ||
      (r.rawItemName && r.rawItemName.toLowerCase().includes(q)) ||
      (r.partName && r.partName.toLowerCase().includes(q)) ||
      (r.partCode && r.partCode.toLowerCase().includes(q)) ||
      (r.comments && r.comments.toLowerCase().includes(q)) ||
      (r.machineSerial && r.machineSerial.toLowerCase().includes(q)) ||
      (r.technicianName && r.technicianName.toLowerCase().includes(q))
    );
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
      
      <!-- Review Summary & Actions Strip -->
      <div style="background: var(--bg-card); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 12.5px; font-weight: 800; color: #fff;">
            ERP Transaction Review
          </span>
          <span style="background: #0284c7; color: #fff; font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 10px; font-family: var(--font-mono);">
            ${activeDraftRows.length} Total
          </span>
          <span style="color: rgba(255,255,255,0.15);">|</span>
          <span style="font-size: 11px; color: #34d399; font-weight: 700;">🟢 ${autoCount} Auto Matched</span>
          <span style="font-size: 11px; color: #fbbf24; font-weight: 700;">🟡 ${reviewCount} Review Req</span>
          <span style="font-size: 11px; color: #f87171; font-weight: 700;">🔴 ${errCount} Errors</span>
        </div>

        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" id="btn-rematch-all-drafts" class="btn btn-ghost btn-sm" style="color: #38bdf8; font-size: 11px; padding: 4px 8px; height: 28px; border: 1px solid rgba(56,189,248,0.4);" title="Re-match against latest parts catalog">
            ⚡ Re-Match Parts
          </button>
          <button type="button" id="btn-clear-all-drafts" class="btn btn-ghost btn-sm" style="color: #f87171; font-size: 11px; padding: 4px 8px; height: 28px; border: 1px solid rgba(239,68,68,0.3);">
            ✕ Clear Drafts
          </button>
          <button type="button" id="btn-confirm-save-all-drafts" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; padding: 4px 14px; height: 28px; background: #059669; border-color: #34d399; box-shadow: 0 2px 8px rgba(5,150,105,0.4);">
            ✓ Confirm &amp; Save All (${activeDraftRows.length})
          </button>
        </div>
      </div>

      <!-- Search & Filter Toolbar -->
      <div style="padding: 6px 10px; background: rgba(15, 23, 42, 0.95); border: 1px solid var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        
        <div style="flex: 1; min-width: 180px; position: relative;">
          <input 
            type="text" 
            id="inp-draft-filter-query" 
            class="form-control" 
            placeholder="🔍 Search draft items by part, ERP#, serial, technician, comments..." 
            value="${reviewSearch}"
            style="padding: 4px 28px 4px 10px; font-size: 11.5px; height: 28px; min-height: 28px; border-radius: 6px; background: #090d16; border-color: rgba(56,189,248,0.3); color: #fff;"
          />
        </div>

        <div style="display: flex; gap: 4px;">
          <button type="button" class="btn-draft-filter ${reviewFilter === 'ALL' ? 'active' : ''}" data-filter="ALL" style="padding: 2px 8px; font-size: 10.5px; font-weight: 700; border-radius: 12px; border: 1px solid ${reviewFilter === 'ALL' ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; background: ${reviewFilter === 'ALL' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${reviewFilter === 'ALL' ? '#38bdf8' : '#cbd5e1'}; cursor: pointer;">
            All (${activeDraftRows.length})
          </button>
          <button type="button" class="btn-draft-filter ${reviewFilter === 'AUTO_MATCHED' ? 'active' : ''}" data-filter="AUTO_MATCHED" style="padding: 2px 8px; font-size: 10.5px; font-weight: 700; border-radius: 12px; border: 1px solid ${reviewFilter === 'AUTO_MATCHED' ? '#34d399' : 'rgba(255,255,255,0.15)'}; background: ${reviewFilter === 'AUTO_MATCHED' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${reviewFilter === 'AUTO_MATCHED' ? '#34d399' : '#cbd5e1'}; cursor: pointer;">
            🟢 Auto Matched (${autoCount})
          </button>
          <button type="button" class="btn-draft-filter ${reviewFilter === 'REVIEW_REQUIRED' ? 'active' : ''}" data-filter="REVIEW_REQUIRED" style="padding: 2px 8px; font-size: 10.5px; font-weight: 700; border-radius: 12px; border: 1px solid ${reviewFilter === 'REVIEW_REQUIRED' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; background: ${reviewFilter === 'REVIEW_REQUIRED' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${reviewFilter === 'REVIEW_REQUIRED' ? '#fbbf24' : '#cbd5e1'}; cursor: pointer;">
            🟡 Review Req (${reviewCount})
          </button>
          <button type="button" class="btn-draft-filter ${reviewFilter === 'ERROR' ? 'active' : ''}" data-filter="ERROR" style="padding: 2px 8px; font-size: 10.5px; font-weight: 700; border-radius: 12px; border: 1px solid ${reviewFilter === 'ERROR' ? '#f87171' : 'rgba(255,255,255,0.15)'}; background: ${reviewFilter === 'ERROR' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${reviewFilter === 'ERROR' ? '#f87171' : '#cbd5e1'}; cursor: pointer;">
            🔴 Errors (${errCount})
          </button>
        </div>

      </div>

      <!-- Review Draft Table Container (Clean columns without Manpower) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; flex: 1; min-height: 0; overflow: auto;">
        <table class="parts-trace-table">
          <thead>
            <tr>
              <th style="width: 32px;">SL</th>
              <th style="width: 110px;">ERP No</th>
              <th style="width: 120px;">Floor &amp; Line</th>
              <th style="min-width: 220px;">Matched Part &amp; Code</th>
              <th style="width: 75px;">Qty</th>
              <th style="min-width: 170px;">Machine</th>
              <th style="min-width: 150px;">Technician</th>
              <th style="width: 90px;">Status</th>
              <th style="width: 40px; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((r, idx) => {
              const statusColor = r.status === 'AUTO_MATCHED' ? '#34d399' : (r.status === 'REVIEW_REQUIRED' ? '#fbbf24' : '#f87171');
              const statusBadge = r.status === 'AUTO_MATCHED' ? '🟢 Matched' : (r.status === 'REVIEW_REQUIRED' ? '🟡 Review' : '🔴 Error');

              return `
                <tr data-draft-id="${r.draftId}" style="transition: background 0.15s ease;">
                  <td style="color: #94a3b8; font-weight: 800; font-family: var(--font-mono); text-align: center;">${r.sl}</td>
                  <td>
                    <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 12px; letter-spacing: 0.3px;">${r.erpNo}</span>
                  </td>
                  <td>
                    <div style="color: #ffffff; font-weight: 700; font-size: 12px;">${r.floorName}</div>
                    <div style="font-size: 10.5px; color: #94a3b8; font-weight: 600; font-family: var(--font-mono);">${r.lineName}</div>
                  </td>
                  <td>
                    <!-- Smart Matched Part Dropdown Trigger -->
                    <button type="button" class="smart-dropdown-trigger btn-open-smart-part-modal ${r.partId ? 'has-val' : ''}" data-draft-id="${r.draftId}" title="Click to search and change spare part">
                      <div style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                        <div style="font-weight: 800; color: #ffffff; font-size: 12px; overflow: hidden; text-overflow: ellipsis;">${r.partName}</div>
                        <div style="display: flex; gap: 5px; align-items: center; margin-top: 2px;">
                          <span style="font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: #38bdf8; background: rgba(56,189,248,0.15); padding: 1px 5px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.35);">
                            ${r.partCode || 'NO CODE'}
                          </span>
                          <span style="font-size: 10px; color: #94a3b8; font-style: italic; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">
                            "${r.rawItemName}"
                          </span>
                        </div>
                      </div>
                      <span style="color: #38bdf8; font-size: 11px; margin-left: 4px; flex-shrink: 0;">▼</span>
                    </button>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <input 
                        type="number" 
                        class="inp-draft-qty" 
                        data-draft-id="${r.draftId}" 
                        value="${r.issueQty}" 
                        min="1" 
                        style="width: 48px; height: 26px; font-size: 12px; padding: 2px 4px; text-align: center; background: #060a14; border: 1.5px solid rgba(52,211,153,0.4); border-radius: 4px; color: #34d399; font-weight: 800; font-family: var(--font-mono);"
                      />
                      <span style="font-size: 11px; color: #e2e8f0; font-weight: 800;">${r.uom}</span>
                    </div>
                  </td>
                  <td>
                    <!-- Smart Machine Dropdown Trigger -->
                    <button type="button" class="smart-dropdown-trigger btn-open-smart-machine-modal ${r.machineSerial ? 'has-val' : ''}" data-draft-id="${r.draftId}" title="Click to search and change machine">
                      <div style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                        ${r.machineSerial ? `
                          <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="font-family: var(--font-mono); font-weight: 900; color: #fbbf24; font-size: 12.5px;">🛠️ ${r.machineSerial}</span>
                            <span class="badge" style="background: rgba(251,191,36,0.2); color: #fbbf24; font-size: 8.5px; font-weight: 800; padding: 1px 5px; border: 1px solid rgba(251,191,36,0.4);">AUTO</span>
                          </div>
                          <div style="font-size: 11px; color: #ffffff; font-weight: 700; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
                            ${r.machineName || 'Plane Machine'}
                          </div>
                          ${r.machineBrand || r.machineModel ? `
                            <div style="font-size: 9.5px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis;">
                              ${r.machineBrand || ''}${r.machineModel ? ' • ' + r.machineModel : ''}
                            </div>
                          ` : ''}
                        ` : `
                          <span style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">🔍 Select Machine</span>
                        `}
                      </div>
                      <span style="color: #38bdf8; font-size: 11px; margin-left: 4px; flex-shrink: 0;">▼</span>
                    </button>
                    ${r.comments ? `<div style="font-size: 9.5px; color: #94a3b8; margin-top: 2px; padding-left: 2px;"><em>"${r.comments}"</em></div>` : ''}
                  </td>
                  <td>
                    <!-- Smart Technician Dropdown Trigger -->
                    <button type="button" class="smart-dropdown-trigger btn-open-smart-tech-modal ${r.technicianName ? 'has-val' : ''}" data-draft-id="${r.draftId}" title="Click to search and change technician">
                      <div style="display: flex; flex-direction: column; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                        ${r.technicianName ? `
                          <div style="display: flex; align-items: center; gap: 5px;">
                            <strong style="color: #38bdf8; font-size: 12px; font-weight: 800;">👷 ${r.technicianName}</strong>
                            <span class="badge" style="background: rgba(56,189,248,0.2); color: #38bdf8; font-size: 8.5px; font-weight: 800; padding: 1px 5px; border: 1px solid rgba(56,189,248,0.4);">AUTO</span>
                          </div>
                          <span style="font-size: 9.5px; color: #94a3b8; font-family: var(--font-mono);">${r.technicianCard && r.technicianCard !== '—' ? `Card: ${r.technicianCard}` : 'Mechanic'}</span>
                        ` : `
                          <span style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">+ Assign Tech</span>
                        `}
                      </div>
                      <span style="color: #38bdf8; font-size: 11px; margin-left: 4px; flex-shrink: 0;">▼</span>
                    </button>
                  </td>
                  <td>
                    <span class="badge" style="font-size: 10px; font-weight: 800; padding: 3px 8px; border: 1.5px solid ${statusColor}; color: ${statusColor}; background: rgba(0,0,0,0.5); border-radius: 4px;">
                      ${statusBadge}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button type="button" class="btn btn-ghost btn-xs btn-delete-draft-row" data-draft-id="${r.draftId}" style="color: #f87171; font-size: 13px; padding: 2px 6px;" title="Remove Row">
                      🗑️
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 4. SPARE PARTS MASTER TAB (PAGINATED & 5K+ SUPPORT)
// ─────────────────────────────────────────────────────────────
function renderPartsMasterTab() {
  const allFiltered = partsTraceService.getAllParts({ search: masterSearch, category: masterCategory });
  const totalCount = allFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / MASTER_PAGE_SIZE));

  if (masterCurrentPage > totalPages) masterCurrentPage = totalPages;
  if (masterCurrentPage < 1) masterCurrentPage = 1;

  const startIndex = (masterCurrentPage - 1) * MASTER_PAGE_SIZE;
  const pageParts = allFiltered.slice(startIndex, startIndex + MASTER_PAGE_SIZE);

  const isPageAllSelected = pageParts.length > 0 && pageParts.every(p => masterSelectedPartIds.has(p.id));
  const hasSelection = masterSelectedPartIds.size > 0;

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
      
      <!-- Toolbar & Actions -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
        
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1;">
          <input 
            type="text" 
            id="inp-master-parts-search" 
            class="form-control" 
            placeholder="🔍 Search 5,000+ parts by code, name, alias, brand, model..." 
            value="${masterSearch}"
            style="max-width: 280px; height: 28px; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; background: #090d16;"
          />
          <select id="sel-master-parts-cat" class="form-control" style="width: 130px; height: 28px; font-size: 11.5px; padding: 2px 6px; border-radius: 6px; background: #090d16;">
            <option value="ALL">All Categories</option>
            <option value="Mechanical" ${masterCategory === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
            <option value="Electrical" ${masterCategory === 'Electrical' ? 'selected' : ''}>Electrical</option>
            <option value="Consumable" ${masterCategory === 'Consumable' ? 'selected' : ''}>Consumable</option>
            <option value="Pneumatic" ${masterCategory === 'Pneumatic' ? 'selected' : ''}>Pneumatic</option>
          </select>
          <span style="font-size: 11px; color: #38bdf8; font-family: var(--font-mono); font-weight: 700;">
            ${totalCount.toLocaleString()} Parts Registered
          </span>

          ${hasSelection ? `
            <div style="display: flex; align-items: center; gap: 5px; margin-left: 4px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); padding: 2px 8px; border-radius: 6px;">
              <span style="font-size: 11px; color: #fca5a5; font-weight: 700;">✓ ${masterSelectedPartIds.size} Selected</span>
              <button type="button" id="btn-bulk-delete-parts" class="btn btn-danger btn-sm" style="font-size: 11px; height: 22px; padding: 0 8px; font-weight: 800; background: #dc2626; border: none; color: #fff; border-radius: 4px; cursor: pointer;">
                🗑️ Delete Selected (${masterSelectedPartIds.size})
              </button>
              <button type="button" id="btn-clear-parts-selection" class="btn btn-ghost btn-xs" style="font-size: 10.5px; height: 22px; padding: 0 6px; color: #cbd5e1; cursor: pointer;">
                ✕ Deselect
              </button>
            </div>
          ` : ''}
        </div>

        <div style="display: flex; gap: 6px; align-items: center;">
          ${totalCount > 0 ? `
            <button type="button" id="btn-select-all-filtered-parts" class="btn btn-ghost btn-sm" style="font-size: 11px; height: 28px; padding: 2px 8px; color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);" title="Select all ${totalCount} filtered parts">
              ☑ Select All (${totalCount})
            </button>
            <button type="button" id="btn-clear-all-parts-master" class="btn btn-outline btn-sm" style="font-size: 11px; height: 28px; padding: 2px 8px; color: #f87171; border-color: rgba(248,113,113,0.4);" title="Delete all registered parts to import a clean catalog">
              🗑️ Clear Catalog
            </button>
          ` : ''}
          <button type="button" id="btn-open-add-part-modal" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11.5px; height: 28px; padding: 4px 10px; background: #0284c7; border: 1px solid #38bdf8;">
            ➕ Add Part
          </button>
          <button type="button" id="btn-open-import-excel-modal" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; height: 28px; padding: 4px 10px; border: 1px solid rgba(56,189,248,0.4); background: rgba(56,189,248,0.1); color: #38bdf8;">
            📥 Import Excel (5k+)
          </button>
          <button type="button" id="btn-download-parts-template" class="btn btn-outline btn-sm" style="font-size: 11px; height: 28px; padding: 2px 8px; color: #34d399; border-color: rgba(52,211,153,0.4);">
            📄 Template
          </button>
        </div>

      </div>

      <!-- Parts Master Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; flex: 1; min-height: 0; overflow: auto;">
        <table class="parts-trace-table">
          <thead>
            <tr>
              <th style="width: 36px; text-align: center;">
                <input type="checkbox" id="chk-parts-master-select-all" ${isPageAllSelected ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #0284c7;" title="Select/Deselect all on this page" />
              </th>
              <th style="width: 100px;">Part Code</th>
              <th style="min-width: 180px;">Part Name</th>
              <th style="min-width: 180px;">Alternative Name / Alias</th>
              <th>Category</th>
              <th>UoM</th>
              <th>Brand &amp; Model</th>
              <th>Compatible Machines</th>
              <th>Unit Price</th>
              <th>Status</th>
              <th style="text-align: right; min-width: 165px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${pageParts.length === 0 ? `
              <tr>
                <td colspan="11" style="text-align: center; padding: 30px; color: var(--text-muted);">
                  No spare parts found matching your criteria.
                </td>
              </tr>
            ` : pageParts.map(p => {
              const isSelected = masterSelectedPartIds.has(p.id);
              return `
                <tr style="${isSelected ? 'background: rgba(2, 132, 199, 0.12);' : ''}">
                  <td style="text-align: center;">
                    <input type="checkbox" class="chk-part-row" data-id="${p.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #0284c7;" />
                  </td>
                  <td>
                    <span style="font-family: var(--font-mono); font-weight: 900; color: #38bdf8; background: rgba(56,189,248,0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.2);">
                      ${p.code}
                    </span>
                  </td>
                  <td>
                    <strong style="color: #fff;">${p.name}</strong>
                  </td>
                  <td>
                    <div style="color: #cbd5e1; font-size: 11px;">${p.altName || '—'}</div>
                    ${p.alias ? `<div style="font-size: 9.5px; color: var(--text-muted);">Alias: ${p.alias}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge badge-idle" style="font-size: 10px;">${p.category || 'Mechanical'}</span>
                  </td>
                  <td style="font-weight: 700; color: #94a3b8;">${p.unit || 'PCS'}</td>
                  <td>
                    <span style="color: #fff;">${p.brand || '—'}</span>
                    ${p.model ? `<span style="color: var(--text-muted); font-size: 10px;">/ ${p.model}</span>` : ''}
                  </td>
                  <td style="font-size: 10.5px; color: #e2e8f0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${p.compatibleMachineTypes || 'Universal'}
                  </td>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #34d399;">
                    ${p.unitPrice ? `৳${p.unitPrice}` : '—'}
                  </td>
                  <td>
                    <span class="badge ${p.status === 'ACTIVE' ? 'badge-active' : 'badge-danger'}" style="font-size: 9.5px;">
                      ${p.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button type="button" class="btn btn-ghost btn-xs btn-edit-part" data-id="${p.id}" style="font-size: 11px; padding: 2px 5px; color: #38bdf8;" title="Edit this part">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn btn-ghost btn-xs btn-toggle-part-status" data-id="${p.id}" style="font-size: 11px; padding: 2px 5px; color: ${p.status === 'ACTIVE' ? '#94a3b8' : '#34d399'};" title="${p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}">
                      ${p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" class="btn btn-ghost btn-xs btn-delete-single-part" data-id="${p.id}" data-name="${(p.name || '').replace(/"/g, '&quot;')}" style="font-size: 11px; padding: 2px 5px; color: #ef4444;" title="Delete this part">
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- High-Speed Pagination Footer -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 11px;">
        <span style="color: var(--text-muted);">
          Showing <strong>${startIndex + 1}</strong> - <strong>${Math.min(startIndex + MASTER_PAGE_SIZE, totalCount)}</strong> of <strong>${totalCount.toLocaleString()}</strong> parts
        </span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button type="button" id="btn-master-prev-page" class="btn btn-ghost btn-xs" ${masterCurrentPage <= 1 ? 'disabled' : ''} style="font-size: 11px; padding: 2px 8px;">
            &laquo; Prev
          </button>
          <span style="font-family: var(--font-mono); font-weight: 700; color: #fff; padding: 0 4px;">
            Page ${masterCurrentPage} of ${totalPages}
          </span>
          <button type="button" id="btn-master-next-page" class="btn btn-ghost btn-xs" ${masterCurrentPage >= totalPages ? 'disabled' : ''} style="font-size: 11px; padding: 2px 8px;">
            Next &raquo;
          </button>
        </div>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 5. TRACEABILITY HISTORY TAB
// ─────────────────────────────────────────────────────────────
function renderHistoryTab() {
  const issues = partsTraceService.getAllIssues({ search: historySearch, ...historyFilters });

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
      
      <!-- Filter Toolbar -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
        
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1;">
          <input 
            type="text" 
            id="inp-history-search" 
            class="form-control" 
            placeholder="🔍 Search ERP#, part, machine, technician..." 
            value="${historySearch}"
            style="max-width: 260px; height: 28px; font-size: 11.5px; padding: 3px 8px; border-radius: 6px; background: #090d16;"
          />
          <input 
            type="date" 
            id="inp-history-from" 
            class="form-control" 
            value="${historyFilters.dateFrom || ''}"
            style="width: 120px; height: 28px; font-size: 11px; padding: 2px 4px; background: #090d16;"
            title="From Date"
          />
          <input 
            type="date" 
            id="inp-history-to" 
            class="form-control" 
            value="${historyFilters.dateTo || ''}"
            style="width: 120px; height: 28px; font-size: 11px; padding: 2px 4px; background: #090d16;"
            title="To Date"
          />
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
            ${issues.length} Results
          </span>
        </div>

        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" id="btn-export-history-excel" class="btn btn-outline btn-sm" style="color: #34d399; border-color: rgba(52,211,153,0.4); font-size: 11px; height: 28px; padding: 2px 8px; font-weight: 700;">
            📊 Export Excel
          </button>
        </div>

      </div>

      <!-- History Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; flex: 1; min-height: 0; overflow: auto;">
        <table class="parts-trace-table">
          <thead>
            <tr>
              <th>ERP No</th>
              <th>Date</th>
              <th>Part Name &amp; Code</th>
              <th>Qty</th>
              <th>Machine No</th>
              <th>Technician</th>
              <th>Floor &amp; Line</th>
              <th>PDF Source</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${issues.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">
                  No spare parts transaction records found.
                </td>
              </tr>
            ` : issues.map(iss => `
              <tr>
                <td>
                  <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">${iss.erpNo}</span>
                </td>
                <td style="font-family: var(--font-mono); font-size: 11px;">${iss.issueDate}</td>
                <td>
                  <div style="font-weight: 700; color: #fff;">${iss.partName}</div>
                  <div style="font-size: 10px; color: #94a3b8; font-family: var(--font-mono);">${iss.partCode || '—'}</div>
                </td>
                <td>
                  <strong style="color: #34d399;">${iss.issueQty} ${iss.uom}</strong>
                </td>
                <td>
                  ${iss.machineSerial ? `
                    <span style="font-family: var(--font-mono); font-weight: 800; color: #fbbf24; background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.25); padding: 1px 5px; border-radius: 4px;">
                      ${iss.machineSerial}
                    </span>
                  ` : '<span style="color: #64748b;">—</span>'}
                </td>
                <td>
                  <span style="color: #cbd5e1; font-weight: 600;">${iss.technicianName || '—'}</span>
                </td>
                <td>
                  <span style="color: #fff;">${iss.floorName}</span>
                  <span style="color: var(--text-muted); font-size: 10px;">/ ${iss.lineName}</span>
                </td>
                <td style="font-size: 10.5px; color: var(--text-muted); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${iss.pdfFileName || 'Manual'}
                </td>
                <td style="text-align: right;">
                  <button type="button" class="btn btn-ghost btn-xs btn-view-trace-details" data-id="${iss.id}" style="font-size: 11px; padding: 2px 6px; color: #38bdf8;" title="View Complete Traceability">
                    🔍 Trace
                  </button>
                  <button type="button" class="btn btn-ghost btn-xs btn-delete-issue" data-id="${iss.id}" style="font-size: 11px; padding: 2px 6px; color: #f87171;" title="Delete">
                    🗑️
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 6. REPORTS TAB
// ─────────────────────────────────────────────────────────────
function renderReportsTab() {
  const all = partsTraceService.getAllIssues();
  
  const floorMap = {};
  const partMap = {};
  const machineMap = {};

  all.forEach(iss => {
    const flr = iss.floorName || 'Unknown';
    floorMap[flr] = (floorMap[flr] || 0) + (parseFloat(iss.issueQty) || 1);

    const prt = iss.partName || 'Unknown';
    partMap[prt] = (partMap[prt] || 0) + (parseFloat(iss.issueQty) || 1);

    if (iss.machineSerial) {
      machineMap[iss.machineSerial] = (machineMap[iss.machineSerial] || 0) + (parseFloat(iss.issueQty) || 1);
    }
  });

  const topParts = Object.entries(partMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topFloors = Object.entries(floorMap).sort((a, b) => b[1] - a[1]);
  const topMachines = Object.entries(machineMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow-y: auto;">
      
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12.5px; font-weight: 800; color: #fff;">
          📈 Spare Parts Traceability Analytics &amp; Diagnostics
        </span>
        <button type="button" id="btn-export-reports-excel" class="btn btn-outline btn-sm" style="color: #34d399; border-color: rgba(52,211,153,0.4); font-size: 11px;">
          📊 Export Full Dataset (Excel)
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 11.5px; font-weight: 800; color: #38bdf8; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
            🔩 Top Consumed Parts
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${topParts.length === 0 ? '<div style="color: var(--text-muted); font-size: 11px;">No records yet.</div>' : topParts.map(([name, qty]) => `
              <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 4px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <span style="color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">${name}</span>
                <strong style="color: #34d399; font-family: var(--font-mono);">${qty} pcs</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 11.5px; font-weight: 800; color: #fbbf24; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
            🏢 Floor-wise Distribution
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${topFloors.length === 0 ? '<div style="color: var(--text-muted); font-size: 11px;">No records yet.</div>' : topFloors.map(([flr, qty]) => `
              <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 4px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <span style="color: #fff;">${flr}</span>
                <strong style="color: #fbbf24; font-family: var(--font-mono);">${qty} parts</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 11.5px; font-weight: 800; color: #a78bfa; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
            🏭 Top Machines Replaced
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            ${topMachines.length === 0 ? '<div style="color: var(--text-muted); font-size: 11px;">No machines fitted yet.</div>' : topMachines.map(([serial, qty]) => `
              <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 2px 4px; background: rgba(255,255,255,0.02); border-radius: 4px;">
                <span style="font-family: var(--font-mono); color: #38bdf8; font-weight: 700;">${serial}</span>
                <strong style="color: #a78bfa; font-family: var(--font-mono);">${qty} parts</strong>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// Helper: Resolve & Enrich All Machines with Master Data
// ─────────────────────────────────────────────────────────────
function getEnrichedMachinesList() {
  let allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  if (allMachines.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machines)) {
    allMachines = INITIAL_DATA.machines;
  }
  
  const mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
  const brdTable = storage.getTable(TABLE_NAMES.BRANDS) || [];
  const mdlTable = storage.getTable(TABLE_NAMES.MODELS) || [];
  const flrTable = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const linTable = storage.getTable(TABLE_NAMES.LINES) || [];

  const initialMn = (typeof INITIAL_DATA !== 'undefined' && (INITIAL_DATA.machine_names || INITIAL_DATA.machineNames)) || [];
  const initialBrd = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.brands) || [];
  const initialMdl = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.models) || [];
  const initialFlr = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.floors) || [];
  const initialLin = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.lines) || [];

  const mnMap = new Map();
  initialMn.forEach(x => mnMap.set(x.id, x.name));
  mnTable.forEach(x => mnMap.set(x.id, x.name));

  const brdMap = new Map();
  initialBrd.forEach(x => brdMap.set(x.id, x.name));
  brdTable.forEach(x => brdMap.set(x.id, x.name));

  const mdlMap = new Map();
  initialMdl.forEach(x => mdlMap.set(x.id, x.name));
  mdlTable.forEach(x => mdlMap.set(x.id, x.name));

  const flrMap = new Map();
  initialFlr.forEach(x => flrMap.set(x.id, x.name));
  flrTable.forEach(x => flrMap.set(x.id, x.name));

  const linMap = new Map();
  initialLin.forEach(x => linMap.set(x.id, x.name));
  linTable.forEach(x => linMap.set(x.id, x.name));

  return allMachines.map(m => {
    const resolvedName = mnMap.get(m.machineNameId) || m.machineName || m.name || (m.brand ? m.brand + ' Machine' : 'Sewing Machine');
    const resolvedBrand = brdMap.get(m.brandId) || m.brand || 'Juki';
    const resolvedModel = mdlMap.get(m.modelId) || m.model || m.modelName || 'Standard';
    const resolvedFloor = flrMap.get(m.floorId) || m.floorName || m.floor || '';
    const resolvedLine = linMap.get(m.lineId) || m.lineName || m.line || '';

    return {
      ...m,
      resolvedName,
      resolvedBrand,
      resolvedModel,
      resolvedFloor,
      resolvedLine
    };
  });
}

function getEnrichedEmployeesList() {
  let allEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
  if (allEmployees.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.employees)) {
    allEmployees = INITIAL_DATA.employees;
  }
  
  const flrTable = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const linTable = storage.getTable(TABLE_NAMES.LINES) || [];
  const untTable = storage.getTable(TABLE_NAMES.UNITS) || [];

  const initialFlr = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.floors) || [];
  const initialLin = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.lines) || [];
  const initialUnt = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.units) || [];

  const flrMap = new Map();
  initialFlr.forEach(x => flrMap.set(x.id, x.name));
  flrTable.forEach(x => flrMap.set(x.id, x.name));

  const linMap = new Map();
  initialLin.forEach(x => linMap.set(x.id, x.name));
  linTable.forEach(x => linMap.set(x.id, x.name));

  const untMap = new Map();
  initialUnt.forEach(x => untMap.set(x.id, x.name));
  untTable.forEach(x => untMap.set(x.id, x.name));

  return allEmployees.map(e => {
    const resolvedFloor = flrMap.get(e.floorId) || e.floorName || e.floor || '';
    const resolvedLine = linMap.get(e.lineId) || e.lineName || e.line || '';
    const resolvedUnit = untMap.get(e.unitId) || e.unitName || e.unit || '';
    const workingArea = e.workingArea || resolvedFloor || '';

    return {
      ...e,
      resolvedFloor,
      resolvedLine,
      resolvedUnit,
      workingArea
    };
  });
}

// ─────────────────────────────────────────────────────────────
// 7. SMART MODALS: MACHINE, TECHNICIAN, PART, MANUAL ISSUE
// ─────────────────────────────────────────────────────────────

function renderSmartMachineModal() {
  if (!selectedMachineDraftId) return '';
  const draft = activeDraftRows.find(d => d.draftId === selectedMachineDraftId);
  if (!draft) return '';

  const enrichedMachines = getEnrichedMachinesList();
  
  // Floor & Line machines priority matching
  const draftFloor = (draft.floorName || '').toLowerCase().replace(/floor/gi, '').trim();
  const draftLine = (draft.lineName || '').toLowerCase().trim();

  let floorMachines = enrichedMachines.filter(m => {
    const mFlr = (m.resolvedFloor || '').toLowerCase();
    const mLin = (m.resolvedLine || '').toLowerCase();
    if (draftLine && (mLin === draftLine || mLin.includes(draftLine) || (draftLine.includes('padma-b') && (mLin === 'pd-b' || mLin === 'padma-b')))) {
      return true;
    }
    if (draftFloor && (mFlr.includes(draftFloor) || mFlr === draftFloor || (draftFloor.includes('padma') && mFlr.includes('padma')))) {
      return true;
    }
    return false;
  });

  // Sort so exact line matches come first, then floor matches, then numeric serial order
  floorMachines.sort((a, b) => {
    const aLineMatch = draftLine && (a.resolvedLine.toLowerCase() === draftLine || a.resolvedLine.toLowerCase().includes(draftLine));
    const bLineMatch = draftLine && (b.resolvedLine.toLowerCase() === draftLine || b.resolvedLine.toLowerCase().includes(draftLine));
    if (aLineMatch && !bLineMatch) return -1;
    if (!aLineMatch && bLineMatch) return 1;
    return (a.serialNumber || '').localeCompare(b.serialNumber || '', undefined, { numeric: true });
  });

  if (floorMachines.length === 0) {
    floorMachines = enrichedMachines.slice(0, 30);
  } else {
    floorMachines = floorMachines.slice(0, 40);
  }

  // Extract detected number from comment if any
  const detectedNumber = draft.comments ? draft.comments.match(/\b(?:MID-\d{3,8}|MCH-\d{3,8}|SL-\d{2,6}|[A-Z]{1,3}-\d{2,6}|\d{3,6})\b/gi)?.[0] : null;
  let detectedMachine = null;
  if (detectedNumber) {
    detectedMachine = enrichedMachines.find(m => 
      (m.serialNumber && m.serialNumber.toLowerCase() === detectedNumber.toLowerCase()) ||
      (m.permanentMachineId && m.permanentMachineId.toLowerCase() === detectedNumber.toLowerCase()) ||
      (m.serialNumber && m.serialNumber.toLowerCase().endsWith(detectedNumber.toLowerCase()))
    );
  }

  return `
    <div class="modal-overlay" id="modal-smart-machine-overlay" style="z-index: 10080;">
      <div class="modal-dialog" style="max-width: 620px; width: 95%;">
        
        <div class="modal-header" style="background: linear-gradient(90deg, rgba(2, 132, 199, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%); border-bottom: 1.5px solid rgba(56,189,248,0.35); padding: 12px 18px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #ffffff;">
            <span style="font-size: 16px;">🛠️</span> Assign Machine for <span style="color: #38bdf8;">${draft.floorName}</span> / <span style="color: #34d399;">${draft.lineName}</span>
          </div>
          <button type="button" id="btn-close-smart-machine-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%; color: #94a3b8;">✕</button>
        </div>

        <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; max-height: 80vh; overflow-y: auto;">
          
          <!-- Auto Detected Suggestion Pill -->
          ${detectedNumber ? `
            <div style="background: rgba(251,191,36,0.12); border: 1.5px solid rgba(251,191,36,0.45); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 10.5px; color: #fbbf24; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">⚡ Detected from Note:</span>
                  <span class="badge" style="background: rgba(251,191,36,0.25); color: #fbbf24; font-weight: 800; font-size: 9.5px; padding: 1px 6px; border: 1px solid rgba(251,191,36,0.5);">Auto Match</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
                  <span class="badge" style="font-family: var(--font-mono); font-weight: 900; font-size: 13px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 8px;">
                    SL: ${detectedMachine ? detectedMachine.serialNumber : detectedNumber}
                  </span>
                  <strong style="color: #ffffff; font-weight: 700; font-size: 12.5px;">${detectedMachine ? detectedMachine.resolvedName : (draft.machineName || 'Plane Machine')}</strong>
                  <span style="font-size: 11px; color: #cbd5e1; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12);">
                    🏷️ ${detectedMachine ? `${detectedMachine.resolvedBrand} • ${detectedMachine.resolvedModel}` : 'Juki • Standard'}
                  </span>
                  ${detectedMachine?.resolvedFloor ? `<span style="font-size: 10px; color: #94a3b8;">🏢 ${detectedMachine.resolvedFloor}</span>` : ''}
                  ${detectedMachine?.resolvedLine ? `<span style="font-size: 10px; color: #34d399;">📍 ${detectedMachine.resolvedLine}</span>` : ''}
                  ${draft.comments ? `<span style="font-size: 10.5px; color: #94a3b8; font-style: italic;">"${draft.comments}"</span>` : ''}
                </div>
              </div>
              <button type="button" class="btn btn-warning btn-sm btn-pick-quick-machine" 
                data-id="${detectedMachine ? detectedMachine.id : ''}"
                data-serial="${detectedMachine ? detectedMachine.serialNumber : detectedNumber}" 
                data-name="${detectedMachine ? detectedMachine.resolvedName : (draft.machineName || 'Plane Machine')}" 
                data-brand="${detectedMachine ? detectedMachine.resolvedBrand : 'Juki'}" 
                data-model="${detectedMachine ? detectedMachine.resolvedModel : 'Standard'}" 
                style="font-weight: 800; padding: 6px 14px; white-space: nowrap; box-shadow: 0 2px 8px rgba(251,191,36,0.3);">
                Use ${detectedMachine ? detectedMachine.serialNumber : detectedNumber}
              </button>
            </div>
          ` : ''}

          <!-- Search Input -->
          <div>
            <label class="form-label" style="font-size: 12px; color: #38bdf8; font-weight: 800; margin-bottom: 4px;">🔍 Search Machine Catalog (2,002 Floor Inventory):</label>
            <input 
              type="text" 
              id="inp-search-smart-machine" 
              class="form-control" 
              placeholder="Search serial (124, 7402), machine name (Over Lock), brand (Juki), floor, line..." 
              autofocus 
              style="font-size: 13px; font-weight: 700; background: #060a14; border: 1.5px solid rgba(56,189,248,0.35); color: #ffffff;"
            />
          </div>

          <!-- Quick Actions / Floor Machines -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 11px; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
              <span>Floor Machines (${draft.floorName}):</span>
              <span style="color: #94a3b8; font-weight: 600; text-transform: none;">Showing ${floorMachines.length} suggestions</span>
            </div>
            <div id="smart-machine-results-list" style="display: flex; flex-direction: column; gap: 5px; max-height: 270px; overflow-y: auto; padding-right: 2px;">
              ${floorMachines.map(m => `
                <div class="smart-item-row btn-pick-smart-machine-row" data-id="${m.id}" data-serial="${m.serialNumber}" data-name="${m.resolvedName}" data-brand="${m.resolvedBrand}" data-model="${m.resolvedModel}">
                  <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="badge" style="font-family: var(--font-mono); background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 12px; font-weight: 900; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 7px;">
                        SL: ${m.serialNumber}
                      </span>
                      <strong style="color: #ffffff; font-size: 12.5px; font-weight: 700;">${m.resolvedName}</strong>
                      ${m.customValues?.machine_code ? `<span style="font-size: 10px; color: #a78bfa; font-family: var(--font-mono); font-weight: 700;">[${m.customValues.machine_code}]</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 1px; flex-wrap: wrap;">
                      <span style="font-size: 10.5px; color: #e2e8f0; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12);">
                        🏷️ <strong>${m.resolvedBrand}</strong> • ${m.resolvedModel}
                      </span>
                    </div>
                  </div>
                  <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; margin-left: 8px;">
                    <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-family: var(--font-mono); font-size: 11px; font-weight: 800; border: 1px solid rgba(52, 211, 153, 0.35); padding: 2px 8px; border-radius: 4px;">
                      📍 ${m.resolvedLine || 'Line —'}
                    </span>
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">
                      🏢 ${m.resolvedFloor || 'Floor'}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Custom Machine Serial Manual Field -->
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
            <label class="form-label" style="font-size: 11.5px; color: #94a3b8; font-weight: 700;">Or Enter Custom Machine Serial / ID Manually:</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="inp-custom-machine-serial" class="form-control" placeholder="e.g. 7402, M-101" value="${draft.machineSerial || ''}" style="font-family: var(--font-mono); font-weight: 800; font-size: 12.5px; background: #060a14; color: #ffffff;" />
              <button type="button" id="btn-apply-custom-machine-serial" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 0 16px; white-space: nowrap; background: #0284c7; border-color: #38bdf8;">
                Set Machine
              </button>
            </div>
          </div>

          <!-- Batch Apply Options -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; font-size: 11.5px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #e2e8f0; font-weight: 600;">
              <input type="checkbox" id="chk-machine-apply-line" style="width: 15px; height: 15px; accent-color: #38bdf8;" /> Apply this machine to all unassigned rows on <strong style="color: #38bdf8;">${draft.lineName}</strong>
            </label>
          </div>

        </div>

      </div>
    </div>
  `;
}

function renderSmartTechnicianModal() {
  if (!selectedTechDraftId) return '';
  const draft = activeDraftRows.find(d => d.draftId === selectedTechDraftId);
  if (!draft) return '';

  const enrichedEmployees = getEnrichedEmployeesList();
  
  // Floor matching
  const draftFloor = (draft.floorName || '').toLowerCase().replace(/floor/gi, '').trim();

  const floorEmployees = enrichedEmployees.filter(emp => {
    if (!draftFloor) return true;
    const empFloor = (emp.resolvedFloor || emp.floorName || '').toLowerCase();
    const empArea = (emp.workingArea || '').toLowerCase();
    return empFloor.includes(draftFloor) || empArea.includes(draftFloor) || (draftFloor.includes('padma') && (empFloor.includes('padma') || empArea.includes('padma')));
  });

  // Extract detected technician name from comments if any
  let detectedEmp = null;
  if (draft.comments) {
    const cleanComm = draft.comments.toLowerCase();
    const words = cleanComm.split(/[\s,\/|:]+/).filter(w => w.length >= 3 && !['change', 'repair', 'p/m', 'set', 'belt', 'line', 'padma', 'floor', 'pcs', 'box'].includes(w));
    for (const w of words) {
      const match = enrichedEmployees.find(e => e.name && e.name.toLowerCase().includes(w));
      if (match) {
        detectedEmp = match;
        break;
      }
    }
  }

  // Quick Chips: prioritize floor employees, fallback to top maintenance mechanics
  const chipsList = floorEmployees.length > 0 
    ? floorEmployees.slice(0, 14)
    : enrichedEmployees.filter(e => (e.department || '').toUpperCase().includes('MAINTENANCE') || (e.designation || '').toUpperCase().includes('MECHANIC')).slice(0, 12);

  // List display items
  const displayList = floorEmployees.length > 0 ? floorEmployees : enrichedEmployees.slice(0, 25);

  return `
    <div class="modal-overlay" id="modal-smart-tech-overlay" style="z-index: 10080;">
      <div class="modal-dialog" style="max-width: 540px; width: 95%;">
        
        <div class="modal-header" style="background: linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%); border-bottom: 1.5px solid rgba(52, 211, 153, 0.35); padding: 12px 18px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #ffffff;">
            <span style="font-size: 16px;">👷</span> Assign Technician / Manpower for <span style="color: #38bdf8;">${draft.floorName}</span>
          </div>
          <button type="button" id="btn-close-smart-tech-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%; color: #94a3b8;">✕</button>
        </div>

        <div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; max-height: 80vh; overflow-y: auto;">
          
          <!-- Auto Detected Suggestion Banner -->
          ${detectedEmp ? `
            <div style="background: rgba(251,191,36,0.12); border: 1.5px solid rgba(251,191,36,0.45); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
              <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 10.5px; color: #fbbf24; font-weight: 800; text-transform: uppercase;">⚡ Detected from Note:</span>
                  <span class="badge" style="background: rgba(251,191,36,0.25); color: #fbbf24; font-weight: 800; font-size: 9.5px; padding: 1px 6px;">Auto Match</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
                  <strong style="color: #ffffff; font-size: 13px;">${detectedEmp.name}</strong>
                  <span style="font-family: var(--font-mono); color: #38bdf8; font-size: 11px;">Card: ${detectedEmp.cardNumber || '—'}</span>
                  <span style="font-size: 10.5px; color: #cbd5e1; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px;">${detectedEmp.designation || 'Technician'}</span>
                  <span style="font-size: 10px; color: #34d399;">📍 ${detectedEmp.workingArea || detectedEmp.resolvedFloor || 'Floor'}</span>
                </div>
              </div>
              <button type="button" class="btn btn-warning btn-sm btn-pick-quick-tech" 
                data-id="${detectedEmp.id}" 
                data-name="${detectedEmp.name}" 
                data-card="${detectedEmp.cardNumber || '—'}"
                style="font-weight: 800; padding: 6px 14px; white-space: nowrap; box-shadow: 0 2px 8px rgba(251,191,36,0.3);">
                Use ${detectedEmp.name}
              </button>
            </div>
          ` : ''}

          <!-- Fast Pick Quick Chips from Floor -->
          <div>
            <div style="font-size: 11px; color: #34d399; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              ⚡ Quick Select — ${draft.floorName} Maintenance Staff (${floorEmployees.length > 0 ? floorEmployees.length : chipsList.length}):
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${chipsList.map(t => `
                <button type="button" class="smart-chip btn-pick-quick-tech" data-id="${t.id}" data-name="${t.name}" data-card="${t.cardNumber || '—'}" title="${t.designation} (${t.workingArea || t.resolvedFloor})">
                  <span>👷 ${t.name}</span>
                  ${t.cardNumber ? `<small style="opacity: 0.85; font-family: var(--font-mono); font-size: 9.5px; margin-left: 2px;">(${t.cardNumber.replace(/^AMG-?0*/i, '#')})</small>` : ''}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Search All Employees -->
          <div>
            <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700; margin-bottom: 4px;">🔍 Search Employee / Mechanic Database (226 Staff):</label>
            <input 
              type="text" 
              id="inp-search-smart-tech" 
              class="form-control" 
              placeholder="Search by technician name, card (AMG0100201), designation, floor..." 
              autofocus 
              style="font-size: 13px; font-weight: 700; background: #060a14; border: 1.5px solid rgba(56,189,248,0.35); color: #ffffff;"
            />
          </div>

          <!-- Manpower Results List -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="font-size: 10.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: flex; justify-content: space-between;">
              <span>${floorEmployees.length > 0 ? `🏢 ${draft.floorName} Manpower (${floorEmployees.length} Staff):` : '👥 All Available Maintenance Staff:'}</span>
              <span style="text-transform: none;">Click to assign</span>
            </div>
            <div id="smart-tech-results-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; padding-right: 2px;">
              ${displayList.map(e => `
                <div class="smart-item-row btn-pick-smart-tech-row" data-id="${e.id}" data-name="${e.name}" data-card="${e.cardNumber || '—'}" data-desig="${e.designation || 'Staff'}">
                  <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <strong style="color: #ffffff; font-size: 12.5px; font-weight: 700;">${e.name}</strong>
                      <span style="font-size: 10.5px; color: #38bdf8; font-family: var(--font-mono); font-weight: 800; background: rgba(56,189,248,0.1); padding: 1px 6px; border-radius: 3px; border: 1px solid rgba(56,189,248,0.25);">
                        Card: ${e.cardNumber || '—'}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap;">
                      <span style="font-size: 10px; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px;">
                        🔧 ${e.designation || 'Technician'}
                      </span>
                      <span style="font-size: 10px; color: #34d399;">
                        📍 ${e.workingArea || e.resolvedFloor || 'Factory Floor'}
                      </span>
                    </div>
                  </div>
                  <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; margin-left: 8px;">
                    <span class="badge" style="background: rgba(52, 211, 153, 0.12); color: #34d399; font-size: 10px; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.3); padding: 2px 6px; border-radius: 4px;">
                      ${e.resolvedFloor || e.workingArea || 'Padma'}
                    </span>
                    ${e.resolvedUnit ? `<span style="font-size: 9px; color: #94a3b8;">${e.resolvedUnit}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Custom Name Manual Field -->
          <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
            <label class="form-label" style="font-size: 11px; color: var(--text-muted);">Or Enter Technician Name Manually:</label>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="inp-custom-tech-name" class="form-control" placeholder="e.g. Md. Rahat, Biplob" value="${draft.technicianName || ''}" style="font-weight: 700; font-size: 12px; background: #060a14; color: #ffffff;" />
              <button type="button" id="btn-apply-custom-tech-name" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 0 14px; white-space: nowrap;">
                Set Tech
              </button>
            </div>
          </div>

          <!-- Batch Apply Options -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; font-size: 11px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #cbd5e1;">
              <input type="checkbox" id="chk-tech-apply-all-drafts" style="accent-color: #34d399;" /> Apply this technician to all unassigned rows in drafts
            </label>
          </div>

        </div>

      </div>
    </div>
  `;
}

function renderSmartPartModal() {
  if (!selectedPartDraftId) return '';
  const draft = activeDraftRows.find(d => d.draftId === selectedPartDraftId);
  if (!draft) return '';

  const allParts = partsTraceService.getAllParts();

  return `
    <div class="modal-overlay" id="modal-smart-part-overlay" style="z-index: 10080;">
      <div class="modal-dialog" style="max-width: 580px; width: 95%;">
        
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🔩</span> Select Matched Spare Part for "${draft.rawItemName}"
          </div>
          <button type="button" id="btn-close-smart-part-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%;">✕</button>
        </div>

        <div style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; max-height: 80vh; overflow-y: auto;">
          
          <div>
            <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">🔍 Search 5k+ Parts Catalog:</label>
            <input 
              type="text" 
              id="inp-search-smart-part" 
              class="form-control" 
              placeholder="Search by part code, part name, alt name..." 
              value="${draft.partName || ''}"
              autofocus 
              style="font-size: 13px; font-weight: 700; background: #090d16;"
            />
          </div>

          <div id="smart-part-results-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 300px; overflow-y: auto;">
            ${allParts.slice(0, 30).map(p => `
              <div class="smart-item-row btn-pick-smart-part-row" data-id="${p.id}" data-code="${p.code}" data-name="${p.name}" data-unit="${p.unit || 'PCS'}">
                <div>
                  <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; margin-right: 6px;">${p.code}</span>
                  <strong style="color: #fff; font-size: 12px;">${p.name}</strong>
                  ${p.altName ? `<div style="font-size: 10px; color: var(--text-muted);">${p.altName}</div>` : ''}
                </div>
                <span style="font-size: 11px; font-weight: 700; color: #34d399;">${p.unit || 'PCS'}</span>
              </div>
            `).join('')}
          </div>

        </div>

      </div>
    </div>
  `;
}

function renderManualIssueModal() {
  if (!manualIssueModalOpen) return '';

  const parts = partsTraceService.getAllParts();
  const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
  const enrichedMachines = getEnrichedMachinesList();

  return `
    <div class="modal-overlay" id="modal-manual-issue-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 540px; width: 95%;">
        
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>➕</span> Add Manual Spare Part Issue
          </div>
          <button type="button" id="btn-close-manual-issue-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%;">✕</button>
        </div>

        <form id="form-manual-issue" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; max-height: 80vh; overflow-y: auto;">
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">ERP Number: <span class="req">*</span></label>
              <input type="text" id="man-inp-erp" class="form-control" placeholder="e.g. IR260890430" required style="font-family: var(--font-mono); font-weight: 700;" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Issue Date: <span class="req">*</span></label>
              <input type="date" id="man-inp-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Select Spare Part: <span class="req">*</span></label>
            <select id="man-sel-part" class="form-control" required style="font-size: 13px;">
              <option value="" disabled selected>-- Select Part from Catalog --</option>
              ${parts.map(p => `<option value="${p.id}" data-code="${p.code}" data-name="${p.name}" data-unit="${p.unit}">${p.code} — ${p.name} (${p.unit || 'PCS'})</option>`).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #cbd5e1; font-weight: 700;">Quantity Issued: <span class="req">*</span></label>
              <input type="number" id="man-inp-qty" class="form-control" value="1" min="1" required style="font-weight: 800; color: #34d399;" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #cbd5e1; font-weight: 700;">Use of Area:</label>
              <input type="text" id="man-inp-area" class="form-control" value="change" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Machine (Optional):</label>
            <select id="man-sel-machine" class="form-control" style="font-size: 12px;">
              <option value="">-- No Machine / General Floor Stock --</option>
              ${enrichedMachines.slice(0, 150).map(m => `<option value="${m.id}" data-serial="${m.serialNumber}" data-name="${m.resolvedName}" data-brand="${m.resolvedBrand}" data-model="${m.resolvedModel}">${m.serialNumber} — ${m.resolvedName} (${m.resolvedBrand} ${m.resolvedModel}) [${m.resolvedFloor} / ${m.resolvedLine}]</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Assigned Technician:</label>
            <select id="man-sel-technician" class="form-control" style="font-size: 12px;">
              <option value="">-- Select Technician --</option>
              ${employees.map(e => `<option value="${e.id}" data-card="${e.cardNumber}" data-name="${e.name}">${e.name} (${e.cardNumber || '—'})</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: var(--text-muted);">Remarks / Notes:</label>
            <input type="text" id="man-inp-remarks" class="form-control" placeholder="Optional comments" />
          </div>

          <div class="modal-footer" style="padding: 0; display: flex; gap: 8px; margin-top: 6px;">
            <button type="button" id="btn-cancel-manual-issue" class="btn btn-secondary" style="flex: 1; height: 36px; font-weight: 700;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 2; height: 36px; font-weight: 800; background: #059669; border-color: #34d399;">
              ✓ Save Issue Record
            </button>
          </div>

        </form>

      </div>
    </div>
  `;
}

function renderAddPartModal() {
  if (!addPartModalOpen) return '';
  const p = editingPartData || {};

  return `
    <div class="modal-overlay" id="modal-add-part-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 540px; width: 95%;">
        
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🔩</span> ${p.id ? 'Edit Spare Part' : 'Add New Spare Part Master'}
          </div>
          <button type="button" id="btn-close-add-part-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%;">✕</button>
        </div>

        <form id="form-save-part" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; max-height: 80vh; overflow-y: auto;">
          <input type="hidden" id="part-inp-id" value="${p.id || ''}" />
          
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Part Code: <span class="req">*</span></label>
              <input type="text" id="part-inp-code" class="form-control" value="${p.code || ''}" required placeholder="SP-001" style="font-family: var(--font-mono); font-weight: 800;" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Part Name: <span class="req">*</span></label>
              <input type="text" id="part-inp-name" class="form-control" value="${p.name || ''}" required placeholder="e.g. Fixed Knife" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: #cbd5e1; font-weight: 700;">Alternative / Full Name:</label>
            <input type="text" id="part-inp-alt" class="form-control" value="${p.altName || ''}" placeholder="e.g. P/M FIXED KNIFE (DDL-900BB) 40195552" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: #cbd5e1; font-weight: 700;">Aliases (Comma-separated for auto matching):</label>
            <input type="text" id="part-inp-alias" class="form-control" value="${p.alias || ''}" placeholder="e.g. Sharp Belt, Knife Sharpener Belt" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #cbd5e1; font-weight: 700;">Category:</label>
              <select id="part-sel-cat" class="form-control">
                <option value="Mechanical" ${p.category === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                <option value="Electrical" ${p.category === 'Electrical' ? 'selected' : ''}>Electrical</option>
                <option value="Consumable" ${p.category === 'Consumable' ? 'selected' : ''}>Consumable</option>
                <option value="Pneumatic" ${p.category === 'Pneumatic' ? 'selected' : ''}>Pneumatic</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #cbd5e1; font-weight: 700;">Unit of Measure (UoM):</label>
              <input type="text" id="part-inp-unit" class="form-control" value="${p.unit || 'PCS'}" placeholder="PCS, BOX, SET" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #cbd5e1;">Brand / Origin:</label>
              <input type="text" id="part-inp-brand" class="form-control" value="${p.brand || ''}" placeholder="JUKI / Brother" />
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #cbd5e1;">Model Compatibility:</label>
              <input type="text" id="part-inp-model" class="form-control" value="${p.model || ''}" placeholder="DDL-900BB, DDL-8700" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: #cbd5e1;">Compatible Machine Types:</label>
            <input type="text" id="part-inp-mtypes" class="form-control" value="${p.compatibleMachineTypes || ''}" placeholder="Plane Machine, Overlock, etc." />
          </div>

          <div class="modal-footer" style="padding: 0; display: flex; gap: 8px; margin-top: 6px;">
            <button type="button" id="btn-cancel-add-part" class="btn btn-secondary" style="flex: 1; height: 36px; font-weight: 700;">Cancel</button>
            <button type="submit" class="btn btn-primary" style="flex: 2; height: 36px; font-weight: 800; background: #0284c7; border-color: #38bdf8;">
              ✓ Save Part Master
            </button>
          </div>

        </form>

      </div>
    </div>
  `;
}

function renderImportExcelModal() {
  if (!importExcelModalOpen) return '';

  return `
    <div class="modal-overlay" id="modal-import-excel-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 520px; width: 95%;">
        
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>📥</span> Bulk Import Spare Parts Master (Excel 5k+)
          </div>
          <button type="button" id="btn-close-import-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%;">✕</button>
        </div>

        <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
            Upload your master parts catalog (supports <strong>5,000 to 20,000+ rows</strong>). All valid rows will be imported and indexed for instant auto-detection!
          </div>

          <div style="border: 2px dashed rgba(56,189,248,0.4); border-radius: 8px; padding: 22px; text-align: center; background: rgba(56,189,248,0.05); cursor: pointer;" id="dropzone-parts-excel">
            <input type="file" id="inp-parts-excel-file" accept=".xlsx,.xls,.csv" style="display: none;" />
            <div style="font-size: 34px; margin-bottom: 6px;">📊</div>
            <div style="font-weight: 700; color: #fff; font-size: 13.5px;">Click or Drag Excel Catalog File (.xlsx)</div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">Columns: Part Code, Part Name, Alternative Name, Alias, Category, UoM...</div>
          </div>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #fca5a5; font-size: 11.5px; background: rgba(239, 68, 68, 0.08); padding: 8px 10px; border-radius: 6px; border: 1px dashed rgba(239, 68, 68, 0.3);">
            <input type="checkbox" id="chk-replace-all-parts-import" style="cursor: pointer; width: 15px; height: 15px; accent-color: #ef4444;" />
            <span><strong>Wipe existing catalog</strong> &amp; replace completely with this Excel file</span>
          </label>

          <div id="excel-import-results-box" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px; font-size: 11.5px;">
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <button type="button" id="btn-download-sample-template-modal" class="btn btn-ghost btn-sm" style="color: #38bdf8; font-size: 11.5px;">
              📄 Download Sample Template
            </button>
            <button type="button" id="btn-close-import-done" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 6px 16px;">
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderTraceabilityDetailsModal() {
  if (!selectedTraceIssue) return '';
  const iss = selectedTraceIssue;

  return `
    <div class="modal-overlay" id="modal-trace-details-overlay" style="z-index: 10060;">
      <div class="modal-dialog" style="max-width: 580px; width: 95%;">
        
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🔍</span> Complete Traceability Record
          </div>
          <button type="button" id="btn-close-trace-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; border-radius: 50%;">✕</button>
        </div>

        <div style="padding: 16px; display: flex; flex-direction: column; gap: 10px; max-height: 80vh; overflow-y: auto; font-size: 12px;">
          
          <!-- Traceability Chain Diagram -->
          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 10px 12px;">
            <div style="font-size: 10.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">
              🔗 Traceability Chain:
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #fff; margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="color: #38bdf8;">${iss.erpNo}</span>
              <span>➔</span>
              <span style="color: #34d399;">${iss.partName}</span>
              <span>➔</span>
              <span style="color: #fbbf24;">${iss.machineSerial || 'General'}</span>
              <span>➔</span>
              <span style="color: #e2e8f0;">${iss.technicianName || 'Staff'}</span>
            </div>
          </div>

          <!-- Key Details Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: var(--text-muted);">ERP Issue Number</div>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 13px;">${iss.erpNo}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: var(--text-muted);">Issue Date</div>
              <div style="font-family: var(--font-mono); font-weight: 700; color: #fff;">${iss.issueDate}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: var(--text-muted);">Spare Part</div>
              <div style="font-weight: 700; color: #fff;">${iss.partName}</div>
              <div style="font-size: 10px; color: #94a3b8; font-family: var(--font-mono);">${iss.partCode || '—'}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: var(--text-muted);">Quantity Issued</div>
              <div style="font-weight: 800; color: #34d399; font-size: 14px;">${iss.issueQty} ${iss.uom}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: var(--text-muted);">Machine Target</div>
              <div style="font-weight: 800; color: #fbbf24; font-family: var(--font-mono);">${iss.machineSerial || 'None / Stock'}</div>
              <div style="font-size: 10px; color: var(--text-muted);">${iss.machineName || ''}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: var(--text-muted);">Assigned Technician</div>
              <div style="font-weight: 700; color: #cbd5e1;">${iss.technicianName || '—'}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; grid-column: span 2;">
              <div style="font-size: 10px; color: var(--text-muted);">Location (Floor / Line)</div>
              <div style="color: #fff;">${iss.floorName} / ${iss.lineName}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 10px; font-size: 11px; color: var(--text-muted);">
            <div>Cost Center: <strong style="color: #cbd5e1;">${iss.costCenter || 'Maintenance'}</strong> &bull; Store: <strong style="color: #cbd5e1;">${iss.store || 'MAINTENANCE'}</strong></div>
            <div style="margin-top: 2px;">PDF Reference: <strong style="color: #38bdf8;">${iss.pdfFileName || 'Manual Entry'}</strong></div>
            <div style="margin-top: 2px;">Created By: <strong>${iss.createdBy}</strong> on ${new Date(iss.createdAt).toLocaleString()}</div>
          </div>

          <button type="button" id="btn-close-trace-modal-btn" class="btn btn-secondary" style="width: 100%; height: 34px; font-weight: 700; margin-top: 4px;">
            Close
          </button>

        </div>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 8. EVENT LISTENERS & CONTROLLERS
// ─────────────────────────────────────────────────────────────

export function initPartsTraceEvents() {
  const root = document.getElementById('parts-trace-root');
  if (!root) return;

  const refresh = () => {
    const container = document.getElementById('main-view-container');
    if (!container) return;
    container.innerHTML = renderPartsTraceView();
    initPartsTraceEvents();
  };

  // 1. Tab Switching
  root.querySelectorAll('.btn-trace-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      refresh();
    });
  });

  root.querySelectorAll('.btn-nav-to-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-target');
      refresh();
    });
  });

  // 2. Load Sample ERP Report Shortcut
  const btnSample = root.querySelector('#btn-quick-sample-load') || root.querySelector('#btn-upload-load-sample');
  if (btnSample) {
    btnSample.addEventListener('click', () => {
      activeDraftRows = partsTraceService.getSampleErpReportDrafts();
      activeTab = 'review';
      notificationService.notifySuccess('Sample Report Loaded', 'Loaded 8 ERP spare parts issue rows from reference report.');
      refresh();
    });
  }

  // 3. PDF Upload Dropzone Events
  const dropzone = root.querySelector('#dropzone-pdf-upload');
  const inpPdf = root.querySelector('#inp-trace-pdf-file');
  const btnBrowse = root.querySelector('#btn-browse-pdf');
  const metaBox = root.querySelector('#selected-pdf-meta-box');
  const btnProcess = root.querySelector('#btn-process-selected-pdf');

  if (dropzone && inpPdf) {
    dropzone.addEventListener('click', (e) => {
      if (e.target !== btnProcess) inpPdf.click();
    });

    if (btnBrowse) {
      btnBrowse.addEventListener('click', (e) => {
        e.stopPropagation();
        inpPdf.click();
      });
    }

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#34d399';
      dropzone.style.background = 'rgba(52, 211, 153, 0.08)';
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      dropzone.style.background = 'rgba(56, 189, 248, 0.04)';
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      dropzone.style.background = 'rgba(56, 189, 248, 0.04)';

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    inpPdf.addEventListener('change', () => {
      if (inpPdf.files && inpPdf.files.length > 0) {
        handleFileSelected(inpPdf.files[0]);
      }
    });
  }

  let selectedFileObj = null;
  const handleFileSelected = (file) => {
    selectedFileObj = file;
    if (metaBox) {
      metaBox.style.display = 'block';
      const nameEl = root.querySelector('#pdf-file-name');
      const sizeEl = root.querySelector('#pdf-file-size');
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = `${Math.round(file.size / 1024)} KB &bull; ${file.type || 'Document'}`;
    }
  };

  if (btnProcess) {
    btnProcess.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!selectedFileObj) return;

      const progressBox = root.querySelector('#pdf-processing-progress-box');
      const progressText = root.querySelector('#pdf-progress-status');
      const progressPct = root.querySelector('#pdf-progress-pct');
      const progressFill = root.querySelector('#pdf-progress-bar-fill');

      if (progressBox) progressBox.style.display = 'flex';

      try {
        const drafts = await partsTraceService.parsePdfOrImageFile(selectedFileObj, (pct, status) => {
          if (progressText) progressText.textContent = status;
          if (progressPct) progressPct.textContent = `${pct}%`;
          if (progressFill) progressFill.style.width = `${pct}%`;
        });

        activeDraftRows = drafts;
        uploadedPdfMetadata = {
          fileName: selectedFileObj.name,
          fileSize: `${Math.round(selectedFileObj.size / 1024)} KB`,
          pagesCount: 1,
          issueDate: new Date().toISOString().split('T')[0]
        };

        activeTab = 'review';
        notificationService.notifySuccess('PDF Processed', `Extracted ${drafts.length} spare parts issue rows from ${selectedFileObj.name}.`);
        refresh();
      } catch (err) {
        notificationService.notifyError('PDF Extraction Error', err.message);
        if (progressBox) progressBox.style.display = 'none';
      }
    });
  }

  // 4. Draft Review Filter & Search
  root.querySelectorAll('.btn-draft-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      reviewFilter = btn.getAttribute('data-filter');
      refresh();
    });
  });

  const inpDraftSearch = root.querySelector('#inp-draft-filter-query');
  if (inpDraftSearch) {
    inpDraftSearch.addEventListener('input', (e) => {
      reviewSearch = e.target.value;
      refresh();
    });
  }

  // 5. Quantity edits inside draft table
  root.querySelectorAll('.inp-draft-qty').forEach(inp => {
    inp.addEventListener('change', () => {
      const draftId = inp.getAttribute('data-draft-id');
      const draft = activeDraftRows.find(d => d.draftId === draftId);
      if (draft) {
        draft.issueQty = parseFloat(inp.value) || 1;
      }
    });
  });

  // 6. Delete single draft row
  root.querySelectorAll('.btn-delete-draft-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const draftId = btn.getAttribute('data-draft-id');
      activeDraftRows = activeDraftRows.filter(d => d.draftId !== draftId);
      refresh();
    });
  });

  // 7. Re-Match All Drafts Button
  const btnRematch = root.querySelector('#btn-rematch-all-drafts');
  if (btnRematch) {
    btnRematch.addEventListener('click', () => {
      activeDraftRows = partsTraceService.rematchDraftRows(activeDraftRows);
      const autoCount = activeDraftRows.filter(r => r.status === 'AUTO_MATCHED').length;
      notificationService.notifySuccess('Re-Match Completed', `Re-matched ${activeDraftRows.length} rows (${autoCount} Auto-Matched).`);
      refresh();
    });
  }

  // 8. Clear All Drafts
  const btnClearDrafts = root.querySelector('#btn-clear-all-drafts');
  if (btnClearDrafts) {
    btnClearDrafts.addEventListener('click', () => {
      if (confirm('Are you sure you want to discard all extracted draft rows?')) {
        activeDraftRows = [];
        activeTab = 'upload';
        refresh();
      }
    });
  }

  // 9. Confirm & Save All Drafts
  const btnConfirmSave = root.querySelector('#btn-confirm-save-all-drafts');
  if (btnConfirmSave) {
    btnConfirmSave.addEventListener('click', async () => {
      if (activeDraftRows.length === 0) return;

      btnConfirmSave.disabled = true;
      btnConfirmSave.textContent = 'Saving...';

      try {
        const res = await partsTraceService.confirmAndSaveAll(activeDraftRows, uploadedPdfMetadata || {});
        notificationService.notifySuccess('Transactions Saved', `Successfully saved ${res.count} spare parts issues with complete traceability.`);
        activeDraftRows = [];
        uploadedPdfMetadata = null;
        activeTab = 'dashboard';
        refresh();
      } catch (err) {
        notificationService.notifyError('Save Error', err.message);
        btnConfirmSave.disabled = false;
        btnConfirmSave.textContent = '✓ Confirm & Save All';
      }
    });
  }

  // 10. Smart Machine Selector Modal Events
  root.querySelectorAll('.btn-open-smart-machine-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMachineDraftId = btn.getAttribute('data-draft-id');
      refresh();
    });
  });

  const btnCloseSmartMachine = root.querySelector('#btn-close-smart-machine-modal');
  if (btnCloseSmartMachine) {
    btnCloseSmartMachine.addEventListener('click', () => {
      selectedMachineDraftId = null;
      refresh();
    });
  }

  const applyMachineSelection = (machineData, applyToLine = false) => {
    const targetDraft = activeDraftRows.find(d => d.draftId === selectedMachineDraftId);
    if (!targetDraft) return;

    const assign = (d) => {
      d.machineId = machineData.id || '';
      d.machineSerial = machineData.serialNumber || '';
      d.machinePermanentId = machineData.permanentMachineId || '';
      d.machineName = machineData.machineName || 'Sewing Machine';
      d.machineBrand = machineData.brand || '';
      d.machineModel = machineData.model || '';
      d.machineMatchStatus = 'MANUAL';
    };

    assign(targetDraft);

    if (applyToLine && targetDraft.lineName) {
      activeDraftRows.forEach(d => {
        if (d.lineName === targetDraft.lineName && !d.machineSerial) {
          assign(d);
        }
      });
    }

    selectedMachineDraftId = null;
    refresh();
  };

  root.querySelectorAll('.btn-pick-quick-machine').forEach(btn => {
    btn.addEventListener('click', () => {
      const serial = btn.getAttribute('data-serial');
      const name = btn.getAttribute('data-name');
      const brand = btn.getAttribute('data-brand') || 'Juki';
      const model = btn.getAttribute('data-model') || 'Standard';
      const id = btn.getAttribute('data-id') || '';
      const applyLine = root.querySelector('#chk-machine-apply-line')?.checked;
      applyMachineSelection({ id, serialNumber: serial, machineName: name, brand, model }, applyLine);
    });
  });

  root.querySelectorAll('.btn-pick-smart-machine-row').forEach(row => {
    row.addEventListener('click', () => {
      const mData = {
        id: row.getAttribute('data-id'),
        serialNumber: row.getAttribute('data-serial'),
        machineName: row.getAttribute('data-name'),
        brand: row.getAttribute('data-brand'),
        model: row.getAttribute('data-model')
      };
      const applyLine = root.querySelector('#chk-machine-apply-line')?.checked;
      applyMachineSelection(mData, applyLine);
    });
  });

  const btnApplyCustomMachine = root.querySelector('#btn-apply-custom-machine-serial');
  if (btnApplyCustomMachine) {
    btnApplyCustomMachine.addEventListener('click', () => {
      const serial = root.querySelector('#inp-custom-machine-serial')?.value.trim();
      if (!serial) return;
      
      const enrichedMachines = getEnrichedMachinesList();
      const match = enrichedMachines.find(m => 
        (m.serialNumber && m.serialNumber.toLowerCase() === serial.toLowerCase()) ||
        (m.permanentMachineId && m.permanentMachineId.toLowerCase() === serial.toLowerCase())
      );

      const mData = match ? {
        id: match.id,
        serialNumber: match.serialNumber,
        machineName: match.resolvedName,
        brand: match.resolvedBrand,
        model: match.resolvedModel
      } : {
        serialNumber: serial,
        machineName: 'Plane Machine',
        brand: 'Juki',
        model: 'Standard'
      };

      const applyLine = root.querySelector('#chk-machine-apply-line')?.checked;
      applyMachineSelection(mData, applyLine);
    });
  }

  const inpSearchMachine = root.querySelector('#inp-search-smart-machine');
  if (inpSearchMachine) {
    inpSearchMachine.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const listContainer = root.querySelector('#smart-machine-results-list');
      if (!listContainer) return;

      const enrichedMachines = getEnrichedMachinesList();
      const matches = (!q ? enrichedMachines.slice(0, 35) : enrichedMachines.filter(m =>
        (m.serialNumber && m.serialNumber.toLowerCase().includes(q)) ||
        (m.permanentMachineId && m.permanentMachineId.toLowerCase().includes(q)) ||
        (m.resolvedName && m.resolvedName.toLowerCase().includes(q)) ||
        (m.resolvedBrand && m.resolvedBrand.toLowerCase().includes(q)) ||
        (m.resolvedModel && m.resolvedModel.toLowerCase().includes(q)) ||
        (m.resolvedFloor && m.resolvedFloor.toLowerCase().includes(q)) ||
        (m.resolvedLine && m.resolvedLine.toLowerCase().includes(q)) ||
        (m.customValues?.machine_code && String(m.customValues.machine_code).toLowerCase().includes(q))
      )).slice(0, 40);

      listContainer.innerHTML = matches.length === 0 ? `
        <div style="color: #94a3b8; font-size: 11.5px; padding: 14px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 6px;">
          No matching machines found for "<strong>${q}</strong>". Enter custom serial below.
        </div>
      ` : matches.map(m => `
        <div class="smart-item-row btn-pick-smart-machine-row" data-id="${m.id}" data-serial="${m.serialNumber}" data-name="${m.resolvedName}" data-brand="${m.resolvedBrand}" data-model="${m.resolvedModel}">
          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge" style="font-family: var(--font-mono); background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 12px; font-weight: 900; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 7px;">
                SL: ${m.serialNumber}
              </span>
              <strong style="color: #ffffff; font-size: 12.5px; font-weight: 700;">${m.resolvedName}</strong>
              ${m.customValues?.machine_code ? `<span style="font-size: 10px; color: #a78bfa; font-family: var(--font-mono); font-weight: 700;">[${m.customValues.machine_code}]</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 1px; flex-wrap: wrap;">
              <span style="font-size: 10.5px; color: #e2e8f0; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.12);">
                🏷️ <strong>${m.resolvedBrand}</strong> • ${m.resolvedModel}
              </span>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; margin-left: 8px;">
            <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-family: var(--font-mono); font-size: 11px; font-weight: 800; border: 1px solid rgba(52, 211, 153, 0.35); padding: 2px 8px; border-radius: 4px;">
              📍 ${m.resolvedLine || 'Line —'}
            </span>
            <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">
              🏢 ${m.resolvedFloor || 'Floor'}
            </span>
          </div>
        </div>
      `).join('');

      listContainer.querySelectorAll('.btn-pick-smart-machine-row').forEach(row => {
        row.addEventListener('click', () => {
          const mData = {
            id: row.getAttribute('data-id'),
            serialNumber: row.getAttribute('data-serial'),
            machineName: row.getAttribute('data-name'),
            brand: row.getAttribute('data-brand'),
            model: row.getAttribute('data-model')
          };
          const applyLine = root.querySelector('#chk-machine-apply-line')?.checked;
          applyMachineSelection(mData, applyLine);
        });
      });
    });
  }

  // 11. Smart Technician Selector Modal Events
  root.querySelectorAll('.btn-open-smart-tech-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTechDraftId = btn.getAttribute('data-draft-id');
      refresh();
    });
  });

  const btnCloseSmartTech = root.querySelector('#btn-close-smart-tech-modal');
  if (btnCloseSmartTech) {
    btnCloseSmartTech.addEventListener('click', () => {
      selectedTechDraftId = null;
      refresh();
    });
  }

  const applyTechSelection = (techData, applyToAll = false) => {
    const targetDraft = activeDraftRows.find(d => d.draftId === selectedTechDraftId);
    if (!targetDraft) return;

    const assign = (d) => {
      d.technicianId = techData.id || '';
      d.technicianName = techData.name || '';
      d.technicianCard = techData.cardNumber || techData.card || '—';
    };

    assign(targetDraft);

    if (applyToAll) {
      activeDraftRows.forEach(d => {
        if (!d.technicianName) assign(d);
      });
    }

    selectedTechDraftId = null;
    refresh();
  };

  root.querySelectorAll('.btn-pick-quick-tech').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id') || '';
      const name = btn.getAttribute('data-name');
      const card = btn.getAttribute('data-card');
      const applyAll = root.querySelector('#chk-tech-apply-all-drafts')?.checked;
      applyTechSelection({ id, name, cardNumber: card }, applyAll);
    });
  });

  root.querySelectorAll('.btn-pick-smart-tech-row').forEach(row => {
    row.addEventListener('click', () => {
      const tData = {
        id: row.getAttribute('data-id'),
        name: row.getAttribute('data-name'),
        cardNumber: row.getAttribute('data-card')
      };
      const applyAll = root.querySelector('#chk-tech-apply-all-drafts')?.checked;
      applyTechSelection(tData, applyAll);
    });
  });

  const btnApplyCustomTech = root.querySelector('#btn-apply-custom-tech-name');
  if (btnApplyCustomTech) {
    btnApplyCustomTech.addEventListener('click', () => {
      const name = root.querySelector('#inp-custom-tech-name')?.value.trim();
      if (!name) return;
      const applyAll = root.querySelector('#chk-tech-apply-all-drafts')?.checked;
      applyTechSelection({ name: name, cardNumber: '—' }, applyAll);
    });
  }

  const inpSearchTech = root.querySelector('#inp-search-smart-tech');
  if (inpSearchTech) {
    inpSearchTech.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const listContainer = root.querySelector('#smart-tech-results-list');
      if (!listContainer) return;

      const enrichedEmployees = getEnrichedEmployeesList();
      const matches = (!q ? enrichedEmployees.slice(0, 25) : enrichedEmployees.filter(emp =>
        (emp.name && emp.name.toLowerCase().includes(q)) ||
        (emp.cardNumber && String(emp.cardNumber).toLowerCase().includes(q)) ||
        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
        (emp.workingArea && emp.workingArea.toLowerCase().includes(q)) ||
        (emp.resolvedFloor && emp.resolvedFloor.toLowerCase().includes(q)) ||
        (emp.resolvedUnit && emp.resolvedUnit.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q))
      )).slice(0, 30);

      listContainer.innerHTML = matches.length === 0 ? `
        <div style="color: #94a3b8; font-size: 11.5px; padding: 14px; text-align: center; background: rgba(255,255,255,0.02); border-radius: 6px;">
          No matching employees found for "<strong>${q}</strong>". Enter custom name below.
        </div>
      ` : matches.map(emp => `
        <div class="smart-item-row btn-pick-smart-tech-row" data-id="${emp.id}" data-name="${emp.name}" data-card="${emp.cardNumber || '—'}" data-desig="${emp.designation || 'Staff'}">
          <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <strong style="color: #ffffff; font-size: 12.5px; font-weight: 700;">${emp.name}</strong>
              <span style="font-size: 10.5px; color: #38bdf8; font-family: var(--font-mono); font-weight: 800; background: rgba(56,189,248,0.1); padding: 1px 6px; border-radius: 3px; border: 1px solid rgba(56,189,248,0.25);">
                Card: ${emp.cardNumber || '—'}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap;">
              <span style="font-size: 10px; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px;">
                🔧 ${emp.designation || 'Technician'}
              </span>
              <span style="font-size: 10px; color: #34d399;">
                📍 ${emp.workingArea || emp.resolvedFloor || 'Factory Floor'}
              </span>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; margin-left: 8px;">
            <span class="badge" style="background: rgba(52, 211, 153, 0.12); color: #34d399; font-size: 10px; font-weight: 700; border: 1px solid rgba(52, 211, 153, 0.3); padding: 2px 6px; border-radius: 4px;">
              ${emp.resolvedFloor || emp.workingArea || 'Padma'}
            </span>
            ${emp.resolvedUnit ? `<span style="font-size: 9px; color: #94a3b8;">${emp.resolvedUnit}</span>` : ''}
          </div>
        </div>
      `).join('');

      listContainer.querySelectorAll('.btn-pick-smart-tech-row').forEach(row => {
        row.addEventListener('click', () => {
          const tData = {
            id: row.getAttribute('data-id'),
            name: row.getAttribute('data-name'),
            cardNumber: row.getAttribute('data-card')
          };
          const applyAll = root.querySelector('#chk-tech-apply-all-drafts')?.checked;
          applyTechSelection(tData, applyAll);
        });
      });
    });
  }

  // 12. Smart Part Selector Modal Events
  root.querySelectorAll('.btn-open-smart-part-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPartDraftId = btn.getAttribute('data-draft-id');
      refresh();
    });
  });

  const btnCloseSmartPart = root.querySelector('#btn-close-smart-part-modal');
  if (btnCloseSmartPart) {
    btnCloseSmartPart.addEventListener('click', () => {
      selectedPartDraftId = null;
      refresh();
    });
  }

  const applyPartSelection = (partData) => {
    const targetDraft = activeDraftRows.find(d => d.draftId === selectedPartDraftId);
    if (!targetDraft) return;

    targetDraft.partId = partData.id;
    targetDraft.partCode = partData.code;
    targetDraft.partName = partData.name;
    targetDraft.uom = partData.unit || targetDraft.uom;
    targetDraft.partMatchStatus = 'AUTO_MATCHED';
    targetDraft.status = 'AUTO_MATCHED';

    selectedPartDraftId = null;
    refresh();
  };

  root.querySelectorAll('.btn-pick-smart-part-row').forEach(row => {
    row.addEventListener('click', () => {
      applyPartSelection({
        id: row.getAttribute('data-id'),
        code: row.getAttribute('data-code'),
        name: row.getAttribute('data-name'),
        unit: row.getAttribute('data-unit')
      });
    });
  });

  const inpSearchSmartPart = root.querySelector('#inp-search-smart-part');
  if (inpSearchSmartPart) {
    inpSearchSmartPart.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const listContainer = root.querySelector('#smart-part-results-list');
      if (!listContainer) return;

      const allParts = partsTraceService.getAllParts();
      const matches = allParts.filter(p =>
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.altName && p.altName.toLowerCase().includes(q)) ||
        (p.alias && p.alias.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q))
      ).slice(0, 40);

      listContainer.innerHTML = matches.length === 0 ? `
        <div style="color: var(--text-muted); font-size: 11px; padding: 10px; text-align: center;">
          No matching parts found in 5k+ catalog.
        </div>
      ` : matches.map(p => `
        <div class="smart-item-row btn-pick-smart-part-row" data-id="${p.id}" data-code="${p.code}" data-name="${p.name}" data-unit="${p.unit || 'PCS'}">
          <div>
            <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; margin-right: 6px;">${p.code}</span>
            <strong style="color: #fff; font-size: 12px;">${p.name}</strong>
            ${p.altName ? `<div style="font-size: 10px; color: var(--text-muted);">${p.altName}</div>` : ''}
          </div>
          <span style="font-size: 11px; font-weight: 700; color: #34d399;">${p.unit || 'PCS'}</span>
        </div>
      `).join('');

      listContainer.querySelectorAll('.btn-pick-smart-part-row').forEach(row => {
        row.addEventListener('click', () => {
          applyPartSelection({
            id: row.getAttribute('data-id'),
            code: row.getAttribute('data-code'),
            name: row.getAttribute('data-name'),
            unit: row.getAttribute('data-unit')
          });
        });
      });
    });
  }

  // Auto-focus search input and backdrop click close
  setTimeout(() => {
    const activeSearch = root.querySelector('#inp-search-smart-machine') || 
                         root.querySelector('#inp-search-smart-tech') || 
                         root.querySelector('#inp-search-smart-part');
    if (activeSearch) activeSearch.focus();
  }, 50);

  const activeOverlay = root.querySelector('#modal-smart-machine-overlay') || 
                        root.querySelector('#modal-smart-tech-overlay') || 
                        root.querySelector('#modal-smart-part-overlay');
  if (activeOverlay) {
    activeOverlay.addEventListener('click', (e) => {
      if (e.target === activeOverlay) {
        selectedMachineDraftId = null;
        selectedTechDraftId = null;
        selectedPartDraftId = null;
        refresh();
      }
    });
  }

  // 13. Traceability Details Modal
  root.querySelectorAll('.btn-view-trace-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const issues = partsTraceService.getAllIssues();
      selectedTraceIssue = issues.find(i => i.id === id);
      refresh();
    });
  });

  const btnCloseTrace = root.querySelector('#btn-close-trace-modal') || root.querySelector('#btn-close-trace-modal-btn');
  if (btnCloseTrace) {
    btnCloseTrace.addEventListener('click', () => {
      selectedTraceIssue = null;
      refresh();
    });
  }

  // 14. Delete Confirmed Issue
  root.querySelectorAll('.btn-delete-issue').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this spare parts issue record?')) {
        await partsTraceService.deleteIssue(id);
        notificationService.notifySuccess('Issue Deleted', 'Record removed from system.');
        refresh();
      }
    });
  });

  // 15. Manual Issue Modal Open/Close & Submit
  const btnOpenManual = root.querySelector('#btn-trace-add-manual');
  if (btnOpenManual) {
    btnOpenManual.addEventListener('click', () => {
      manualIssueModalOpen = true;
      refresh();
    });
  }

  const btnCloseManual = root.querySelector('#btn-close-manual-issue-modal') || root.querySelector('#btn-cancel-manual-issue');
  if (btnCloseManual) {
    btnCloseManual.addEventListener('click', () => {
      manualIssueModalOpen = false;
      refresh();
    });
  }

  const formManual = root.querySelector('#form-manual-issue');
  if (formManual) {
    formManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selPart = root.querySelector('#man-sel-part');
      const selPartOpt = selPart?.options[selPart.selectedIndex];
      const selMachine = root.querySelector('#man-sel-machine');
      const selMachineOpt = selMachine?.options[selMachine.selectedIndex];
      const selTech = root.querySelector('#man-sel-technician');
      const selTechOpt = selTech?.options[selTech.selectedIndex];

      const payload = {
        erpNo: root.querySelector('#man-inp-erp')?.value || 'MANUAL',
        issueDate: root.querySelector('#man-inp-date')?.value || new Date().toISOString().split('T')[0],
        partId: selPart?.value || '',
        partCode: selPartOpt?.getAttribute('data-code') || '',
        partName: selPartOpt?.getAttribute('data-name') || 'Part',
        uom: selPartOpt?.getAttribute('data-unit') || 'PCS',
        reqQty: root.querySelector('#man-inp-qty')?.value || 1,
        issueQty: root.querySelector('#man-inp-qty')?.value || 1,
        useOfArea: root.querySelector('#man-inp-area')?.value || 'change',
        machineId: selMachine?.value || '',
        machineSerial: selMachineOpt?.getAttribute('data-serial') || '',
        machineName: selMachineOpt?.getAttribute('data-name') || '',
        technicianId: selTech?.value || '',
        technicianName: selTechOpt?.getAttribute('data-name') || '',
        remarks: root.querySelector('#man-inp-remarks')?.value || ''
      };

      try {
        await partsTraceService.addManualIssue(payload);
        notificationService.notifySuccess('Issue Added', 'Spare parts issue saved successfully.');
        manualIssueModalOpen = false;
        refresh();
      } catch (err) {
        notificationService.notifyError('Error', err.message);
      }
    });
  }

  // 16. Parts Master Add/Edit Modal
  const btnOpenAddPart = root.querySelector('#btn-open-add-part-modal');
  if (btnOpenAddPart) {
    btnOpenAddPart.addEventListener('click', () => {
      editingPartData = null;
      addPartModalOpen = true;
      refresh();
    });
  }

  root.querySelectorAll('.btn-edit-part').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      editingPartData = partsTraceService.getPartById(id);
      addPartModalOpen = true;
      refresh();
    });
  });

  const btnCloseAddPart = root.querySelector('#btn-close-add-part-modal') || root.querySelector('#btn-cancel-add-part');
  if (btnCloseAddPart) {
    btnCloseAddPart.addEventListener('click', () => {
      addPartModalOpen = false;
      editingPartData = null;
      refresh();
    });
  }

  const formSavePart = root.querySelector('#form-save-part');
  if (formSavePart) {
    formSavePart.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        id: root.querySelector('#part-inp-id')?.value || '',
        code: root.querySelector('#part-inp-code')?.value || '',
        name: root.querySelector('#part-inp-name')?.value || '',
        altName: root.querySelector('#part-inp-alt')?.value || '',
        alias: root.querySelector('#part-inp-alias')?.value || '',
        category: root.querySelector('#part-sel-cat')?.value || 'Mechanical',
        unit: root.querySelector('#part-inp-unit')?.value || 'PCS',
        brand: root.querySelector('#part-inp-brand')?.value || '',
        model: root.querySelector('#part-inp-model')?.value || '',
        compatibleMachineTypes: root.querySelector('#part-inp-mtypes')?.value || ''
      };

      try {
        await partsTraceService.savePart(payload);
        notificationService.notifySuccess('Part Saved', `Spare Part '${payload.name}' saved in catalog.`);
        addPartModalOpen = false;
        editingPartData = null;
        refresh();
      } catch (err) {
        notificationService.notifyError('Error', err.message);
      }
    });
  }

  root.querySelectorAll('.btn-toggle-part-status').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await partsTraceService.togglePartStatus(id);
      refresh();
    });
  });

  root.querySelectorAll('.btn-delete-single-part').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name') || 'this part';
      if (!confirm(`Are you sure you want to delete spare part "${name}"?`)) {
        return;
      }
      try {
        await partsTraceService.deletePart(id);
        masterSelectedPartIds.delete(id);
        notificationService.notifySuccess('Part Deleted', `Spare part "${name}" removed from catalog.`);
        refresh();
      } catch (err) {
        notificationService.notifyError('Delete Failed', err.message);
      }
    });
  });

  // Checkbox selection events
  const chkMasterSelectAll = root.querySelector('#chk-parts-master-select-all');
  if (chkMasterSelectAll) {
    chkMasterSelectAll.addEventListener('change', (e) => {
      const allFiltered = partsTraceService.getAllParts({ search: masterSearch, category: masterCategory });
      const startIndex = (masterCurrentPage - 1) * MASTER_PAGE_SIZE;
      const pageParts = allFiltered.slice(startIndex, startIndex + MASTER_PAGE_SIZE);
      if (e.target.checked) {
        pageParts.forEach(p => masterSelectedPartIds.add(p.id));
      } else {
        pageParts.forEach(p => masterSelectedPartIds.delete(p.id));
      }
      refresh();
    });
  }

  root.querySelectorAll('.chk-part-row').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = chk.getAttribute('data-id');
      if (e.target.checked) {
        masterSelectedPartIds.add(id);
      } else {
        masterSelectedPartIds.delete(id);
      }
      refresh();
    });
  });

  const btnSelectAllFiltered = root.querySelector('#btn-select-all-filtered-parts');
  if (btnSelectAllFiltered) {
    btnSelectAllFiltered.addEventListener('click', () => {
      const allFiltered = partsTraceService.getAllParts({ search: masterSearch, category: masterCategory });
      allFiltered.forEach(p => masterSelectedPartIds.add(p.id));
      refresh();
    });
  }

  const btnClearSelection = root.querySelector('#btn-clear-parts-selection');
  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', () => {
      masterSelectedPartIds.clear();
      refresh();
    });
  }

  const btnBulkDelete = root.querySelector('#btn-bulk-delete-parts');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async () => {
      const count = masterSelectedPartIds.size;
      if (count === 0) return;
      if (!confirm(`Are you sure you want to permanently delete ${count} selected spare part(s) from Parts Master?`)) {
        return;
      }
      try {
        const res = await partsTraceService.deletePartsBatch(Array.from(masterSelectedPartIds));
        masterSelectedPartIds.clear();
        notificationService.notifySuccess('Parts Deleted', `Successfully deleted ${res.deleted} spare part(s).`);
        refresh();
      } catch (err) {
        notificationService.notifyError('Delete Failed', err.message);
      }
    });
  }

  const btnClearAllMaster = root.querySelector('#btn-clear-all-parts-master');
  if (btnClearAllMaster) {
    btnClearAllMaster.addEventListener('click', async () => {
      const allParts = partsTraceService.getAllParts();
      if (allParts.length === 0) return;
      if (!confirm(`⚠️ WARNING: Are you sure you want to permanently delete ALL ${allParts.length} spare parts from the Master catalog?\n\nThis will completely wipe the catalog so you can import a fresh Excel dataset.`)) {
        return;
      }
      try {
        const res = await partsTraceService.deleteAllParts();
        masterSelectedPartIds.clear();
        notificationService.notifySuccess('Catalog Cleared', `Successfully deleted all ${res.deleted} spare parts.`);
        refresh();
      } catch (err) {
        notificationService.notifyError('Clear Failed', err.message);
      }
    });
  }

  // 17. Excel Bulk Import Modal & Actions (5k+ Support)
  const btnOpenImport = root.querySelector('#btn-open-import-excel-modal');
  if (btnOpenImport) {
    btnOpenImport.addEventListener('click', () => {
      importExcelModalOpen = true;
      refresh();
    });
  }

  const btnCloseImport = root.querySelector('#btn-close-import-modal') || root.querySelector('#btn-close-import-done');
  if (btnCloseImport) {
    btnCloseImport.addEventListener('click', () => {
      importExcelModalOpen = false;
      refresh();
    });
  }

  const dropzonePartsExcel = root.querySelector('#dropzone-parts-excel');
  const inpPartsExcel = root.querySelector('#inp-parts-excel-file');
  if (dropzonePartsExcel && inpPartsExcel) {
    dropzonePartsExcel.addEventListener('click', () => inpPartsExcel.click());
    inpPartsExcel.addEventListener('change', async () => {
      if (inpPartsExcel.files && inpPartsExcel.files.length > 0) {
        const file = inpPartsExcel.files[0];
        const replaceExisting = root.querySelector('#chk-replace-all-parts-import')?.checked || false;
        const resBox = root.querySelector('#excel-import-results-box');
        if (resBox) {
          resBox.style.display = 'block';
          resBox.innerHTML = `<span style="color: #38bdf8;">${replaceExisting ? 'Wiping catalog & indexing Excel rows...' : 'Reading Excel and indexing 5,000+ parts...'}</span>`;
        }

        try {
          const res = await partsTraceService.importPartsFromExcel(file, (pct, msg) => {
            if (resBox) {
              resBox.innerHTML = `
                <div style="color: #38bdf8; font-weight: 700; margin-bottom: 4px;">${msg} (${pct}%)</div>
                <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                  <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #38bdf8, #34d399); transition: width 0.2s ease;"></div>
                </div>
              `;
            }
          }, { replaceExisting });

          masterSelectedPartIds.clear();

          // Auto-rematch active drafts with newly imported parts
          if (activeDraftRows.length > 0) {
            activeDraftRows = partsTraceService.rematchDraftRows(activeDraftRows);
          }

          if (resBox) {
            resBox.innerHTML = `
              <strong style="color: #34d399; display: block; margin-bottom: 4px; font-size: 12.5px;">✓ Import Completed!</strong>
              <div>Total Rows: <strong>${res.totalRows.toLocaleString()}</strong></div>
              <div>New Parts Added: <strong style="color: #34d399;">${res.imported.toLocaleString()}</strong> &bull; Updated: <strong style="color: #38bdf8;">${res.updated.toLocaleString()}</strong></div>
              ${res.skipped > 0 ? `<div style="color: #f87171;">Skipped / Empty: <strong>${res.skipped}</strong></div>` : ''}
              <div style="color: #38bdf8; font-size: 11px; margin-top: 4px;">⚡ All review drafts automatically re-matched!</div>
            `;
          }
          notificationService.notifySuccess('Excel Imported', `Successfully processed ${res.totalRows.toLocaleString()} parts from Excel.`);
        } catch (err) {
          if (resBox) resBox.innerHTML = `<span style="color: #f87171;">Error: ${err.message}</span>`;
        }
      }
    });
  }

  const btnDownloadTemplate = root.querySelector('#btn-download-parts-template') || root.querySelector('#btn-download-sample-template-modal');
  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', () => {
      partsTraceService.downloadPartsMasterTemplate();
    });
  }

  // 18. Export Excel Actions
  const btnExportIssues = root.querySelector('#btn-export-issues-excel') || root.querySelector('#btn-export-history-excel') || root.querySelector('#btn-export-reports-excel');
  if (btnExportIssues) {
    btnExportIssues.addEventListener('click', () => {
      partsTraceService.exportToExcel();
    });
  }

  // 19. Parts Master Pagination Controls
  const btnPrevPage = root.querySelector('#btn-master-prev-page');
  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (masterCurrentPage > 1) {
        masterCurrentPage--;
        refresh();
      }
    });
  }

  const btnNextPage = root.querySelector('#btn-master-next-page');
  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      masterCurrentPage++;
      refresh();
    });
  }

  // 20. Search & Filter Inputs
  const inpMasterSearch = root.querySelector('#inp-master-parts-search');
  if (inpMasterSearch) {
    inpMasterSearch.addEventListener('input', (e) => {
      masterSearch = e.target.value;
      masterCurrentPage = 1;
      refresh();
    });
  }

  const selMasterCat = root.querySelector('#sel-master-parts-cat');
  if (selMasterCat) {
    selMasterCat.addEventListener('change', (e) => {
      masterCategory = e.target.value;
      masterCurrentPage = 1;
      refresh();
    });
  }

  const inpHistSearch = root.querySelector('#inp-history-search');
  if (inpHistSearch) {
    inpHistSearch.addEventListener('input', (e) => {
      historySearch = e.target.value;
      refresh();
    });
  }

  const inpHistFrom = root.querySelector('#inp-history-from');
  if (inpHistFrom) {
    inpHistFrom.addEventListener('change', (e) => {
      historyFilters.dateFrom = e.target.value;
      refresh();
    });
  }

  const inpHistTo = root.querySelector('#inp-history-to');
  if (inpHistTo) {
    inpHistTo.addEventListener('change', (e) => {
      historyFilters.dateTo = e.target.value;
      refresh();
    });
  }
}
