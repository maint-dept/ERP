/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Inventory -> Relocate View Component
 * Mobile-First Physical Verification, QR Scan, Auto-Idle Identification & Reconciliation System
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { masterDataService } from '../services/masterDataService.js';
import { relocateService } from '../services/relocateService.js';
import { notificationService } from '../services/notificationService.js';
import { renderQrScannerModal, initQrScannerModalEvents } from './qrScannerModal.js?v=4.6.7';
import { state } from '../state.js';

let activeTab = 'scan'; // 'scan' | 'idle' | 'approvals' | 'history'
let pendingScanMachine = null; // Machine object pending confirmation in modal
let manualSearchModalOpen = false;
let completeModalOpen = false;
let editingScanItem = null; // Item being edited in modal
let scannedListSearch = ''; // Search query on scanned machines
let scannedListFilter = 'ALL'; // 'ALL' | 'CORRECT' | 'LINE_MISMATCH' | 'FLOOR_MISMATCH'
let kpisCollapsedOnMobile = (typeof window !== 'undefined' && window.innerWidth <= 768); // Default to compact on mobile to maximize card feed area
let historySubTab = 'movements'; // 'movements' | 'sessions'
let historySearch = '';
let historyFilter = 'ALL'; // 'ALL' | 'APPROVED' | 'REJECTED' | 'INTER_FLOOR' | 'SAME_FLOOR' (movements) or 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED' (sessions)
let viewingSessionModal = null; // Session object or null

export function renderRelocateView() {
  const activeSession = relocateService.getActiveSession();
  const pendingApprovals = relocateService.getPendingApprovals();
  const idleMachines = relocateService.getIdleMachines();
  const allSessions = relocateService.getAllSessions();

  return `
    <div class="page-view relocate-view-root" id="relocate-page-root">
      
      <!-- Top Title & Navigation Bar -->
      <div class="relocate-top-nav-card">
        <div class="relocate-title-area">
          <div class="relocate-title-icon">
            📍
          </div>
          <div class="relocate-title-text-group">
            <h1 class="relocate-main-title">
              Machine Relocate &amp; Verification
            </h1>
            <div class="relocate-sub-title">
              QR Scan &bull; Auto-Idle Detection &bull; Location Reconciliation
            </div>
          </div>
        </div>

        <!-- Horizontal Swipeable Pill Tabs -->
        <div class="relocate-tabs-bar">
          <button type="button" class="btn-relocate-tab ${activeTab === 'scan' ? 'active' : ''}" data-tab="scan">
            📷 ${activeSession ? 'Active Scan' : 'New Session'}
          </button>
          <button type="button" class="btn-relocate-tab ${activeTab === 'idle' ? 'active' : ''}" data-tab="idle">
            💤 Idle <span class="relocate-tab-badge badge-idle">${idleMachines.length}</span>
          </button>
          <button type="button" class="btn-relocate-tab ${activeTab === 'approvals' ? 'active' : ''}" data-tab="approvals">
            ⏳ Approvals <span class="relocate-tab-badge ${pendingApprovals.length > 0 ? 'badge-alert' : 'badge-idle'}">${pendingApprovals.length}</span>
          </button>
          <button type="button" class="btn-relocate-tab ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
            📜 History
          </button>
          <button type="button" id="btn-relocate-goto-qr-codes" class="btn-relocate-tab" style="margin-left: auto; border: 1.5px solid #38bdf8; color: #38bdf8; background: rgba(56, 189, 248, 0.12); font-weight: 800;" title="Open QR Code & Label Studio">
            🏁 QR Code &amp; Label Studio
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div id="relocate-tab-content-area" class="relocate-tab-content-area">
        ${renderActiveTabContent(activeSession, pendingApprovals, idleMachines, allSessions)}
      </div>

      <!-- Sticky Bottom Dock for Active Scanning on Mobile (Thumbs-First) -->
      ${activeSession && activeTab === 'scan' ? `
        <div class="relocate-mobile-action-dock">
          <button type="button" id="btn-dock-scan-qr" class="dock-btn-scan">
            <span class="dock-btn-icon">📷</span>
            <span class="dock-btn-label">Scan QR</span>
          </button>
          <button type="button" id="btn-dock-manual-search" class="dock-btn-search">
            <span class="dock-btn-icon">🔎</span>
            <span class="dock-btn-label">Search</span>
          </button>
          <button type="button" id="btn-dock-complete" class="dock-btn-complete" title="Complete &amp; Reconcile">
            <span class="dock-btn-icon">🏁</span>
            <span class="dock-btn-label">Finish</span>
          </button>
        </div>
      ` : ''}

      <!-- Dynamic Modals Container (Rendered as Bottom Sheets on Mobile) -->
      <div id="relocate-modal-container">
        ${renderConfirmationModal()}
        ${renderManualSearchModal()}
        ${renderReconciliationModal(activeSession)}
        ${renderEditScanModal(activeSession)}
        ${renderSessionDetailsModal()}
      </div>

      <!-- Dedicated Scanner Modal Container (Prevents overwriting session modals) -->
      <div id="relocate-scanner-slot"></div>

    </div>

    <!-- Scoped Mobile Responsive Styles -->
    <style>
      .relocate-view-root {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        font-family: var(--font-main);
      }

      .relocate-top-nav-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .relocate-title-area {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .relocate-title-icon {
        font-size: 22px;
        background: rgba(56, 189, 248, 0.12);
        border: 1.5px solid #38bdf8;
        border-radius: 10px;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .relocate-main-title {
        font-size: 16px;
        font-weight: 800;
        color: #fff;
        margin: 0;
        line-height: 1.2;
      }

      .relocate-sub-title {
        font-size: 11px;
        color: #38bdf8;
        margin-top: 2px;
      }

      .relocate-tabs-bar {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .btn-relocate-tab {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 12px;
        padding: 7px 14px;
        border-radius: 20px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .btn-relocate-tab:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .btn-relocate-tab.active {
        background: #0284c7;
        border-color: #38bdf8;
        color: #fff;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
      }

      .relocate-tab-badge {
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.15);
      }

      .relocate-tab-badge.badge-alert {
        background: #ef4444;
        color: #fff;
      }

      .relocate-tab-content-area {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      /* Desktop & Base Grid */
      .relocate-kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }

      .relocate-kpi-box {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 10px 12px;
        text-align: center;
      }

      .relocate-kpi-val {
        font-size: 22px;
        font-weight: 900;
        margin-top: 2px;
      }

      /* Mobile Sticky Dock - Hidden on Desktop */
      .relocate-mobile-action-dock {
        display: none;
      }

      /* ─────────────────────────────────────────────────────────────
         HISTORY TAB REDESIGN STYLES
         ───────────────────────────────────────────────────────────── */
      .relocate-history-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        min-height: 0;
      }

      .relocate-history-kpis-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-top: 4px;
      }

      .relocate-history-kpi-card {
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
        transition: transform 0.15s ease, border-color 0.15s ease;
      }

      .relocate-history-kpi-card:hover {
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.16);
      }

      .relocate-history-kpi-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .relocate-history-kpi-title {
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.5px;
        color: var(--text-secondary);
        text-transform: uppercase;
      }

      .relocate-history-kpi-icon {
        font-size: 16px;
      }

      .relocate-history-kpi-val {
        font-size: 26px;
        font-weight: 900;
        line-height: 1.1;
        font-family: var(--font-mono);
      }

      .relocate-history-kpi-sub {
        font-size: 10.5px;
        color: var(--text-muted);
      }

      .relocate-history-subtabs-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 10px;
      }

      .relocate-history-subtabs-btns {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .btn-history-subtab {
        background: rgba(255, 255, 255, 0.04);
        border: 1.5px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: var(--text-secondary);
        font-size: 12.5px;
        font-weight: 700;
        padding: 7px 15px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
      }

      .btn-history-subtab:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }

      .btn-history-subtab.active {
        background: rgba(56, 189, 248, 0.15);
        border-color: #38bdf8;
        color: #38bdf8;
        box-shadow: 0 0 14px rgba(56, 189, 248, 0.2);
      }

      .history-subtab-count {
        font-size: 10.5px;
        font-weight: 800;
        padding: 1px 7px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
      }

      .btn-history-subtab.active .history-subtab-count {
        background: #38bdf8;
        color: #0b1329;
      }

      .btn-history-export {
        background: rgba(16, 185, 129, 0.12);
        border: 1.5px solid #10b981;
        border-radius: 8px;
        color: #34d399;
        font-size: 12px;
        font-weight: 800;
        padding: 7px 15px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }

      .btn-history-export:hover {
        background: #10b981;
        color: #fff;
        box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
      }

      .relocate-history-controls-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .relocate-history-search-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.35);
        border: 1.5px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 6px 12px;
        flex: 1;
        min-width: 240px;
        max-width: 440px;
      }

      .relocate-history-search-wrap:focus-within {
        border-color: #38bdf8;
        box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
      }

      .relocate-history-search-icon {
        font-size: 14px;
        color: var(--text-muted);
      }

      .relocate-history-search-input {
        background: transparent;
        border: none;
        outline: none;
        color: #fff;
        font-size: 12.5px;
        width: 100%;
      }

      .relocate-history-search-input::placeholder {
        color: var(--text-muted);
      }

      .relocate-history-clear-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 13px;
        cursor: pointer;
        padding: 2px 5px;
        border-radius: 4px;
      }

      .relocate-history-clear-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }

      .relocate-history-pills-wrap {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        white-space: nowrap;
        -webkit-overflow-scrolling: touch;
      }

      .btn-history-filter-pill {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        color: var(--text-secondary);
        font-size: 11.5px;
        font-weight: 600;
        padding: 4px 12px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-history-filter-pill:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .btn-history-filter-pill.active {
        background: #38bdf8;
        color: #0b1329;
        border-color: #38bdf8;
        font-weight: 800;
      }

      .history-session-card {
        background: rgba(15, 23, 42, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: transform 0.15s ease, border-color 0.15s ease;
      }

      .history-session-card:hover {
        border-color: rgba(56, 189, 248, 0.35);
        transform: translateY(-1px);
      }

      .history-session-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .history-session-body {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }

      .history-session-meta-pill {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 6px 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 11px;
      }

      .meta-pill-label {
        color: var(--text-muted);
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .meta-pill-value {
        color: #e2e8f0;
        font-size: 11.5px;
      }

      .history-session-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 8px;
        margin-top: 2px;
      }

      .relocate-history-table-desktop {
        display: block;
      }

      .relocate-history-feed-mobile {
        display: none;
      }

      /* Bottom Sheet Modal Styles on Mobile */
      @media (max-width: 768px) {
        .relocate-view-root {
          padding: 8px 10px 145px 10px !important;
          height: auto !important;
          min-height: 100% !important;
          overflow-y: visible !important;
        }

        .relocate-desktop-actions {
          display: none !important;
        }

        .relocate-scanned-feed-wrap {
          min-height: auto !important;
          overflow: visible !important;
          margin-bottom: 24px !important;
        }

        .relocate-scanned-list {
          overflow-y: visible !important;
          max-height: none !important;
          padding: 8px 8px 145px 8px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
        }

        .relocate-top-nav-card {
          padding: 10px 12px;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }

        .relocate-main-title {
          font-size: 15px;
        }

        .relocate-sub-title {
          font-size: 10.5px;
        }

        /* Swipeable horizontal tab bar */
        .relocate-tabs-bar {
          overflow-x: auto;
          flex-wrap: nowrap;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 2px;
          width: 100%;
        }

        .relocate-tabs-bar::-webkit-scrollbar {
          display: none;
        }

        .btn-relocate-tab {
          flex-shrink: 0;
          padding: 6px 12px;
          font-size: 11.5px;
        }

        /* 2x2 grid for KPIs on mobile */
        .relocate-kpi-grid {
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .relocate-kpi-box {
          padding: 8px 10px;
        }

        .relocate-kpi-val {
          font-size: 20px;
        }

        /* Fixed Mobile Sticky Action Dock */
        .relocate-mobile-action-dock {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          padding: 10px 14px max(10px, env(safe-area-inset-bottom, 10px));
          background: rgba(11, 17, 32, 0.96);
          backdrop-filter: blur(14px);
          border-top: 1.5px solid rgba(56, 189, 248, 0.4);
          box-shadow: 0 -8px 25px rgba(0, 0, 0, 0.75);
          gap: 8px;
          align-items: center;
        }

        .dock-btn-scan {
          flex: 2;
          min-height: 48px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          border: 1.5px solid #38bdf8;
          border-radius: 12px;
          color: #fff;
          font-weight: 800;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.5);
          cursor: pointer;
        }

        .dock-btn-search {
          flex: 1;
          min-height: 48px;
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: #e2e8f0;
          font-weight: 700;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
        }

        .dock-btn-complete {
          width: 48px;
          min-width: 48px;
          min-height: 48px;
          background: rgba(5, 150, 105, 0.25);
          border: 1.5px solid #34d399;
          border-radius: 12px;
          color: #34d399;
          font-size: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .dock-btn-complete .dock-btn-label {
          font-size: 9px;
          font-weight: 800;
          margin-top: -2px;
        }

        /* Relocate modal inherits smooth centered layout from components.css */
        .modal-body {
          padding: 14px 16px !important;
        }

        /* 16px font to stop iOS auto-zoom */
        .modal-dialog input,
        .modal-dialog select,
        .modal-dialog textarea,
        .form-control {
          font-size: 16px !important;
          min-height: 44px;
        }

        /* History Tab Mobile Overrides */
        .relocate-history-kpis-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 8px !important;
        }

        .relocate-history-subtabs-bar {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 8px !important;
        }

        .relocate-history-subtabs-btns {
          width: 100% !important;
          display: flex !important;
        }

        .btn-history-subtab {
          flex: 1 !important;
          justify-content: center !important;
          font-size: 11px !important;
          padding: 8px 6px !important;
        }

        .btn-history-export {
          width: 100% !important;
          justify-content: center !important;
        }

        .relocate-history-controls-row {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 8px !important;
        }

        .relocate-history-search-wrap {
          max-width: 100% !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        .relocate-history-pills-wrap {
          width: 100% !important;
        }

        .relocate-history-table-desktop {
          display: none !important;
        }

        .relocate-history-feed-mobile {
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
        }

        .history-session-body {
          grid-template-columns: 1fr !important;
        }
      }
    </style>
  `;
}

function renderActiveTabContent(activeSession, pendingApprovals, idleMachines, allSessions) {
  switch (activeTab) {
    case 'scan':
      return activeSession ? renderLiveScanView(activeSession) : renderSessionSetupView();
    case 'idle':
      return renderIdleMachinesTab(idleMachines);
    case 'approvals':
      return renderApprovalsTab(pendingApprovals);
    case 'history':
      return renderHistoryTab(allSessions);
    default:
      return renderSessionSetupView();
  }
}

// ─────────────────────────────────────────────────────────────
// 1. SESSION SETUP VIEW (Before Scan Begins)
// ─────────────────────────────────────────────────────────────
function renderSessionSetupView() {
  const units = masterDataService.getUnits();
  const floors = [];
  const lines = [];

  return `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; max-width: 680px; margin: 0 auto; width: 100%; box-sizing: border-box;">
      
      <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
        <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>📋</span> Start New Verification &amp; Relocation Session
        </h2>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
          Select target Unit and Floor to start. The system takes an instant snapshot of all machines registered on this floor for physical verification and auto-idle classification.
        </p>
      </div>

      <form id="form-start-relocate-session" style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Target Unit -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; font-size: 12.5px; color: #38bdf8;">Factory Unit: <span class="req">*</span></label>
          <select id="relocate-sel-unit" class="form-control" required style="font-size: 15px; font-weight: 600;">
            <option value="" selected disabled>-- Select Factory Unit --</option>
            ${units.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
          </select>
        </div>

        <!-- Target Floor -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; font-size: 12.5px; color: #38bdf8;">Production Floor: <span class="req">*</span></label>
          <select id="relocate-sel-floor" class="form-control" required style="font-size: 15px; font-weight: 700;">
            <option value="" selected disabled>-- Select Production Floor --</option>
            ${units.map(u => {
              const uFloors = masterDataService.getFloors(u.id);
              if (uFloors.length === 0) return '';
              return `<optgroup label="${u.name}">
                ${uFloors.map(f => `<option value="${f.id}" data-unit-id="${u.id}">${f.name} (${f.code || f.name})</option>`).join('')}
              </optgroup>`;
            }).join('')}
          </select>
        </div>

        <!-- Scan Entire Floor Toggle -->
        <div style="background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 12px 14px;">
          <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none;">
            <input type="checkbox" id="chk-scan-entire-floor" checked style="width: 20px; height: 20px; margin-top: 2px; accent-color: #38bdf8; flex-shrink: 0;" />
            <div>
              <strong style="color: #fff; font-size: 13.5px; display: block;">Scan Entire Floor (Recommended)</strong>
              <span style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4; display: block; margin-top: 2px;">
                Audits all active lines on this floor simultaneously. Any machine not found in running lines will be identified as <strong>Idle</strong>.
              </span>
            </div>
          </label>
        </div>

        <!-- Specific Lines Selector -->
        <div id="relocate-lines-section" style="display: none; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #cbd5e1; margin: 0;">Target Specific Lines:</label>
            <div style="display: flex; gap: 8px;">
              <button type="button" id="btn-lines-select-all" class="btn btn-ghost btn-sm" style="font-size: 11px; padding: 2px 8px; color: #38bdf8;">Select All</button>
              <button type="button" id="btn-lines-deselect-all" class="btn btn-ghost btn-sm" style="font-size: 11px; padding: 2px 8px; color: #94a3b8;">Deselect All</button>
            </div>
          </div>
          
          <div id="relocate-lines-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; max-height: 180px; overflow-y: auto; padding: 6px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
            <div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">
              Please select a Factory Unit and Production Floor to view available lines.
            </div>
          </div>
        </div>

        <!-- Notes / Purpose -->
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; color: var(--text-muted);">Verification Purpose / Notes (Optional):</label>
          <input type="text" id="relocate-session-notes" class="form-control" placeholder="e.g. Weekly Line Physical Audit, Layout Rearrangement" />
        </div>

        <!-- Start Button -->
        <button type="submit" id="btn-start-relocate-session" class="btn btn-primary" style="font-weight: 800; font-size: 15px; padding: 14px 20px; min-height: 48px; margin-top: 6px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); border-radius: 10px;">
          🚀 Take Snapshot &amp; Start Physical Verification
        </button>

      </form>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 2. LIVE SCAN VIEW (Active Session)
// ─────────────────────────────────────────────────────────────
function renderScannedItemsList(session) {
  if (!session || !session.scanned || session.scanned.length === 0) {
    return `
      <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
        <div style="font-size: 38px; margin-bottom: 8px;">📦</div>
        <div style="font-weight: 800; font-size: 14px; color: #fff;">No machines scanned yet</div>
        <div style="font-size: 12px; margin-top: 4px; color: #94a3b8;">
          Tap <strong>Scan QR</strong> or <strong>Search</strong> to verify machines on this floor.
        </div>
      </div>
    `;
  }

  let filtered = session.scanned.slice().reverse();

  if (scannedListFilter && scannedListFilter !== 'ALL') {
    filtered = filtered.filter(s => s.matchType === scannedListFilter);
  }

  if (scannedListSearch && scannedListSearch.trim()) {
    const q = scannedListSearch.trim().toLowerCase();
    filtered = filtered.filter(s => 
      (s.serialNumber && s.serialNumber.toLowerCase().includes(q)) ||
      (s.machineNameStr && s.machineNameStr.toLowerCase().includes(q)) ||
      (s.brandStr && s.brandStr.toLowerCase().includes(q)) ||
      (s.modelStr && s.modelStr.toLowerCase().includes(q)) ||
      (s.scannedLineId && s.scannedLineId.toLowerCase().includes(q)) ||
      (s.remarks && s.remarks.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    return `
      <div style="text-align: center; padding: 30px 16px; color: var(--text-muted);">
        <div style="font-size: 28px; margin-bottom: 6px;">🔍</div>
        <div style="font-weight: 700; font-size: 13px; color: #cbd5e1;">No matching scanned machines</div>
        <div style="font-size: 11.5px; margin-top: 3px;">Try clearing your search query or filter pills.</div>
      </div>
    `;
  }

  return filtered.map((s, idx) => {
    const isVerified = s.matchType === 'CORRECT';
    const isLineMove = s.matchType === 'LINE_MISMATCH';
    const targetLine = masterDataService.getLineById(s.scannedLineId);
    const borderColor = isVerified ? 'rgba(52, 211, 153, 0.4)' : (isLineMove ? 'rgba(56, 189, 248, 0.4)' : 'rgba(251, 191, 36, 0.5)');
    const timeStr = s.scannedAt ? new Date(s.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return `
      <div class="scanned-machine-card" data-scan-id="${s.scanId}" style="background: var(--bg-card); border: 1.5px solid ${borderColor}; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
        
        <!-- Header: Serial, Badge, Time -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-family: var(--font-mono); font-size: 15px; font-weight: 900; color: #38bdf8; letter-spacing: 0.3px;">${s.serialNumber}</span>
              <span class="badge ${isVerified ? 'badge-active' : (isLineMove ? 'badge-idle' : 'badge-breakdown')}" style="font-size: 10.5px; font-weight: 800; padding: 2px 7px;">
                ${s.evalResult?.icon || '•'} ${s.evalResult?.label || s.matchType}
              </span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 3px; word-break: break-word;">${s.machineNameStr}</div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">${s.brandStr || ''} &bull; ${s.modelStr || ''}</div>
          </div>
          
          <div style="text-align: right; flex-shrink: 0;">
            <span style="font-size: 11px; color: #64748b; font-family: var(--font-mono); display: block;">${timeStr}</span>
            <span style="font-size: 10px; color: #38bdf8; font-weight: 800;">#${session.scanned.length - idx}</span>
          </div>
        </div>

        <!-- Location Information -->
        <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="color: #94a3b8; font-size: 11px;">Prev:</span>
            <span style="color: #cbd5e1; font-weight: 600;">${s.previousFloorStr} / ${s.previousLineStr}</span>
            <span style="color: #38bdf8; font-weight: 900;">➔</span>
            <span style="color: #94a3b8; font-size: 11px;">Scanned at:</span>
            <strong style="color: #34d399; font-weight: 800;">${targetLine?.name || s.scannedLineId}</strong>
          </div>
          ${s.needleQuantity ? `
            <div style="font-size: 11.5px; color: #e2e8f0; display: flex; align-items: center; gap: 6px;">
              <span>🪡 Needles: <strong style="color: #38bdf8;">${s.needleQuantity}</strong></span>
            </div>
          ` : ''}
          ${s.remarks ? `
            <div style="font-size: 11px; color: #94a3b8; font-style: italic;">
              💬 "${s.remarks}"
            </div>
          ` : ''}
        </div>

        <!-- Action Buttons: Edit & Delete (Large, touch-friendly) -->
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
          <button type="button" class="btn btn-secondary btn-sm btn-edit-scan" data-scan-id="${s.scanId}" style="min-height: 38px; padding: 6px 14px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; color: #38bdf8; border-color: rgba(56,189,248,0.4);">
            ✏️ Edit
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-delete-scan" data-scan-id="${s.scanId}" data-serial="${s.serialNumber}" style="min-height: 38px; padding: 6px 14px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; color: #f87171; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08);">
            🗑️ Delete
          </button>
        </div>

      </div>
    `;
  }).join('');

  return cardsHtml + `
    <!-- Extra bottom clearance spacer so the last card is 100% visible above mobile fixed action dock -->
    <div style="height: 130px; width: 100%; flex-shrink: 0;" class="mobile-dock-spacer" aria-hidden="true"></div>
  `;
}

function renderLiveScanView(session) {
  const metrics = relocateService.getReconciliationMetrics(session);
  const unt = masterDataService.getUnitById(session.unitId);
  const flr = masterDataService.getFloorById(session.floorId);

  const totalCount = session.scanned.length;
  const verifiedCount = session.scanned.filter(s => s.matchType === 'CORRECT').length;
  const lineMoveCount = session.scanned.filter(s => s.matchType === 'LINE_MISMATCH').length;
  const floorMoveCount = session.scanned.filter(s => s.matchType === 'FLOOR_MISMATCH').length;

  return `
    <div style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
      
      <!-- Session Header & Quick Info -->
      <div style="background: var(--bg-card); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="badge badge-active" style="font-size: 11px; padding: 4px 8px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px #34d399;"></span>
            LIVE
          </span>
          <span style="font-family: var(--font-mono); font-size: 13px; font-weight: 800; color: #38bdf8;">${session.id}</span>
          <span style="color: var(--text-muted); font-size: 12px;">&bull;</span>
          <span style="font-size: 12.5px; font-weight: 700; color: #fff;">${flr?.name || session.floorId} (${unt?.name || session.unitId})</span>
          <span style="font-size: 11px; color: #94a3b8;">(${session.isFullFloor ? 'Full Floor' : `${session.lineIds.length} Lines`})</span>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" id="btn-cancel-relocate-session" class="btn btn-ghost btn-sm" style="color: #f87171; font-size: 11.5px; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 10px;">
            ✕ Cancel
          </button>
          <button type="button" id="btn-open-complete-modal" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; background: #059669; border-color: #34d399; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3); padding: 6px 12px;">
            🏁 Reconcile &amp; Finish
          </button>
        </div>
      </div>

      <!-- Mobile Quick Stats Accordion Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 4px;">
        <span style="font-size: 12px; font-weight: 800; color: #cbd5e1; display: flex; align-items: center; gap: 6px;">
          📊 Session Statistics (${metrics.scannedTotal}/${metrics.expectedTotal})
        </span>
        <button type="button" id="btn-toggle-kpi-mobile" class="btn btn-ghost btn-sm" style="font-size: 11px; padding: 2px 8px; color: #38bdf8; font-weight: 700;">
          ${kpisCollapsedOnMobile ? '▼ Expand Counters' : '▲ Collapse Counters'}
        </button>
      </div>

      <!-- Live Counters Header (Compact 1-line strip when collapsed on mobile, full grid when expanded) -->
      ${kpisCollapsedOnMobile ? `
        <div class="relocate-kpi-compact-strip" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 10px; text-align: center;">
          <div style="border-right: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 9.5px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Target</div>
            <div style="font-size: 15px; font-weight: 900; color: #fff;">${metrics.expectedTotal}</div>
          </div>
          <div style="border-right: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 9.5px; color: #34d399; text-transform: uppercase; font-weight: 700;">Verified</div>
            <div style="font-size: 15px; font-weight: 900; color: #34d399;">${metrics.scannedTotal}</div>
          </div>
          <div style="border-right: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 9.5px; color: #38bdf8; text-transform: uppercase; font-weight: 700;">Idle</div>
            <div style="font-size: 15px; font-weight: 900; color: #38bdf8;">${metrics.idleCount}</div>
          </div>
          <div>
            <div style="font-size: 9.5px; color: #fbbf24; text-transform: uppercase; font-weight: 700;">Pending</div>
            <div style="font-size: 15px; font-weight: 900; color: #fbbf24;">${metrics.pendingRelocationCount}</div>
          </div>
        </div>
      ` : `
        <div id="relocate-kpi-container" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="relocate-kpi-grid">
            <div class="relocate-kpi-box" style="border-left: 3px solid #94a3b8;">
              <div style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Expected Snapshot</div>
              <div class="relocate-kpi-val" style="color: #fff;">${metrics.expectedTotal}</div>
            </div>
            <div class="relocate-kpi-box" style="border-left: 3px solid #34d399; border-color: rgba(52, 211, 153, 0.3);">
              <div style="font-size: 10.5px; font-weight: 700; color: #34d399; text-transform: uppercase;">Scanned &amp; Verified</div>
              <div class="relocate-kpi-val" style="color: #34d399;">${metrics.scannedTotal}</div>
            </div>
            <div class="relocate-kpi-box" style="border-left: 3px solid #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
              <div style="font-size: 10.5px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Idle (Unscanned)</div>
              <div class="relocate-kpi-val" style="color: #38bdf8;">${metrics.idleCount}</div>
            </div>
            <div class="relocate-kpi-box" style="border-left: 3px solid #fbbf24; border-color: rgba(251, 191, 36, 0.3);">
              <div style="font-size: 10.5px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">Pending Relocate</div>
              <div class="relocate-kpi-val" style="color: #fbbf24;">${metrics.pendingRelocationCount}</div>
            </div>
          </div>

          <!-- Line Breakdown Progress Bars -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #fff;">Line Scan Progress:</span>
              <span style="font-size: 10.5px; color: var(--text-muted);">${metrics.lineBreakdown.length} Lines Targeted</span>
            </div>
            <div style="display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px;">
              ${metrics.lineBreakdown.map(lb => {
                const isFinished = lb.scanned >= lb.expected && lb.expected > 0;
                return `
                  <div style="flex-shrink: 0; min-width: 105px; background: rgba(0,0,0,0.25); border: 1px solid ${isFinished ? '#34d399' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 4px 8px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 700;">
                      <span style="color: ${isFinished ? '#34d399' : '#fff'};">${lb.lineName}</span>
                      <span style="color: ${isFinished ? '#34d399' : '#38bdf8'}; font-family: var(--font-mono); margin-left: 6px;">${lb.scanned} / ${lb.expected}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `}

      <!-- Primary Action Buttons (Desktop inline controls, hidden on mobile in favor of bottom dock) -->
      <div class="relocate-desktop-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button type="button" id="btn-open-camera-scanner" class="btn btn-primary" style="font-size: 14px; font-weight: 800; padding: 12px 18px; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1.5px solid #38bdf8; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);">
          <span style="font-size: 20px;">📷</span> Scan QR Code
        </button>
        <button type="button" id="btn-open-manual-search" class="btn btn-secondary" style="font-size: 14px; font-weight: 800; padding: 12px 18px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1.5px solid rgba(255,255,255,0.2);">
          <span style="font-size: 18px;">🔎</span> Manual Search
        </button>
      </div>

      <!-- Feed of Scanned Machines in Current Session -->
      <div class="relocate-scanned-feed-wrap" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); display: flex; flex-direction: column; flex: 1;">
        
        <!-- Filter & Search Toolbar (Sticky, Mobile Optimized) -->
        <div style="padding: 10px 12px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 13px; font-weight: 800; color: #fff;">
                Scanned Machines
              </span>
              <span style="background: #0284c7; color: #fff; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 12px; font-family: var(--font-mono);">
                ${totalCount}
              </span>
            </div>

            <button type="button" id="btn-feed-quick-scan" class="btn btn-primary btn-sm" style="font-size: 11.5px; font-weight: 800; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px; background: #0284c7; border: 1px solid #38bdf8;">
              📷 Scan Next
            </button>
          </div>

          <!-- Realtime Search Input -->
          <div style="position: relative;">
            <input 
              type="text" 
              id="inp-scanned-filter-query" 
              class="form-control" 
              placeholder="🔍 Search scanned by serial, name, or line..." 
              value="${scannedListSearch}"
              style="padding: 8px 32px 8px 12px; font-size: 13px; min-height: 38px; border-radius: 8px; background: #090d16; border-color: rgba(56,189,248,0.3); color: #fff;"
            />
            ${scannedListSearch ? `
              <button type="button" id="btn-clear-scanned-filter" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; padding: 4px;">✕</button>
            ` : ''}
          </div>

          <!-- Filter Pills -->
          <div style="display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px;">
            <button type="button" class="btn-scan-filter-pill ${scannedListFilter === 'ALL' ? 'active' : ''}" data-filter="ALL" style="flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; border: 1px solid ${scannedListFilter === 'ALL' ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; background: ${scannedListFilter === 'ALL' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${scannedListFilter === 'ALL' ? '#38bdf8' : '#cbd5e1'}; cursor: pointer;">
              All (${totalCount})
            </button>
            <button type="button" class="btn-scan-filter-pill ${scannedListFilter === 'CORRECT' ? 'active' : ''}" data-filter="CORRECT" style="flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; border: 1px solid ${scannedListFilter === 'CORRECT' ? '#34d399' : 'rgba(255,255,255,0.15)'}; background: ${scannedListFilter === 'CORRECT' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${scannedListFilter === 'CORRECT' ? '#34d399' : '#cbd5e1'}; cursor: pointer;">
              ✓ Verified (${verifiedCount})
            </button>
            <button type="button" class="btn-scan-filter-pill ${scannedListFilter === 'LINE_MISMATCH' ? 'active' : ''}" data-filter="LINE_MISMATCH" style="flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; border: 1px solid ${scannedListFilter === 'LINE_MISMATCH' ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; background: ${scannedListFilter === 'LINE_MISMATCH' ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${scannedListFilter === 'LINE_MISMATCH' ? '#38bdf8' : '#cbd5e1'}; cursor: pointer;">
              ⚠️ Line Move (${lineMoveCount})
            </button>
            ${floorMoveCount > 0 ? `
              <button type="button" class="btn-scan-filter-pill ${scannedListFilter === 'FLOOR_MISMATCH' ? 'active' : ''}" data-filter="FLOOR_MISMATCH" style="flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; border: 1px solid ${scannedListFilter === 'FLOOR_MISMATCH' ? '#fbbf24' : 'rgba(255,255,255,0.15)'}; background: ${scannedListFilter === 'FLOOR_MISMATCH' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)'}; color: ${scannedListFilter === 'FLOOR_MISMATCH' ? '#fbbf24' : '#cbd5e1'}; cursor: pointer;">
                ⏳ Inter-Floor (${floorMoveCount})
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Scanned Items List -->
        <div id="relocate-scanned-items-container" class="relocate-scanned-list">
          ${renderScannedItemsList(session)}
        </div>

      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 3. CONFIRMATION MODAL FOR SCANNED MACHINE (Mobile Bottom Sheet)
// ─────────────────────────────────────────────────────────────
function renderConfirmationModal() {
  if (!pendingScanMachine) return '';

  const session = relocateService.getActiveSession();
  if (!session) return '';

  const lines = masterDataService.getLines(session.floorId);
  const initialLineId = pendingScanMachine.lineId && lines.some(l => l.id === pendingScanMachine.lineId)
    ? pendingScanMachine.lineId
    : (lines[0]?.id || '');

  const evalResult = relocateService.evaluateLocation(session, pendingScanMachine, initialLineId);

  return `
    <div class="modal-overlay" id="modal-confirm-scan-overlay" style="z-index: 10040;">
      <div class="modal-dialog" style="max-width: 480px; width: 95%;">
        
        <!-- Drag Handle for Mobile Sheet Affordance -->
        <div style="width: 40px; height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; margin: 8px auto 0 auto;"></div>

        <div class="modal-header" style="padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>📋 Confirm Machine Verification</span>
          </div>
          <button type="button" id="btn-close-confirm-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; width: 36px; height: 36px; border-radius: 50%;">✕</button>
        </div>

        <form id="form-confirm-scan-machine" class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 14px 16px;">
          
          <!-- Machine Spec Summary Card -->
          <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px; font-family: var(--font-mono); font-weight: 900; color: #fff;">${pendingScanMachine.serialNumber}</span>
                <span style="font-size: 11px; font-family: var(--font-mono); font-weight: 800; background: rgba(56,189,248,0.15); border: 1px solid #38bdf8; border-radius: 4px; padding: 1px 6px; color: #38bdf8;" title="Permanent Unique Machine ID">
                  ${pendingScanMachine.permanentMachineId || pendingScanMachine.id}
                </span>
              </div>
              <span class="badge ${evalResult.badgeClass}" style="font-size: 11px;">${evalResult.icon} ${evalResult.label}</span>
            </div>
            <div style="font-size: 13.5px; font-weight: 700; color: #fff;">${pendingScanMachine.machineNameStr}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${pendingScanMachine.brandStr} &bull; ${pendingScanMachine.modelStr} &bull; Status: <strong style="color: #34d399;">${pendingScanMachine.status || 'ACTIVE'}</strong></div>
            <div style="font-size: 11.5px; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 4px; display: flex; justify-content: space-between;">
              <span>Registered Location: <strong style="color: #cbd5e1;">${pendingScanMachine.floorStr} / ${pendingScanMachine.lineStr}</strong></span>
              <span style="color: #38bdf8; font-weight: 700;">${pendingScanMachine.unitStr}</span>
            </div>
          </div>

          <!-- Physical Line Selection -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #38bdf8;">Physical Line Where Machine is Located: <span class="req">*</span></label>
            <select id="confirm-scanned-line" class="form-control" required style="font-weight: 700; font-size: 15px; min-height: 44px;">
              ${lines.map(l => `<option value="${l.id}" ${l.id === initialLineId ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>

          <!-- Needle Quantity Field (Mandatory per spec) -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #38bdf8;">Needle Quantity: <span style="font-weight: normal; color: var(--text-muted);">(if applicable)</span></label>
            <input type="number" id="confirm-needle-quantity" class="form-control" placeholder="e.g. 1, 2, 4" min="0" value="${pendingScanMachine.needleQuantity || ''}" style="font-size: 16px; min-height: 44px;" />
          </div>

          <!-- Remarks -->
          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: var(--text-muted);">Verification Remarks (Optional):</label>
            <input type="text" id="confirm-scan-remarks" class="form-control" placeholder="e.g. In working condition, needle threader aligned" style="font-size: 15px;" />
          </div>

          <!-- Location Alert Notice -->
          <div id="confirm-location-alert" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 8px 12px; font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
            ${evalResult.description}
          </div>

          <!-- Bottom Action Buttons -->
          <div class="modal-footer" style="padding: 0; margin-top: 6px; display: flex; gap: 8px;">
            <button type="button" id="btn-cancel-confirm-scan" class="btn btn-secondary" style="flex: 1; min-height: 44px; font-weight: 700;">Cancel</button>
            <button type="submit" id="btn-submit-confirm-scan" class="btn btn-primary" style="flex: 2; min-height: 44px; font-weight: 800; font-size: 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8;">
              ✓ Confirm &amp; Add Machine
            </button>
          </div>

        </form>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 3b. EDIT SCANNED MACHINE MODAL (Mobile Bottom Sheet)
// ─────────────────────────────────────────────────────────────
function renderEditScanModal(session) {
  if (!editingScanItem || !session) return '';

  const lines = masterDataService.getLines(session.floorId);
  const currentTargetLineId = editingScanItem.scannedLineId || '';

  return `
    <div class="modal-overlay" id="modal-edit-scan-overlay" style="z-index: 10045;">
      <div class="modal-dialog" style="max-width: 480px; width: 95%;">
        
        <!-- Drag Handle for Mobile Sheet Affordance -->
        <div style="width: 40px; height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; margin: 8px auto 0 auto;"></div>

        <div class="modal-header" style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>✏️ Edit Scanned Machine</span>
          </div>
          <button type="button" id="btn-close-edit-scan-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; width: 36px; height: 36px; border-radius: 50%;">✕</button>
        </div>

        <form id="form-edit-scan-machine" class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 14px 16px;">
          
          <!-- Machine Header Info -->
          <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(56,189,248,0.25); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-family: var(--font-mono); font-size: 16px; font-weight: 900; color: #38bdf8;">${editingScanItem.serialNumber}</span>
              <span class="badge ${editingScanItem.evalResult?.badgeClass || 'badge-idle'}" style="font-size: 10px;">${editingScanItem.evalResult?.label || editingScanItem.matchType}</span>
            </div>
            <div style="font-size: 13.5px; font-weight: 700; color: #fff;">${editingScanItem.machineNameStr}</div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">${editingScanItem.brandStr || ''} &bull; ${editingScanItem.modelStr || ''}</div>
            <div style="font-size: 11px; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 4px; margin-top: 2px;">
              Original Location: <strong style="color: #cbd5e1;">${editingScanItem.previousFloorStr} / ${editingScanItem.previousLineStr}</strong>
            </div>
          </div>

          <!-- Target Line Dropdown -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #38bdf8;">Assigned Physical Line: <span class="req">*</span></label>
            <select id="edit-scanned-line" class="form-control" required style="font-weight: 700; font-size: 15px; min-height: 44px;">
              ${lines.map(l => `<option value="${l.id}" ${l.id === currentTargetLineId ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>

          <!-- Needle Quantity -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #38bdf8;">Needle Quantity:</label>
            <input type="number" id="edit-needle-quantity" class="form-control" min="0" value="${editingScanItem.needleQuantity || ''}" placeholder="e.g. 1, 2, 4" style="font-size: 16px; min-height: 44px;" />
          </div>

          <!-- Remarks -->
          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: var(--text-muted);">Remarks / Verification Notes:</label>
            <input type="text" id="edit-scan-remarks" class="form-control" value="${editingScanItem.remarks || ''}" placeholder="e.g. Needle threader aligned, Line re-allocated" style="font-size: 15px;" />
          </div>

          <!-- Footer Actions -->
          <div class="modal-footer" style="padding: 0; margin-top: 6px; display: flex; gap: 8px;">
            <button type="button" id="btn-cancel-edit-scan" class="btn btn-secondary" style="flex: 1; min-height: 44px; font-weight: 700;">Cancel</button>
            <button type="submit" id="btn-submit-edit-scan" class="btn btn-primary" style="flex: 2; min-height: 44px; font-weight: 800; font-size: 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8;">
              💾 Save Changes
            </button>
          </div>

        </form>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 4. MANUAL SEARCH MODAL (Mobile Bottom Sheet)
// ─────────────────────────────────────────────────────────────
function renderManualSearchModal() {
  if (!manualSearchModalOpen) return '';

  return `
    <div class="modal-overlay" id="modal-manual-search-overlay" style="z-index: 10030;">
      <div class="modal-dialog" style="max-width: 520px; width: 95%; max-height: 85vh; display: flex; flex-direction: column;">
        
        <div style="width: 40px; height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; margin: 8px auto 0 auto;"></div>

        <div class="modal-header" style="padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🔎 Manual Machine Search</span>
          </div>
          <button type="button" id="btn-close-manual-search-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; width: 36px; height: 36px; border-radius: 50%;">✕</button>
        </div>

        <div class="modal-body" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto;">
          <div class="form-group">
            <input
              type="text"
              id="inp-manual-search-query"
              class="form-control"
              placeholder="Search Serial, Machine Name, Model (e.g. JA-01)..."
              autofocus
              style="font-size: 16px; min-height: 46px; padding: 10px 14px; font-weight: 700; color: #38bdf8;"
            />
          </div>

          <!-- Search Results List -->
          <div id="manual-search-results-list" style="display: flex; flex-direction: column; gap: 6px; min-height: 180px; max-height: 380px; overflow-y: auto;">
            <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 12px;">
              Type a Serial Number or Machine Name above to search inventory.
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 5. RECONCILIATION & FINALIZATION MODAL (Mobile Bottom Sheet)
// ─────────────────────────────────────────────────────────────
function renderReconciliationModal(session) {
  if (!completeModalOpen || !session) return '';

  const metrics = relocateService.getReconciliationMetrics(session);

  return `
    <div class="modal-overlay" id="modal-reconciliation-overlay" style="z-index: 10060;">
      <div class="modal-dialog" style="max-width: 540px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
        
        <div style="width: 40px; height: 4px; background: rgba(255,255,255,0.25); border-radius: 2px; margin: 8px auto 0 auto;"></div>

        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 16px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🏁 Reconcile &amp; Complete Session</span>
          </div>
          <button type="button" id="btn-close-reconciliation-modal" class="btn btn-ghost btn-sm" style="font-size: 16px; width: 36px; height: 36px; border-radius: 50%;">✕</button>
        </div>

        <div class="modal-body" style="padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
          
          <div style="background: rgba(14, 165, 233, 0.08); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #e2e8f0; line-height: 1.4;">
            Completing this session updates physical locations and classifies unscanned machines on this floor as <strong>IDLE</strong>.
          </div>

          <!-- Summary Metric 2x2 Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; border-left: 3px solid #94a3b8;">
              <div style="font-size: 10.5px; color: var(--text-muted);">Snapshot Total</div>
              <div style="font-size: 18px; font-weight: 800; color: #fff;">${metrics.expectedTotal}</div>
            </div>
            <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; border-left: 3px solid #34d399;">
              <div style="font-size: 10.5px; color: #34d399;">Scanned &amp; Verified</div>
              <div style="font-size: 18px; font-weight: 800; color: #34d399;">${metrics.verifiedCount}</div>
            </div>
            <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; border-left: 3px solid #38bdf8;">
              <div style="font-size: 10.5px; color: #38bdf8;">Line Move (Same Floor)</div>
              <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">${metrics.lineRelocationCount}</div>
            </div>
            <div style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; border-left: 3px solid #fbbf24;">
              <div style="font-size: 10.5px; color: #fbbf24;">Inter-Floor Approvals</div>
              <div style="font-size: 18px; font-weight: 800; color: #fbbf24;">${metrics.pendingRelocationCount}</div>
            </div>
          </div>

          <!-- Automated Idle Action Banner -->
          <div style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 16px;">💤</span>
              <strong style="color: #f87171; font-size: 13px;">${metrics.idleCount} Machines Auto-Classified as IDLE</strong>
            </div>
            <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
              These ${metrics.idleCount} machines were registered on this floor but were not scanned in running lines. They will automatically be marked <strong>IDLE</strong>.
            </div>
          </div>

          <!-- Final Notes -->
          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: var(--text-muted);">Session Notes / Sign-off (Optional):</label>
            <input type="text" id="final-reconciliation-notes" class="form-control" placeholder="e.g. Audit verified by supervisor" style="font-size: 15px;" />
          </div>

          <div class="modal-footer" style="padding: 0; display: flex; gap: 8px; margin-top: 4px;">
            <button type="button" id="btn-cancel-reconciliation" class="btn btn-secondary" style="flex: 1; min-height: 44px; font-weight: 700;">Back</button>
            <button type="button" id="btn-confirm-complete-session" class="btn btn-primary" style="flex: 2; min-height: 44px; background: #059669; border-color: #34d399; font-weight: 800; font-size: 13.5px;">
              ✓ Finalize &amp; Reconcile
            </button>
          </div>

        </div>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 6. IDLE MACHINES TAB
// ─────────────────────────────────────────────────────────────
function renderIdleMachinesTab(idleMachines) {
  return `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
      
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
        <div>
          <h2 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
            💤 Factory Idle Machines (${idleMachines.length})
          </h2>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
            Machines on standby, awaiting line allocation, or unlocated in active lines
          </div>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
        ${idleMachines.length === 0 ? `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            No idle machines recorded in system.
          </div>
        ` : idleMachines.map(m => `
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 13.5px;">${m.serialNumber}</span>
                <span style="font-size: 12.5px; font-weight: 700; color: #fff;">${m.machineNameStr}</span>
                <span style="font-size: 11px; color: var(--text-secondary);">${m.brandStr} / ${m.modelStr}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px; display: flex; gap: 10px; flex-wrap: wrap;">
                <span>Location: <strong style="color: #cbd5e1;">${m.floorStr} / ${m.lineStr}</strong></span>
                <span>Last Verified: <strong style="color: #38bdf8;">${m.lastVerifiedDate ? new Date(m.lastVerifiedDate).toLocaleDateString() : 'Never'}</strong></span>
                ${m.remarks ? `<span>Note: <em>${m.remarks}</em></span>` : ''}
              </div>
            </div>
            <div>
              <span class="badge badge-idle" style="font-size: 10.5px; font-weight: 800;">IDLE</span>
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 7. PENDING APPROVALS TAB
// ─────────────────────────────────────────────────────────────
function renderApprovalsTab(pendingApprovals) {
  const canApprove = authService.isSuperAdmin() || 
                     authService.isAdmin() || 
                     authService.hasAccess('relocate', 'APPROVE') || 
                     authService.hasPermission('relocate', 'APPROVE') || 
                     authService.hasPermission('RELOCATE_APPROVE') ||
                     authService.hasAccess('transfers', 'APPROVE');

  return `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
      
      <div>
        <h2 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
          ⏳ Inter-Floor Relocation Approvals (${pendingApprovals.length})
        </h2>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
          Machines scanned on a different floor requiring management authorization
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
        ${pendingApprovals.length === 0 ? `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            No pending inter-floor relocation approvals.
          </div>
        ` : pendingApprovals.map(a => {
    const prevFlr = masterDataService.getFloorById(a.previousFloorId);
    const prevLin = masterDataService.getLineById(a.previousLineId);
    const destFlr = masterDataService.getFloorById(a.destFloorId);
    const destLin = masterDataService.getLineById(a.destLineId);

    return `
            <div style="background: var(--bg-surface); border: 1.5px solid rgba(251, 191, 36, 0.4); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div style="flex: 1; min-width: 240px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span style="font-family: var(--font-mono); font-weight: 900; color: #38bdf8; font-size: 14px;">${a.serialNumber}</span>
                  <span style="font-size: 13px; font-weight: 700; color: #fff;">${a.machineNameStr}</span>
                  <span style="font-size: 11px; color: var(--text-secondary);">${a.brandStr} / ${a.modelStr}</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px; font-size: 11.5px; flex-wrap: wrap;">
                  <span style="color: #f87171;">Previous: <strong>${prevFlr?.name || a.previousFloorId} / ${prevLin?.name || a.previousLineId}</strong></span>
                  <span>&rarr;</span>
                  <span style="color: #34d399;">Destination: <strong>${destFlr?.name || a.destFloorId} / ${destLin?.name || a.destLineId}</strong></span>
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">
                  Session: <strong>${a.sessionId}</strong> &bull; Requested by: <strong>${a.requestedBy}</strong> on ${new Date(a.requestedAt).toLocaleDateString()}
                </div>
              </div>

              ${canApprove ? `
                <div style="display: flex; gap: 6px; width: 100%; justify-content: flex-end;">
                  <button type="button" class="btn btn-danger btn-sm btn-reject-relocation" data-id="${a.id}" style="min-height: 38px; font-size: 11.5px; padding: 6px 14px; flex: 1;">
                    ✕ Reject
                  </button>
                  <button type="button" class="btn btn-primary btn-sm btn-approve-relocation" data-id="${a.id}" style="min-height: 38px; font-size: 11.5px; padding: 6px 16px; background: #059669; border-color: #34d399; flex: 1;">
                    ✓ Approve Move
                  </button>
                </div>
              ` : `
                <span class="badge badge-idle">Pending Admin Review</span>
              `}
            </div>
          `;
  }).join('')}
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 8. RELOCATION HISTORY TAB & EXPORT HELPERS
// ─────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEnrichedRelocationHistory() {
  const rawList = relocateService.getRelocationHistory() || [];
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const machineMap = new Map();
  allMachines.forEach(m => {
    if (!m) return;
    if (m.id) machineMap.set(String(m.id).toLowerCase(), m);
    if (m.serialNumber) machineMap.set(String(m.serialNumber).trim().toLowerCase(), m);
  });

  return rawList.map(h => {
    const machKey = String(h.machineId || '').toLowerCase();
    const snKey = String(h.serialNumber || '').trim().toLowerCase();
    const m = machineMap.get(machKey) || (snKey ? machineMap.get(snKey) : null);
    
    const mName = m?.machineNameStr || (m?.machineNameId ? masterDataService.getMachineNameById(m.machineNameId)?.name : null) || m?.machineName || 'Machine';
    const mBrand = m?.brandStr || (m?.brandId ? masterDataService.getBrandById(m.brandId)?.name : null) || m?.brand || '';
    const mModel = m?.modelStr || (m?.modelId ? masterDataService.getModelById(m.modelId)?.name : null) || m?.model || '';

    const prevFlr = masterDataService.getFloorById(h.previousFloorId)?.name || h.previousFloorId || '—';
    const prevLin = masterDataService.getLineById(h.previousLineId)?.name || h.previousLineId || '—';
    const newFlr = masterDataService.getFloorById(h.newFloorId)?.name || h.newFloorId || '—';
    const newLin = masterDataService.getLineById(h.newLineId)?.name || h.newLineId || '—';

    return {
      ...h,
      machineName: mName,
      machineBrand: mBrand,
      machineModel: mModel,
      prevFloorName: prevFlr,
      prevLineName: prevLin,
      newFloorName: newFlr,
      newLineName: newLin
    };
  });
}

function exportMovementsToExcel(movements) {
  if (typeof XLSX === 'undefined') {
    notificationService.notifyError('Export Failed', 'Excel export library (XLSX) is not loaded.');
    return;
  }

  const rows = [
    ['#', 'Date', 'Time', 'Serial Number', 'Machine Name', 'Brand', 'Model', 'From Floor', 'From Line', 'To Floor', 'To Line', 'Move Type', 'Approval Status', 'Approved / Action By', 'Session Ref', 'Notes']
  ];

  movements.forEach((h, idx) => {
    const dt = new Date(h.date || Date.now());
    const dateStr = dt.toLocaleDateString('en-GB');
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    rows.push([
      idx + 1,
      dateStr,
      timeStr,
      h.serialNumber || '',
      h.machineName || '',
      h.machineBrand || '',
      h.machineModel || '',
      h.prevFloorName || '',
      h.prevLineName || '',
      h.newFloorName || '',
      h.newLineName || '',
      h.approvalType || '',
      h.status || '',
      h.approvedBy || '',
      h.sessionId || '',
      h.notes || ''
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 13 }, { wch: 10 }, { wch: 14 }, { wch: 25 },
    { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 14 }, { wch: 22 }, { wch: 15 }, { wch: 24 }, { wch: 20 },
    { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Relocation Movements');
  const fileName = `Machine_Relocation_History_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
  notificationService.notifySuccess('Excel Exported', `Downloaded ${fileName} (${movements.length} records)`);
}

function exportSessionsToExcel(sessions) {
  if (typeof XLSX === 'undefined') {
    notificationService.notifyError('Export Failed', 'Excel export library (XLSX) is not loaded.');
    return;
  }

  const sessionRows = [
    ['Session ID', 'Floor', 'Lines Covered', 'Started At', 'Completed At', 'Auditor / Conducted By', 'Status', 'Snapshot Expected', 'Machines Scanned', 'Notes']
  ];

  const scannedRows = [
    ['Session ID', 'Floor', 'Scan Time', 'Serial Number', 'Machine Name', 'Brand', 'Model', 'Original Floor', 'Original Line', 'Scanned Line', 'Result Status', 'Remarks']
  ];

  sessions.forEach(s => {
    const flr = masterDataService.getFloorById(s.floorId);
    const floorName = flr?.name || s.floorId || '';
    const linesStr = s.isFullFloor || s.lineIds === 'ALL' ? 'Entire Floor' : (Array.isArray(s.lineIds) ? s.lineIds.join(', ') : s.lineIds);

    sessionRows.push([
      s.id,
      floorName,
      linesStr,
      s.startedAt ? new Date(s.startedAt).toLocaleString() : '',
      s.completedAt ? new Date(s.completedAt).toLocaleString() : '',
      s.startedBy || '',
      s.status || '',
      s.snapshotTotal ?? (s.snapshot?.length || 0),
      (s.scanned || []).length,
      s.notes || ''
    ]);

    (s.scanned || []).forEach(item => {
      scannedRows.push([
        s.id,
        floorName,
        item.scannedAt ? new Date(item.scannedAt).toLocaleString() : '',
        item.serialNumber || '',
        item.machineNameStr || '',
        item.brandStr || '',
        item.modelStr || '',
        item.previousFloorStr || '',
        item.previousLineStr || '',
        masterDataService.getLineById(item.scannedLineId)?.name || item.scannedLineId || '',
        item.matchType || '',
        item.remarks || ''
      ]);
    });
  });

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(sessionRows);
  ws1['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Sessions Summary');

  const ws2 = XLSX.utils.aoa_to_sheet(scannedRows);
  ws2['!cols'] = [
    { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 24 },
    { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 18 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'All Scanned Machines');

  const fileName = `Verification_Sessions_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
  notificationService.notifySuccess('Excel Exported', `Downloaded ${fileName} (${sessions.length} sessions)`);
}

function exportSingleSessionToExcel(session) {
  if (typeof XLSX === 'undefined') {
    notificationService.notifyError('Export Failed', 'Excel export library (XLSX) is not loaded.');
    return;
  }
  const flr = masterDataService.getFloorById(session.floorId);
  const rows = [
    ['#', 'Serial Number', 'Machine Name', 'Brand', 'Model', 'Original Floor', 'Original Line', 'Scanned Floor', 'Scanned Line', 'Verification Status', 'Needle Qty', 'Remarks', 'Scan Timestamp']
  ];

  (session.scanned || []).forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.serialNumber || '',
      item.machineNameStr || '',
      item.brandStr || '',
      item.modelStr || '',
      item.previousFloorStr || item.previousFloorId || '',
      item.previousLineStr || item.previousLineId || '',
      flr?.name || session.floorId || '',
      masterDataService.getLineById(item.scannedLineId)?.name || item.scannedLineId || '',
      item.matchType || '',
      item.needleQuantity || '',
      item.remarks || '',
      item.scannedAt ? new Date(item.scannedAt).toLocaleString() : ''
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 12 }, { wch: 25 }, { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Scanned Machines');
  const fileName = `Session_${session.id}_Scanned_Machines.xlsx`;
  XLSX.writeFile(wb, fileName);
  notificationService.notifySuccess('Session Exported', `Downloaded ${fileName}`);
}

function renderHistoryTab(allSessions) {
  const enrichedHistory = getEnrichedRelocationHistory();
  const sessions = allSessions || [];

  // Metrics
  const totalMoves = enrichedHistory.length;
  const approvedMoves = enrichedHistory.filter(h => h.status === 'APPROVED').length;
  const rejectedMoves = enrichedHistory.filter(h => h.status === 'REJECTED').length;
  const interFloorMoves = enrichedHistory.filter(h => String(h.approvalType || '').toUpperCase().includes('INTER_FLOOR')).length;
  const sameFloorMoves = enrichedHistory.filter(h => String(h.approvalType || '').toUpperCase().includes('SAME_FLOOR')).length;

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;
  const inProgressSessions = sessions.filter(s => s.status === 'IN_PROGRESS').length;
  const cancelledSessions = sessions.filter(s => s.status === 'CANCELLED').length;

  // Filtered movements
  let filteredMovements = enrichedHistory;
  if (historyFilter === 'APPROVED') {
    filteredMovements = filteredMovements.filter(h => h.status === 'APPROVED');
  } else if (historyFilter === 'REJECTED') {
    filteredMovements = filteredMovements.filter(h => h.status === 'REJECTED');
  } else if (historyFilter === 'INTER_FLOOR') {
    filteredMovements = filteredMovements.filter(h => String(h.approvalType || '').toUpperCase().includes('INTER_FLOOR'));
  } else if (historyFilter === 'SAME_FLOOR') {
    filteredMovements = filteredMovements.filter(h => String(h.approvalType || '').toUpperCase().includes('SAME_FLOOR'));
  }

  if (historySearch) {
    const q = historySearch.toLowerCase().trim();
    filteredMovements = filteredMovements.filter(h =>
      String(h.serialNumber || '').toLowerCase().includes(q) ||
      String(h.machineName || '').toLowerCase().includes(q) ||
      String(h.machineBrand || '').toLowerCase().includes(q) ||
      String(h.machineModel || '').toLowerCase().includes(q) ||
      String(h.prevFloorName || '').toLowerCase().includes(q) ||
      String(h.prevLineName || '').toLowerCase().includes(q) ||
      String(h.newFloorName || '').toLowerCase().includes(q) ||
      String(h.newLineName || '').toLowerCase().includes(q) ||
      String(h.approvedBy || '').toLowerCase().includes(q) ||
      String(h.sessionId || '').toLowerCase().includes(q) ||
      String(h.notes || '').toLowerCase().includes(q)
    );
  }

  // Filtered sessions
  let filteredSessions = sessions;
  if (historyFilter === 'COMPLETED') {
    filteredSessions = filteredSessions.filter(s => s.status === 'COMPLETED');
  } else if (historyFilter === 'IN_PROGRESS') {
    filteredSessions = filteredSessions.filter(s => s.status === 'IN_PROGRESS');
  } else if (historyFilter === 'CANCELLED') {
    filteredSessions = filteredSessions.filter(s => s.status === 'CANCELLED');
  }

  if (historySearch) {
    const q = historySearch.toLowerCase().trim();
    filteredSessions = filteredSessions.filter(s => {
      const flr = masterDataService.getFloorById(s.floorId);
      return (
        String(s.id || '').toLowerCase().includes(q) ||
        String(flr?.name || s.floorId || '').toLowerCase().includes(q) ||
        String(s.startedBy || '').toLowerCase().includes(q) ||
        String(s.notes || '').toLowerCase().includes(q)
      );
    });
  }

  return `
    <div class="relocate-history-container">
      
      <!-- Top Title Bar -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>📜</span> Physical Verification &amp; Relocation Audit History
            </h2>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px;">
              Enterprise audit ledger for physical verification scans, line relocations, and inter-floor transfer approvals
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-export-history-excel" class="btn-history-export" title="Download Excel audit report for current view">
              <span>📊</span> Export to Excel
            </button>
          </div>
        </div>

        <!-- 4 Top KPI Stat Metric Cards -->
        <div class="relocate-history-kpis-grid">
          
          <div class="relocate-history-kpi-card" style="border-left: 3.5px solid #38bdf8;">
            <div class="relocate-history-kpi-header">
              <span class="relocate-history-kpi-title">TOTAL RELOCATIONS</span>
              <span class="relocate-history-kpi-icon" style="color: #38bdf8;">🚚</span>
            </div>
            <div class="relocate-history-kpi-val" style="color: #38bdf8;">${totalMoves}</div>
            <div class="relocate-history-kpi-sub">Across all factory lines &amp; floors</div>
          </div>

          <div class="relocate-history-kpi-card" style="border-left: 3.5px solid #10b981;">
            <div class="relocate-history-kpi-header">
              <span class="relocate-history-kpi-title">APPROVED MOVES</span>
              <span class="relocate-history-kpi-icon" style="color: #10b981;">✓</span>
            </div>
            <div class="relocate-history-kpi-val" style="color: #34d399;">${approvedMoves}</div>
            <div class="relocate-history-kpi-sub">${totalMoves > 0 ? Math.round((approvedMoves / totalMoves) * 100) : 0}% successful approval rate</div>
          </div>

          <div class="relocate-history-kpi-card" style="border-left: 3.5px solid #f43f5e;">
            <div class="relocate-history-kpi-header">
              <span class="relocate-history-kpi-title">REJECTED MOVES</span>
              <span class="relocate-history-kpi-icon" style="color: #f43f5e;">✕</span>
            </div>
            <div class="relocate-history-kpi-val" style="color: #fb7185;">${rejectedMoves}</div>
            <div class="relocate-history-kpi-sub">Location preserved at origin</div>
          </div>

          <div class="relocate-history-kpi-card" style="border-left: 3.5px solid #a855f7;">
            <div class="relocate-history-kpi-header">
              <span class="relocate-history-kpi-title">AUDIT SESSIONS</span>
              <span class="relocate-history-kpi-icon" style="color: #a855f7;">📋</span>
            </div>
            <div class="relocate-history-kpi-val" style="color: #c084fc;">${totalSessions}</div>
            <div class="relocate-history-kpi-sub">${completedSessions} completed physical audits</div>
          </div>

        </div>
      </div>

      <!-- Main Ledger Card with Sub-Tabs -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0;">
        
        <!-- Sub-Tabs Switcher & Export -->
        <div class="relocate-history-subtabs-bar">
          <div class="relocate-history-subtabs-btns">
            <button type="button" class="btn-history-subtab ${historySubTab === 'movements' ? 'active' : ''}" data-subtab="movements">
              <span>🚚</span> Machine Movement Logs
              <span class="history-subtab-count">${totalMoves}</span>
            </button>
            <button type="button" class="btn-history-subtab ${historySubTab === 'sessions' ? 'active' : ''}" data-subtab="sessions">
              <span>📋</span> Verification Sessions
              <span class="history-subtab-count">${totalSessions}</span>
            </button>
          </div>
        </div>

        <!-- Search & Filter Pills Row -->
        <div class="relocate-history-controls-row">
          
          <!-- Live Search Box -->
          <div class="relocate-history-search-wrap">
            <span class="relocate-history-search-icon">🔍</span>
            <input type="text" id="inp-history-search" class="relocate-history-search-input"
              placeholder="${historySubTab === 'movements' ? 'Search by serial, machine, floor, line, approver...' : 'Search by session code, floor name, auditor, notes...'}"
              value="${escapeHtml(historySearch)}" />
            ${historySearch ? `
              <button type="button" id="btn-clear-history-search" class="relocate-history-clear-btn" title="Clear search">✕</button>
            ` : ''}
          </div>

          <!-- Dynamic Filter Pills -->
          <div class="relocate-history-pills-wrap">
            ${historySubTab === 'movements' ? `
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
                All (${totalMoves})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'APPROVED' ? 'active' : ''}" data-filter="APPROVED">
                ✓ Approved (${approvedMoves})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'REJECTED' ? 'active' : ''}" data-filter="REJECTED">
                ✕ Rejected (${rejectedMoves})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'INTER_FLOOR' ? 'active' : ''}" data-filter="INTER_FLOOR">
                🏢 Inter-Floor (${interFloorMoves})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'SAME_FLOOR' ? 'active' : ''}" data-filter="SAME_FLOOR">
                🔄 Same-Floor (${sameFloorMoves})
              </button>
            ` : `
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
                All (${totalSessions})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'COMPLETED' ? 'active' : ''}" data-filter="COMPLETED">
                ✓ Completed (${completedSessions})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'IN_PROGRESS' ? 'active' : ''}" data-filter="IN_PROGRESS">
                ⏳ In Progress (${inProgressSessions})
              </button>
              <button type="button" class="btn-history-filter-pill ${historyFilter === 'CANCELLED' ? 'active' : ''}" data-filter="CANCELLED">
                ✕ Cancelled (${cancelledSessions})
              </button>
            `}
          </div>

        </div>

        <!-- ─────────────────────────────────────────────── -->
        <!-- SUB-TAB 1: MACHINE MOVEMENT LOGS -->
        <!-- ─────────────────────────────────────────────── -->
        ${historySubTab === 'movements' ? `
          
          ${filteredMovements.length === 0 ? `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.15); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; margin-top: 10px;">
              <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
              <div style="font-size: 14px; font-weight: 700; color: #fff;">No machine relocation records found</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
                ${historySearch ? `No records matched "${escapeHtml(historySearch)}". Click ✕ to clear search.` : 'No relocation records match the active filter criteria.'}
              </div>
            </div>
          ` : `

            <!-- Desktop Modern Table View -->
            <div class="relocate-history-table-desktop" style="overflow-x: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; background: rgba(0,0,0,0.2);">
              <table class="table" style="width: 100%; margin: 0; font-size: 12px; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.03); border-bottom: 1.5px solid rgba(255,255,255,0.1);">
                    <th style="padding: 10px 12px; text-align: left; width: 12%;">Date &amp; Time</th>
                    <th style="padding: 10px 12px; text-align: left; width: 16%;">Machine</th>
                    <th style="padding: 10px 12px; text-align: left; width: 28%;">Relocation Route</th>
                    <th style="padding: 10px 12px; text-align: left; width: 14%;">Move Type</th>
                    <th style="padding: 10px 12px; text-align: center; width: 10%;">Status</th>
                    <th style="padding: 10px 12px; text-align: left; width: 12%;">Authorized By</th>
                    <th style="padding: 10px 12px; text-align: left; width: 8%;">Session</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredMovements.map(h => {
                    const dt = new Date(h.date || Date.now());
                    const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const isInterFloor = String(h.approvalType || '').toUpperCase().includes('INTER_FLOOR');
                    const isApproved = h.status === 'APPROVED';

                    const typeBadge = isInterFloor
                      ? `<span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10.5px; font-weight: 700;">🏢 Inter-Floor</span>`
                      : `<span class="badge" style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 10.5px; font-weight: 700;">🔄 Same-Floor</span>`;

                    const statusBadge = isApproved
                      ? `<span class="badge badge-active" style="font-size: 10px; font-weight: 800; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px;">✓ APPROVED</span>`
                      : `<span class="badge badge-danger" style="font-size: 10px; font-weight: 800; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px;">✕ REJECTED</span>`;

                    return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s ease;">
                        
                        <!-- Date & Time -->
                        <td style="padding: 10px 12px; white-space: nowrap;">
                          <div style="font-weight: 600; color: #fff;">${dateStr}</div>
                          <div style="font-size: 10.5px; color: var(--text-muted); font-family: var(--font-mono);">${timeStr}</div>
                        </td>

                        <!-- Machine Details -->
                        <td style="padding: 10px 12px;">
                          <div style="margin-bottom: 2px;">
                            <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 11.5px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 6px; border-radius: 4px; display: inline-block;">
                              ${h.serialNumber}
                            </span>
                          </div>
                          <div style="font-weight: 600; color: #e2e8f0; font-size: 11.5px; line-height: 1.2;">
                            ${h.machineName}
                          </div>
                          ${h.machineBrand || h.machineModel ? `
                            <div style="font-size: 10.5px; color: var(--text-secondary); margin-top: 1px;">
                              ${h.machineBrand} ${h.machineModel ? `&bull; ${h.machineModel}` : ''}
                            </div>
                          ` : ''}
                        </td>

                        <!-- Relocation Route -->
                        <td style="padding: 10px 12px;">
                          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;">
                            <!-- Origin -->
                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 4px 8px; font-size: 11px; white-space: nowrap; flex: 1;">
                              <div style="font-size: 9px; color: var(--text-muted); text-transform: uppercase;">Origin</div>
                              <div style="font-weight: 600; color: #cbd5e1;">${h.prevFloorName}</div>
                              <div style="font-size: 10px; color: #94a3b8;">Line: <strong>${h.prevLineName}</strong></div>
                            </div>
                            <!-- Transfer Arrow -->
                            <div style="color: ${isApproved ? '#34d399' : '#f43f5e'}; font-size: 14px; font-weight: 900; padding: 0 2px;">
                              ${isApproved ? '➔' : '✕'}
                            </div>
                            <!-- Destination -->
                            <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; padding: 4px 8px; font-size: 11px; white-space: nowrap; flex: 1;">
                              <div style="font-size: 9px; color: #38bdf8; text-transform: uppercase;">Destination</div>
                              <div style="font-weight: 700; color: #38bdf8;">${h.newFloorName}</div>
                              <div style="font-size: 10px; color: #7dd3fc;">Line: <strong>${h.newLineName}</strong></div>
                            </div>
                          </div>
                          ${h.notes ? `
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; font-style: italic;">
                              Note: ${escapeHtml(h.notes)}
                            </div>
                          ` : ''}
                        </td>

                        <!-- Move Type -->
                        <td style="padding: 10px 12px;">
                          ${typeBadge}
                        </td>

                        <!-- Status Badge -->
                        <td style="padding: 10px 12px; text-align: center;">
                          ${statusBadge}
                        </td>

                        <!-- Authorized By -->
                        <td style="padding: 10px 12px;">
                          <div style="font-weight: 600; color: #e2e8f0; font-size: 11.5px;">${h.approvedBy || 'Admin'}</div>
                        </td>

                        <!-- Session Code -->
                        <td style="padding: 10px 12px; font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted);">
                          ${h.sessionId ? `#${h.sessionId}` : 'Manual'}
                        </td>

                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Responsive Card Feed -->
            <div class="relocate-history-feed-mobile">
              ${filteredMovements.map(h => {
                const dt = new Date(h.date || Date.now());
                const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const isInterFloor = String(h.approvalType || '').toUpperCase().includes('INTER_FLOOR');
                const isApproved = h.status === 'APPROVED';

                const typeBadge = isInterFloor
                  ? `<span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10px; font-weight: 700;">🏢 Inter-Floor</span>`
                  : `<span class="badge" style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 10px; font-weight: 700;">🔄 Same-Floor</span>`;

                return `
                  <div class="relocate-history-card-item" style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 13px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 8px; border-radius: 4px;">
                        SN: ${h.serialNumber}
                      </span>
                      <span class="badge ${isApproved ? 'badge-active' : 'badge-danger'}" style="font-size: 10px; font-weight: 800;">
                        ${isApproved ? '✓ APPROVED' : '✕ REJECTED'}
                      </span>
                    </div>

                    <div>
                      <div style="font-weight: 700; color: #fff; font-size: 12.5px;">${h.machineName}</div>
                      ${h.machineBrand || h.machineModel ? `
                        <div style="font-size: 11px; color: var(--text-secondary);">${h.machineBrand} &bull; ${h.machineModel}</div>
                      ` : ''}
                    </div>

                    <!-- Route Box -->
                    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                      <div style="flex: 1;">
                        <div style="font-size: 9px; color: var(--text-muted); text-transform: uppercase;">Origin</div>
                        <div style="font-size: 11px; font-weight: 600; color: #cbd5e1;">${h.prevFloorName}</div>
                        <div style="font-size: 10px; color: #94a3b8;">Line: ${h.prevLineName}</div>
                      </div>
                      <div style="font-size: 16px; font-weight: 900; color: ${isApproved ? '#34d399' : '#f43f5e'};">
                        ${isApproved ? '➔' : '✕'}
                      </div>
                      <div style="flex: 1; text-align: right;">
                        <div style="font-size: 9px; color: #38bdf8; text-transform: uppercase;">Destination</div>
                        <div style="font-size: 11px; font-weight: 700; color: #38bdf8;">${h.newFloorName}</div>
                        <div style="font-size: 10px; color: #7dd3fc;">Line: ${h.newLineName}</div>
                      </div>
                    </div>

                    ${h.notes ? `
                      <div style="font-size: 10.5px; color: var(--text-muted); font-style: italic; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">
                        Note: ${escapeHtml(h.notes)}
                      </div>
                    ` : ''}

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-secondary); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 2px;">
                      <div>${typeBadge}</div>
                      <div style="font-family: var(--font-mono); font-size: 10.5px;">${dateStr} &bull; ${timeStr}</div>
                    </div>

                    <div style="font-size: 10.5px; color: var(--text-muted); display: flex; justify-content: space-between;">
                      <span>By: <strong>${h.approvedBy || 'Admin'}</strong></span>
                      ${h.sessionId ? `<span style="font-family: var(--font-mono); color: #64748b;">Ref #${h.sessionId}</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

          `}

        ` : `

          <!-- ─────────────────────────────────────────────── -->
          <!-- SUB-TAB 2: VERIFICATION SESSIONS -->
          <!-- ─────────────────────────────────────────────── -->
          ${filteredSessions.length === 0 ? `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.15); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px; margin-top: 10px;">
              <div style="font-size: 36px; margin-bottom: 8px;">📋</div>
              <div style="font-size: 14px; font-weight: 700; color: #fff;">No verification audit sessions found</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
                ${historySearch ? `No sessions matched "${escapeHtml(historySearch)}". Click ✕ to clear search.` : 'No sessions match the active filter criteria.'}
              </div>
            </div>
          ` : `
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${filteredSessions.map(s => {
                const flr = masterDataService.getFloorById(s.floorId);
                const isCompleted = s.status === 'COMPLETED';
                const isInProgress = s.status === 'IN_PROGRESS';
                const statusBadge = isCompleted ? 'badge-active' : (isInProgress ? 'badge-idle' : 'badge-danger');
                const scannedCount = (s.scanned || []).length;
                const expectedCount = s.snapshotTotal ?? (s.snapshot?.length || 0);

                const linesLabel = s.isFullFloor || s.lineIds === 'ALL'
                  ? 'Entire Floor Scan'
                  : (Array.isArray(s.lineIds)
                      ? s.lineIds.map(lid => masterDataService.getLineById(lid)?.name || lid).join(', ')
                      : (s.lineIds || 'All Lines'));

                const startDt = s.startedAt ? new Date(s.startedAt) : null;
                const formattedStartDate = startDt ? startDt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                const formattedStartTime = startDt ? startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                return `
                  <div class="history-session-card">
                    
                    <!-- Session Header -->
                    <div class="history-session-header">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">📋</span>
                        <div>
                          <div style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: #38bdf8;">
                            ${s.id}
                          </div>
                          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">
                            Auditor: <strong>${s.startedBy || 'Authorized Staff'}</strong> &bull; ${formattedStartDate} at ${formattedStartTime}
                          </div>
                        </div>
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${statusBadge}" style="font-size: 10.5px; font-weight: 800; padding: 4px 10px;">
                          ${isCompleted ? '✓ COMPLETED' : (isInProgress ? '⏳ IN PROGRESS' : '✕ CANCELLED')}
                        </span>
                      </div>
                    </div>

                    <!-- Session Metadata Grid -->
                    <div class="history-session-body">
                      
                      <div class="history-session-meta-pill">
                        <span class="meta-pill-label">Floor</span>
                        <span class="meta-pill-value" style="color: #fff; font-weight: 700;">🏢 ${flr?.name || s.floorId}</span>
                      </div>

                      <div class="history-session-meta-pill">
                        <span class="meta-pill-label">Target Lines</span>
                        <span class="meta-pill-value" style="color: #e2e8f0;">${linesLabel}</span>
                      </div>

                      <div class="history-session-meta-pill">
                        <span class="meta-pill-label">Snapshot Expected</span>
                        <span class="meta-pill-value" style="color: #cbd5e1; font-weight: 700;">${expectedCount} Machines</span>
                      </div>

                      <div class="history-session-meta-pill" style="border-color: rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.08);">
                        <span class="meta-pill-label" style="color: #38bdf8;">Scanned Assets</span>
                        <span class="meta-pill-value" style="color: #38bdf8; font-weight: 800;">⚡ ${scannedCount} Machines</span>
                      </div>

                    </div>

                    ${s.notes ? `
                      <div style="font-size: 11px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.08);">
                        <strong style="color: #cbd5e1;">Audit Notes:</strong> ${escapeHtml(s.notes)}
                      </div>
                    ` : ''}

                    <!-- Actions -->
                    <div class="history-session-actions">
                      <button type="button" class="btn btn-outline btn-view-session-details" data-session-id="${s.id}" style="border-color: #38bdf8; color: #38bdf8; font-size: 12px; padding: 6px 14px; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; background: rgba(56,189,248,0.08);">
                        <span>👁️</span> View Scanned Machines (${scannedCount})
                      </button>
                    </div>

                  </div>
                `;
              }).join('')}
            </div>

          `}

        `}

      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 8.1. SESSION DETAILS AUDIT MODAL
// ─────────────────────────────────────────────────────────────
function renderSessionDetailsModal() {
  if (!viewingSessionModal) return '';
  const s = viewingSessionModal;
  const flr = masterDataService.getFloorById(s.floorId);
  const scanned = s.scanned || [];

  const correctCount = scanned.filter(item => item.matchType === 'CORRECT').length;
  const lineMismatchCount = scanned.filter(item => item.matchType === 'LINE_MISMATCH').length;
  const floorMismatchCount = scanned.filter(item => item.matchType === 'FLOOR_MISMATCH').length;

  return `
    <div class="modal-overlay" id="modal-session-details-overlay" style="z-index: 10040;">
      <div class="modal-dialog" style="max-width: 860px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
        
        <!-- Modal Header -->
        <div class="modal-header" style="padding: 14px 18px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px;">
              📋
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                Session: <span style="color: #38bdf8; font-family: var(--font-mono);">${s.id}</span>
                <span class="badge ${s.status === 'COMPLETED' ? 'badge-active' : (s.status === 'IN_PROGRESS' ? 'badge-idle' : 'badge-danger')}" style="font-size: 10px; font-weight: 800;">
                  ${s.status === 'COMPLETED' ? '✓ COMPLETED' : (s.status === 'IN_PROGRESS' ? '⏳ IN PROGRESS' : '✕ CANCELLED')}
                </span>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                Floor: <strong>${flr?.name || s.floorId}</strong> &bull; Auditor: <strong>${s.startedBy || 'Authorized Staff'}</strong> &bull; ${new Date(s.startedAt).toLocaleString()}
              </div>
            </div>
          </div>
          <button type="button" id="btn-close-session-details-modal" class="modal-close" style="background: none; border: none; font-size: 24px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; line-height: 1;">&times;</button>
        </div>

        <!-- Modal KPI Metrics Bar -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px 18px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.06);">
          <div style="text-align: center; background: rgba(255,255,255,0.02); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
            <div style="font-size: 18px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono);">${scanned.length}</div>
            <div style="font-size: 9.5px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px;">Total Scanned</div>
          </div>
          <div style="text-align: center; background: rgba(16, 185, 129, 0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.15);">
            <div style="font-size: 18px; font-weight: 900; color: #34d399; font-family: var(--font-mono);">${correctCount}</div>
            <div style="font-size: 9.5px; color: #34d399; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px;">Correct Line</div>
          </div>
          <div style="text-align: center; background: rgba(245, 158, 11, 0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.15);">
            <div style="font-size: 18px; font-weight: 900; color: #fbbf24; font-family: var(--font-mono);">${lineMismatchCount}</div>
            <div style="font-size: 9.5px; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px;">Line Relocated</div>
          </div>
          <div style="text-align: center; background: rgba(244, 63, 94, 0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(244, 63, 94, 0.15);">
            <div style="font-size: 18px; font-weight: 900; color: #f43f5e; font-family: var(--font-mono);">${floorMismatchCount}</div>
            <div style="font-size: 9.5px; color: #fb7185; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px;">Floor Mismatch</div>
          </div>
        </div>

        <!-- Modal Body (Scanned Machines Table) -->
        <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 14px 18px;">
          ${scanned.length === 0 ? `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">📷</div>
              <div style="font-size: 14px; font-weight: 700; color: #fff;">No machines scanned in this session</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">This session was closed without scanning any physical assets.</div>
            </div>
          ` : `
            <div style="overflow-x: auto;">
              <table class="table" style="width: 100%; font-size: 11.5px; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.03); border-bottom: 1.5px solid rgba(255,255,255,0.1);">
                    <th style="padding: 8px 10px; width: 5%;">#</th>
                    <th style="padding: 8px 10px; width: 15%;">Serial #</th>
                    <th style="padding: 8px 10px; width: 22%;">Machine</th>
                    <th style="padding: 8px 10px; width: 20%;">Origin (Snapshot)</th>
                    <th style="padding: 8px 10px; width: 14%;">Scanned Line</th>
                    <th style="padding: 8px 10px; text-align: center; width: 14%;">Result</th>
                    <th style="padding: 8px 10px; width: 10%;">Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${scanned.map((item, idx) => {
                    const scanDt = item.scannedAt ? new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                    let resBadge = '';
                    if (item.matchType === 'CORRECT') {
                      resBadge = '<span class="badge badge-active" style="font-size: 10px; font-weight: 700;">✓ Correct</span>';
                    } else if (item.matchType === 'LINE_MISMATCH') {
                      resBadge = '<span class="badge badge-maint" style="font-size: 10px; font-weight: 700;">🔄 Line Relocate</span>';
                    } else {
                      resBadge = '<span class="badge badge-danger" style="font-size: 10px; font-weight: 700;">🏢 Floor Mismatch</span>';
                    }

                    return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="color: var(--text-muted); padding: 8px 10px;">${idx + 1}</td>
                        <td style="padding: 8px 10px;">
                          <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); padding: 2px 6px; border-radius: 4px; display: inline-block;">
                            ${item.serialNumber}
                          </span>
                        </td>
                        <td style="padding: 8px 10px;">
                          <div style="font-weight: 700; color: #fff;">${item.machineNameStr || 'Sewing Machine'}</div>
                          <div style="font-size: 10px; color: var(--text-secondary);">${item.brandStr || ''} ${item.modelStr || ''}</div>
                        </td>
                        <td style="padding: 8px 10px;">
                          <div style="color: #cbd5e1;">${item.previousFloorStr || item.previousFloorId || '—'}</div>
                          <div style="font-size: 10px; color: var(--text-muted);">Line: <strong>${item.previousLineStr || item.previousLineId || '—'}</strong></div>
                        </td>
                        <td style="padding: 8px 10px;">
                          <strong style="color: #38bdf8;">${masterDataService.getLineById(item.scannedLineId)?.name || item.scannedLineId || '—'}</strong>
                        </td>
                        <td style="padding: 8px 10px; text-align: center;">${resBadge}</td>
                        <td style="padding: 8px 10px; color: var(--text-secondary); font-family: var(--font-mono); font-size: 10.5px;">${scanDt}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer" style="padding: 12px 18px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <button type="button" id="btn-export-session-details-excel" class="btn btn-outline" style="border-color: #10b981; color: #34d399; font-size: 11.5px; padding: 6px 14px; font-weight: 800; border-radius: 8px; display: flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.1);">
            <span>📊</span> Export Session Details to Excel
          </button>
          <button type="button" id="btn-close-session-details-btn" class="btn btn-secondary" style="font-size: 12px; padding: 7px 18px; border-radius: 8px; font-weight: 700;">
            Close
          </button>
        </div>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS & CONTROLLERS
// ─────────────────────────────────────────────────────────────
export function initRelocateViewEvents() {
  const root = document.getElementById('relocate-page-root');
  if (!root) return;

  const refreshView = () => {
    const container = document.getElementById('main-view-container');
    if (!container) return;

    const containerY = container.scrollTop;
    const containerX = container.scrollLeft;
    const pv = container.querySelector('.page-view');
    const pvY = pv ? pv.scrollTop : 0;
    const pvX = pv ? pv.scrollLeft : 0;
    const winY = window.scrollY || document.documentElement.scrollTop || 0;
    const winX = window.scrollX || document.documentElement.scrollLeft || 0;

    container.innerHTML = renderRelocateView();
    initRelocateViewEvents();

    const restore = () => {
      container.scrollTop = containerY;
      container.scrollLeft = containerX;
      const newPv = container.querySelector('.page-view');
      if (newPv) {
        newPv.scrollTop = pvY;
        newPv.scrollLeft = pvX;
      }
      if (winY > 0 || winX > 0) {
        window.scrollTo({ top: winY, left: winX, behavior: 'instant' });
      }
    };
    restore();
    requestAnimationFrame(restore);
  };

  // 1. Tab Switching
  root.querySelectorAll('.btn-relocate-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      pendingScanMachine = null;
      manualSearchModalOpen = false;
      completeModalOpen = false;
      activeTab = btn.getAttribute('data-tab');
      refreshView();
    });
  });

  // 2. Cascading Setup Unit -> Floor -> Lines
  const selUnit = root.querySelector('#relocate-sel-unit');
  const selFloor = root.querySelector('#relocate-sel-floor');
  const linesContainer = root.querySelector('#relocate-lines-container');
  const chkFullFloor = root.querySelector('#chk-scan-entire-floor');
  const linesSection = root.querySelector('#relocate-lines-section');

  if (chkFullFloor && linesSection) {
    chkFullFloor.addEventListener('change', () => {
      linesSection.style.display = chkFullFloor.checked ? 'none' : 'flex';
    });
  }

  const btnSelectAll = root.querySelector('#btn-lines-select-all');
  const btnDeselectAll = root.querySelector('#btn-lines-deselect-all');
  if (btnSelectAll && linesContainer) {
    btnSelectAll.addEventListener('click', () => {
      linesContainer.querySelectorAll('.relocate-line-check').forEach(c => c.checked = true);
    });
  }
  if (btnDeselectAll && linesContainer) {
    btnDeselectAll.addEventListener('click', () => {
      linesContainer.querySelectorAll('.relocate-line-check').forEach(c => c.checked = false);
    });
  }

  if (selUnit && selFloor) {
    selUnit.addEventListener('change', () => {
      const unitId = selUnit.value;
      if (!unitId) return;
      const floors = masterDataService.getFloors(unitId);
      selFloor.disabled = false;
      if (floors.length === 0) {
        selFloor.innerHTML = '<option value="" selected disabled>-- No Floors Registered For This Unit --</option>';
      } else {
        selFloor.innerHTML = '<option value="" selected disabled>-- Select Production Floor --</option>' +
          floors.map(f => `<option value="${f.id}" data-unit-id="${unitId}">${f.name}</option>`).join('');
      }
      selFloor.value = '';
      if (linesContainer) {
        linesContainer.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">Please select a Production Floor to view available lines.</div>';
      }
    });
  }

  if (selFloor) {
    selFloor.addEventListener('change', () => {
      const floorId = selFloor.value;
      const opt = selFloor.options[selFloor.selectedIndex];
      const optUnitId = opt?.getAttribute('data-unit-id');
      if (optUnitId && selUnit && selUnit.value !== optUnitId) {
        selUnit.value = optUnitId;
      }

      if (linesContainer) {
        if (!floorId) {
          linesContainer.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">Please select a Production Floor to view available lines.</div>';
          return;
        }
        const lines = masterDataService.getLines(floorId);
        if (lines.length === 0) {
          linesContainer.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center;">No production lines registered on this floor.</div>';
          return;
        }
        linesContainer.innerHTML = lines.map(l => `
          <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cbd5e1; cursor: pointer; background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
            <input type="checkbox" class="relocate-line-check" value="${l.id}" checked style="accent-color: #38bdf8; width: 16px; height: 16px;" />
            <span style="font-weight: 600;">${l.name}</span>
          </label>
        `).join('');
      }
    });
  }

  // 3. Start Session Submit
  const formStart = root.querySelector('#form-start-relocate-session');
  if (formStart) {
    formStart.addEventListener('submit', async (e) => {
      e.preventDefault();
      const unitId = root.querySelector('#relocate-sel-unit')?.value;
      const floorId = root.querySelector('#relocate-sel-floor')?.value;
      const isFullFloor = root.querySelector('#chk-scan-entire-floor')?.checked;
      const lineChecks = root.querySelectorAll('.relocate-line-check:checked');
      const lineIds = Array.from(lineChecks).map(c => c.value);
      const notes = root.querySelector('#relocate-session-notes')?.value || '';

      if (!unitId) {
        notificationService.notifyWarning('Factory Unit Required', 'Please select a Factory Unit before starting the session.');
        root.querySelector('#relocate-sel-unit')?.focus({ preventScroll: true });
        return;
      }

      if (!floorId) {
        notificationService.notifyWarning('Production Floor Required', 'Please select a Production Floor before starting the session.');
        root.querySelector('#relocate-sel-floor')?.focus({ preventScroll: true });
        return;
      }

      if (!isFullFloor && lineIds.length === 0) {
        notificationService.notifyWarning('Line Selection Required', 'Please select at least one production line or check "Scan Entire Floor".');
        return;
      }

      try {
        await relocateService.startSession({
          unitId,
          floorId,
          lineIds,
          isFullFloor,
          notes
        });
        activeTab = 'scan';
        refreshView();
      } catch (err) {
        notificationService.notifyError('Start Session Error', 'Error starting session: ' + err.message);
      }
    });
  }

  // 4. Cancel Session Button
  const btnCancelSession = root.querySelector('#btn-cancel-relocate-session');
  if (btnCancelSession) {
    btnCancelSession.addEventListener('click', () => {
      const active = relocateService.getActiveSession();
      if (!active) return;
      if (!confirm(`Cancel active physical scan session ${active.id}?`)) return;
      relocateService.cancelSession(active.id, 'User cancelled');
      refreshView();
    });
  }

  // Open Camera Scanner helper
  const openCameraScanner = () => {
    const slot = document.getElementById('relocate-scanner-slot') || document.getElementById('relocate-modal-container');
    if (slot) {
      slot.innerHTML = renderQrScannerModal();
      initQrScannerModalEvents({
        onScanSuccess: (decodedText) => {
          slot.innerHTML = '';
          handleMachineIdentified(decodedText);
        },
        onManualSearchRequest: () => {
          slot.innerHTML = '';
          manualSearchModalOpen = true;
          refreshView();
        },
        onClose: () => {
          slot.innerHTML = '';
        }
      });
    }
  };

  // 5. Camera Scanner Buttons (Inline + Sticky Mobile Dock + Setup Location Scan)
  const btnScanQr = root.querySelector('#btn-open-camera-scanner');
  const btnDockScanQr = root.querySelector('#btn-dock-scan-qr');
  const btnScanLocSetup = root.querySelector('#btn-scan-loc-setup');
  if (btnScanQr) btnScanQr.addEventListener('click', openCameraScanner);
  if (btnDockScanQr) btnDockScanQr.addEventListener('click', openCameraScanner);
  if (btnScanLocSetup) btnScanLocSetup.addEventListener('click', openCameraScanner);

  // 6. Manual Search Buttons (Inline + Sticky Mobile Dock)
  const openManualSearch = () => {
    manualSearchModalOpen = true;
    refreshView();
  };
  const btnManualSearch = root.querySelector('#btn-open-manual-search');
  const btnDockManualSearch = root.querySelector('#btn-dock-manual-search');
  if (btnManualSearch) btnManualSearch.addEventListener('click', openManualSearch);
  if (btnDockManualSearch) btnDockManualSearch.addEventListener('click', openManualSearch);

  // Handle Manual Search Input
  const manualSearchInput = root.querySelector('#inp-manual-search-query');
  const manualSearchResults = root.querySelector('#manual-search-results-list');
  const closeManualModalBtn = root.querySelector('#btn-close-manual-search-modal');

  if (closeManualModalBtn) {
    closeManualModalBtn.addEventListener('click', () => {
      manualSearchModalOpen = false;
      refreshView();
    });
  }

  const manualSearchOverlay = root.querySelector('#modal-manual-search-overlay');
  if (manualSearchOverlay) {
    manualSearchOverlay.addEventListener('click', (e) => {
      if (e.target === manualSearchOverlay) {
        manualSearchModalOpen = false;
        refreshView();
      }
    });
  }

  if (manualSearchInput && manualSearchResults) {
    manualSearchInput.addEventListener('input', () => {
      const q = manualSearchInput.value.trim().toLowerCase();
      if (!q) {
        manualSearchResults.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Type to search machines.</div>';
        return;
      }

      const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const mnMap = new Map(storage.getTable(TABLE_NAMES.MACHINE_NAMES).map(x => [x.id, x.name]));
      const brdMap = new Map(storage.getTable(TABLE_NAMES.BRANDS).map(x => [x.id, x.name]));
      const mdlMap = new Map(storage.getTable(TABLE_NAMES.MODELS).map(x => [x.id, x.name]));
      const flrMap = new Map(storage.getTable(TABLE_NAMES.FLOORS).map(x => [x.id, x.name]));
      const linMap = new Map(storage.getTable(TABLE_NAMES.LINES).map(x => [x.id, x.name]));

      const matches = allMachines.filter(m => {
        if (!m) return false;
        const s = (m.serialNumber || '').toLowerCase();
        const permId = (m.permanentMachineId || '').toLowerCase();
        const mn = (mnMap.get(m.machineNameId) || '').toLowerCase();
        const mdl = (mdlMap.get(m.modelId) || '').toLowerCase();
        return s.includes(q) || permId.includes(q) || mn.includes(q) || mdl.includes(q);
      }).slice(0, 15);

      if (matches.length === 0) {
        manualSearchResults.innerHTML = '<div style="text-align: center; padding: 20px; color: #f87171;">No matching machines found.</div>';
        return;
      }

      manualSearchResults.innerHTML = matches.map(m => `
        <div class="manual-search-item" data-id="${m.id}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s ease;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 13.5px;">${m.serialNumber}</span>
              ${m.permanentMachineId ? `<span style="font-size: 10px; font-family: var(--font-mono); background: rgba(56,189,248,0.15); color: #38bdf8; padding: 1px 4px; border-radius: 3px;">${m.permanentMachineId}</span>` : ''}
            </div>
            <div style="font-size: 12.5px; color: #fff; font-weight: 600;">${mnMap.get(m.machineNameId) || 'Machine'}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${brdMap.get(m.brandId) || ''} &bull; ${mdlMap.get(m.modelId) || ''} &bull; Floor: ${flrMap.get(m.floorId) || ''} / ${linMap.get(m.lineId) || ''}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="font-size: 11.5px; padding: 6px 12px; min-height: 36px;">Select &rarr;</button>
        </div>
      `).join('');

      manualSearchResults.querySelectorAll('.manual-search-item').forEach(item => {
        item.addEventListener('click', () => {
          const mId = item.getAttribute('data-id');
          manualSearchModalOpen = false;
          handleMachineIdentified(mId);
        });
      });
    });
  }

  // 7. Confirmation Modal Events
  const confirmCloseBtn = root.querySelector('#btn-close-confirm-modal');
  const confirmCancelBtn = root.querySelector('#btn-cancel-confirm-scan');
  const confirmOverlay = root.querySelector('#modal-confirm-scan-overlay');
  const confirmForm = root.querySelector('#form-confirm-scan-machine');
  const scannedLineSelect = root.querySelector('#confirm-scanned-line');

  const closeConfirmModal = () => {
    pendingScanMachine = null;
    refreshView();
  };

  if (confirmCloseBtn) confirmCloseBtn.addEventListener('click', closeConfirmModal);
  if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirmModal);
  if (confirmOverlay) {
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) {
        closeConfirmModal();
      }
    });
  }

  // Dynamic feedback when line selection changes in confirmation modal
  if (scannedLineSelect && pendingScanMachine) {
    scannedLineSelect.addEventListener('change', () => {
      const session = relocateService.getActiveSession();
      if (!session || !pendingScanMachine) return;
      const evalRes = relocateService.evaluateLocation(session, pendingScanMachine, scannedLineSelect.value);
      const alertEl = root.querySelector('#confirm-location-alert');
      if (alertEl) {
        alertEl.innerHTML = evalRes.description;
      }
    });
  }

  if (confirmForm) {
    confirmForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const session = relocateService.getActiveSession();
      if (!session || !pendingScanMachine) return;

      const currentMachine = pendingScanMachine;
      const scannedLineId = root.querySelector('#confirm-scanned-line')?.value;
      const needleQuantity = root.querySelector('#confirm-needle-quantity')?.value;
      const remarks = root.querySelector('#confirm-scan-remarks')?.value;

      try {
        const result = relocateService.recordScan(session.id, currentMachine.id, {
          scannedLineId,
          needleQuantity,
          remarks
        });

        // Clear pending machine and re-render the view so the newly added machine is immediately in the DOM
        pendingScanMachine = null;
        refreshView();

        if (result && result.duplicate) {
          notificationService.notifyWarning('Duplicate Scan', result.message);
        } else {
          notificationService.notifySuccess('Scan Recorded', `Machine [${currentMachine.serialNumber}] verified at line!`);
        }

        // Scroll the newly scanned machine card into view and highlight it with a glowing border
        setTimeout(() => {
          const scanId = result.scanRecord?.scanId;
          const newCard = scanId ? document.querySelector(`.scanned-machine-card[data-scan-id="${scanId}"]`) : null;
          if (newCard) {
            newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            newCard.style.outline = '2.5px solid #38bdf8';
            newCard.style.boxShadow = '0 0 24px rgba(56, 189, 248, 0.7)';
            setTimeout(() => {
              newCard.style.outline = '';
              newCard.style.boxShadow = '';
            }, 3000);
          }
        }, 120);

      } catch (err) {
        notificationService.notifyError('Scan Failed', 'Error recording scan: ' + (err.message || err));
      }
    });
  }

  // 7b. Edit Scanned Machine Modal Events
  const editCloseBtn = root.querySelector('#btn-close-edit-scan-modal');
  const editCancelBtn = root.querySelector('#btn-cancel-edit-scan');
  const editOverlay = root.querySelector('#modal-edit-scan-overlay');
  const editForm = root.querySelector('#form-edit-scan-machine');

  const closeEditModal = () => {
    editingScanItem = null;
    refreshView();
  };

  if (editCloseBtn) editCloseBtn.addEventListener('click', closeEditModal);
  if (editCancelBtn) editCancelBtn.addEventListener('click', closeEditModal);
  if (editOverlay) {
    editOverlay.addEventListener('click', (e) => {
      if (e.target === editOverlay) closeEditModal();
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const session = relocateService.getActiveSession();
      if (!session || !editingScanItem) return;

      const scannedLineId = root.querySelector('#edit-scanned-line')?.value;
      const needleQuantity = root.querySelector('#edit-needle-quantity')?.value;
      const remarks = root.querySelector('#edit-scan-remarks')?.value;

      try {
        const result = relocateService.updateScan(session.id, editingScanItem.scanId, {
          scannedLineId,
          needleQuantity,
          remarks
        });

        const sn = result.updatedScan.serialNumber;
        editingScanItem = null;
        notificationService.notifySuccess('Scan Updated', `Updated verification details for [${sn}].`);
        refreshView();
      } catch (err) {
        notificationService.notifyError('Update Failed', 'Error updating scan: ' + (err.message || err));
      }
    });
  }

  // Helper to bind Edit & Delete action buttons on each scanned machine card
  const attachCardActionListeners = () => {
    root.querySelectorAll('.btn-edit-scan').forEach(btn => {
      btn.addEventListener('click', () => {
        const scanId = btn.getAttribute('data-scan-id');
        const session = relocateService.getActiveSession();
        if (!session) return;
        const item = session.scanned.find(s => s.scanId === scanId);
        if (item) {
          editingScanItem = item;
          refreshView();
        }
      });
    });

    root.querySelectorAll('.btn-delete-scan').forEach(btn => {
      btn.addEventListener('click', () => {
        const scanId = btn.getAttribute('data-scan-id');
        const serial = btn.getAttribute('data-serial');
        const session = relocateService.getActiveSession();
        if (!session) return;

        const confirmed = confirm(`Are you sure you want to remove machine [${serial}] from this session?\nIt will be restored to unscanned / idle status.`);
        if (!confirmed) return;

        try {
          relocateService.removeScan(session.id, scanId);
          notificationService.notifyWarning('Scan Removed', `Machine [${serial}] removed from session.`);
          refreshView();
        } catch (err) {
          notificationService.notifyError('Remove Failed', 'Error removing scan: ' + (err.message || err));
        }
      });
    });
  };

  attachCardActionListeners();

  // 7c. Scanned Feed Live Filter & Search Events
  const inpScannedFilter = root.querySelector('#inp-scanned-filter-query');
  if (inpScannedFilter) {
    inpScannedFilter.addEventListener('input', (e) => {
      scannedListSearch = e.target.value;
      const container = root.querySelector('#relocate-scanned-items-container');
      const session = relocateService.getActiveSession();
      if (container && session) {
        container.innerHTML = renderScannedItemsList(session);
        attachCardActionListeners();
      }
    });
  }

  const btnClearFilter = root.querySelector('#btn-clear-scanned-filter');
  if (btnClearFilter) {
    btnClearFilter.addEventListener('click', () => {
      scannedListSearch = '';
      refreshView();
    });
  }

  root.querySelectorAll('.btn-scan-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      scannedListFilter = btn.getAttribute('data-filter') || 'ALL';
      refreshView();
    });
  });

  const btnFeedQuickScan = root.querySelector('#btn-feed-quick-scan');
  if (btnFeedQuickScan) {
    btnFeedQuickScan.addEventListener('click', openCameraScanner);
  }

  const btnToggleKpiMobile = root.querySelector('#btn-toggle-kpi-mobile');
  if (btnToggleKpiMobile) {
    btnToggleKpiMobile.addEventListener('click', () => {
      kpisCollapsedOnMobile = !kpisCollapsedOnMobile;
      refreshView();
    });
  }

  // 8. Open Complete Scan Modal (Header + Sticky Mobile Dock)
  const openCompleteModal = () => {
    completeModalOpen = true;
    refreshView();
  };
  const btnOpenComplete = root.querySelector('#btn-open-complete-modal');
  const btnDockComplete = root.querySelector('#btn-dock-complete');
  if (btnOpenComplete) btnOpenComplete.addEventListener('click', openCompleteModal);
  if (btnDockComplete) btnDockComplete.addEventListener('click', openCompleteModal);

  const btnCloseComplete = root.querySelector('#btn-close-reconciliation-modal');
  const btnCancelComplete = root.querySelector('#btn-cancel-reconciliation');
  const btnConfirmComplete = root.querySelector('#btn-confirm-complete-session');
  const reconOverlay = root.querySelector('#modal-reconciliation-overlay');

  const closeCompleteModal = () => {
    completeModalOpen = false;
    refreshView();
  };

  if (btnCloseComplete) btnCloseComplete.addEventListener('click', closeCompleteModal);
  if (btnCancelComplete) btnCancelComplete.addEventListener('click', closeCompleteModal);
  if (reconOverlay) {
    reconOverlay.addEventListener('click', (e) => {
      if (e.target === reconOverlay) {
        closeCompleteModal();
      }
    });
  }

  if (btnConfirmComplete) {
    btnConfirmComplete.addEventListener('click', () => {
      const active = relocateService.getActiveSession();
      if (!active) return;
      const notes = root.querySelector('#final-reconciliation-notes')?.value || '';

      try {
        relocateService.completeSession(active.id, notes);
        completeModalOpen = false;
        activeTab = 'history';
        notificationService.notifySuccess('Verification Finalized', `Session ${active.id} reconciled successfully!`);
        refreshView();
      } catch (err) {
        notificationService.notifyError('Completion Error', 'Error completing session: ' + err.message);
      }
    });
  }

  // 9. Relocation Approval / Reject Buttons
  root.querySelectorAll('.btn-approve-relocation').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      try {
        await relocateService.approveRelocation(id);
        notificationService.notifySuccess('Relocation Approved', 'Machine inventory location updated!');
        refreshView();
      } catch (err) {
        notificationService.notifyError('Approval Failed', 'Error approving relocation: ' + err.message);
      }
    });
  });

  root.querySelectorAll('.btn-reject-relocation').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const reason = prompt('Please enter rejection reason:', 'Physical move not approved');
      if (!reason) return;
      try {
        await relocateService.rejectRelocation(id, reason);
        notificationService.notifyWarning('Relocation Rejected', 'Machine location kept at original.');
        refreshView();
      } catch (err) {
        notificationService.notifyError('Rejection Failed', 'Error rejecting relocation: ' + err.message);
      }
    });
  });

  // 10. History Tab Sub-Tabs, Search, Filters, View Session & Export
  root.querySelectorAll('.btn-history-subtab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      historySubTab = btn.getAttribute('data-subtab');
      historyFilter = 'ALL';
      historySearch = '';
      refreshView();
    });
  });

  const inpHistSearch = root.querySelector('#inp-history-search');
  if (inpHistSearch) {
    inpHistSearch.addEventListener('input', (e) => {
      historySearch = e.target.value;
      refreshView();
      const newInp = document.getElementById('inp-history-search');
      if (newInp) {
        newInp.focus({ preventScroll: true });
        newInp.setSelectionRange(newInp.value.length, newInp.value.length);
      }
    });
  }

  const btnClearHistSearch = root.querySelector('#btn-clear-history-search');
  if (btnClearHistSearch) {
    btnClearHistSearch.addEventListener('click', (e) => {
      e.preventDefault();
      historySearch = '';
      refreshView();
    });
  }

  root.querySelectorAll('.btn-history-filter-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      historyFilter = btn.getAttribute('data-filter');
      refreshView();
    });
  });

  root.querySelectorAll('.btn-view-session-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sId = btn.getAttribute('data-session-id');
      const session = (relocateService.getAllSessions() || []).find(s => s.id === sId);
      if (session) {
        viewingSessionModal = session;
        refreshView();
      }
    });
  });

  const btnCloseSessionModal = root.querySelector('#btn-close-session-details-modal');
  if (btnCloseSessionModal) {
    btnCloseSessionModal.addEventListener('click', () => {
      viewingSessionModal = null;
      refreshView();
    });
  }

  const btnCloseSessionBtn = root.querySelector('#btn-close-session-details-btn');
  if (btnCloseSessionBtn) {
    btnCloseSessionBtn.addEventListener('click', () => {
      viewingSessionModal = null;
      refreshView();
    });
  }

  const sessionOverlay = root.querySelector('#modal-session-details-overlay');
  if (sessionOverlay) {
    sessionOverlay.addEventListener('click', (e) => {
      if (e.target === sessionOverlay) {
        viewingSessionModal = null;
        refreshView();
      }
    });
  }

  const btnExportHistory = root.querySelector('#btn-export-history-excel');
  if (btnExportHistory) {
    btnExportHistory.addEventListener('click', (e) => {
      e.preventDefault();
      if (historySubTab === 'movements') {
        const enriched = getEnrichedRelocationHistory();
        exportMovementsToExcel(enriched);
      } else {
        const sessions = relocateService.getAllSessions() || [];
        exportSessionsToExcel(sessions);
      }
    });
  }

  const btnExportSessionDetails = root.querySelector('#btn-export-session-details-excel');
  if (btnExportSessionDetails && viewingSessionModal) {
    btnExportSessionDetails.addEventListener('click', (e) => {
      e.preventDefault();
      exportSingleSessionToExcel(viewingSessionModal);
    });
  }

  // Direct Shortcut to QR Code & Label Studio
  const btnGotoQr = root.querySelector('#btn-relocate-goto-qr-codes');
  if (btnGotoQr) {
    btnGotoQr.addEventListener('click', (e) => {
      e.preventDefault();
      state.set('currentView', 'qr-codes');
      if (typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
        window.app.switchView('qr-codes');
      }
    });
  }

  // Helper when QR is scanned or search item selected
  function handleMachineIdentified(identifier) {
    const session = relocateService.getActiveSession();

    // 1. Check if scanned code is a Location QR (Unit + Floor)
    const locResult = relocateService.parseLocationQr(identifier);
    if (locResult.isLocationQr) {
      if (!session) {
        // Setup view: auto-select Unit and Floor!
        const selUnit = root.querySelector('#relocate-sel-unit');
        const selFloor = root.querySelector('#relocate-sel-floor');
        if (selUnit) {
          selUnit.value = locResult.unitId;
          const floors = masterDataService.getFloors(locResult.unitId);
          if (selFloor) {
            selFloor.innerHTML = floors.map(f => `<option value="${f.id}" ${f.id === locResult.floorId ? 'selected' : ''}>${f.name}</option>`).join('');
            selFloor.value = locResult.floorId;
            selFloor.dispatchEvent(new Event('change'));
          }
        }
        notificationService.notifySuccess('Location Detected', `Auto-selected ${locResult.locationTag} (${locResult.unitName} - ${locResult.floorName})!`);
        return;
      } else {
        // Active session: check if checkpoint matches session floor
        if (session.floorId === locResult.floorId) {
          notificationService.notifySuccess('Location Checkpoint Verified', `Scanned ${locResult.locationTag} for active session.`);
        } else {
          notificationService.notifyError('Location Mismatch', `Scanned ${locResult.locationTag} (${locResult.floorName}), but active session is on floor ${session.floorId}.`);
        }
        return;
      }
    }

    // 2. Machine QR / Identifier Scan
    if (!session) {
      const peekMachine = relocateService.lookupMachine(identifier);
      if (peekMachine) {
        notificationService.notifyInfo('Machine Identified', `[${peekMachine.serialNumber} - ${peekMachine.machineNameStr}] registered at ${peekMachine.floorStr} / ${peekMachine.lineStr}. Please start session first.`);
      } else {
        notificationService.notifyWarning('Session Required', 'Please start a verification session or scan a Location QR before scanning machines.');
      }
      return;
    }

    const machine = relocateService.lookupMachine(identifier);
    if (!machine) {
      notificationService.notifyError('Not Found', `Machine not found for identifier: "${identifier}". Please verify Serial Number or QR tag.`);
      return;
    }

    // Check duplicate
    const isAlreadyScanned = session.scanned.some(s => s.machineId === machine.id);
    if (isAlreadyScanned) {
      notificationService.notifyWarning('Already Scanned', `Machine [${machine.serialNumber}] was already recorded in this session.`);
      return;
    }

    // Open confirmation modal
    pendingScanMachine = machine;
    refreshView();
  }
}
