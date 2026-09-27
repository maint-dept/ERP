/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * 🔧 ENT Lab Management — Action-Focused Single Page Interface
 * 
 * Simple Workflow:
 * 1. SEARCH BOARD FIRST (Board ID / Unit Number)
 * 2. VIEW BOARD SUMMARY & CURRENT STATUS
 * 3. QUICK ACTIONS or TOP "➕ Add Action"
 * 4. COMPLETE LIFETIME HISTORY (Ledger Table & Timeline)
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, ET_BOARD_STATUSES, ET_ACTIONS } from '../db/schema.js';
import { etLabService } from '../services/etLabService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { renderSparePartsManagementView, initSparePartsManagementEvents } from './sparePartsManagementView.js';

// Local view state
let selectedBoardSerial = null; // Blank by default, user searches or clicks a board
let searchFilterQuery = '';
let filterStatus = 'ALL';
let historyViewMode = 'table'; // Default 'table' for clean ledger, toggleable to 'timeline'
let activeEntTab = 'boards'; // 'boards' | 'spare-parts' | 'lab-config'

export function setEntActiveTab(tab) {
  activeEntTab = tab;
}

export function getEntActiveTab() {
  return activeEntTab;
}

export function renderEtLabManagementView() {
  const kpi = etLabService.getGlobalStats();
  const allBoards = etLabService.getBoards();
  const filteredBoards = etLabService.getBoards({
    search: searchFilterQuery,
    status: filterStatus
  });

  const isAdmin = authService.isAdmin();

  // Find currently selected board (only if explicitly searched or chosen by the user)
  const currentBoard = selectedBoardSerial ? etLabService.getBoardBySerial(selectedBoardSerial) : null;

  // Get machine connection details if installed
  const connectedMachine = currentBoard && currentBoard.currentMachineSerial ? 
    etLabService.getMachineDetailsForBoard(currentBoard.currentMachineSerial) : null;

  // Complete lifetime history
  const boardHistory = currentBoard ? etLabService.getBoardHistory(currentBoard.boardSerial) : [];
  const recentHistory = boardHistory.slice(0, 3);

  return `
    <div class="page-view ent-lab-page-container" style="padding: 16px 22px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; height: 100%;">
      
      <!-- Top Navigation Tabs for ENT Lab Management -->
      <div class="ent-header-tabs" style="display: flex; gap: 10px; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; margin-bottom: 4px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button 
            id="ent-tab-btn-boards" 
            class="btn btn-sm ${activeEntTab === 'boards' ? 'btn-primary' : 'btn-ghost'}" 
            style="font-weight: 800; font-size: 13px; padding: 8px 18px; border-radius: 6px; display: flex; align-items: center; gap: 8px; ${activeEntTab === 'boards' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8; color: #fff; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);' : 'color: #94a3b8; border: 1px solid rgba(255,255,255,0.12);'}"
          >
            <span>⚡</span>
            <span>Circuit Boards &amp; Hardware</span>
          </button>
          <button 
            id="ent-tab-btn-spare-parts" 
            class="btn btn-sm ${activeEntTab === 'spare-parts' ? 'btn-primary' : 'btn-ghost'}" 
            style="font-weight: 800; font-size: 13px; padding: 8px 18px; border-radius: 6px; display: flex; align-items: center; gap: 8px; ${activeEntTab === 'spare-parts' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8; color: #fff; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);' : 'color: #94a3b8; border: 1px solid rgba(255,255,255,0.12);'}"
          >
            <span>⚙️</span>
            <span>Spare Parts Catalog &amp; Configuration</span>
          </button>
          <button 
            id="ent-tab-btn-lab-config" 
            class="btn btn-sm ${activeEntTab === 'lab-config' ? 'btn-primary' : 'btn-ghost'}" 
            style="font-weight: 800; font-size: 13px; padding: 8px 18px; border-radius: 6px; display: flex; align-items: center; gap: 8px; ${activeEntTab === 'lab-config' ? 'background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8; color: #fff; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);' : 'color: #94a3b8; border: 1px solid rgba(255,255,255,0.12);'}"
          >
            <span>🛠️</span>
            <span>Lab Staff &amp; Setup</span>
          </button>
        </div>

        <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; background: #38bdf8; border-radius: 50%;"></span>
          <span>ENT Lab Management Unit &bull; Central Engineering</span>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div id="ent-tab-content-area" style="display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0;">
        ${activeEntTab === 'spare-parts' ? renderSparePartsManagementView() : 
          activeEntTab === 'lab-config' ? renderEntLabConfigInlineView() : 
          renderEntBoardsContent(kpi, allBoards, filteredBoards, currentBoard, connectedMachine, boardHistory, recentHistory, isAdmin)}
      </div>

    </div>
  `;
}

function renderEntBoardsContent(kpi, allBoards, filteredBoards, currentBoard, connectedMachine, boardHistory, recentHistory, isAdmin) {
  return `
      <!-- ============================================================ -->
      <!-- 1. TOP SECTION: SEARCH & PRIMARY ACTION                      -->
      <!-- ============================================================ -->
      <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
        
        <!-- Search Box with Live Dropdown Autocomplete -->
        <div style="flex: 1; min-width: 320px; position: relative;">
          <div style="position: relative; display: flex; align-items: center;">
            <input 
              type="text" 
              id="ent-live-search-input" 
              class="form-control" 
              placeholder="🔍 Search Board ID, S/N, Model, Name, or Machine (e.g. BRD-00025, TS-01)..." 
              value="${currentBoard ? `${currentBoard.boardSerial} — ${currentBoard.partName}` : ''}"
              style="height: 42px; font-size: 13.5px; font-weight: 800; padding-left: 14px; padding-right: 36px; background: rgba(30, 41, 59, 0.95); border: 1.5px solid #38bdf8; color: #fff; box-shadow: 0 0 12px rgba(56, 189, 248, 0.25); border-radius: 6px;"
              autocomplete="off"
            />
            <button 
              type="button" 
              id="btn-clear-ent-search" 
              style="position: absolute; right: 10px; background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 2px 6px; display: ${currentBoard ? 'block' : 'none'};" 
              title="Clear Search &amp; Pick Another Board"
            >✕</button>
          </div>
          <div id="ent-search-dropdown-results" style="display: none; position: absolute; top: 46px; left: 0; right: 0; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; max-height: 280px; overflow-y: auto; z-index: 1000; box-shadow: 0 12px 35px rgba(0,0,0,0.9);"></div>
        </div>

        <!-- Quick Jump Chips -->
        <div style="display: flex; align-items: center; gap: 6px; overflow-x: auto; max-width: 440px;">
          ${filteredBoards.slice(0, 5).map(b => {
            const isSel = currentBoard && b.boardSerial === currentBoard.boardSerial;
            return `
              <button 
                class="btn btn-sm btn-quick-select-board ${isSel ? 'btn-primary' : 'btn-ghost'}" 
                data-serial="${b.boardSerial}"
                style="padding: 3px 10px; font-size: 11.5px; font-family: var(--font-mono); font-weight: 700; border-radius: 16px; white-space: nowrap; border: 1px solid ${isSel ? '#38bdf8' : 'rgba(255,255,255,0.15)'};"
              >
                ${b.boardSerial}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Top Right Action Buttons -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <button 
            id="btn-top-add-action" 
            class="btn btn-primary" 
            style="height: 42px; padding: 0 20px; font-size: 14px; font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8; box-shadow: 0 4px 16px rgba(2, 132, 199, 0.45); display: flex; align-items: center; gap: 8px; cursor: pointer;"
            title="Execute an action on currently selected board"
          >
            <span style="font-size: 17px;">➕</span>
            <span>Add Action</span>
          </button>
          
          <button 
            id="btn-top-open-reports" 
            class="btn btn-secondary" 
            style="height: 42px; font-weight: 700; border-color: #38bdf8; color: #38bdf8; display: flex; align-items: center; gap: 6px; cursor: pointer;" 
            title="Open ENT Lab Management Reports"
          >
            <span>📊</span>
            <span>Reports</span>
          </button>

          <button id="btn-open-add-board-modal" class="btn btn-secondary btn-sm" style="height: 42px; font-weight: 700;" title="Register New Board">
            + New Board
          </button>

          <button 
            id="btn-ent-top-spare-config" 
            class="btn btn-secondary btn-sm" 
            style="height: 42px; font-weight: 700; border-color: #38bdf8; color: #38bdf8; display: flex; align-items: center; gap: 6px; padding: 0 14px;" 
            title="Open Spare Parts Management & Configuration"
          >
            <span>⚙️</span>
            <span>Spare Parts &amp; Config</span>
          </button>
        </div>

      </div>

      ${currentBoard ? `
        <!-- ============================================================ -->
        <!-- 2. COMPACT BOARD SUMMARY                                     -->
        <!-- ============================================================ -->
        <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-sm);">
          
          <!-- Row 1: Board Name | Model | SL No. | Current Status -->
          <div style="display: grid; grid-template-columns: 2fr 1fr 1.2fr 1.8fr; gap: 12px; align-items: center;">
            
            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Board Name</span>
              <div style="font-size: 15px; font-weight: 800; color: #fff; margin-top: 1px; display: flex; align-items: center; gap: 8px;">
                <span style="color: #38bdf8; font-family: var(--font-mono);">${currentBoard.boardSerial}</span>
                <span style="color: var(--text-muted);">&bull;</span>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentBoard.partName}</span>
                <button id="btn-trigger-edit-board" class="btn btn-ghost btn-sm" style="padding: 1px 6px; font-size: 10px; color: #94a3b8;" title="Edit Board Specs">✏️</button>
              </div>
            </div>

            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Model</span>
              <div style="font-size: 13px; font-weight: 700; color: #cbd5e1; font-family: var(--font-mono); margin-top: 1px;">
                ${currentBoard.modelNo || '—'}
              </div>
            </div>

            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">SL No. (JUKI)</span>
              <div style="font-size: 13px; font-weight: 700; color: #cbd5e1; font-family: var(--font-mono); margin-top: 1px;">
                ${currentBoard.jukiSlNo || currentBoard.slNo || '—'}
              </div>
            </div>

            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Current Status</span>
              <div style="margin-top: 2px;">
                ${renderCurrentStatusBadge(currentBoard, connectedMachine)}
              </div>
            </div>

          </div>

          <!-- Row 2: Current Machine | Unit | Floor | Line -->
          <div style="display: grid; grid-template-columns: 2fr 1fr 1.2fr 1.8fr; gap: 12px; align-items: center; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 10px;">
            
            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Current Machine</span>
              <div style="font-size: 13.5px; font-weight: 800; color: ${currentBoard.currentMachineSerial ? '#38bdf8' : '#94a3b8'}; font-family: var(--font-mono); margin-top: 1px;">
                ${currentBoard.currentMachineSerial ? `🧵 ${currentBoard.currentMachineSerial} ${connectedMachine ? `(${connectedMachine.machineName})` : ''}` : '— (Ready in Lab Stock)'}
              </div>
            </div>

            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Unit / Factory</span>
              <div style="font-size: 12.5px; font-weight: 600; color: #cbd5e1; margin-top: 1px;">
                ${connectedMachine?.unitName || 'Central Maintenance'}
              </div>
            </div>

            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Floor</span>
              <div style="font-size: 12.5px; font-weight: 600; color: #cbd5e1; margin-top: 1px;">
                ${connectedMachine?.floorName || 'ENT Lab'}
              </div>
            </div>

            <div>
              <span style="color: var(--text-muted); font-size: 10.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Line / Location</span>
              <div style="font-size: 12.5px; font-weight: 700; color: #86efac; margin-top: 1px;">
                ${connectedMachine?.lineName || currentBoard.location || 'Shelf B-01'}
              </div>
            </div>

          </div>

        </div>

        <!-- ============================================================ -->
        <!-- 3. QUICK ACTIONS (1-Click Action Execution)                  -->
        <!-- ============================================================ -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-lg); padding: 14px 18px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
            <span>⚡ Quick Actions (1-Click Action Execution)</span>
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Select an action to launch form</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
            <button class="btn btn-quick-action" data-action="INSTALL" style="height: 42px; font-weight: 800; font-size: 12.5px; background: rgba(56, 189, 248, 0.15); border: 1.5px solid #38bdf8; color: #38bdf8;">
              📥 Install / Assign
            </button>
            
            <button class="btn btn-quick-action" data-action="REMOVE" style="height: 42px; font-weight: 800; font-size: 12.5px; background: rgba(245, 158, 11, 0.15); border: 1.5px solid #f59e0b; color: #fbbf24;">
              📤 Remove
            </button>
            
            <button class="btn btn-quick-action" data-action="INHOUSE_REPAIR" style="height: 42px; font-weight: 800; font-size: 12.5px; background: rgba(249, 115, 22, 0.15); border: 1.5px solid #f97316; color: #fb923c;">
              🛠️ In-House Repair
            </button>
            
            <button class="btn btn-quick-action" data-action="SEND_OUTSIDE" style="height: 42px; font-weight: 800; font-size: 12.5px; background: rgba(168, 85, 247, 0.15); border: 1.5px solid #a855f7; color: #c084fc;">
              🚚 Send Outside
            </button>
            
            <button class="btn btn-quick-action" data-action="RECEIVE" style="height: 42px; font-weight: 800; font-size: 12.5px; background: rgba(20, 184, 166, 0.15); border: 1.5px solid #14b8a6; color: #2dd4bf;">
              🟣 Receive
            </button>

            <button class="btn btn-quick-action" data-action="ASSIGN_ANOTHER" style="height: 42px; font-weight: 800; font-size: 12.5px; background: rgba(99, 102, 241, 0.15); border: 1.5px solid #6366f1; color: #a5b4fc;">
              🔄 Assign Another
            </button>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- 4. RECENT ACTIVITY & "VIEW COMPLETE HISTORY" BUTTON           -->
        <!-- ============================================================ -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 18px; display: flex; flex-direction: column; gap: 10px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 13.5px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>🕒 Recent Activity</span>
              <span class="badge badge-info" style="font-size: 11px;">${recentHistory.length} of ${boardHistory.length} Events</span>
            </div>

            <!-- "View Complete History" Button (Opens Full History Modal) -->
            <button 
              id="btn-open-complete-history-modal" 
              class="btn btn-primary btn-sm" 
              style="font-weight: 800; font-size: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #38bdf8; padding: 6px 16px;"
            >
              📜 View Complete History (${boardHistory.length})
            </button>
          </div>

          <!-- Compact Recent Activity Table -->
          <div class="table-responsive" style="border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: rgba(15, 23, 42, 0.95); font-size: 11px; text-transform: uppercase; color: #94a3b8;">
                  <th style="padding: 8px 10px; width: 85px;">Date</th>
                  <th style="padding: 8px 10px; width: 130px;">Action</th>
                  <th style="padding: 8px 10px; width: 95px;">Board</th>
                  <th style="padding: 8px 10px; width: 95px;">Machine</th>
                  <th style="padding: 8px 10px; width: 130px;">Employee Name</th>
                  <th style="padding: 8px 10px; width: 90px;">Card No.</th>
                  <th style="padding: 8px 10px; width: 120px;">Working Area</th>
                  <th style="padding: 8px 10px; width: 110px;">Result</th>
                  <th style="padding: 8px 10px;">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${recentHistory.length === 0 ? `
                  <tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">No history logged for this board yet. Click <strong>Add Action</strong> above.</td></tr>
                ` : recentHistory.map(h => {
                  const act = ET_ACTIONS[h.action] || { label: h.actionLabel || h.action, icon: '⚡', color: '#38bdf8' };
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <td style="padding: 8px 10px; font-family: var(--font-mono); color: #cbd5e1;">${h.timestamp ? h.timestamp.split('T')[0] : '—'}</td>
                      <td style="padding: 8px 10px; font-weight: 700; color: #fff;">
                        <span style="color: ${act.color};">${act.icon}</span> ${h.actionLabel || act.label}
                        ${h.repairAttempt ? `<span style="font-size: 10px; color: #c084fc; font-family: var(--font-mono);">[#${h.repairAttempt}]</span>` : ''}
                      </td>
                      <td style="padding: 8px 10px; font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">${h.boardSerial || currentBoard.boardSerial}</td>
                      <td style="padding: 8px 10px; font-family: var(--font-mono); font-weight: 800; color: ${h.machineSerial ? '#38bdf8' : '#94a3b8'};">${h.machineSerial ? `🧵 ${h.machineSerial}` : '—'}</td>
                      <td style="padding: 8px 10px; color: #fff; font-weight: 700;">👤 ${h.performedByName || 'Engineer'}</td>
                      <td style="padding: 8px 10px; font-family: var(--font-mono); color: #38bdf8; font-weight: 800;">${h.performedByCard || '1001'}</td>
                      <td style="padding: 8px 10px; color: #86efac; font-size: 11px; font-weight: 600;">${h.performedByArea || 'Central ENT Lab'}</td>
                      <td style="padding: 8px 10px;">${renderResultBadge(h)}</td>
                      <td style="padding: 8px 10px; color: var(--text-secondary); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.remarks || h.removalReason || h.repairDetails || '—'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

        </div>

      ` : `
        <!-- Clean Initial State: Awaiting User Search or Quick Selection -->
        <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; box-shadow: var(--shadow-sm);">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(56, 189, 248, 0.12); border: 1.5px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 26px;">
            ⚡
          </div>
          <div>
            <div style="font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">
              Circuit Boards &amp; Hardware Management
            </div>
            <div style="font-size: 12.5px; color: var(--text-muted); max-width: 560px; margin: 6px auto 0; line-height: 1.5;">
              Search by <strong>Board ID</strong> (e.g. BRD-00025), <strong>Name</strong>, <strong>Model</strong>, <strong>S/N</strong>, or <strong>Assigned Machine</strong> in the search bar above, or pick from the quick chips below to view details and execute actions.
            </div>
          </div>

          <!-- Quick Selection Chips Grid -->
          <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 760px; margin-top: 6px;">
            ${allBoards.slice(0, 8).map(b => `
              <button 
                class="btn btn-sm btn-quick-select-board" 
                data-serial="${b.boardSerial}"
                style="background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(56, 189, 248, 0.3); color: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.15s ease;"
                onmouseover="this.style.borderColor='#38bdf8'; this.style.background='rgba(56, 189, 248, 0.15)';"
                onmouseout="this.style.borderColor='rgba(56, 189, 248, 0.3)'; this.style.background='rgba(30, 41, 59, 0.85)';"
              >
                <span style="font-family: var(--font-mono); color: #38bdf8;">${b.boardSerial}</span>
                <span>&bull;</span>
                <span style="color: #cbd5e1; font-size: 11.5px;">${b.partName}</span>
                <span style="font-size: 10px; color: ${b.currentMachineSerial ? '#34d399' : '#94a3b8'};">(${b.currentMachineSerial ? `🧵 ${b.currentMachineSerial}` : 'In Spares'})</span>
              </button>
            `).join('')}
          </div>

          <div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; justify-content: center;">
            <button id="btn-empty-open-directory" class="btn btn-secondary btn-sm" style="font-weight: 700;">
              📋 Browse Master Directory (${allBoards.length} Boards)
            </button>
            <button id="btn-empty-new-board" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); border: 1px solid #38bdf8;">
              ➕ Register New Board
            </button>
          </div>
        </div>
      `}

      <!-- ============================================================ -->
      <!-- 5. BOTTOM UTILITIES & DIRECTORY TOGGLE                      -->
      <!-- ============================================================ -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 0;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-toggle-directory-view" class="btn btn-secondary btn-sm" style="font-weight: 700;">
            📋 Toggle Master Directory (${filteredBoards.length} Boards)
          </button>
          
          <button id="btn-export-ent-excel" class="btn btn-secondary btn-sm" style="font-weight: 600;" title="Download complete Excel ledger">
            📊 Export Excel (.xlsx)
          </button>
          
          <button id="btn-print-board-passport" class="btn btn-secondary btn-sm" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700;" title="Print official passport">
            🖨️ Print Passport / PDF
          </button>
        </div>

        ${isAdmin ? `
          <button id="btn-open-admin-config" class="btn btn-ghost btn-sm" style="font-weight: 600; color: #94a3b8; border: 1px solid rgba(255,255,255,0.12);">
            ⚙️ Admin Config
          </button>
        ` : ''}
      </div>

      <!-- Collapsible Board Master Directory -->
      <div id="ent-collapsible-directory" style="display: none; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;">
        <div style="padding: 10px 16px; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 800; font-size: 13px; color: #fff;">📋 All Boards Master Directory</div>
          <div style="font-size: 11.5px; color: var(--text-muted);">Click any row to select</div>
        </div>
        <div class="table-responsive" style="max-height: 280px; overflow-y: auto;">
          ${renderMasterDirectoryTable(filteredBoards, currentBoard)}
        </div>
      </div>

    </div>
  `;
}

/**
 * ============================================================
 * CURRENT STATUS BADGE & CARD RENDERERS
 * ============================================================
 */
function renderResultBadge(h) {
  if (h.acceptanceStatus) {
    if (h.acceptanceStatus.includes('Accepted')) {
      return `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">✅ Accepted</span>`;
    } else if (h.acceptanceStatus.includes('Rejected') || h.acceptanceStatus.includes('Not Successful')) {
      return `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">❌ Rejected</span>`;
    } else if (h.acceptanceStatus.includes('Partially')) {
      return `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">⚠️ Partial</span>`;
    } else if (h.acceptanceStatus.includes('Send Again')) {
      return `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #a855f7; font-size: 10.5px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">🔄 Send Again</span>`;
    }
  }
  return h.repairType ? `<span style="color: #cbd5e1; font-size: 11px;">${h.repairType}</span>` : '—';
}

function renderCurrentStatusBadge(board, connectedMachine) {
  const lastExt = board.lastExternalRepair;
  switch (board.status) {
    case 'INSTALLED':
      return `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1.5px solid #10b981; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">🟢 Installed on ${board.currentMachineSerial || 'Machine'}</span>`;
    case 'AVAILABLE_SPARE':
    case 'REPAIR_ACCEPTED':
      const isAccepted = lastExt && lastExt.acceptanceStatus && lastExt.acceptanceStatus.includes('Accepted');
      return `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1.5px solid ${isAccepted ? '#10b981' : '#38bdf8'}; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">${isAccepted ? '✅ Repair Accepted (Spare)' : '🔵 Available / Spare'}</span>`;
    case 'UNDER_INHOUSE_REPAIR':
    case 'REPAIR_REJECTED':
      const isRejected = lastExt && lastExt.acceptanceStatus && lastExt.acceptanceStatus.includes('Rejected');
      return `<span style="background: rgba(249, 115, 22, 0.2); color: ${isRejected ? '#f87171' : '#fb923c'}; border: 1.5px solid ${isRejected ? '#ef4444' : '#f97316'}; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">${isRejected ? '❌ Repair Rejected' : '🟠 Under Repair'}</span>`;
    case 'SENT_EXTERNAL':
      return `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1.5px solid #ef4444; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">🔴 Sent Outside (${board.externalRepair?.companyName || 'External Partner'})</span>`;
    case 'PARTIALLY_REPAIRED':
      return `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1.5px solid #f59e0b; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">⚠️ Partially Repaired</span>`;
    case 'RETURNED':
      return `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1.5px solid #a855f7; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">🟣 Returned from External</span>`;
    case 'DAMAGED_SCRAP':
      return `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1.5px solid #ef4444; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;">❌ Damaged / Scrap</span>`;
    default:
      return `<span class="badge badge-secondary">${board.status}</span>`;
  }
}

function renderSimpleStatusBadge(status) {
  switch (status) {
    case 'INSTALLED':
      return `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; font-weight: 700;">🟢 Installed</span>`;
    case 'AVAILABLE_SPARE':
    case 'REPAIR_ACCEPTED':
      return `<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8; font-weight: 700;">🔵 Available</span>`;
    case 'UNDER_INHOUSE_REPAIR':
      return `<span class="badge" style="background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid #f97316; font-weight: 700;">🟠 Repair</span>`;
    case 'REPAIR_REJECTED':
      return `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-weight: 700;">❌ Rejected</span>`;
    case 'SENT_EXTERNAL':
      return `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-weight: 700;">🔴 Outside</span>`;
    case 'PARTIALLY_REPAIRED':
      return `<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; font-weight: 700;">⚠️ Partial</span>`;
    case 'RETURNED':
      return `<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #a855f7; font-weight: 700;">🟣 Returned</span>`;
    case 'DAMAGED_SCRAP':
      return `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-weight: 700;">❌ Scrap</span>`;
    default:
      return `<span class="badge badge-secondary">${status}</span>`;
  }
}

function renderMasterDirectoryTable(boards, currentBoard) {
  if (boards.length === 0) {
    return `
      <div style="text-align: center; padding: 30px; color: var(--text-muted);">
        No boards found matching criteria.
      </div>
    `;
  }
  return `
    <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); font-size: 11px; text-transform: uppercase; color: #94a3b8; position: sticky; top: 0; z-index: 2;">
          <th style="padding: 8px 12px; text-align: left;">Board ID</th>
          <th style="padding: 8px 12px; text-align: left;">Board Name</th>
          <th style="padding: 8px 12px; text-align: left;">Model</th>
          <th style="padding: 8px 12px; text-align: left;">Serial No. (JUKI)</th>
          <th style="padding: 8px 12px; text-align: center;">Current Status</th>
          <th style="padding: 8px 12px; text-align: left;">Connected Machine</th>
          <th style="padding: 8px 12px; text-align: right;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${boards.map(b => {
          const isSelected = currentBoard && b.boardSerial === currentBoard.boardSerial;
          return `
            <tr 
              class="hover-row ${isSelected ? 'selected-row' : ''}" 
              style="border-bottom: 1px solid rgba(255,255,255,0.05); background: ${isSelected ? 'rgba(56, 189, 248, 0.1)' : 'transparent'}; cursor: pointer;"
              data-board-serial="${b.boardSerial}"
            >
              <td style="padding: 8px 12px; font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">
                ${b.boardSerial}
              </td>
              <td style="padding: 8px 12px; font-weight: 700; color: #fff;">
                ${b.partName}
              </td>
              <td style="padding: 8px 12px; font-family: var(--font-mono); color: #cbd5e1;">
                ${b.modelNo || '—'}
              </td>
              <td style="padding: 8px 12px; font-family: var(--font-mono); color: #cbd5e1;">
                ${b.jukiSlNo || b.slNo || '—'}
              </td>
              <td style="padding: 8px 12px; text-align: center;">
                ${renderSimpleStatusBadge(b.status)}
              </td>
              <td style="padding: 8px 12px;">
                ${b.currentMachineSerial ? `
                  <span style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">🧵 ${b.currentMachineSerial}</span>
                ` : `
                  <span style="color: var(--text-muted);">— (In Lab Stock)</span>
                `}
              </td>
              <td style="padding: 8px 12px; text-align: right;">
                <button class="btn btn-secondary btn-sm btn-inspect-board" data-serial="${b.boardSerial}" style="padding: 2px 8px; font-size: 11px; font-weight: 700;">
                  Select 🔍
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * ============================================================
 * COMPLETE LIFETIME HISTORY MODAL (Drawer / Modal View)
 * ============================================================
 */
function openCompleteHistoryModal(board, historyList, connectedMachine) {
  let modalViewMode = 'table';
  let historySearch = '';

  const renderModalContent = () => {
    const q = historySearch.trim().toLowerCase();
    const filtered = historyList.filter(h => {
      if (!q) return true;
      return (h.actionLabel || h.action || '').toLowerCase().includes(q) ||
             (h.machineSerial || '').toLowerCase().includes(q) ||
             (h.location || '').toLowerCase().includes(q) ||
             (h.companyName || '').toLowerCase().includes(q) ||
             (h.acceptanceStatus || '').toLowerCase().includes(q) ||
             (h.repairDetails || '').toLowerCase().includes(q) ||
             (h.remarks || '').toLowerCase().includes(q) ||
             (h.timestamp || '').includes(q);
    });

    return `
      <div class="modal-overlay" id="ent-complete-history-modal-overlay">
        <div class="modal-dialog" style="max-width: 1000px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1.5px solid #38bdf8; background: #0f172a;">
          
          <!-- Modal Header -->
          <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px; color: #fff;">
              <span style="font-size: 24px;">📜</span>
              <div>
                <div style="font-size: 16px; font-weight: 800; color: #fff;">
                  Complete Lifetime History &bull; ${board.boardSerial}
                </div>
                <div style="font-size: 11.5px; color: #e0f2fe;">
                  ${board.partName} &bull; Model: ${board.modelNo || 'N/A'} &bull; ${historyList.length} Total Events
                </div>
              </div>
            </div>
            <button id="btn-close-complete-history-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 20px; line-height: 1;">&times;</button>
          </div>

          <!-- Controls Bar -->
          <div style="padding: 12px 20px; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1; min-width: 240px;">
              <input type="text" id="ent-hist-modal-search" class="form-control" placeholder="🔍 Search inside history (Machine, Date, Company, Result)..." value="${historySearch}" style="height: 36px; font-size: 12.5px;" />
            </div>
            
            <div style="display: flex; gap: 6px;">
              <button id="btn-hist-modal-table" class="btn ${modalViewMode === 'table' ? 'btn-primary' : 'btn-ghost'} btn-sm" style="font-weight: 700; font-size: 12px;">
                📋 Ledger Table
              </button>
              <button id="btn-hist-modal-timeline" class="btn ${modalViewMode === 'timeline' ? 'btn-primary' : 'btn-ghost'} btn-sm" style="font-weight: 700; font-size: 12px;">
                🕒 Timeline
              </button>
              <button id="btn-hist-modal-print" class="btn btn-secondary btn-sm" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700; font-size: 12px;">
                🖨️ Print Passport
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1;">
            ${filtered.length === 0 ? `
              <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                No events found matching your search.
              </div>
            ` : modalViewMode === 'table' ? renderHistoryTable(filtered) : renderHistoryTimeline(filtered)}
          </div>

          <!-- Footer -->
          <div class="modal-footer" style="padding: 10px 20px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11.5px; color: var(--text-muted);">
              Showing ${filtered.length} of ${historyList.length} events logged.
            </div>
            <button id="btn-dismiss-complete-history-modal" class="btn btn-secondary btn-sm" style="font-weight: 700;">
              Close
            </button>
          </div>

        </div>
      </div>
    `;
  };

  const showModal = () => {
    let existing = document.getElementById('ent-complete-history-modal-overlay');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', renderModalContent());
    bindModalEvents();
  };

  const bindModalEvents = () => {
    const overlay = document.getElementById('ent-complete-history-modal-overlay');
    if (!overlay) return;

    document.getElementById('btn-close-complete-history-modal')?.addEventListener('click', () => overlay.remove());
    document.getElementById('btn-dismiss-complete-history-modal')?.addEventListener('click', () => overlay.remove());

    document.getElementById('btn-hist-modal-table')?.addEventListener('click', () => {
      modalViewMode = 'table';
      showModal();
    });

    document.getElementById('btn-hist-modal-timeline')?.addEventListener('click', () => {
      modalViewMode = 'timeline';
      showModal();
    });

    document.getElementById('btn-hist-modal-print')?.addEventListener('click', () => {
      overlay.remove();
      openPrintPassportModal(board);
    });

    const sInput = document.getElementById('ent-hist-modal-search');
    if (sInput) {
      sInput.addEventListener('input', (e) => {
        historySearch = e.target.value;
        const body = overlay.querySelector('.modal-body');
        if (body) {
          const q = historySearch.trim().toLowerCase();
          const filtered = historyList.filter(h => {
            if (!q) return true;
            return (h.actionLabel || h.action || '').toLowerCase().includes(q) ||
                   (h.performedByName || '').toLowerCase().includes(q) ||
                   (h.performedByCard || '').toLowerCase().includes(q) ||
                   (h.performedByArea || '').toLowerCase().includes(q) ||
                   (h.machineSerial || '').toLowerCase().includes(q) ||
                   (h.location || '').toLowerCase().includes(q) ||
                   (h.companyName || '').toLowerCase().includes(q) ||
                   (h.acceptanceStatus || '').toLowerCase().includes(q) ||
                   (h.repairDetails || '').toLowerCase().includes(q) ||
                   (h.remarks || '').toLowerCase().includes(q) ||
                   (h.timestamp || '').includes(q);
          });
          body.innerHTML = filtered.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
              No events found matching your search.
            </div>
          ` : modalViewMode === 'table' ? renderHistoryTable(filtered) : renderHistoryTimeline(filtered);
        }
      });
    }
  };

  showModal();
}

/**
 * ============================================================
 * COMPLETE HISTORY LEDGER TABLE
 * Columns: | Date | Action | Board | Machine | Performed By | Result | Remarks |
 * ============================================================
 */
function renderHistoryTable(historyList) {
  return `
    <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); font-size: 11px; text-transform: uppercase; color: #94a3b8; position: sticky; top: 0; z-index: 2;">
          <th style="padding: 10px 12px; text-align: left; width: 85px;">Date</th>
          <th style="padding: 10px 12px; text-align: left; width: 130px;">Action</th>
          <th style="padding: 10px 12px; text-align: left; width: 95px;">Board</th>
          <th style="padding: 10px 12px; text-align: left; width: 95px;">Machine</th>
          <th style="padding: 10px 12px; text-align: left; width: 130px;">Employee Name</th>
          <th style="padding: 10px 12px; text-align: left; width: 90px;">Card No.</th>
          <th style="padding: 10px 12px; text-align: left; width: 120px;">Working Area</th>
          <th style="padding: 10px 12px; text-align: left; width: 110px;">Result</th>
          <th style="padding: 10px 12px; text-align: left;">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${historyList.map(h => {
          const act = ET_ACTIONS[h.action] || { label: h.actionLabel || h.action, icon: '⚡', color: '#38bdf8' };

          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 9px 12px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap;">
                ${h.timestamp ? h.timestamp.split('T')[0] : '—'}
              </td>
              <td style="padding: 9px 12px; font-weight: 700; color: #fff; white-space: nowrap;">
                <span style="color: ${act.color}; margin-right: 4px;">${act.icon}</span>
                <span>${h.actionLabel || act.label}</span>
                ${h.repairAttempt ? `<span style="font-size: 10px; color: #a855f7; font-family: var(--font-mono); margin-left: 4px;">[#${h.repairAttempt}]</span>` : ''}
              </td>
              <td style="padding: 9px 12px; font-family: var(--font-mono); font-weight: 800; color: #38bdf8; white-space: nowrap;">
                ${h.boardSerial || '—'}
              </td>
              <td style="padding: 9px 12px; font-family: var(--font-mono); font-weight: 800; color: ${h.machineSerial ? '#38bdf8' : '#94a3b8'}; white-space: nowrap;">
                ${h.machineSerial ? `🧵 ${h.machineSerial}` : '—'}
              </td>
              <td style="padding: 9px 12px; color: #fff; font-weight: 700; white-space: nowrap;">
                👤 ${h.performedByName || 'Engineer'}
              </td>
              <td style="padding: 9px 12px; font-family: var(--font-mono); color: #38bdf8; font-weight: 800; white-space: nowrap;">
                ${h.performedByCard || '1001'}
              </td>
              <td style="padding: 9px 12px; color: #86efac; font-size: 11px; font-weight: 600; white-space: nowrap;">
                ${h.performedByArea || 'Central ENT Lab'}
              </td>
              <td style="padding: 9px 12px; white-space: nowrap;">
                ${renderResultBadge(h)}
              </td>
              <td style="padding: 9px 12px; color: var(--text-secondary); font-size: 11.5px;">
                ${h.remarks || h.removalReason || h.repairDetails || '—'}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Visual Timeline View
 */
function renderHistoryTimeline(historyList) {
  return `
    <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; position: relative; border-left: 2px solid rgba(56, 189, 248, 0.3); margin-left: 18px;">
      ${historyList.map(h => {
        const act = ET_ACTIONS[h.action] || { label: h.actionLabel || h.action, icon: '⚡', color: '#38bdf8' };
        return `
          <div style="position: relative; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
            
            <div style="position: absolute; left: -27px; top: 12px; width: 14px; height: 14px; border-radius: 50%; background: ${act.color}; border: 2px solid #0f172a; box-shadow: 0 0 6px ${act.color};"></div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 15px;">${act.icon}</span>
                <span style="font-weight: 800; font-size: 13px; color: #fff;">${h.actionLabel || act.label}</span>
                ${h.repairAttempt ? `
                  <span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-family: var(--font-mono); font-weight: 800; font-size: 11px; padding: 1px 6px; border-radius: 4px;">
                    Attempt #${h.repairAttempt}
                  </span>
                ` : ''}
                ${h.acceptanceStatus ? `
                  <span style="background: ${h.acceptanceStatus.includes('Accepted') ? 'rgba(16, 185, 129, 0.2)' : h.acceptanceStatus.includes('Rejected') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${h.acceptanceStatus.includes('Accepted') ? '#34d399' : h.acceptanceStatus.includes('Rejected') ? '#f87171' : '#fbbf24'}; border: 1px solid currentColor; font-weight: 800; font-size: 11px; padding: 1px 6px; border-radius: 4px;">
                    ${h.acceptanceStatus}
                  </span>
                ` : ''}
                ${h.machineSerial ? `
                  <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-family: var(--font-mono); font-weight: 800; font-size: 11px; padding: 1px 6px; border-radius: 4px;">
                    Machine: ${h.machineSerial}
                  </span>
                ` : ''}
                ${h.companyName ? `
                  <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-weight: 700; font-size: 11px; padding: 1px 6px; border-radius: 4px;">
                    🏢 ${h.companyName}
                  </span>
                ` : ''}
              </div>

              <div style="font-size: 11.5px; font-family: var(--font-mono); color: #94a3b8;">
                ${h.timestamp ? h.timestamp.split('T')[0] : '—'}
              </div>
            </div>

            ${h.problem ? `<div style="font-size: 11.5px; color: #fde047;"><strong>Problem:</strong> ${h.problem}</div>` : ''}
            ${h.repairDetails ? `<div style="font-size: 11.5px; color: #cbd5e1;"><strong>Repair Details:</strong> ${h.repairDetails}</div>` : ''}
            ${h.repairDurationDays ? `<div style="font-size: 11.5px; color: #34d399; font-weight: 700;">⏱️ Turnaround: ${h.repairDurationDays} Days</div>` : ''}
            ${h.removalReason ? `<div style="font-size: 11.5px; color: #f87171;"><strong>Removal Reason:</strong> ${h.removalReason}</div>` : ''}
            ${h.remarks ? `<div style="font-size: 11.5px; color: var(--text-secondary);">${h.remarks}</div>` : ''}

            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px; display: flex; justify-content: space-between;">
              <span>Verified / Authorized: <strong style="color: #cbd5e1;">${h.verifiedBy || h.performedByName || 'Engineer'}</strong></span>
              <span>Location: ${h.location || 'ENT Lab'}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Modal to Add or Edit External Repair Company & Vendor
 */
function openEditCompanyModal(companyId = null, onSave = null) {
  const isNew = !companyId;
  const companies = etLabService.getCompanies();
  const company = isNew ? null : companies.find(c => c.id === companyId);

  if (!isNew && !company) {
    notificationService.error('External repair company not found.');
    return;
  }

  // Remove existing modal if any
  document.getElementById('edit-company-modal-overlay')?.remove();

  const modalHtml = `
    <div class="modal-overlay" id="edit-company-modal-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 540px; box-shadow: 0 12px 40px rgba(0,0,0,0.85); border: 1.5px solid #a855f7;">
        
        <div class="modal-header" style="background: linear-gradient(135deg, #7e22ce, #6b21a8); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px; color: #fff;">
            <span style="font-size: 22px;">🏢</span>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">
                ${isNew ? '➕ Register External Repair Company &amp; Vendor' : '✏️ Edit External Repair Company &amp; Vendor'}
              </div>
              <div style="font-size: 11px; color: #e9d5ff;">
                ${isNew ? 'Add a new authorized third-party lab / service partner' : `Update vendor profile &bull; ${escapeHtml(company.name)}`}
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-edit-comp-modal" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <form id="form-edit-company">
          <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
            
            <div class="form-group">
              <label class="form-label required" style="font-weight: 700; color: #fff;">Company Name</label>
              <input type="text" id="edit-comp-name" class="form-control" value="${escapeHtml(company?.name || '')}" placeholder="e.g. JUKI Bangladesh Ltd. - Technical Service Center" required style="height: 38px; font-size: 13px;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700; color: #fff;">Contact Person</label>
                <input type="text" id="edit-comp-contact" class="form-control" value="${escapeHtml(company?.contactPerson || '')}" placeholder="e.g. Engr. Mahbubul Alam" style="height: 38px; font-size: 13px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700; color: #fff;">Phone Number</label>
                <input type="text" id="edit-comp-phone" class="form-control" value="${escapeHtml(company?.phone || '')}" placeholder="e.g. +8801713000111" style="height: 38px; font-size: 13px;" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 700; color: #fff;">Email Address</label>
              <input type="email" id="edit-comp-email" class="form-control" value="${escapeHtml(company?.email || '')}" placeholder="e.g. service@juki-bd.com" style="height: 38px; font-size: 13px;" />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 700; color: #fff;">Office / Lab Address</label>
              <input type="text" id="edit-comp-address" class="form-control" value="${escapeHtml(company?.address || '')}" placeholder="e.g. Plot 14, Sector 7, Uttara, Dhaka" style="height: 38px; font-size: 13px;" />
            </div>

          </div>

          <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-secondary btn-close-edit-comp-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #7e22ce, #6b21a8); border: 1px solid #c084fc;">
              ${isNew ? '➕ Register Vendor' : '💾 Save Changes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('edit-company-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-edit-comp-modal').forEach(b => b.addEventListener('click', close));

  document.getElementById('form-edit-company')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-comp-name')?.value.trim();
    if (!name) {
      notificationService.warning('Please enter a company name.');
      return;
    }
    const contactPerson = document.getElementById('edit-comp-contact')?.value.trim() || '';
    const phone = document.getElementById('edit-comp-phone')?.value.trim() || '';
    const email = document.getElementById('edit-comp-email')?.value.trim() || '';
    const address = document.getElementById('edit-comp-address')?.value.trim() || '';

    if (isNew) {
      etLabService.addCompany({
        name,
        contactPerson,
        phone,
        email,
        address
      });
      notificationService.success(`Company "${name}" registered successfully!`);
    } else {
      etLabService.updateCompany(companyId, {
        name,
        contactPerson,
        phone,
        email,
        address
      });
      notificationService.success(`Company "${name}" updated successfully!`);
    }

    close();
    if (typeof onSave === 'function') onSave();
  });
}

/**
 * Modal to Edit Board Category / Item Type
 */
function openEditCategoryModal(catId, onSave = null) {
  const categories = etLabService.getCategories();
  const cat = categories.find(c => c.id === catId);
  if (!cat) {
    notificationService.error('Category not found.');
    return;
  }

  document.getElementById('edit-cat-modal-overlay')?.remove();

  const modalHtml = `
    <div class="modal-overlay" id="edit-cat-modal-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 460px; box-shadow: 0 12px 40px rgba(0,0,0,0.85); border: 1.5px solid #38bdf8;">
        
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px; color: #fff;">
            <span style="font-size: 22px;">📦</span>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">Edit Board Category &amp; Type</div>
              <div style="font-size: 11px; color: #e0f2fe;">Update circuit board category name</div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-edit-cat-modal" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <form id="form-edit-category">
          <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label required" style="font-weight: 700; color: #fff;">Category / Item Type Name</label>
              <input type="text" id="edit-cat-name" class="form-control" value="${escapeHtml(cat.name || '')}" placeholder="e.g. Servo Motor Drive PCB" required style="height: 38px; font-size: 13px;" />
            </div>
          </div>

          <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-secondary btn-close-edit-cat-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 800;">
              💾 Save Changes
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('edit-cat-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-edit-cat-modal').forEach(b => b.addEventListener('click', close));

  document.getElementById('form-edit-category')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-cat-name')?.value.trim();
    if (!name) {
      notificationService.warning('Please enter a category name.');
      return;
    }

    etLabService.updateCategory(catId, { name });
    close();
    notificationService.success(`Category updated to "${name}"!`);
    if (typeof onSave === 'function') onSave();
  });
}

/**
 * ============================================================
 * INLINE LAB CONFIGURATION & STAFF SETUP VIEW
 * ============================================================
 */
function renderEntLabConfigInlineView() {
  const categories = etLabService.getCategories();
  const companies = etLabService.getCompanies();
  const technicians = etLabService.getTechnicians();
  const erpEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
      
      <!-- Top Banner / Launcher Card for Spare Parts -->
      <div style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(15, 23, 42, 0.9)); border: 1.5px solid #38bdf8; border-radius: var(--radius-lg); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 28px;">⚙️</div>
          <div>
            <div style="font-size: 15px; font-weight: 800; color: #fff;">
              Spare Parts Management &amp; Enterprise Master Catalog
            </div>
            <div style="font-size: 12px; color: #38bdf8; margin-top: 2px;">
              Master catalog items, stock specifications, machine usage ledgers &amp; replacement history linkage
            </div>
          </div>
        </div>
        <button id="btn-inline-open-spare-parts" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); padding: 8px 18px;">
          🚀 Open Spare Parts Catalog &amp; Studio
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px;">
        
        <!-- 1. Section-Wise ENT Lab Technicians & Staff -->
        <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
            <div style="font-size: 14px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span>
              <span>ENT Lab Section Technicians &amp; Staff (${technicians.length})</span>
            </div>
            <span style="font-size: 11px; font-weight: 600; color: #86efac;">🔗 Linked to Manpower</span>
          </div>
          
          <div style="font-size: 11.5px; color: var(--text-secondary);">
            Authorized technicians for circuit board diagnostic tests, component soldering, repair, removal &amp; machine installation. Select any employee from Manpower Management to auto-fill details.
          </div>

          <!-- Add Staff Form with Live Search from Manpower -->
          <div style="display: flex; flex-direction: column; gap: 8px; background: rgba(30, 41, 59, 0.7); padding: 12px; border-radius: 8px; border: 1.5px dashed rgba(56, 189, 248, 0.45);">
            <div style="font-size: 11px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span>🔍</span>
                <span>Auto-Search &amp; Link Technician from Manpower:</span>
              </span>
              <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">Type Name, Card No, or Designation</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 8px; align-items: flex-start;">
              <!-- 1. Search Box with Live Dropdown Popup -->
              <div style="position: relative;">
                <div style="position: relative; display: flex; align-items: center;">
                  <input 
                    type="text" 
                    id="inline-tech-name" 
                    class="form-control" 
                    placeholder="🔍 Search Name or Card No..." 
                    style="height: 38px; font-size: 12px; font-weight: 700; padding-left: 12px; padding-right: 28px; background: rgba(15, 23, 42, 0.95); border: 1.5px solid #38bdf8; color: #fff; box-shadow: 0 0 10px rgba(56, 189, 248, 0.15);" 
                    autocomplete="off"
                  />
                  <button 
                    type="button" 
                    id="btn-clear-inline-tech" 
                    style="position: absolute; right: 6px; background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer; display: none; padding: 2px 6px;" 
                    title="Clear selection"
                  >✕</button>
                </div>
                <div 
                  id="inline-tech-dropdown-results" 
                  style="display: none; position: absolute; top: 42px; left: 0; right: 0; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; max-height: 260px; overflow-y: auto; z-index: 1050; box-shadow: 0 12px 35px rgba(0,0,0,0.95);"
                ></div>
              </div>

              <!-- 2. Role (Auto-filled from Manpower) -->
              <input 
                type="text" 
                id="inline-tech-role" 
                class="form-control" 
                placeholder="Role (Auto from Manpower)" 
                style="height: 38px; font-size: 12px; background: rgba(15, 23, 42, 0.85); border-color: rgba(255,255,255,0.15);" 
              />

              <!-- 3. Section (Auto-filled from Manpower) -->
              <input 
                type="text" 
                id="inline-tech-section" 
                class="form-control" 
                placeholder="Section (Auto from Manpower)" 
                style="height: 38px; font-size: 12px; background: rgba(15, 23, 42, 0.85); border-color: rgba(255,255,255,0.15);" 
              />

              <!-- 4. Add Button -->
              <button 
                id="btn-inline-add-tech" 
                class="btn btn-primary btn-sm" 
                style="font-weight: 800; height: 38px; padding: 0 16px; white-space: nowrap; background: linear-gradient(135deg, #0284c7, #0369a1); border: 1px solid #38bdf8;"
              >
                ➕ Add Staff
              </button>
            </div>

            <!-- Selection Status Indicator -->
            <div id="inline-tech-selection-badge" style="display: none; font-size: 11px; color: #34d399; font-weight: 600; padding: 4px 10px; background: rgba(16, 185, 129, 0.12); border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.25);">
              🔗 Linked to Manpower: <span id="inline-tech-badge-name" style="color: #fff; font-weight: 700;"></span> 
              &bull; Card: <span id="inline-tech-badge-card" style="font-family: var(--font-mono); color: #38bdf8;"></span>
              &bull; <span id="inline-tech-badge-dept"></span>
            </div>
          </div>

          <!-- Technicians List -->
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
            ${technicians.length === 0 ? `
              <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 14px;">No dedicated technicians configured. Defaulting to all Manpower mechanics.</div>
            ` : technicians.map(t => `
              <div style="background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); padding: 8px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                <div>
                  <strong style="color: #fff;">${t.name}</strong>
                  ${t.cardNumber ? `<span style="font-family: var(--font-mono); color: #38bdf8; font-size: 11px; margin-left: 6px;">[Card: ${t.cardNumber}]</span>` : ''}
                  <span style="color: #86efac; font-size: 11px; margin-left: 8px;">&bull; ${t.role}</span>
                  <span style="color: #cbd5e1; font-size: 11px; margin-left: 6px;">(${t.section})</span>
                </div>
                <button class="btn btn-ghost btn-sm btn-inline-del-tech" data-id="${t.id}" style="color: #f87171; padding: 2px 8px; font-size: 12px;" title="Remove Technician">🗑️</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right Column: Categories & External Companies -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <!-- 2. Item Types / Categories -->
          <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 13.5px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
              <span>📦</span>
              <span>Board Categories &amp; Hardware Types (${categories.length})</span>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <input type="text" id="inline-cat-name" class="form-control" placeholder="New Item Type (e.g. Servo Driver, Inverter...)" style="height: 36px;" />
              <button id="btn-inline-add-cat" class="btn btn-primary btn-sm" style="font-weight: 700; white-space: nowrap;">
                ➕ Add Type
              </button>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 130px; overflow-y: auto;">
              ${categories.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 6px 0;">No categories registered.</div>
              ` : categories.map(c => `
                <span class="et-cat-chip" style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); color: #fff; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                  <span>${escapeHtml(c.name)}</span>
                  <button class="btn-inline-edit-cat" data-id="${c.id}" data-name="${escapeHtml(c.name)}" style="background: none; border: none; color: #38bdf8; cursor: pointer; padding: 0 2px; font-size: 11px; line-height: 1;" title="Edit Category Name">✏️</button>
                  <button class="btn-inline-del-cat" data-id="${c.id}" data-name="${escapeHtml(c.name)}" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 0 2px; font-size: 11px; line-height: 1;" title="Delete Category">✕</button>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- 3. External Repair Companies -->
          <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="font-size: 13.5px; font-weight: 800; color: #a855f7; display: flex; align-items: center; gap: 6px;">
                <span>🏢</span>
                <span>External Repair Companies &amp; Vendors (${companies.length})</span>
              </div>
              <button id="btn-inline-open-add-comp-modal" class="btn btn-ghost btn-xs" style="color: #c084fc; font-size: 11.5px; font-weight: 700; padding: 3px 8px; border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 4px; background: rgba(168, 85, 247, 0.1);" title="Register vendor with full contact &amp; address details">
                ➕ Detailed Form
              </button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px;">
              <input type="text" id="inline-comp-name" class="form-control" placeholder="Company Name" style="height: 36px;" />
              <input type="text" id="inline-comp-contact" class="form-control" placeholder="Contact Person / Phone" style="height: 36px;" />
              <button id="btn-inline-add-comp" class="btn btn-primary btn-sm" style="font-weight: 700; white-space: nowrap; background: linear-gradient(135deg, #7e22ce, #6b21a8); border: 1px solid #c084fc;">
                ➕ Add
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto;">
              ${companies.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px;">No external repair vendors registered yet.</div>
              ` : companies.map(c => `
                <div style="background: rgba(30, 41, 59, 0.75); border: 1px solid var(--border-color); padding: 8px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px;">
                  <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
                    <div style="color: var(--text-muted); font-size: 11px; display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap;">
                      <span style="color: #cbd5e1;">👤 ${escapeHtml(c.contactPerson || 'Service Partner')}</span>
                      ${c.phone ? `<span>&bull;</span> <span style="color: #38bdf8;">📞 ${escapeHtml(c.phone)}</span>` : ''}
                      ${c.email ? `<span>&bull;</span> <span style="color: #c084fc;">✉️ ${escapeHtml(c.email)}</span>` : ''}
                      ${c.address ? `<span>&bull;</span> <span style="color: #94a3b8;">📍 ${escapeHtml(c.address)}</span>` : ''}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    <button class="btn btn-ghost btn-sm btn-inline-edit-comp" data-id="${c.id}" style="color: #38bdf8; padding: 2px 6px; font-size: 12px; border-radius: 4px;" title="Edit Company Details">✏️</button>
                    <button class="btn btn-ghost btn-sm btn-inline-del-comp" data-id="${c.id}" style="color: #f87171; padding: 2px 6px; font-size: 12px; border-radius: 4px;" title="Delete Company">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

      </div>

    </div>
  `;
}

/**
 * Setup real-time Manpower Autocomplete Search for ENT Lab Technicians
 * Allows searching factory manpower by Name, Card Number, Designation, Department, or Area
 * Auto-populates Role, Section, Card Number, and Phone
 */
function setupManpowerTechAutocomplete({
  inputEl,
  dropdownEl,
  clearBtnEl,
  roleEl,
  secEl,
  badgeEl,
  badgeNameEl,
  badgeCardEl,
  badgeDeptEl,
  erpEmployees,
  existingTechs = [],
  onSelect = null
}) {
  if (!inputEl || !dropdownEl) return null;

  let highlightedIndex = -1;
  let currentMatches = [];

  const filterEmployees = (query = '') => {
    const q = (query || '').trim().toLowerCase();
    let list = erpEmployees || [];
    if (q) {
      list = list.filter(emp => {
        const name = (emp.name || '').toLowerCase();
        const card = (emp.cardNumber || '').toString().toLowerCase();
        const desig = (emp.designation || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const area = (emp.workingArea || '').toLowerCase();
        const phone = (emp.phone || '').toLowerCase();
        return name.includes(q) || card.includes(q) || desig.includes(q) || dept.includes(q) || area.includes(q) || phone.includes(q);
      });
    } else {
      // Prioritize technical, mechanics, electrical, maintenance staff
      list = [...list].sort((a, b) => {
        const isTechA = /tech|mechanic|engineer|electric|lab|pcb/i.test((a.designation || '') + ' ' + (a.department || ''));
        const isTechB = /tech|mechanic|engineer|electric|lab|pcb/i.test((b.designation || '') + ' ' + (b.department || ''));
        if (isTechA && !isTechB) return -1;
        if (!isTechA && isTechB) return 1;
        return 0;
      });
    }
    return list.slice(0, 15);
  };

  const renderDropdown = (query = '') => {
    currentMatches = filterEmployees(query);
    highlightedIndex = -1;

    const existingCardNumbers = new Set((existingTechs || []).map(t => (t.cardNumber || '').toString().toLowerCase()));
    const existingNames = new Set((existingTechs || []).map(t => (t.name || '').trim().toLowerCase()));

    if (currentMatches.length === 0) {
      dropdownEl.innerHTML = `
        <div style="padding: 12px 14px; text-align: center; color: var(--text-muted); font-size: 12px;">
          No Manpower staff found matching "<strong>${query}</strong>".
        </div>
      `;
      dropdownEl.style.display = 'block';
      return;
    }

    dropdownEl.innerHTML = `
      <div style="padding: 6px 12px; font-size: 10.5px; font-weight: 700; color: #38bdf8; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <span>MANPOWER DIRECTORY (${currentMatches.length})</span>
        <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">Click to select &amp; auto-fill</span>
      </div>
      <div style="max-height: 220px; overflow-y: auto;">
        ${currentMatches.map((emp, idx) => {
          const isAlreadyAdded = (emp.cardNumber && existingCardNumbers.has(emp.cardNumber.toString().toLowerCase())) ||
                                 existingNames.has((emp.name || '').trim().toLowerCase());
          const roleDisplay = (emp.designation || 'Technician').replace(/E&amp;T|E&T/g, 'ENT');
          const areaDisplay = (emp.workingArea || emp.department || 'Central ENT Lab').replace(/E&amp;T|E&T/g, 'ENT');
          return `
            <div 
              class="manpower-tech-item" 
              data-index="${idx}"
              style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;"
            >
              <div style="flex: 1; min-width: 0; padding-right: 8px;">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <strong style="color: #fff; font-size: 12px;">${emp.name}</strong>
                  ${emp.cardNumber ? `<span style="font-family: var(--font-mono); color: #38bdf8; background: rgba(56,189,248,0.12); padding: 1px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">Card: ${emp.cardNumber}</span>` : ''}
                  ${isAlreadyAdded ? `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 10px; padding: 1px 5px; border-radius: 4px; font-weight: 600;">Already in Staff</span>` : ''}
                </div>
                <div style="color: #94a3b8; font-size: 11px; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="color: #86efac; font-weight: 600;">💼 ${roleDisplay}</span>
                  <span>&bull;</span>
                  <span>📍 ${areaDisplay}</span>
                  ${emp.phone ? `<span>&bull;</span><span>📞 ${emp.phone}</span>` : ''}
                </div>
              </div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 700; white-space: nowrap;">
                Select ➔
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    dropdownEl.querySelectorAll('.manpower-tech-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        dropdownEl.querySelectorAll('.manpower-tech-item').forEach(el => el.style.background = 'transparent');
        item.style.background = 'rgba(56, 189, 248, 0.15)';
        highlightedIndex = parseInt(item.getAttribute('data-index'), 10);
      });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(item.getAttribute('data-index'), 10);
        if (currentMatches[idx]) {
          selectEmployee(currentMatches[idx]);
        }
      });
    });

    dropdownEl.style.display = 'block';
  };

  const selectEmployee = (emp) => {
    inputEl.value = emp.name;
    inputEl.dataset.selectedCard = emp.cardNumber || '';
    inputEl.dataset.selectedPhone = emp.phone || '';

    if (roleEl) {
      roleEl.value = (emp.designation || 'ENT Specialist').replace(/E&amp;T|E&T/g, 'ENT');
    }
    if (secEl) {
      secEl.value = (emp.workingArea || emp.department || 'Central ENT Lab').replace(/E&amp;T|E&T/g, 'ENT');
    }

    if (clearBtnEl) {
      clearBtnEl.style.display = 'block';
    }

    if (badgeEl && badgeNameEl) {
      badgeNameEl.textContent = emp.name;
      if (badgeCardEl) badgeCardEl.textContent = emp.cardNumber ? emp.cardNumber : 'No Card';
      if (badgeDeptEl) badgeDeptEl.textContent = `${(emp.designation || 'Tech').replace(/E&amp;T|E&T/g, 'ENT')} • ${(emp.workingArea || emp.department || 'ENT Lab').replace(/E&amp;T|E&T/g, 'ENT')}`;
      badgeEl.style.display = 'block';
    }

    dropdownEl.style.display = 'none';

    if (typeof onSelect === 'function') {
      onSelect(emp);
    }
  };

  const clearSelection = () => {
    inputEl.value = '';
    delete inputEl.dataset.selectedCard;
    delete inputEl.dataset.selectedPhone;
    if (roleEl) roleEl.value = '';
    if (secEl) secEl.value = '';
    if (badgeEl) badgeEl.style.display = 'none';
    if (clearBtnEl) clearBtnEl.style.display = 'none';
    dropdownEl.style.display = 'none';
    inputEl.focus({ preventScroll: true });
  };

  if (clearBtnEl) {
    clearBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelection();
    });
  }

  inputEl.addEventListener('input', () => {
    if (clearBtnEl) {
      clearBtnEl.style.display = inputEl.value.length > 0 ? 'block' : 'none';
    }
    if (badgeEl && (!inputEl.value || inputEl.value.toLowerCase() !== badgeNameEl?.textContent?.toLowerCase())) {
      badgeEl.style.display = 'none';
      delete inputEl.dataset.selectedCard;
      delete inputEl.dataset.selectedPhone;
    }
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener('focus', () => {
    renderDropdown(inputEl.value);
  });

  inputEl.addEventListener('keydown', (e) => {
    const items = dropdownEl.querySelectorAll('.manpower-tech-item');
    if (dropdownEl.style.display === 'block' && items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex + 1) % items.length;
        items.forEach((el, i) => {
          el.style.background = i === highlightedIndex ? 'rgba(56, 189, 248, 0.2)' : 'transparent';
          if (i === highlightedIndex) el.scrollIntoView({ block: 'nearest' });
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => {
          el.style.background = i === highlightedIndex ? 'rgba(56, 189, 248, 0.2)' : 'transparent';
          if (i === highlightedIndex) el.scrollIntoView({ block: 'nearest' });
        });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && currentMatches[highlightedIndex]) {
          selectEmployee(currentMatches[highlightedIndex]);
        } else if (currentMatches.length > 0) {
          selectEmployee(currentMatches[0]);
        }
        return;
      }
      if (e.key === 'Escape') {
        dropdownEl.style.display = 'none';
        return;
      }
    }
  });

  const onDocClick = (e) => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      dropdownEl.style.display = 'none';
    }
  };
  document.addEventListener('click', onDocClick);

  return {
    clear: clearSelection,
    close: () => { dropdownEl.style.display = 'none'; },
    destroy: () => { document.removeEventListener('click', onDocClick); }
  };
}

function initEntLabConfigInlineEvents(refreshEntLab) {
  const erpEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
  const existingTechs = etLabService.getTechnicians() || [];

  document.getElementById('btn-inline-open-spare-parts')?.addEventListener('click', () => {
    activeEntTab = 'spare-parts';
    refreshEntLab();
  });

  // Real-time Manpower Autocomplete Search & Auto-Fill
  setupManpowerTechAutocomplete({
    inputEl: document.getElementById('inline-tech-name'),
    dropdownEl: document.getElementById('inline-tech-dropdown-results'),
    clearBtnEl: document.getElementById('btn-clear-inline-tech'),
    roleEl: document.getElementById('inline-tech-role'),
    secEl: document.getElementById('inline-tech-section'),
    badgeEl: document.getElementById('inline-tech-selection-badge'),
    badgeNameEl: document.getElementById('inline-tech-badge-name'),
    badgeCardEl: document.getElementById('inline-tech-badge-card'),
    badgeDeptEl: document.getElementById('inline-tech-badge-dept'),
    erpEmployees,
    existingTechs
  });

  document.getElementById('btn-inline-add-tech')?.addEventListener('click', () => {
    const inputEl = document.getElementById('inline-tech-name');
    const name = inputEl?.value.trim();
    const role = document.getElementById('inline-tech-role')?.value.trim() || 'ENT Specialist';
    const section = document.getElementById('inline-tech-section')?.value.trim() || 'Central ENT Lab';
    const cardNumber = inputEl?.dataset.selectedCard || '';
    const phone = inputEl?.dataset.selectedPhone || '';

    if (name) {
      try {
        etLabService.addTechnician({
          name,
          cardNumber,
          role,
          section,
          phone
        });
        refreshEntLab();
        notificationService.success(`Technician "${name}" added to ENT Lab staff!`);
      } catch (err) {
        notificationService.warning(err.message || 'Technician is already registered.');
      }
    } else {
      notificationService.warning('Please enter an employee name or search from Manpower Management.');
    }
  });

  document.querySelectorAll('.btn-inline-del-tech').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        etLabService.deleteTechnician(id);
        refreshEntLab();
        notificationService.success('Technician removed.');
      }
    });
  });

  document.getElementById('btn-inline-add-cat')?.addEventListener('click', () => {
    const name = document.getElementById('inline-cat-name')?.value.trim();
    if (name) {
      etLabService.addCategory(name);
      refreshEntLab();
      notificationService.success(`Category "${name}" added!`);
    } else {
      notificationService.warning('Please enter a category name.');
    }
  });

  // Edit & Delete for Categories
  document.querySelectorAll('.btn-inline-edit-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        openEditCategoryModal(id, refreshEntLab);
      }
    });
  });

  document.querySelectorAll('.btn-inline-del-cat').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      const name = e.currentTarget.getAttribute('data-name') || 'this category';
      if (id) {
        const confirmed = await notificationService.confirm({
          title: 'Delete Hardware Category',
          message: `Are you sure you want to delete category <strong>${escapeHtml(name)}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Category',
          cancelText: 'Cancel',
          isDestructive: true
        });
        if (confirmed) {
          etLabService.deleteCategory(id);
          refreshEntLab();
          notificationService.success(`Category "${name}" deleted.`);
        }
      }
    });
  });

  document.getElementById('btn-inline-open-add-comp-modal')?.addEventListener('click', () => {
    openEditCompanyModal(null, refreshEntLab);
  });

  document.getElementById('btn-inline-add-comp')?.addEventListener('click', () => {
    const name = document.getElementById('inline-comp-name')?.value.trim();
    const contactRaw = document.getElementById('inline-comp-contact')?.value.trim() || '';
    if (name) {
      let contactPerson = contactRaw;
      let phone = '';
      if (contactRaw.includes('•')) {
        const parts = contactRaw.split('•').map(s => s.trim());
        contactPerson = parts[0];
        phone = parts[1] || '';
      } else if (contactRaw.includes('/')) {
        const parts = contactRaw.split('/').map(s => s.trim());
        contactPerson = parts[0];
        phone = parts[1] || '';
      } else if (contactRaw.includes(',')) {
        const parts = contactRaw.split(',').map(s => s.trim());
        contactPerson = parts[0];
        phone = parts[1] || '';
      }
      etLabService.addCompany(name, contactPerson, phone);
      refreshEntLab();
      notificationService.success(`Company "${name}" added!`);
    } else {
      notificationService.warning('Please enter a company name.');
    }
  });

  // Edit & Delete for External Companies
  document.querySelectorAll('.btn-inline-edit-comp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        openEditCompanyModal(id, refreshEntLab);
      }
    });
  });

  document.querySelectorAll('.btn-inline-del-comp').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const companies = etLabService.getCompanies();
      const comp = companies.find(c => c.id === id);
      const compName = comp?.name || 'this company';
      if (id) {
        const confirmed = await notificationService.confirm({
          title: 'Delete External Repair Company',
          message: `Are you sure you want to delete <strong>${escapeHtml(compName)}</strong> from External Repair Companies &amp; Vendors?`,
          icon: '🗑️',
          confirmText: 'Delete Company',
          cancelText: 'Cancel',
          isDestructive: true
        });
        if (confirmed) {
          etLabService.deleteCompany(id);
          refreshEntLab();
          notificationService.success(`Company "${compName}" deleted.`);
        }
      }
    });
  });
}

/**
 * ============================================================
 * EVENT INITIALIZATION
 * ============================================================
 */
export function initEtLabEvents() {
  const refreshEntLab = () => {
    const container = document.getElementById('main-view-container');
    if (container) {
      container.innerHTML = renderEtLabManagementView();
      initEtLabEvents();
    }
  };

  // Sub-Tab Switching Handlers
  document.getElementById('ent-tab-btn-boards')?.addEventListener('click', () => {
    activeEntTab = 'boards';
    refreshEntLab();
  });

  document.getElementById('ent-tab-btn-spare-parts')?.addEventListener('click', () => {
    activeEntTab = 'spare-parts';
    refreshEntLab();
  });

  document.getElementById('ent-tab-btn-lab-config')?.addEventListener('click', () => {
    activeEntTab = 'lab-config';
    refreshEntLab();
  });

  document.getElementById('btn-ent-top-spare-config')?.addEventListener('click', () => {
    activeEntTab = 'spare-parts';
    refreshEntLab();
  });

  // If Spare Parts tab is active, initialize spare parts events!
  if (activeEntTab === 'spare-parts') {
    initSparePartsManagementEvents();
    return;
  }

  // If Lab Config tab is active, initialize inline lab config events!
  if (activeEntTab === 'lab-config') {
    initEntLabConfigInlineEvents(refreshEntLab);
    return;
  }

  // 1. Search Box with Smooth Live Popup & Keyboard Navigation (Enter, Arrow Keys, Focus)
  const searchInput = document.getElementById('ent-live-search-input');
  const dropdownResults = document.getElementById('ent-search-dropdown-results');
  const btnClearSearch = document.getElementById('btn-clear-ent-search');

  if (searchInput && dropdownResults) {
    let highlightedIndex = -1;

    const renderDropdownItems = (query = '') => {
      const q = (query || '').trim().toLowerCase();
      const all = etLabService.getBoards() || [];
      const matches = all.filter(b => {
        if (!q) return true;
        const s = (b.boardSerial || '').toLowerCase();
        const n = (b.partName || '').toLowerCase();
        const m = (b.modelNo || '').toLowerCase();
        const j = (b.jukiSlNo || b.slNo || '').toLowerCase();
        const mach = (b.currentMachineSerial || '').toLowerCase();
        return s.includes(q) || n.includes(q) || m.includes(q) || j.includes(q) || mach.includes(q);
      }).slice(0, 15);

      highlightedIndex = -1;

      if (matches.length === 0) {
        dropdownResults.innerHTML = `
          <div style="padding: 14px; text-align: center; color: var(--text-muted); font-size: 12px;">
            No boards found matching "<strong>${query}</strong>". Click <strong>+ New Board</strong> to register.
          </div>
        `;
        dropdownResults.style.display = 'block';
        return matches;
      }

      dropdownResults.innerHTML = matches.map((m, idx) => `
        <div class="ent-search-item" data-index="${idx}" data-serial="${m.boardSerial}" style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="color: #38bdf8; font-family: var(--font-mono); font-size: 13px; background: rgba(56,189,248,0.12); padding: 2px 6px; border-radius: 4px;">${m.boardSerial}</strong>
              <strong style="color: #fff; font-size: 13px;">${m.partName}</strong>
            </div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 2px; display: flex; gap: 10px;">
              <span>Model: <strong style="color: #cbd5e1;">${m.modelNo || '—'}</strong></span>
              <span>S/N: <strong style="color: #cbd5e1;">${m.jukiSlNo || m.slNo || '—'}</strong></span>
              <span>Machine: <strong style="color: ${m.currentMachineSerial ? '#38bdf8' : '#86efac'};">${m.currentMachineSerial ? `🧵 ${m.currentMachineSerial}` : 'In Lab Spares'}</strong></span>
            </div>
          </div>
          <div>
            ${renderSimpleStatusBadge(m.status)}
          </div>
        </div>
      `).join('');

      dropdownResults.querySelectorAll('.ent-search-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
          dropdownResults.querySelectorAll('.ent-search-item').forEach(i => i.style.background = 'transparent');
          item.style.background = 'rgba(56, 189, 248, 0.18)';
        });
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
        item.addEventListener('click', () => {
          const serial = item.getAttribute('data-serial');
          if (serial) {
            selectedBoardSerial = serial;
            dropdownResults.style.display = 'none';
            refreshEntLab();
          }
        });
      });

      dropdownResults.style.display = 'block';
      return matches;
    };

    // Open dropdown on focus / click
    searchInput.addEventListener('focus', () => {
      searchInput.select();
      const rawVal = searchInput.value;
      const cleanVal = rawVal.includes('—') ? '' : rawVal;
      renderDropdownItems(cleanVal);
    });

    // Live search without page re-render while typing!
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (btnClearSearch) btnClearSearch.style.display = val.length > 0 ? 'block' : 'none';
      renderDropdownItems(val);
    });

    // Keyboard navigation (Enter, Arrow Down, Arrow Up, Escape)
    searchInput.addEventListener('keydown', (e) => {
      const items = dropdownResults.querySelectorAll('.ent-search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length > 0) {
          highlightedIndex = (highlightedIndex + 1) % items.length;
          items.forEach((it, i) => it.style.background = (i === highlightedIndex ? 'rgba(56, 189, 248, 0.25)' : 'transparent'));
          items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length > 0) {
          highlightedIndex = (highlightedIndex - 1 + items.length) % items.length;
          items.forEach((it, i) => it.style.background = (i === highlightedIndex ? 'rgba(56, 189, 248, 0.25)' : 'transparent'));
          items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          const serial = items[highlightedIndex].getAttribute('data-serial');
          if (serial) {
            selectedBoardSerial = serial;
            dropdownResults.style.display = 'none';
            refreshEntLab();
          }
        } else {
          // Select first match or exact match
          const query = searchInput.value.trim().toLowerCase();
          const all = etLabService.getBoards() || [];
          const matched = all.find(b => 
            b.boardSerial.toLowerCase() === query || 
            b.boardSerial.toLowerCase().includes(query) ||
            b.partName.toLowerCase().includes(query) ||
            (b.currentMachineSerial && b.currentMachineSerial.toLowerCase().includes(query))
          ) || all[0];

          if (matched) {
            selectedBoardSerial = matched.boardSerial;
            dropdownResults.style.display = 'none';
            refreshEntLab();
          }
        }
      } else if (e.key === 'Escape') {
        dropdownResults.style.display = 'none';
      }
    });

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedBoardSerial = null;
        searchInput.value = '';
        btnClearSearch.style.display = 'none';
        dropdownResults.style.display = 'none';
        refreshEntLab();
        setTimeout(() => {
          document.getElementById('ent-live-search-input')?.focus({ preventScroll: true });
        }, 50);
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !dropdownResults.contains(e.target) && !btnClearSearch?.contains(e.target)) {
        dropdownResults.style.display = 'none';
      }
    });
  }

  // Empty state buttons
  document.getElementById('btn-empty-open-directory')?.addEventListener('click', () => {
    const dir = document.getElementById('ent-collapsible-directory');
    if (dir) {
      dir.style.display = 'block';
      dir.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  document.getElementById('btn-empty-new-board')?.addEventListener('click', () => {
    openAddOrEditBoardModal(null);
  });

  // 2. Filter Status
  document.getElementById('ent-filter-status')?.addEventListener('change', (e) => {
    filterStatus = e.target.value;
    refreshEntLab();
  });

  // 3. Clear Filters
  document.getElementById('btn-reset-ent-filters')?.addEventListener('click', () => {
    searchFilterQuery = '';
    filterStatus = 'ALL';
    refreshEntLab();
  });

  // 4. Quick Jump Chips & Table Row Select
  document.querySelectorAll('.btn-quick-select-board, .btn-inspect-board, tr[data-board-serial]').forEach(el => {
    el.addEventListener('click', (e) => {
      const serial = el.getAttribute('data-serial') || el.getAttribute('data-board-serial');
      if (serial) {
        selectedBoardSerial = serial;
        refreshEntLab();
      }
    });
  });

  // 5. History View Mode Toggle
  document.getElementById('btn-toggle-table')?.addEventListener('click', () => {
    historyViewMode = 'table';
    refreshEntLab();
  });

  document.getElementById('btn-toggle-timeline')?.addEventListener('click', () => {
    historyViewMode = 'timeline';
    refreshEntLab();
  });

  // 6. TOP PROMINENT "+ ADD ACTION" BUTTON
  document.getElementById('btn-top-add-action')?.addEventListener('click', () => {
    const board = selectedBoardSerial ? etLabService.getBoardBySerial(selectedBoardSerial) : null;
    if (board) {
      openActionModal(board);
    } else {
      notificationService.info('Please search and select a board first to add an action.');
      document.getElementById('ent-live-search-input')?.focus({ preventScroll: true });
    }
  });

  // 6.1 TOP "📊 REPORTS" BUTTON
  document.getElementById('btn-top-open-reports')?.addEventListener('click', () => {
    state.set('reportActiveTab', 'etlab');
    state.set('currentView', 'reports');
  });

  // 7. QUICK ACTION BUTTONS (1-Click trigger for specific action)
  document.querySelectorAll('.btn-quick-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const actionType = btn.getAttribute('data-action');
      const board = selectedBoardSerial ? etLabService.getBoardBySerial(selectedBoardSerial) : null;
      if (board) openActionModal(board, actionType);
    });
  });

  // 8. Add New Board Modal
  document.getElementById('btn-open-add-board-modal')?.addEventListener('click', () => {
    openAddOrEditBoardModal(null);
  });

  // 9. Edit Board Specs Modal
  document.getElementById('btn-trigger-edit-board')?.addEventListener('click', () => {
    const board = selectedBoardSerial ? etLabService.getBoardBySerial(selectedBoardSerial) : null;
    if (board) openAddOrEditBoardModal(board);
  });

  // 10. Admin Configuration Modal
  document.getElementById('btn-open-admin-config')?.addEventListener('click', () => {
    openAdminConfigModal();
  });

  // 11. Complete History Modal (Drawer / Modal View)
  document.getElementById('btn-open-complete-history-modal')?.addEventListener('click', () => {
    const board = selectedBoardSerial ? etLabService.getBoardBySerial(selectedBoardSerial) : null;
    if (board) {
      const historyList = etLabService.getBoardHistory(board.boardSerial);
      const connectedMachine = board.currentMachineSerial ? 
        etLabService.getMachineDetailsForBoard(board.currentMachineSerial) : null;
      openCompleteHistoryModal(board, historyList, connectedMachine);
    }
  });

  // 12. Toggle Master Directory Table View
  document.getElementById('btn-toggle-directory-view')?.addEventListener('click', () => {
    const dir = document.getElementById('ent-collapsible-directory');
    if (dir) {
      dir.style.display = dir.style.display === 'none' ? 'block' : 'none';
    }
  });

  // 13. Print / PDF Passport
  document.getElementById('btn-print-board-passport')?.addEventListener('click', () => {
    const board = selectedBoardSerial ? etLabService.getBoardBySerial(selectedBoardSerial) : null;
    if (board) {
      openPrintPassportModal(board);
    } else {
      notificationService.info('Please search and select a board first to print its passport.');
      document.getElementById('ent-live-search-input')?.focus({ preventScroll: true });
    }
  });

  // 14. Export Excel
  document.getElementById('btn-export-ent-excel')?.addEventListener('click', () => {
    exportEntLabExcel();
  });
}

/**
 * ============================================================
 * SIMPLE, ACTION-FOCUSED ACTION MODAL
 * 
 * Rules:
 * 1. First select Action Type (Install, Remove, Repair, Send, Receive, Assign)
 * 2. THEN show ONLY the fields required for that selected action!
 * 3. Do not show all fields at once!
 * ============================================================
 */
function openActionModal(board, initialActionType = null) {
  const user = authService.getCurrentUser();
  const machineOptions = etLabService.getAllMachinesForSelect();
  const companies = etLabService.getCompanies();
  const isInstalled = board.status === 'INSTALLED' && Boolean(board.currentMachineSerial);

  // Retrieve comprehensive personnel from Manpower Management, ERP Users, and ENT Technicians
  const allPersonnel = etLabService.getAllPersonnelForSelect();
  const curUserName = user?.name || user?.username || 'Engr. Tanvir Ahmed';

  // Helper to render searchable employee selector with Card Number, Name, Working Area
  const renderPersonnelSelector = (id, label, defaultName = '', color = '#38bdf8') => {
    let initialPerson = {
      name: '',
      cardNumber: '',
      workingArea: ''
    };
    if (defaultName) {
      const match = allPersonnel.find(p => p.name === defaultName);
      if (match) {
        initialPerson = match;
      } else {
        initialPerson = {
          name: defaultName,
          cardNumber: '',
          workingArea: ''
        };
      }
    }

    const hasInitial = Boolean(initialPerson.name);

    return `
      <div class="form-group ent-person-select-wrapper" style="position: relative;">
        <label class="form-label required" style="font-weight: 800; color: ${color}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span>${label}</span>
          <span style="font-size: 10.5px; font-weight: 700; color: #38bdf8;">🪪 Search Card No. / Name / Area</span>
        </label>
        
        <!-- Hidden payload fields to store exact identification -->
        <input type="hidden" id="${id}-name" value="${initialPerson.name}" />
        <input type="hidden" id="${id}-card" value="${initialPerson.cardNumber || ''}" />
        <input type="hidden" id="${id}-area" value="${initialPerson.workingArea || ''}" />
        <input type="hidden" id="${id}-id" value="${initialPerson.id || ''}" />

        <!-- Searchable Selector Input -->
        <div style="position: relative;">
          <input 
            type="text" 
            id="${id}-search" 
            class="form-control ent-person-search-box" 
            data-target="${id}" 
            placeholder="🔍 Search Card No (e.g. 10235), Name, or Working Area..." 
            value="${hasInitial ? (initialPerson.cardNumber ? `Card: ${initialPerson.cardNumber} | ${initialPerson.name} | ${initialPerson.workingArea}` : initialPerson.name) : ''}"
            style="font-weight: 800; height: 38px; font-size: 12px; background: #0f172a; border: 1.5px solid #334155; color: #fff; padding-right: 28px;" 
            autocomplete="off" 
            required
          />
          <button type="button" class="btn-clear-person" data-target="${id}" style="position: absolute; right: 8px; top: 8px; background: none; border: none; color: #94a3b8; font-size: 14px; cursor: pointer;" title="Clear Search">✕</button>

          <!-- Dropdown Results list -->
          <div id="${id}-dropdown" class="ent-person-dropdown" style="display: none; position: absolute; top: 40px; left: 0; right: 0; z-index: 1050; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.9); max-height: 210px; overflow-y: auto;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Distinct Selected Employee Verification Card -->
        <div id="${id}-display-card" style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 6px; padding: 6px 10px; margin-top: 4px; display: grid; grid-template-columns: 1.2fr 1fr 1.2fr; gap: 4px; font-size: 11px;">
          <div>
            <span style="color: #94a3b8; font-size: 10px;">Employee Name:</span><br/>
            <strong id="${id}-disp-name" style="color: #fff; font-size: 12px;">${initialPerson.name || '—'}</strong>
          </div>
          <div>
            <span style="color: #94a3b8; font-size: 10px;">Card Number:</span><br/>
            <strong id="${id}-disp-card" style="font-family: var(--font-mono); color: #38bdf8; font-size: 12px;">${initialPerson.cardNumber || '—'}</strong>
          </div>
          <div>
            <span style="color: #94a3b8; font-size: 10px;">Working Area:</span><br/>
            <strong id="${id}-disp-area" style="color: #86efac; font-size: 11.5px;">${initialPerson.workingArea || '—'}</strong>
          </div>
        </div>
      </div>
    `;
  };

  const renderMachineSearchAndDetails = (inputId, prefix, labelText, themeColor) => `
    <div class="form-group">
      <label class="form-label" style="font-weight: 800; color: ${themeColor};">
        ${labelText}
      </label>
      <input 
        type="text" 
        id="${inputId}" 
        list="shared-machines-datalist" 
        class="form-control" 
        placeholder="Type or scan machine serial (e.g. JA-01, TS-01, GB-05)..." 
        value=""
        style="font-family: var(--font-mono); font-weight: 800; font-size: 13.5px; height: 38px;"
        autocomplete="off"
      />
    </div>

    <!-- Auto-Filled Live Machine Details Card -->
    <div id="${prefix}-auto-machine-card" style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid ${themeColor}66; border-radius: 8px; padding: 12px 14px; font-size: 12px;">
      <div style="font-size: 11px; font-weight: 800; color: ${themeColor}; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
        <span>📍 Auto-Filled Machine Details (Machine Inventory):</span>
        <span id="${prefix}-status" style="font-size: 10px; font-weight: 700; color: #86efac; background: rgba(34, 197, 94, 0.15); padding: 2px 6px; border-radius: 4px; display: none;"></span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px;">
        <div>
          <span style="color: #94a3b8; font-size: 10.5px;">Machine Name:</span><br/>
          <strong id="${prefix}-name" style="color: #fff; font-size: 12.5px;">—</strong>
        </div>
        <div>
          <span style="color: #94a3b8; font-size: 10.5px;">Model:</span><br/>
          <strong id="${prefix}-model" style="color: #cbd5e1; font-size: 12.5px; font-family: var(--font-mono);">—</strong>
        </div>
        <div>
          <span style="color: #94a3b8; font-size: 10.5px;">Brand:</span><br/>
          <strong id="${prefix}-brand" style="color: #facc15; font-size: 12.5px;">—</strong>
        </div>
        <div>
          <span style="color: #94a3b8; font-size: 10.5px;">Machine Serial:</span><br/>
          <strong id="${prefix}-serial" style="color: ${themeColor}; font-family: var(--font-mono); font-size: 12.5px;">—</strong>
        </div>
        <div>
          <span style="color: #94a3b8; font-size: 10.5px;">Floor:</span><br/>
          <strong id="${prefix}-floor" style="color: #cbd5e1; font-size: 12.5px;">—</strong>
        </div>
        <div>
          <span style="color: #94a3b8; font-size: 10.5px;">Line:</span><br/>
          <strong id="${prefix}-line" style="color: #86efac; font-size: 12.5px; font-weight: 800;">—</strong>
        </div>
      </div>
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.08); font-size: 11px; color: #94a3b8;">
        Unit / Factory: <strong id="${prefix}-unit" style="color: #e2e8f0;">—</strong>
      </div>
    </div>
  `;

  const renderPartsSerialField = (inputId, themeColor) => `
    <div class="form-group">
      <label class="form-label" style="font-weight: 800; color: ${themeColor}; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span>Parts Serial Number / Board S/N:</span>
        <span style="font-size: 10.5px; font-weight: 600; color: #94a3b8;">(Part SL No / JUKI S/N)</span>
      </label>
      <input 
        type="text" 
        id="${inputId}" 
        class="form-control" 
        placeholder="Enter parts serial number (e.g. JK-CPU-99026, SN-88321)..." 
        value=""
        style="font-family: var(--font-mono); font-weight: 800; font-size: 13px; height: 38px; background: #0f172a; border: 1.5px solid #334155; color: #fff;"
        autocomplete="off"
      />
    </div>
  `;

  const todayStr = new Date().toISOString().split('T')[0];

  // Determine initial action selection
  let defaultAction = initialActionType;
  if (!defaultAction) {
    if (isInstalled) defaultAction = 'REMOVE';
    else if (board.status === 'UNDER_INHOUSE_REPAIR') defaultAction = 'INHOUSE_REPAIR';
    else if (board.status === 'SENT_EXTERNAL') defaultAction = 'RECEIVE';
    else defaultAction = 'INSTALL';
  }

  const modalHtml = `
    <div class="modal-overlay" id="ent-action-modal-overlay">
      <div class="modal-dialog" style="max-width: 660px; max-height: 88vh; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1.5px solid #38bdf8; border-radius: 12px; overflow: hidden; background: var(--bg-card);">
        
        <!-- Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px; color: #fff;">
            <span style="font-size: 24px;">⚡</span>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff;">Add Action &bull; ${board.boardSerial}</div>
              <div style="font-size: 11.5px; color: #e0f2fe;">${board.partName} (Current Status: ${board.status})</div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-modal" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <form id="form-action-execution" style="display: flex; flex-direction: column; flex: 1; min-height: 0; margin: 0;">
          <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; min-height: 0;">
            
            <!-- 1. ACTION TYPE SELECTION (STEP 1) -->
            <div class="form-group" style="background: rgba(15, 23, 42, 0.85); border: 2px solid #38bdf8; border-radius: 8px; padding: 12px 14px;">
              <label class="form-label required" style="font-weight: 900; color: #38bdf8; font-size: 13px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                <span>1. Select Action Type:</span>
                <span style="font-size: 11px; font-weight: 600; color: #86efac;">Shows only relevant fields below</span>
              </label>
              <select id="act-type-selector" class="form-control" style="font-size: 13.5px; font-weight: 700; height: 40px; background: #0f172a; border-color: #38bdf8; color: #fff;" required>
                <option value="INSTALL" ${defaultAction === 'INSTALL' ? 'selected' : ''}>📥 Install / Assign</option>
                <option value="REMOVE" ${defaultAction === 'REMOVE' ? 'selected' : ''}>📤 Remove</option>
                <option value="INHOUSE_REPAIR" ${defaultAction === 'INHOUSE_REPAIR' ? 'selected' : ''}>🛠️ In-House Repair</option>
                <option value="SEND_OUTSIDE" ${defaultAction === 'SEND_OUTSIDE' ? 'selected' : ''}>🚚 Send to External Company</option>
                <option value="RECEIVE" ${defaultAction === 'RECEIVE' ? 'selected' : ''}>🟣 Receive (with Verification)</option>
                <option value="ASSIGN_ANOTHER" ${defaultAction === 'ASSIGN_ANOTHER' ? 'selected' : ''}>🔄 Assign to Another Machine</option>
              </select>
            </div>

            <!-- ========================================================= -->
            <!-- 2. ACTION-SPECIFIC FIELDS (ONLY SELECTED ACTION IS SHOWN) -->
            <!-- ========================================================= -->

            <!-- Shared Machines Datalist for fast auto-complete across all actions -->
            <datalist id="shared-machines-datalist">
              ${machineOptions.map(m => `<option value="${m.serialNumber}">${m.displayText}</option>`).join('')}
            </datalist>

            <!-- ACTION 1: INSTALL / ASSIGN -->
            <div id="fields-install" class="action-field-group" style="display: none; flex-direction: column; gap: 10px;">
              ${renderMachineSearchAndDetails('install-machine-serial', 'ins-auto', 'Search Target Machine Number / Serial Number:', '#38bdf8')}
              ${renderPartsSerialField('install-parts-serial', '#38bdf8')}

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label required">Install Date</label>
                  <input type="date" id="install-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Remarks</label>
                  <input type="text" id="install-remarks" class="form-control" placeholder="Installation remarks or work note..." style="height: 38px;" />
                </div>
              </div>

              <!-- Employee Name at the very last -->
              ${renderPersonnelSelector('install-assigned-to', 'Assigned To / Installed By', '', '#38bdf8')}
            </div>

            <!-- ACTION 2: REMOVE -->
            <div id="fields-remove" class="action-field-group" style="display: none; flex-direction: column; gap: 10px;">
              ${renderMachineSearchAndDetails('remove-machine-serial', 'remove-auto', 'Search Machine Number / Serial Number:', '#f59e0b')}
              ${renderPartsSerialField('remove-parts-serial', '#f59e0b')}

              <div class="form-group">
                <label class="form-label required" style="font-weight: 800; color: #f59e0b;">Removal Reason / Problem Symptom</label>
                <input type="text" id="remove-reason" class="form-control" placeholder="e.g. Error Code E-02, Trimmer pulse failed, Scheduled maintenance..." required />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label required">Removal Date</label>
                  <input type="date" id="remove-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                </div>
                <div class="form-group">
                  <label class="form-label required" style="font-weight: 700; color: #fff;">Next Board Status</label>
                  <select id="remove-next-status" class="form-control" style="font-weight: 700; height: 38px;">
                    <option value="AVAILABLE_SPARE">🔵 Available / Spare (Ready in Lab Stock)</option>
                    <option value="UNDER_INHOUSE_REPAIR">🟠 Under In-House Repair</option>
                    <option value="SENT_EXTERNAL">🔴 Sent to External Company</option>
                    <option value="DAMAGED_SCRAP">❌ Damaged / Scrap</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Remarks</label>
                <input type="text" id="remove-remarks" class="form-control" placeholder="Optional notes for removal record..." />
              </div>

              <!-- Employee Name at the very last -->
              ${renderPersonnelSelector('remove-by', 'Removed By', '', '#f59e0b')}
            </div>

            <!-- ACTION 3: IN-HOUSE REPAIR -->
            <div id="fields-inhouse" class="action-field-group" style="display: none; flex-direction: column; gap: 10px;">
              ${renderMachineSearchAndDetails('inhouse-machine-serial', 'inhouse-auto', 'Search Machine Number / Serial Number:', '#f97316')}
              ${renderPartsSerialField('inhouse-parts-serial', '#f97316')}

              <div class="form-group">
                <label class="form-label required" style="font-weight: 800; color: #f97316;">Repair Stage</label>
                <select id="inhouse-stage" class="form-control" style="font-weight: 700; height: 38px;">
                  <option value="START">🟠 Start / Log In-House Repair</option>
                  <option value="COMPLETE" ${board.status === 'UNDER_INHOUSE_REPAIR' ? 'selected' : ''}>✅ Mark In-House Repair Completed (Restore to Spares)</option>
                </select>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label required" style="font-weight: 700; color: #fff;">Problem / Symptom</label>
                  <input type="text" id="inhouse-problem" class="form-control" placeholder="e.g. Power MOSFET blown, solder joint cracked..." value="${board.inhouseRepair?.problem || ''}" required />
                </div>
                <div class="form-group">
                  <label class="form-label required">Repair Date</label>
                  <input type="date" id="inhouse-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700; color: #fff;">Repair Details / Actions Taken</label>
                <textarea id="inhouse-details" class="form-control" rows="2" placeholder="Replaced IC, diode testing passed...">${board.inhouseRepair?.details || ''}</textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Remarks</label>
                <input type="text" id="inhouse-remarks" class="form-control" placeholder="Optional notes..." value="${board.inhouseRepair?.remarks || ''}" />
              </div>

              <!-- Employee Name at the very last -->
              ${renderPersonnelSelector('inhouse-repaired-by', 'Repaired By', '', '#f97316')}
            </div>

            <!-- ACTION 4: SEND TO EXTERNAL COMPANY -->
            <div id="fields-send-outside" class="action-field-group" style="display: none; flex-direction: column; gap: 10px;">
              ${renderMachineSearchAndDetails('send-machine-serial', 'send-auto', 'Search Machine Number / Serial Number:', '#a855f7')}
              ${renderPartsSerialField('send-parts-serial', '#a855f7')}

              <div class="form-group">
                <label class="form-label required" style="font-weight: 800; color: #a855f7;">External Repair Company</label>
                <select id="send-company-name" class="form-control" style="font-weight: 700; height: 38px;" required>
                  ${companies.map(c => `<option value="${c.name}">${c.name} (${c.contactPerson || 'Service Partner'})</option>`).join('')}
                </select>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label required">Send Date</label>
                  <input type="date" id="send-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Expected Return Date</label>
                  <input type="date" id="send-expected-date" class="form-control" style="height: 38px;" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label required" style="font-weight: 700; color: #fff;">Fault Details / Repair Work Requested</label>
                <textarea id="send-problem" class="form-control" rows="2" placeholder="Describe fault sent to outside lab..." required></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Remarks</label>
                <input type="text" id="send-remarks" class="form-control" placeholder="Optional notes for gate pass / tracking..." />
              </div>

              <!-- Employee Name at the very last -->
              ${renderPersonnelSelector('send-by', 'Sent By', '', '#a855f7')}
            </div>

            <!-- ACTION 5: RECEIVE WITH REPAIR VERIFICATION -->
            <div id="fields-receive" class="action-field-group" style="display: none; flex-direction: column; gap: 10px;">
              ${renderMachineSearchAndDetails('receive-machine-serial', 'receive-auto', 'Search Machine Number / Serial Number:', '#34d399')}
              ${renderPartsSerialField('receive-parts-serial', '#34d399')}

              <div style="background: rgba(16, 185, 129, 0.1); border: 1.5px solid #10b981; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="font-size: 12.5px; font-weight: 800; color: #34d399; display: flex; align-items: center; justify-content: space-between;">
                  <span>🔬 Repair Verification &amp; Acceptance</span>
                  <span style="font-size: 10.5px; font-weight: 700; background: rgba(16, 185, 129, 0.2); padding: 2px 8px; border-radius: 4px; color: #a7f3d0;">
                    ${board.externalRepair?.companyName ? `Vendor: ${board.externalRepair.companyName}` : 'External Return'}
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label required">Receive Date</label>
                    <input type="date" id="receive-return-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label required" style="font-weight: 800; color: #fff;">Repair Result:</label>
                    <select id="receive-repair-result" class="form-control" style="font-weight: 800; font-size: 13px; height: 38px;" required>
                      <option value="SUCCESSFUL" selected>✅ Successfully Repaired</option>
                      <option value="NOT_REPAIRED">❌ Not Repaired / Problem Not Solved</option>
                      <option value="PARTIALLY_REPAIRED">⚠️ Partially Repaired</option>
                      <option value="SEND_AGAIN">🔄 Send Again</option>
                    </select>
                  </div>
                </div>

                <!-- Dynamic Send Again Box (if Send Again selected) -->
                <div id="resend-options-box" style="display: none; background: rgba(15, 23, 42, 0.85); border: 1.5px dashed #a855f7; border-radius: 6px; padding: 10px 12px; flex-direction: column; gap: 8px;">
                  <div style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase;">
                    🔄 Send Again Configuration (Creates New Repair Record):
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div class="form-group">
                      <label class="form-label required" style="font-size: 11px;">Resend To Company</label>
                      <select id="resend-company-select" class="form-control" style="font-size: 12px;">
                        ${companies.map(c => `
                          <option value="${c.name}" ${board.externalRepair?.companyName === c.name ? 'selected' : ''}>${c.name}</option>
                        `).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-size: 11px;">Expected Return Date</label>
                      <input type="date" id="resend-expected-date" class="form-control" style="font-size: 12px;" />
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div class="form-group">
                    <label class="form-label required" style="font-weight: 700; color: #cbd5e1;">Verification Date</label>
                    <input type="date" id="receive-verification-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700; color: #cbd5e1;">Repair Details / Remarks</label>
                    <input type="text" id="receive-details" class="form-control" placeholder="Testing findings, replaced components..." style="height: 38px;" />
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Remarks</label>
                <input type="text" id="receive-remarks" class="form-control" placeholder="Optional notes for receiving record..." />
              </div>

              ${renderPersonnelSelector('receive-by', 'Received By', '', '#34d399')}
              <!-- Employee Name at the very last -->
              ${renderPersonnelSelector('receive-verified-by', 'Verified By', '', '#34d399')}
            </div>

            <!-- ACTION 6: ASSIGN TO ANOTHER MACHINE -->
            <div id="fields-assign-another" class="action-field-group" style="display: none; flex-direction: column; gap: 10px;">
              ${renderMachineSearchAndDetails('reassign-machine-serial', 're-auto', 'Search New Target Machine Number / Serial Number:', '#6366f1')}
              ${renderPartsSerialField('reassign-parts-serial', '#6366f1')}

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label required">Reassignment Date</label>
                  <input type="date" id="reassign-date" class="form-control" value="${todayStr}" style="height: 38px;" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Remarks</label>
                  <input type="text" id="reassign-remarks" class="form-control" placeholder="Reassignment reason or notes..." style="height: 38px;" />
                </div>
              </div>

              <!-- Employee Name at the very last -->
              ${renderPersonnelSelector('reassign-by', 'Assigned By', '', '#818cf8')}
            </div>

          </div>

          <!-- Footer -->
          <div class="modal-footer" style="padding: 14px 20px; background: #0f172a; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-shrink: 0;">
            <button type="button" class="btn btn-secondary btn-close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #38bdf8; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4);">
              💾 Save Action &amp; Update History
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('ent-action-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', close));

  // ============================================================
  // INTERACTIVE SEARCHABLE EMPLOYEE SELECTOR (Card No, Name, Area)
  // ============================================================
  const setupEmployeeSearchInput = (searchBox) => {
    const targetId = searchBox.getAttribute('data-target');
    const dropdown = document.getElementById(`${targetId}-dropdown`);
    if (!dropdown) return;

    const syncCustomOrClear = (typedVal) => {
      const trimmed = (typedVal || '').trim();
      const elName = document.getElementById(`${targetId}-name`);
      const elCard = document.getElementById(`${targetId}-card`);
      const elArea = document.getElementById(`${targetId}-area`);
      const elDispName = document.getElementById(`${targetId}-disp-name`);
      const elDispCard = document.getElementById(`${targetId}-disp-card`);
      const elDispArea = document.getElementById(`${targetId}-disp-area`);

      if (!trimmed) {
        if (elName) elName.value = '';
        if (elCard) elCard.value = '';
        if (elArea) elArea.value = '';
        if (elDispName) elDispName.textContent = '—';
        if (elDispCard) elDispCard.textContent = '—';
        if (elDispArea) elDispArea.textContent = '—';
        return;
      }

      if (trimmed.startsWith('Card:')) {
        return;
      }

      const match = allPersonnel.find(p => 
        (p.cardNumber && p.cardNumber.toLowerCase() === trimmed.toLowerCase()) ||
        (p.name && p.name.toLowerCase() === trimmed.toLowerCase())
      );
      if (match) {
        if (elName) elName.value = match.name;
        if (elCard) elCard.value = match.cardNumber || '';
        if (elArea) elArea.value = match.workingArea || '';
        if (elDispName) elDispName.textContent = match.name;
        if (elDispCard) elDispCard.textContent = match.cardNumber || '—';
        if (elDispArea) elDispArea.textContent = match.workingArea || '—';
      } else {
        if (elName) elName.value = trimmed;
        if (elDispName) elDispName.textContent = trimmed;
        if (elDispCard) elDispCard.textContent = '—';
        if (elDispArea) elDispArea.textContent = '—';
      }
    };

    const renderMatches = (q) => {
      const term = q.trim().toLowerCase();
      const cleanTerm = term.startsWith('card:') ? '' : term;
      const matches = allPersonnel.filter(p => {
        if (!cleanTerm) return true;
        return (p.cardNumber && p.cardNumber.toLowerCase().includes(cleanTerm)) ||
               (p.name && p.name.toLowerCase().includes(cleanTerm)) ||
               (p.workingArea && p.workingArea.toLowerCase().includes(cleanTerm)) ||
               (p.designation && p.designation.toLowerCase().includes(cleanTerm)) ||
               (p.department && p.department.toLowerCase().includes(cleanTerm));
      });

      if (matches.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 10px 12px; color: var(--text-muted); font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
            <span>Staff not found in directory. Use "<strong>${q}</strong>" as typed name.</span>
          </div>
        `;
      } else {
        dropdown.innerHTML = matches.map(p => `
          <div class="ent-person-item" data-target="${targetId}" data-name="${p.name}" data-card="${p.cardNumber || '—'}" data-area="${p.workingArea || 'ENT Lab'}" data-id="${p.id}" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;">
            <div>
              <span style="font-family: var(--font-mono); font-weight: 900; color: #38bdf8; font-size: 11.5px; background: rgba(56, 189, 248, 0.15); padding: 2px 6px; border-radius: 4px; margin-right: 6px;">[ Card: ${p.cardNumber || '—'} ]</span>
              <strong style="color: #fff; font-size: 12.5px;">${p.name}</strong>
            </div>
            <div style="text-align: right;">
              <span style="color: #86efac; font-size: 11px; font-weight: 700;">📍 ${p.workingArea || 'ENT Lab'}</span>
              <div style="color: #94a3b8; font-size: 10px;">${p.designation || 'Technician'}</div>
            </div>
          </div>
        `).join('');

        // Bind clicks on rows
        dropdown.querySelectorAll('.ent-person-item').forEach(item => {
          item.addEventListener('mouseenter', () => item.style.background = 'rgba(56, 189, 248, 0.15)');
          item.addEventListener('mouseleave', () => item.style.background = 'transparent');
          item.addEventListener('click', () => {
            const pName = item.getAttribute('data-name');
            const pCard = item.getAttribute('data-card');
            const pArea = item.getAttribute('data-area');
            const pId = item.getAttribute('data-id');

            document.getElementById(`${targetId}-name`).value = pName;
            document.getElementById(`${targetId}-card`).value = pCard;
            document.getElementById(`${targetId}-area`).value = pArea;
            document.getElementById(`${targetId}-id`).value = pId;

            searchBox.value = `Card: ${pCard} | ${pName} | ${pArea}`;
            
            document.getElementById(`${targetId}-disp-name`).textContent = pName;
            document.getElementById(`${targetId}-disp-card`).textContent = pCard;
            document.getElementById(`${targetId}-disp-area`).textContent = pArea;

            dropdown.style.display = 'none';
          });
        });
      }
      dropdown.style.display = 'block';
    };

    searchBox.addEventListener('focus', () => renderMatches(searchBox.value));
    searchBox.addEventListener('input', (e) => {
      renderMatches(e.target.value);
      syncCustomOrClear(e.target.value);
    });
  };

  overlay.querySelectorAll('.ent-person-search-box').forEach(sb => setupEmployeeSearchInput(sb));

  // Clear button handler
  overlay.querySelectorAll('.btn-clear-person').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      const sBox = document.getElementById(`${targetId}-search`);
      if (sBox) {
        sBox.value = '';
        sBox.focus({ preventScroll: true });
      }
      const elName = document.getElementById(`${targetId}-name`);
      const elCard = document.getElementById(`${targetId}-card`);
      const elArea = document.getElementById(`${targetId}-area`);
      const elDispName = document.getElementById(`${targetId}-disp-name`);
      const elDispCard = document.getElementById(`${targetId}-disp-card`);
      const elDispArea = document.getElementById(`${targetId}-disp-area`);
      if (elName) elName.value = '';
      if (elCard) elCard.value = '';
      if (elArea) elArea.value = '';
      if (elDispName) elDispName.textContent = '—';
      if (elDispCard) elDispCard.textContent = '—';
      if (elDispArea) elDispArea.textContent = '—';
    });
  });

  // Hide dropdowns when clicking outside
  overlay.addEventListener('click', (e) => {
    if (!e.target.closest('.ent-person-select-wrapper')) {
      overlay.querySelectorAll('.ent-person-dropdown').forEach(d => d.style.display = 'none');
    }
  });

  // Dynamic Section Switcher — Show ONLY the selected action's fields!
  const actionSelector = document.getElementById('act-type-selector');
  const switchActionFields = (val) => {
    document.querySelectorAll('.action-field-group').forEach(el => el.style.display = 'none');
    
    // Toggle required fields cleanly
    const setReq = (id, req) => {
      const el = document.getElementById(id);
      if (el) el.required = req;
    };

    setReq('install-machine-serial', val === 'INSTALL');
    setReq('install-assigned-to-search', val === 'INSTALL');
    
    setReq('remove-reason', val === 'REMOVE');
    setReq('remove-by-search', val === 'REMOVE');
    
    setReq('inhouse-problem', val === 'INHOUSE_REPAIR');
    setReq('inhouse-repaired-by-search', val === 'INHOUSE_REPAIR');
    
    setReq('send-company-name', val === 'SEND_OUTSIDE');
    setReq('send-problem', val === 'SEND_OUTSIDE');
    setReq('send-by-search', val === 'SEND_OUTSIDE');
    
    setReq('receive-by-search', val === 'RECEIVE');
    setReq('receive-verified-by-search', val === 'RECEIVE');
    
    setReq('reassign-machine-serial', val === 'ASSIGN_ANOTHER');
    setReq('reassign-by-search', val === 'ASSIGN_ANOTHER');

    if (val === 'INSTALL') {
      document.getElementById('fields-install').style.display = 'flex';
    } else if (val === 'REMOVE') {
      document.getElementById('fields-remove').style.display = 'flex';
    } else if (val === 'INHOUSE_REPAIR') {
      document.getElementById('fields-inhouse').style.display = 'flex';
    } else if (val === 'SEND_OUTSIDE') {
      document.getElementById('fields-send-outside').style.display = 'flex';
    } else if (val === 'RECEIVE') {
      document.getElementById('fields-receive').style.display = 'flex';
    } else if (val === 'ASSIGN_ANOTHER') {
      document.getElementById('fields-assign-another').style.display = 'flex';
    }
  };

  actionSelector.addEventListener('change', (e) => switchActionFields(e.target.value));
  switchActionFields(defaultAction);

  // Dynamic Resend Toggle in Receive
  const repairResultSelect = document.getElementById('receive-repair-result');
  const resendBox = document.getElementById('resend-options-box');
  if (repairResultSelect && resendBox) {
    repairResultSelect.addEventListener('change', (e) => {
      resendBox.style.display = e.target.value === 'SEND_AGAIN' ? 'flex' : 'none';
    });
  }

  // Live Auto-Fill for Machine Serials
  const bindMachineLookup = (inputId, prefix) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    const lookup = (rawVal) => {
      const elName = document.getElementById(`${prefix}-name`);
      const elModel = document.getElementById(`${prefix}-model`);
      const elBrand = document.getElementById(`${prefix}-brand`);
      const elSerial = document.getElementById(`${prefix}-serial`);
      const elFloor = document.getElementById(`${prefix}-floor`);
      const elLine = document.getElementById(`${prefix}-line`);
      const elUnit = document.getElementById(`${prefix}-unit`);
      const elStatus = document.getElementById(`${prefix}-status`);

      let val = (rawVal || '').trim();
      if (val.includes('—')) val = val.split('—')[0].trim();
      else if (val.includes(' - ')) val = val.split(' - ')[0].trim();

      if (!val) {
        if (elName) elName.textContent = '—';
        if (elModel) elModel.textContent = '—';
        if (elBrand) elBrand.textContent = '—';
        if (elSerial) elSerial.textContent = '—';
        if (elFloor) elFloor.textContent = '—';
        if (elLine) elLine.textContent = '—';
        if (elUnit) elUnit.textContent = '—';
        if (elStatus) elStatus.style.display = 'none';
        return;
      }

      const mach = etLabService.getMachineDetailsForBoard(val);
      if (mach) {
        if (elName) elName.textContent = mach.machineName || '—';
        if (elModel) elModel.textContent = mach.model || '—';
        if (elBrand) elBrand.textContent = mach.brand || '—';
        if (elSerial) elSerial.textContent = mach.serialNumber || val;
        if (elFloor) elFloor.textContent = mach.floorName || '—';
        if (elLine) elLine.textContent = mach.lineName || '—';
        if (elUnit) elUnit.textContent = mach.unitName || '—';
        if (elStatus) {
          elStatus.textContent = `✓ ${mach.status || 'ACTIVE'}`;
          elStatus.style.display = 'inline-block';
        }
      } else {
        if (elName) elName.textContent = '⚠️ Not Found in Inventory';
        if (elModel) elModel.textContent = '—';
        if (elBrand) elBrand.textContent = '—';
        if (elSerial) elSerial.textContent = val;
        if (elFloor) elFloor.textContent = '—';
        if (elLine) elLine.textContent = '—';
        if (elUnit) elUnit.textContent = '—';
        if (elStatus) elStatus.style.display = 'none';
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        lookup(input.value);
      }
    });
    input.addEventListener('input', (e) => lookup(e.target.value));
    input.addEventListener('change', (e) => lookup(e.target.value));
    if (input.value) lookup(input.value);
  };

  bindMachineLookup('install-machine-serial', 'ins-auto');
  bindMachineLookup('remove-machine-serial', 'remove-auto');
  bindMachineLookup('inhouse-machine-serial', 'inhouse-auto');
  bindMachineLookup('send-machine-serial', 'send-auto');
  bindMachineLookup('receive-machine-serial', 'receive-auto');
  bindMachineLookup('reassign-machine-serial', 're-auto');

  // Form Submission
  document.getElementById('form-action-execution').addEventListener('submit', (e) => {
    e.preventDefault();
    const actionType = actionSelector.value;

    try {
      if (actionType === 'INSTALL') {
        const mSerial = document.getElementById('install-machine-serial')?.value.trim();
        const assignedToName = document.getElementById('install-assigned-to-name')?.value.trim() || document.getElementById('install-assigned-to-search')?.value.trim();
        const assignedToCard = document.getElementById('install-assigned-to-card')?.value.trim();
        const assignedToArea = document.getElementById('install-assigned-to-area')?.value.trim();
        const partsSerial = document.getElementById('install-parts-serial')?.value.trim();
        const installDate = document.getElementById('install-date')?.value || todayStr;
        const remarks = document.getElementById('install-remarks')?.value.trim() || '';

        if (!mSerial) throw new Error('Please enter or select target Machine Serial.');
        if (!assignedToName) throw new Error('Please select or enter the Assigned To / Installed By employee name.');

        etLabService.installBoardToMachine({
          boardSerial: board.boardSerial,
          machineSerial: mSerial,
          installDate: installDate,
          installedDate: installDate,
          installedBy: assignedToName,
          installedByCard: assignedToCard,
          installedByArea: assignedToArea,
          partsSerial: partsSerial,
          remarks: remarks
        });
      } else if (actionType === 'REMOVE') {
        const mSerial = document.getElementById('remove-machine-serial')?.value.trim();
        const removedByName = document.getElementById('remove-by-name')?.value.trim() || document.getElementById('remove-by-search')?.value.trim();
        const removedByCard = document.getElementById('remove-by-card')?.value.trim();
        const removedByArea = document.getElementById('remove-by-area')?.value.trim();
        const partsSerial = document.getElementById('remove-parts-serial')?.value.trim();
        const removeDate = document.getElementById('remove-date')?.value || todayStr;
        const reason = document.getElementById('remove-reason')?.value.trim();
        const nextStatus = document.getElementById('remove-next-status')?.value;
        const remarks = document.getElementById('remove-remarks')?.value.trim() || '';

        if (!removedByName) throw new Error('Please select or enter the Removed By employee name.');

        etLabService.removeBoardFromMachine({
          boardSerial: board.boardSerial,
          machineSerial: mSerial,
          removalDate: removeDate,
          removedBy: removedByName,
          removedByCard: removedByCard,
          removedByArea: removedByArea,
          partsSerial: partsSerial,
          removalReason: reason,
          nextStatus: nextStatus,
          remarks: remarks
        });
      } else if (actionType === 'INHOUSE_REPAIR') {
        const mSerial = document.getElementById('inhouse-machine-serial')?.value.trim();
        const stage = document.getElementById('inhouse-stage')?.value;
        const repairedByName = document.getElementById('inhouse-repaired-by-name')?.value.trim() || document.getElementById('inhouse-repaired-by-search')?.value.trim();
        const repairedByCard = document.getElementById('inhouse-repaired-by-card')?.value.trim();
        const repairedByArea = document.getElementById('inhouse-repaired-by-area')?.value.trim();
        const partsSerial = document.getElementById('inhouse-parts-serial')?.value.trim();
        const repairDate = document.getElementById('inhouse-date')?.value || todayStr;
        const problem = document.getElementById('inhouse-problem')?.value.trim();
        const details = document.getElementById('inhouse-details')?.value.trim();
        const remarks = document.getElementById('inhouse-remarks')?.value.trim() || '';

        if (!repairedByName) throw new Error('Please select or enter the Repaired By employee name.');

        if (stage === 'START') {
          etLabService.startInHouseRepair({
            boardSerial: board.boardSerial,
            machineSerial: mSerial,
            problem: problem,
            startDate: repairDate,
            repairedBy: repairedByName,
            repairedByCard: repairedByCard,
            repairedByArea: repairedByArea,
            partsSerial: partsSerial,
            details: details,
            remarks: remarks
          });
        } else {
          etLabService.completeInHouseRepair({
            boardSerial: board.boardSerial,
            machineSerial: mSerial,
            completeDate: repairDate,
            repairedBy: repairedByName,
            repairedByCard: repairedByCard,
            repairedByArea: repairedByArea,
            partsSerial: partsSerial,
            repairDetails: details || problem,
            remarks: remarks
          });
        }
      } else if (actionType === 'SEND_OUTSIDE') {
        const mSerial = document.getElementById('send-machine-serial')?.value.trim();
        const company = document.getElementById('send-company-name')?.value;
        const sentByName = document.getElementById('send-by-name')?.value.trim() || document.getElementById('send-by-search')?.value.trim();
        const sentByCard = document.getElementById('send-by-card')?.value.trim();
        const sentByArea = document.getElementById('send-by-area')?.value.trim();
        const partsSerial = document.getElementById('send-parts-serial')?.value.trim();
        const sendDate = document.getElementById('send-date')?.value || todayStr;
        const expDate = document.getElementById('send-expected-date')?.value;
        const problem = document.getElementById('send-problem')?.value.trim();
        const remarks = document.getElementById('send-remarks')?.value.trim() || '';

        if (!sentByName) throw new Error('Please select or enter the Sent By employee name.');

        etLabService.sendToExternalCompany({
          boardSerial: board.boardSerial,
          machineSerial: mSerial,
          companyName: company,
          sendDate: sendDate,
          expectedReturnDate: expDate,
          problem: problem,
          sentBy: sentByName,
          sentByCard: sentByCard,
          sentByArea: sentByArea,
          performedByName: sentByName,
          partsSerial: partsSerial,
          remarks: remarks
        });
      } else if (actionType === 'RECEIVE') {
        const mSerial = document.getElementById('receive-machine-serial')?.value.trim();
        const receivedByName = document.getElementById('receive-by-name')?.value.trim() || document.getElementById('receive-by-search')?.value.trim();
        const receivedByCard = document.getElementById('receive-by-card')?.value.trim();
        const receivedByArea = document.getElementById('receive-by-area')?.value.trim();
        const receiveDate = document.getElementById('receive-return-date')?.value || todayStr;
        const vDate = document.getElementById('receive-verification-date')?.value || receiveDate;
        const vByName = document.getElementById('receive-verified-by-name')?.value.trim() || document.getElementById('receive-verified-by-search')?.value.trim() || receivedByName;
        const vByCard = document.getElementById('receive-verified-by-card')?.value.trim() || receivedByCard;
        const vByArea = document.getElementById('receive-verified-by-area')?.value.trim() || receivedByArea;
        const partsSerial = document.getElementById('receive-parts-serial')?.value.trim();
        const result = document.getElementById('receive-repair-result')?.value || 'SUCCESSFUL';
        const details = document.getElementById('receive-details')?.value.trim();
        const resendComp = document.getElementById('resend-company-select')?.value;
        const resendExpDate = document.getElementById('resend-expected-date')?.value;

        if (!receivedByName) throw new Error('Please select or enter the Received By employee name.');

        etLabService.receiveFromExternalCompany({
          boardSerial: board.boardSerial,
          machineSerial: mSerial,
          returnDate: receiveDate,
          receivedBy: receivedByName,
          receivedByCard: receivedByCard,
          receivedByArea: receivedByArea,
          verifiedBy: vByName,
          verifiedByCard: vByCard,
          verifiedByArea: vByArea,
          verificationDate: vDate,
          repairResult: result,
          repairDetails: details,
          remarks: details,
          resendCompany: resendComp,
          resendExpectedDate: resendExpDate,
          partsSerial: partsSerial
        });
      } else if (actionType === 'ASSIGN_ANOTHER') {
        const mSerial = document.getElementById('reassign-machine-serial')?.value.trim();
        const assignedByName = document.getElementById('reassign-by-name')?.value.trim() || document.getElementById('reassign-by-search')?.value.trim();
        const assignedByCard = document.getElementById('reassign-by-card')?.value.trim();
        const assignedByArea = document.getElementById('reassign-by-area')?.value.trim();
        const partsSerial = document.getElementById('reassign-parts-serial')?.value.trim();
        const reassignDate = document.getElementById('reassign-date')?.value || todayStr;
        const remarks = document.getElementById('reassign-remarks')?.value.trim() || '';

        if (!mSerial) throw new Error('Please enter or select target Machine Serial.');
        if (!assignedByName) throw new Error('Please select or enter Employee Name in "Assigned By".');

        etLabService.reassignBoardToAnotherMachine({
          boardSerial: board.boardSerial,
          targetMachineSerial: mSerial,
          assignDate: reassignDate,
          assignedBy: assignedByName,
          assignedByCard: assignedByCard,
          assignedByArea: assignedByArea,
          partsSerial: partsSerial,
          remarks: remarks
        });
      }

      close();
      notificationService.success(`Action "${actionType}" executed successfully!`);
      const container = document.getElementById('main-view-container');
      if (container) {
        container.innerHTML = renderEtLabManagementView();
        initEtLabEvents();
      }
    } catch (err) {
      alert('Action execution failed: ' + err.message);
    }
  });
}

/**
 * ============================================================
 * ADD / EDIT BOARD SPECIFICATIONS MODAL
 * ============================================================
 */
function openAddOrEditBoardModal(board = null) {
  const isEdit = Boolean(board);
  const categories = etLabService.getCategories();

  const modalHtml = `
    <div class="modal-overlay" id="board-modal-overlay">
      <div class="modal-dialog" style="max-width: 600px; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1px solid #38bdf8;">
        
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px; color: #fff;">
            <span style="font-size: 22px;">${isEdit ? '✏️' : '➕'}</span>
            <div style="font-size: 16px; font-weight: 800; color: #fff;">
              ${isEdit ? `Edit Board Specifications &bull; ${board.boardSerial}` : 'Register New Board in ENT Lab'}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-board-modal" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <form id="form-board-master">
          <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px; max-height: 75vh; overflow-y: auto;">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label required">Board ID / Unit Number</label>
                <input 
                  type="text" 
                  id="modal-board-serial" 
                  class="form-control" 
                  placeholder="e.g. BRD-00026" 
                  value="${board ? board.boardSerial : `BRD-${String(etLabService.getBoards().length + 1).padStart(5, '0')}`}" 
                  ${isEdit ? 'readonly' : ''} 
                  required 
                  style="font-family: var(--font-mono); font-weight: 800;"
                />
              </div>

              <div class="form-group">
                <label class="form-label required">Item Type / Category</label>
                <select id="modal-category" class="form-control" required>
                  ${categories.map(c => `
                    <option value="${c.name}" ${board && board.category === c.name ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label required">Board Name</label>
              <input 
                type="text" 
                id="modal-part-name" 
                class="form-control" 
                placeholder="e.g. Main CPU Control Board, Power Supply Unit, Operation Panel" 
                value="${board ? board.partName : ''}" 
                required 
              />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Model</label>
                <input 
                  type="text" 
                  id="modal-model-no" 
                  class="form-control" 
                  placeholder="e.g. SC-920, MD-500, CP-180" 
                  value="${board ? (board.modelNo || '') : ''}" 
                />
              </div>

              <div class="form-group">
                <label class="form-label">Serial No. (JUKI S/N)</label>
                <input 
                  type="text" 
                  id="modal-juki-sl" 
                  class="form-control" 
                  placeholder="e.g. JK-CPU-99026" 
                  value="${board ? (board.jukiSlNo || board.slNo || '') : ''}" 
                />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Part No. (P. No)</label>
                <input 
                  type="text" 
                  id="modal-part-no" 
                  class="form-control" 
                  placeholder="e.g. 236-41008" 
                  value="${board ? (board.partNo || '') : ''}" 
                />
              </div>

              <div class="form-group">
                <label class="form-label">Quantity (QTY)</label>
                <input 
                  type="number" 
                  id="modal-qty" 
                  class="form-control" 
                  value="${board ? (board.qty || 1) : 1}" 
                  min="1" 
                  required 
                />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Come Date / Received</label>
                <input 
                  type="date" 
                  id="modal-come-date" 
                  class="form-control" 
                  value="${board ? (board.comeDate || '') : new Date().toISOString().split('T')[0]}" 
                />
              </div>

              <div class="form-group">
                <label class="form-label">Location / Shelf</label>
                <input 
                  type="text" 
                  id="modal-location" 
                  class="form-control" 
                  placeholder="e.g. Rack A-02, ENT Shelf 3" 
                  value="${board ? (board.location || '') : 'ENT Lab Shelf'}" 
                />
              </div>
            </div>

            <!-- PREVIOUS BILL RECORD (Duplicate-billing prevention check) -->
            <div style="background: rgba(245, 158, 11, 0.1); border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 12px 14px;">
              <div style="font-size: 12px; font-weight: 800; color: #fbbf24; margin-bottom: 4px;">
                ⚠️ Previous Bill History (Duplicate-Billing Prevention Check)
              </div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
                Enter previous bill number if this board was billed earlier to prevent duplicate billing.
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group">
                  <label class="form-label">Previous Bill No. (If Any)</label>
                  <input 
                    type="text" 
                    id="modal-bill-no" 
                    class="form-control" 
                    placeholder="e.g. BILL-2026-089" 
                    value="${board ? (board.billNo || '') : ''}" 
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Gate Pass No (GP No)</label>
                  <input 
                    type="text" 
                    id="modal-gp-no" 
                    class="form-control" 
                    placeholder="e.g. GP-2026-880" 
                    value="${board ? (board.gpNo || '') : ''}" 
                  />
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Remarks</label>
              <textarea id="modal-remarks" class="form-control" rows="2" placeholder="Optional notes...">${board ? (board.remarks || '') : ''}</textarea>
            </div>

          </div>

          <div class="modal-footer" style="padding: 14px 20px; background: var(--bg-card); display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-close-board-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 800;">
              ${isEdit ? '💾 Update Specifications' : '➕ Create Board Record'}
            </button>
          </div>
        </form>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('board-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-board-modal').forEach(b => b.addEventListener('click', close));

  document.getElementById('form-board-master').addEventListener('submit', (e) => {
    e.preventDefault();
    const boardSerial = document.getElementById('modal-board-serial').value.trim();
    const partName = document.getElementById('modal-part-name').value.trim();
    const category = document.getElementById('modal-category').value;
    const modelNo = document.getElementById('modal-model-no').value.trim();
    const partNo = document.getElementById('modal-part-no').value.trim();
    const jukiSlNo = document.getElementById('modal-juki-sl').value.trim();
    const qty = parseInt(document.getElementById('modal-qty').value, 10) || 1;
    const comeDate = document.getElementById('modal-come-date').value;
    const location = document.getElementById('modal-location').value.trim();
    const billNo = document.getElementById('modal-bill-no').value.trim();
    const gpNo = document.getElementById('modal-gp-no').value.trim();
    const remarks = document.getElementById('modal-remarks').value.trim();

    try {
      if (isEdit) {
        etLabService.updateBoard(board.id, {
          partName, category, modelNo, partNo, jukiSlNo, qty, comeDate, location, billNo, gpNo, remarks
        });
        notificationService.success(`Board ${board.boardSerial} updated successfully!`);
      } else {
        etLabService.createBoard({
          boardSerial, partName, category, modelNo, partNo, jukiSlNo, qty, comeDate, location, billNo, gpNo, remarks
        });
        selectedBoardSerial = boardSerial;
        notificationService.success(`New Board ${boardSerial} registered successfully!`);
      }
      close();
      const container = document.getElementById('main-view-container');
      if (container) {
        container.innerHTML = renderEtLabManagementView();
        initEtLabEvents();
      }
    } catch (err) {
      alert('Failed to save board: ' + err.message);
    }
  });
}

/**
 * ============================================================
 * ADMIN CONFIGURATION MODAL (Item Types & External Companies)
 * ============================================================
 */
function openAdminConfigModal() {
  const categories = etLabService.getCategories();
  const companies = etLabService.getCompanies();
  const technicians = etLabService.getTechnicians();
  const erpEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];

  const modalHtml = `
    <div class="modal-overlay" id="admin-config-modal-overlay">
      <div class="modal-dialog" style="max-width: 720px; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1.5px solid #38bdf8;">
        
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); border-bottom: 1px solid var(--border-color); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>⚙️ ENT Lab Admin Configuration &amp; Section Staff</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-admin-modal" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; max-height: 75vh; overflow-y: auto;">
          
          <!-- Master Spare Parts Quick Launcher -->
          <div style="background: rgba(2, 132, 199, 0.15); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div>
              <div style="font-size: 13px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
                <span>⚙️</span>
                <span>Master Spare Parts Catalog &amp; Configuration</span>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                Manage all ENT Lab spare parts catalog, machine usage ledger, and maintenance linkages.
              </div>
            </div>
            <button id="btn-modal-open-spare-parts" class="btn btn-primary btn-sm" style="font-weight: 700; white-space: nowrap; background: linear-gradient(135deg, #0284c7, #0369a1);">
              🚀 Open Spare Parts Studio
            </button>
          </div>

          <!-- 1. Section-Wise ENT Lab Technicians & Manpower Staff -->
          <div style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 800; color: #38bdf8; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
              <span>⚡ ENT Lab Section Technicians &amp; Authorized Staff (${technicians.length})</span>
              <span style="font-size: 11px; font-weight: 600; color: #86efac;">🔗 Linked to Manpower Management</span>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 10px;">
              Manage technicians and engineers authorized for Board repair, removal, and installation. Search any employee from Manpower Management to auto-link.
            </div>

            <!-- Add Technician Form with Live Search from Manpower -->
            <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; background: rgba(30, 41, 59, 0.7); padding: 10px; border-radius: 8px; border: 1.5px dashed rgba(56, 189, 248, 0.45);">
              <div style="font-size: 10.5px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 6px;">
                  <span>🔍</span>
                  <span>Auto-Search &amp; Link from Manpower:</span>
                </span>
                <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">Type Name, Card, or Designation</span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1.4fr 1fr 1fr auto; gap: 6px; align-items: flex-start;">
                <!-- 1. Live Search Input & Dropdown -->
                <div style="position: relative;">
                  <div style="position: relative; display: flex; align-items: center;">
                    <input 
                      type="text" 
                      id="admin-new-tech-name" 
                      class="form-control" 
                      placeholder="🔍 Search Name or Card..." 
                      style="height: 34px; font-size: 12px; font-weight: 700; padding-left: 10px; padding-right: 26px; background: rgba(15, 23, 42, 0.95); border: 1.5px solid #38bdf8; color: #fff;" 
                      autocomplete="off"
                    />
                    <button 
                      type="button" 
                      id="btn-clear-admin-tech" 
                      style="position: absolute; right: 6px; background: none; border: none; color: #94a3b8; font-size: 13px; cursor: pointer; display: none; padding: 1px 4px;" 
                      title="Clear selection"
                    >✕</button>
                  </div>

                  <!-- Dropdown Popup -->
                  <div 
                    id="admin-tech-dropdown-results" 
                    style="display: none; position: absolute; top: 38px; left: 0; right: 0; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; max-height: 260px; overflow-y: auto; z-index: 1100; box-shadow: 0 12px 35px rgba(0,0,0,0.95);"
                  ></div>
                </div>

                <!-- 2. Role -->
                <input type="text" id="admin-new-tech-role" class="form-control" placeholder="Role (Auto from Manpower)" style="height: 34px; font-size: 12px;" />
                <!-- 3. Section -->
                <input type="text" id="admin-new-tech-section" class="form-control" placeholder="Section (Auto from Manpower)" style="height: 34px; font-size: 12px;" />
                <!-- 4. Add Button -->
                <button id="btn-admin-add-tech" class="btn btn-primary btn-sm" style="font-weight: 700; height: 34px; white-space: nowrap;">
                  ➕ Add Staff
                </button>
              </div>

              <!-- Selection Status Indicator -->
              <div id="admin-tech-selection-badge" style="display: none; font-size: 10.5px; color: #34d399; font-weight: 600; padding: 3px 8px; background: rgba(16, 185, 129, 0.12); border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.25);">
                🔗 Linked to Manpower: <span id="admin-tech-badge-name" style="color: #fff; font-weight: 700;"></span> 
                &bull; Card: <span id="admin-tech-badge-card" style="font-family: var(--font-mono); color: #38bdf8;"></span>
                &bull; <span id="admin-tech-badge-dept"></span>
              </div>
            </div>

            <!-- Technician List -->
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto;">
              ${technicians.length === 0 ? `
                <div style="font-size: 11.5px; color: var(--text-muted); text-align: center; padding: 10px;">No dedicated technicians configured. Defaulting to all Manpower mechanics.</div>
              ` : technicians.map(t => `
                <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(56, 189, 248, 0.25); padding: 7px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                  <div>
                    <strong style="color: #fff;">${t.name}</strong>
                    ${t.cardNumber ? `<span style="font-family: var(--font-mono); color: #38bdf8; font-size: 11px; margin-left: 6px;">[Card: ${t.cardNumber}]</span>` : ''}
                    <span style="color: #86efac; font-size: 11px; margin-left: 8px;">&bull; ${t.role}</span>
                    <span style="color: #cbd5e1; font-size: 11px; margin-left: 6px;">(${t.section})</span>
                  </div>
                  <button class="btn btn-ghost btn-sm btn-del-tech" data-id="${t.id}" style="color: #f87171; padding: 2px 6px; font-size: 11px;" title="Remove Technician">🗑️</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 2. Item Types Section -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <div style="font-size: 13px; font-weight: 800; color: #38bdf8; margin-bottom: 8px;">
              📦 Item Types / Categories (${categories.length})
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <input type="text" id="admin-new-cat-name" class="form-control" placeholder="New Item Type name (e.g. Servo Driver, Inverter...)" style="height: 36px;" />
              <button id="btn-admin-add-category" class="btn btn-primary btn-sm" style="font-weight: 700; white-space: nowrap;">
                ➕ Add Type
              </button>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${categories.map(c => `
                <span style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); color: #fff; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                  <span>${escapeHtml(c.name)}</span>
                  <button class="btn-admin-edit-cat" data-id="${c.id}" data-name="${escapeHtml(c.name)}" style="background: none; border: none; color: #38bdf8; cursor: pointer; padding: 0 2px; font-size: 11px; line-height: 1;" title="Edit Type">✏️</button>
                  <button class="btn-admin-del-cat" data-id="${c.id}" data-name="${escapeHtml(c.name)}" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 0 2px; font-size: 11px; line-height: 1;" title="Delete Type">✕</button>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- 3. External Companies Section -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <div style="font-size: 13px; font-weight: 800; color: #a855f7;">
                🏢 External Repair Companies (${companies.length})
              </div>
              <button id="btn-admin-open-add-comp-modal" class="btn btn-ghost btn-xs" style="color: #c084fc; font-size: 11px; font-weight: 700; padding: 2px 6px; border: 1px solid rgba(192, 132, 252, 0.4); border-radius: 4px; background: rgba(168, 85, 247, 0.1);" title="Register vendor with full details">
                ➕ Detailed Form
              </button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; margin-bottom: 10px;">
              <input type="text" id="admin-new-comp-name" class="form-control" placeholder="Company Name (e.g. Jack Service)" style="height: 36px;" />
              <input type="text" id="admin-new-comp-contact" class="form-control" placeholder="Contact Person / Phone" style="height: 36px;" />
              <button id="btn-admin-add-company" class="btn btn-primary btn-sm" style="font-weight: 700; white-space: nowrap; background: linear-gradient(135deg, #7e22ce, #6b21a8); border: 1px solid #c084fc;">
                ➕ Add Company
              </button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto;">
              ${companies.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 10px;">No external repair companies configured.</div>
              ` : companies.map(c => `
                <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--border-color); padding: 7px 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px;">
                  <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
                    <div style="color: var(--text-muted); font-size: 11px; display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap;">
                      <span style="color: #cbd5e1;">👤 ${escapeHtml(c.contactPerson || 'Service Partner')}</span>
                      ${c.phone ? `<span>&bull;</span> <span style="color: #38bdf8;">📞 ${escapeHtml(c.phone)}</span>` : ''}
                      ${c.email ? `<span>&bull;</span> <span style="color: #c084fc;">✉️ ${escapeHtml(c.email)}</span>` : ''}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    <button class="btn btn-ghost btn-sm btn-admin-edit-company" data-id="${c.id}" style="color: #38bdf8; padding: 2px 6px; font-size: 12px; border-radius: 4px;" title="Edit Company">✏️</button>
                    <button class="btn btn-ghost btn-sm btn-admin-del-company" data-id="${c.id}" style="color: #f87171; padding: 2px 6px; font-size: 12px; border-radius: 4px;" title="Delete Company">🗑️</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>

        <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary btn-close-admin-modal">Close</button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('admin-config-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-admin-modal').forEach(b => b.addEventListener('click', close));

  document.getElementById('btn-modal-open-spare-parts')?.addEventListener('click', () => {
    close();
    activeEntTab = 'spare-parts';
    const container = document.getElementById('main-view-container');
    if (container) {
      container.innerHTML = renderEtLabManagementView();
      initEtLabEvents();
    }
  });

  // Real-time Manpower Autocomplete Search & Auto-Fill in Admin Modal
  const existingTechs = etLabService.getTechnicians() || [];
  setupManpowerTechAutocomplete({
    inputEl: document.getElementById('admin-new-tech-name'),
    dropdownEl: document.getElementById('admin-tech-dropdown-results'),
    clearBtnEl: document.getElementById('btn-clear-admin-tech'),
    roleEl: document.getElementById('admin-new-tech-role'),
    secEl: document.getElementById('admin-new-tech-section'),
    badgeEl: document.getElementById('admin-tech-selection-badge'),
    badgeNameEl: document.getElementById('admin-tech-badge-name'),
    badgeCardEl: document.getElementById('admin-tech-badge-card'),
    badgeDeptEl: document.getElementById('admin-tech-badge-dept'),
    erpEmployees,
    existingTechs
  });

  document.getElementById('btn-admin-add-tech')?.addEventListener('click', () => {
    const inputEl = document.getElementById('admin-new-tech-name');
    const name = inputEl?.value.trim();
    const role = document.getElementById('admin-new-tech-role')?.value.trim() || 'ENT Specialist';
    const section = document.getElementById('admin-new-tech-section')?.value.trim() || 'Central ENT Lab';
    const cardNumber = inputEl?.dataset.selectedCard || '';
    const phone = inputEl?.dataset.selectedPhone || '';

    if (name) {
      try {
        etLabService.addTechnician({
          name,
          cardNumber,
          role,
          section,
          phone
        });
        close();
        openAdminConfigModal();
        notificationService.success(`Technician "${name}" added to ENT Lab staff!`);
      } catch (err) {
        notificationService.warning(err.message || 'Technician is already registered in ENT Lab.');
      }
    } else {
      notificationService.warning('Please enter an employee name or search from Manpower Management.');
    }
  });

  overlay.querySelectorAll('.btn-del-tech').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        etLabService.deleteTechnician(id);
        close();
        openAdminConfigModal();
        notificationService.success('Technician removed.');
      }
    });
  });

  document.getElementById('btn-admin-add-category')?.addEventListener('click', () => {
    const name = document.getElementById('admin-new-cat-name')?.value.trim();
    if (name) {
      etLabService.addCategory(name);
      close();
      openAdminConfigModal();
      notificationService.success(`Category "${name}" added!`);
    } else {
      notificationService.warning('Please enter a category name.');
    }
  });

  overlay.querySelectorAll('.btn-admin-edit-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        openEditCategoryModal(id, () => {
          close();
          openAdminConfigModal();
        });
      }
    });
  });

  overlay.querySelectorAll('.btn-admin-del-cat').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      const name = e.currentTarget.getAttribute('data-name') || 'this category';
      if (id) {
        const confirmed = await notificationService.confirm({
          title: 'Delete Hardware Category',
          message: `Are you sure you want to delete category <strong>${escapeHtml(name)}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Category',
          cancelText: 'Cancel',
          isDestructive: true
        });
        if (confirmed) {
          etLabService.deleteCategory(id);
          close();
          openAdminConfigModal();
          notificationService.success(`Category "${name}" deleted.`);
        }
      }
    });
  });

  document.getElementById('btn-admin-open-add-comp-modal')?.addEventListener('click', () => {
    openEditCompanyModal(null, () => {
      close();
      openAdminConfigModal();
    });
  });

  document.getElementById('btn-admin-add-company')?.addEventListener('click', () => {
    const name = document.getElementById('admin-new-comp-name')?.value.trim();
    const contactRaw = document.getElementById('admin-new-comp-contact')?.value.trim() || '';
    if (name) {
      let contactPerson = contactRaw;
      let phone = '';
      if (contactRaw.includes('•')) {
        const parts = contactRaw.split('•').map(s => s.trim());
        contactPerson = parts[0];
        phone = parts[1] || '';
      } else if (contactRaw.includes('/')) {
        const parts = contactRaw.split('/').map(s => s.trim());
        contactPerson = parts[0];
        phone = parts[1] || '';
      } else if (contactRaw.includes(',')) {
        const parts = contactRaw.split(',').map(s => s.trim());
        contactPerson = parts[0];
        phone = parts[1] || '';
      }
      etLabService.addCompany(name, contactPerson, phone);
      close();
      openAdminConfigModal();
      notificationService.success(`Company "${name}" added!`);
    } else {
      notificationService.warning('Please enter a company name.');
    }
  });

  overlay.querySelectorAll('.btn-admin-edit-company').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (id) {
        openEditCompanyModal(id, () => {
          close();
          openAdminConfigModal();
        });
      }
    });
  });

  overlay.querySelectorAll('.btn-admin-del-company').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const companies = etLabService.getCompanies();
      const comp = companies.find(c => c.id === id);
      const compName = comp?.name || 'this company';
      if (id) {
        const confirmed = await notificationService.confirm({
          title: 'Delete External Repair Company',
          message: `Are you sure you want to delete <strong>${escapeHtml(compName)}</strong> from External Repair Companies &amp; Vendors?`,
          icon: '🗑️',
          confirmText: 'Delete Company',
          cancelText: 'Cancel',
          isDestructive: true
        });
        if (confirmed) {
          etLabService.deleteCompany(id);
          close();
          openAdminConfigModal();
          notificationService.success(`Company "${compName}" deleted.`);
        }
      }
    });
  });
}

/**
 * ============================================================
 * PRINTABLE BOARD PASSPORT MODAL (PDF / Hard Copy)
 * ============================================================
 */
function openPrintPassportModal(board) {
  const historyList = etLabService.getBoardHistory(board.boardSerial);
  const connectedMachine = board.currentMachineSerial ? 
    etLabService.getMachineDetailsForBoard(board.currentMachineSerial) : null;

  const modalHtml = `
    <div class="modal-overlay" id="board-passport-modal-overlay">
      <div class="modal-dialog" style="max-width: 780px; box-shadow: 0 10px 40px rgba(0,0,0,0.85);">
        
        <div class="modal-header" style="background: var(--bg-surface); border-bottom: 1px solid var(--border-color); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 16px; font-weight: 800; color: #fff;">
            🖨️ Official Board Lifetime Passport &bull; ${board.boardSerial}
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-execute-print-passport" class="btn btn-primary btn-sm" style="font-weight: 700;">
              🖨️ Print Document
            </button>
            <button class="btn btn-ghost btn-sm btn-close-passport">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding: 20px; max-height: 75vh; overflow-y: auto;" id="passport-print-content">
          
          <div style="border: 2px solid #0f172a; padding: 20px; background: #fff; color: #0f172a; font-family: sans-serif;">
            
            <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">AL-MUSLIM GROUP</h2>
              <div style="font-size: 13px; font-weight: 700; color: #475569;">Central Engineering &amp; Maintenance Division &bull; ENT Electronic Lab</div>
              <div style="font-size: 15px; font-weight: 800; color: #0284c7; margin-top: 4px;">OFFICIAL BOARD LIFETIME PASSPORT &amp; REPAIR LEDGER</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px;">
              <div><strong>Board ID / Unit Number:</strong> <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: #0284c7;">${board.boardSerial}</span></div>
              <div><strong>Board Name:</strong> ${board.partName}</div>
              <div><strong>Item Type / Category:</strong> ${board.category || 'General PCB'}</div>
              <div><strong>Model Number:</strong> ${board.modelNo || '—'}</div>
              <div><strong>Serial Number (JUKI S/N):</strong> ${board.jukiSlNo || board.slNo || '—'}</div>
              <div><strong>Part Number (P. No):</strong> ${board.partNo || '—'}</div>
              <div><strong>Current Status:</strong> <strong style="color: #0284c7;">${board.status}</strong></div>
              <div><strong>Current Machine:</strong> <strong>${board.currentMachineSerial ? `Machine ${board.currentMachineSerial}` : (board.location || 'ENT Lab Stock')}</strong></div>
              <div><strong>Previous Bill Status:</strong> <strong>${board.billNo ? `⚠️ YES (Bill No: ${board.billNo})` : 'NO PREVIOUS BILL'}</strong></div>
              <div><strong>Gate Pass Number (GP No):</strong> ${board.gpNo || '—'}</div>
            </div>

            ${connectedMachine ? `
              <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 10px 12px; margin-bottom: 14px; font-size: 12px;">
                <div style="font-weight: 800; color: #0369a1; margin-bottom: 4px;">📍 CURRENTLY CONNECTED MACHINE DETAILS</div>
                <div>Machine Name: <strong>${connectedMachine.machineName} (${connectedMachine.model})</strong></div>
                <div>Machine Serial: <strong>${connectedMachine.serialNumber}</strong></div>
                <div>Location: <strong>${connectedMachine.floorName} &bull; ${connectedMachine.lineName} (${connectedMachine.unitName})</strong></div>
                <div>Installed Date: <strong>${board.installedDate || 'Active'}</strong> by <strong>${board.installedBy || 'Engineer'}</strong></div>
              </div>
            ` : ''}

            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
              Complete Chronological Movement &amp; Repair History
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 30px;">Sl.</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 80px;">Date</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 120px;">Action</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 85px;">Machine</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Destination / Location</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 110px;">Company</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 110px;">Repair Result</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 60px;">Turnaround</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left; width: 95px;">Authorized By</th>
                </tr>
              </thead>
              <tbody>
                ${historyList.map((h, idx) => `
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: 700;">${h.timestamp ? h.timestamp.split('T')[0] : '—'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700;">
                      ${h.actionLabel || h.action}
                      ${h.repairAttempt ? `[#${h.repairAttempt}]` : ''}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: 700; color: #0284c7;">
                      ${h.machineSerial ? `🧵 ${h.machineSerial}` : '—'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">
                      ${h.location || 'ENT Lab'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">
                      ${h.companyName ? `🏢 ${h.companyName}` : '—'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">
                      ${h.acceptanceStatus || h.repairResult || '—'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-family: monospace;">
                      ${h.repairDurationDays !== undefined ? `${h.repairDurationDays} d` : '—'}
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">
                      ${h.verifiedBy || h.performedByName || 'Engineer'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

          </div>

        </div>

        <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary btn-close-passport">Close</button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('board-passport-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-passport').forEach(b => b.addEventListener('click', close));

  document.getElementById('btn-execute-print-passport')?.addEventListener('click', () => {
    const printContent = document.getElementById('passport-print-content')?.innerHTML;
    if (!printContent) return;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Board Passport - ${board.boardSerial}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            @media print {
              body { padding: 0; }
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  });
}

/**
 * ============================================================
 * EXCEL EXPORT (.xlsx)
 * ============================================================
 */
function exportEntLabExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel library is loading. Please try again.');
    return;
  }

  const allBoards = etLabService.getBoards();
  const allHistory = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];

  const wb = XLSX.utils.book_new();

  // 1. Board Master Sheet
  const boardRows = allBoards.map((b, idx) => ({
    'SL': idx + 1,
    'Board ID / Unit No': b.boardSerial,
    'Board Name': b.partName,
    'Model': b.modelNo || '',
    'Serial No (JUKI S/N)': b.jukiSlNo || b.slNo || '',
    'Item Type / Category': b.category || 'General PCB',
    'Current Status': b.status,
    'Current Machine': b.currentMachineSerial || 'N/A (In Lab)',
    'Install Date': b.installedDate || '',
    'Installed By': b.installedBy || '',
    'Previous Bill No': b.billNo || '',
    'Previous Bill Status': b.billNo ? 'YES' : 'NO',
    'Gate Pass No': b.gpNo || '',
    'Come Date': b.comeDate || '',
    'Location': b.location || 'ENT Lab Stock',
    'Remarks': b.remarks || ''
  }));

  const wsBoards = XLSX.utils.json_to_sheet(boardRows);
  XLSX.utils.book_append_sheet(wb, wsBoards, 'Board Master');

  // 2. Complete Lifecycle History Sheet
  const historyRows = allHistory.map((h, idx) => ({
    'SL': idx + 1,
    'Date': h.timestamp ? h.timestamp.split('T')[0] : '',
    'Board ID': h.boardSerial,
    'Action': h.actionLabel || h.action,
    'Repair Attempt': h.repairAttempt ? `Attempt #${h.repairAttempt}` : '',
    'Machine Serial': h.machineSerial || '',
    'External Company': h.companyName || '',
    'Repair Result / Status': h.acceptanceStatus || h.repairResult || h.repairType || '',
    'Problem': h.problem || '',
    'Repair Details': h.repairDetails || '',
    'Repair Turnaround (Days)': h.repairDurationDays || '',
    'Verified By': h.verifiedBy || '',
    'Authorized By': h.performedByName || '',
    'Location': h.location || '',
    'Remarks': h.remarks || ''
  }));

  const wsHistory = XLSX.utils.json_to_sheet(historyRows);
  XLSX.utils.book_append_sheet(wb, wsHistory, 'Complete History');

  XLSX.writeFile(wb, `ET_Lab_Management_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
}
