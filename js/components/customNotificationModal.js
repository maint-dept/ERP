/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Custom Notification & Instant Alert Center Modal Component
 * 
 * Provides an enterprise-grade broadcast composer with:
 * - Multi-tier Urgency & Severity (Emergency with siren, Warning, Info, Maintenance, Success)
 * - Quick 1-click factory operational presets (Line Stoppage, Power/Air Outage, PM Due, Needle Shortage, Safety Drill)
 * - Granular audience targeting (All Factory Staff, Physical Location [Unit/Floor/Line], Role, Specific User)
 * - Multi-channel delivery (In-App Notification Center, Native Web Push, Instant Full-Screen HUD, Audible Siren)
 * - Live acknowledgment tracking & sent broadcast audit logs
 */

import { notificationService } from '../services/notificationService.js';
import { webPushService } from '../services/webPushService.js';
import { authService } from '../services/authService.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { state } from '../state.js';
import { router } from '../services/router.js';

let activeCustomNotifTab = 'compose'; // 'compose' or 'history'

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Predefined factory operational alert presets
 */
const ALERT_PRESETS = [
  {
    id: 'line_stoppage',
    icon: '🛑',
    label: 'Line Stoppage',
    severity: 'EMERGENCY',
    title: 'Sewing Line Stoppage Alert',
    message: 'Sewing Line has encountered an urgent breakdown. Immediate mechanic & technician support required on floor.',
    targetUrl: '#breakdowns',
    popupHUD: true
  },
  {
    id: 'air_compressor',
    icon: '⚡',
    label: 'Utility / Air Drop',
    severity: 'WARNING',
    title: 'Compressor / Pneumatic Pressure Drop',
    message: 'Main air compressor pressure dropping below 6.5 Bar. Engineering utility team is actively troubleshooting.',
    targetUrl: '#et-lab',
    popupHUD: true
  },
  {
    id: 'pm_due',
    icon: '🔧',
    label: 'PM Schedule Due',
    severity: 'MAINTENANCE',
    title: 'Preventive Maintenance Overhaul Due',
    message: 'Batch PM servicing scheduled for today. Floor supervisors please release targeted machines for inspection.',
    targetUrl: '#preventive_maintenance',
    popupHUD: false
  },
  {
    id: 'needle_shortage',
    icon: '🧵',
    label: 'Parts / Needle Notice',
    severity: 'WARNING',
    title: 'Urgent Spare Parts / Needle Requisition',
    message: 'Critical needle/spare part replenishment pending floor dispatch from Central Spare Parts Store.',
    targetUrl: '#spare-parts',
    popupHUD: true
  },
  {
    id: 'safety_drill',
    icon: '🚨',
    label: 'Emergency Evacuation',
    severity: 'EMERGENCY',
    title: 'Factory Safety & Evacuation Alert',
    message: 'Emergency safety drill or floor evacuation protocol initiated. All staff follow safety marshals immediately.',
    targetUrl: '#dashboard',
    popupHUD: true
  },
  {
    id: 'shift_handover',
    icon: '📣',
    label: 'Shift Handover',
    severity: 'INFO',
    title: 'Maintenance Shift Handover Briefing',
    message: 'Shift handover briefing starting now. On-duty mechanics submit logbooks to Floor Lead.',
    targetUrl: '#dashboard',
    popupHUD: false
  }
];

/**
 * Renders the HTML content for Custom Notification Center Modal
 */
export function renderCustomNotificationModal() {
  const currentUser = authService.getCurrentUser();
  if (!authService.canBroadcastNotification(currentUser)) {
    return `
      <div id="modal-custom-notification-overlay" class="modal-backdrop custom-notif-modal-backdrop" style="position: fixed; inset: 0; background: rgba(2, 6, 23, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100050; display: flex; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #0f172a; border: 1.5px solid #ef4444; border-radius: 16px; padding: 28px; max-width: 440px; text-align: center; color: #fff; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
          <div style="font-size: 40px; margin-bottom: 12px;">⛔</div>
          <h3 style="font-size: 17px; font-weight: 800; color: #f87171; margin: 0 0 8px;">Access Restricted</h3>
          <p style="font-size: 13px; color: #94a3b8; margin: 0 0 18px; line-height: 1.5;">Custom factory notifications and emergency siren broadcasts are strictly restricted to <strong>Super Admin</strong> and <strong>Admin</strong> accounts.</p>
          <button id="btn-close-custom-notif-modal" class="btn btn-primary btn-sm" style="font-weight: 700; padding: 6px 18px;">Understood</button>
        </div>
      </div>
    `;
  }

  const units = storage.getTable(TABLE_NAMES.UNITS) || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines = storage.getTable(TABLE_NAMES.LINES) || [];
  const allUsers = authService.getAllUsers() || [];
  const sentAlerts = notificationService.getSentCustomAlerts(currentUser) || [];

  return `
    <div id="modal-custom-notification-overlay" class="modal-backdrop custom-notif-modal-backdrop" style="position: fixed; inset: 0; background: rgba(2, 6, 23, 0.82); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100050; display: flex; align-items: center; justify-content: center; padding: 16px; overflow-y: auto;">
      <div class="custom-notif-dialog" style="width: 100%; max-width: 740px; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 18px; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(56, 189, 248, 0.15); display: flex; flex-direction: column; overflow: hidden; max-height: 92vh;">
        
        <!-- Modal Top Bar -->
        <div class="custom-notif-header" style="padding: 18px 24px; background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95)); border-bottom: 1px solid rgba(56, 189, 248, 0.2); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(59, 130, 246, 0.25)); border: 1.5px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);">
              📢
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">Factory Alert &amp; Notification Dispatcher</h3>
                <span class="badge" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-size: 10.5px; font-weight: 700; text-transform: uppercase;">Instant HUD</span>
              </div>
              <p style="margin: 3px 0 0; font-size: 12px; color: #94a3b8;">
                Broadcast instant sirens, machine breakdown alerts, and floor announcements
              </p>
            </div>
          </div>
          <button id="btn-close-custom-notif-modal" class="btn btn-ghost btn-sm" style="color: #94a3b8; font-size: 20px; line-height: 1; padding: 6px 10px; border-radius: 8px; cursor: pointer;" title="Close (Esc)">✕</button>
        </div>

        <!-- Tab Switcher Strip -->
        <div style="display: flex; gap: 8px; padding: 10px 24px 0; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0;">
          <button type="button" id="tab-btn-compose" class="tab-btn ${activeCustomNotifTab === 'compose' ? 'active' : ''}" style="padding: 9px 18px; font-size: 13px; font-weight: 700; border: none; background: ${activeCustomNotifTab === 'compose' ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}; color: ${activeCustomNotifTab === 'compose' ? '#38bdf8' : '#94a3b8'}; border-bottom: 2px solid ${activeCustomNotifTab === 'compose' ? '#38bdf8' : 'transparent'}; border-radius: 6px 6px 0 0; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;">
            <span>✍️</span> Compose New Alert
          </button>
          <button type="button" id="tab-btn-history" class="tab-btn ${activeCustomNotifTab === 'history' ? 'active' : ''}" style="padding: 9px 18px; font-size: 13px; font-weight: 700; border: none; background: ${activeCustomNotifTab === 'history' ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}; color: ${activeCustomNotifTab === 'history' ? '#38bdf8' : '#94a3b8'}; border-bottom: 2px solid ${activeCustomNotifTab === 'history' ? '#38bdf8' : 'transparent'}; border-radius: 6px 6px 0 0; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;">
            <span>📜</span> Sent Broadcasts &amp; Acknowledgment Log
            <span class="badge" style="background: rgba(255, 255, 255, 0.1); color: #cbd5e1; font-size: 10.5px; padding: 1px 6px; border-radius: 10px;">${sentAlerts.length}</span>
          </button>
        </div>

        <!-- Modal Body Content -->
        <div class="custom-notif-body custom-scrollbar" style="padding: 20px 24px; overflow-y: auto; flex-grow: 1;">
          
          <!-- TAB 1: COMPOSE ALERT -->
          <div id="tab-pane-compose" style="display: ${activeCustomNotifTab === 'compose' ? 'block' : 'none'};">
            
            <!-- Quick Factory Presets -->
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
                  ⚡ Quick 1-Click Operational Presets
                </label>
                <span style="font-size: 11px; color: #64748b;">Click to autofill template</span>
              </div>
              <div class="preset-pill-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">
                ${ALERT_PRESETS.map(preset => `
                  <button type="button" class="btn-preset-card" data-preset-id="${preset.id}" style="display: flex; align-items: center; gap: 7px; padding: 7px 10px; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; color: #cbd5e1; font-size: 12px; font-weight: 600; cursor: pointer; text-align: left; transition: all 0.2s;">
                    <span style="font-size: 15px;">${preset.icon}</span>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${preset.label}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Severity Selector -->
            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.4px;">
                🚨 Urgency &amp; Severity Level
              </label>
              <div class="severity-selector-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px;">
                <label class="severity-pill-label" style="cursor: pointer; margin: 0;">
                  <input type="radio" name="custom-severity" value="EMERGENCY" checked style="display: none;">
                  <div class="severity-pill emergency active" style="padding: 10px 12px; border-radius: 10px; background: rgba(239, 68, 68, 0.15); border: 1.5px solid #ef4444; color: #fca5a5; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; transition: all 0.2s;">
                    <span style="font-size: 18px;">🚨</span>
                    <span style="font-size: 12px; font-weight: 800;">EMERGENCY</span>
                    <span style="font-size: 10px; color: #f87171; line-height: 1;">Audible Siren + Instant HUD</span>
                  </div>
                </label>

                <label class="severity-pill-label" style="cursor: pointer; margin: 0;">
                  <input type="radio" name="custom-severity" value="WARNING" style="display: none;">
                  <div class="severity-pill warning" style="padding: 10px 12px; border-radius: 10px; background: rgba(245, 158, 11, 0.1); border: 1.5px solid rgba(245, 158, 11, 0.3); color: #fde68a; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; transition: all 0.2s;">
                    <span style="font-size: 18px;">⚠️</span>
                    <span style="font-size: 12px; font-weight: 800;">WARNING</span>
                    <span style="font-size: 10px; color: #fbbf24; line-height: 1;">Breakdown / Urgent</span>
                  </div>
                </label>

                <label class="severity-pill-label" style="cursor: pointer; margin: 0;">
                  <input type="radio" name="custom-severity" value="INFO" style="display: none;">
                  <div class="severity-pill info" style="padding: 10px 12px; border-radius: 10px; background: rgba(14, 165, 233, 0.1); border: 1.5px solid rgba(14, 165, 233, 0.3); color: #bae6fd; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; transition: all 0.2s;">
                    <span style="font-size: 18px;">ℹ️</span>
                    <span style="font-size: 12px; font-weight: 800;">INFORMATION</span>
                    <span style="font-size: 10px; color: #38bdf8; line-height: 1;">General Broadcast</span>
                  </div>
                </label>

                <label class="severity-pill-label" style="cursor: pointer; margin: 0;">
                  <input type="radio" name="custom-severity" value="MAINTENANCE" style="display: none;">
                  <div class="severity-pill maintenance" style="padding: 10px 12px; border-radius: 10px; background: rgba(168, 85, 247, 0.1); border: 1.5px solid rgba(168, 85, 247, 0.3); color: #e9d5ff; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; transition: all 0.2s;">
                    <span style="font-size: 18px;">🔧</span>
                    <span style="font-size: 12px; font-weight: 800;">MAINTENANCE</span>
                    <span style="font-size: 10px; color: #c084fc; line-height: 1;">PM / Overhaul Due</span>
                  </div>
                </label>

                <label class="severity-pill-label" style="cursor: pointer; margin: 0;">
                  <input type="radio" name="custom-severity" value="SUCCESS" style="display: none;">
                  <div class="severity-pill success" style="padding: 10px 12px; border-radius: 10px; background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.3); color: #a7f3d0; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; transition: all 0.2s;">
                    <span style="font-size: 18px;">✅</span>
                    <span style="font-size: 12px; font-weight: 800;">RESOLVED / OK</span>
                    <span style="font-size: 10px; color: #34d399; line-height: 1;">Line Resumed</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Audience Targeting -->
            <div style="margin-bottom: 20px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 16px;">
              <label style="display: block; font-size: 12px; font-weight: 700; color: #38bdf8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.4px;">
                🎯 Recipient Audience Scope
              </label>

              <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #fff; cursor: pointer;">
                  <input type="radio" name="custom-target-type" value="ALL" checked style="accent-color: #38bdf8;">
                  <span>🌐 All Factory Staff (Broadcast)</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #cbd5e1; cursor: pointer;">
                  <input type="radio" name="custom-target-type" value="LOCATION" style="accent-color: #38bdf8;">
                  <span>📍 By Physical Location (Unit / Floor / Line)</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #cbd5e1; cursor: pointer;">
                  <input type="radio" name="custom-target-type" value="ROLE" style="accent-color: #38bdf8;">
                  <span>👥 By User Role</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #cbd5e1; cursor: pointer;">
                  <input type="radio" name="custom-target-type" value="USER" style="accent-color: #38bdf8;">
                  <span>👤 Specific Staff / User</span>
                </label>
              </div>

              <!-- Location Scope Controls -->
              <div id="target-scope-location-wrap" style="display: none; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.1);">
                <div>
                  <label style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 4px;">Unit</label>
                  <select id="inp-target-unit" class="form-control form-control-sm" style="background: #1e293b; color: #fff; border-color: rgba(255, 255, 255, 0.15); border-radius: 6px; width: 100%;">
                    <option value="">All Units</option>
                    ${units.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 4px;">Floor</label>
                  <select id="inp-target-floor" class="form-control form-control-sm" style="background: #1e293b; color: #fff; border-color: rgba(255, 255, 255, 0.15); border-radius: 6px; width: 100%;">
                    <option value="">All Floors</option>
                    ${floors.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 4px;">Sewing Line / Area</label>
                  <select id="inp-target-line" class="form-control form-control-sm" style="background: #1e293b; color: #fff; border-color: rgba(255, 255, 255, 0.15); border-radius: 6px; width: 100%;">
                    <option value="">All Lines</option>
                    ${lines.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- Role Scope Controls -->
              <div id="target-scope-role-wrap" style="display: none; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.1);">
                <label style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 6px;">Target Staff Roles</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${[
                    { code: 'SUPER_ADMIN', label: 'Super Admin' },
                    { code: 'ADMIN', label: 'Plant Manager' },
                    { code: 'FLOOR_MAINT', label: 'Floor Maintenance Lead' },
                    { code: 'LINE_TECH', label: 'Line Technician / Mechanic' },
                    { code: 'STORE_INCHARGE', label: 'Store & Spare Parts' },
                    { code: 'ET_LAB_TECH', label: 'ENT Lab / Utilities' },
                    { code: 'FACTORY_VIEWER', label: 'Factory Viewers' }
                  ].map(r => `
                    <label style="display: inline-flex; align-items: center; gap: 4px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 4px 8px; font-size: 11.5px; color: #e2e8f0; cursor: pointer;">
                      <input type="checkbox" name="custom-target-role" value="${r.code}" style="accent-color: #38bdf8;">
                      <span>${r.label}</span>
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- User Scope Controls -->
              <div id="target-scope-user-wrap" style="display: none; padding-top: 8px; border-top: 1px dashed rgba(255, 255, 255, 0.1);">
                <label style="font-size: 11px; font-weight: 600; color: #94a3b8; display: block; margin-bottom: 4px;">Select Staff Member</label>
                <select id="inp-target-user-id" class="form-control form-control-sm" style="background: #1e293b; color: #fff; border-color: rgba(255, 255, 255, 0.15); border-radius: 6px; width: 100%;">
                  <option value="">Select recipient...</option>
                  ${allUsers.map(u => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name || u.username)} (${escapeHtml(u.role || 'Staff')})</option>`).join('')}
                </select>
              </div>

            </div>

            <!-- Title & Message Text -->
            <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
              <div>
                <label for="inp-custom-alert-title" style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
                  Alert Headline / Title <span style="color: #ef4444;">*</span>
                </label>
                <input 
                  type="text" 
                  id="inp-custom-alert-title" 
                  class="form-control" 
                  placeholder="e.g. Sewing Line 4 - Urgent Motor Breakdown" 
                  value="Sewing Line Stoppage Alert" 
                  style="background: #1e293b; color: #fff; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 10px 14px; font-size: 13.5px; width: 100%; box-sizing: border-box;"
                  required
                />
              </div>

              <div>
                <label for="inp-custom-alert-msg" style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
                  Broadcast Message Details <span style="color: #ef4444;">*</span>
                </label>
                <textarea 
                  id="inp-custom-alert-msg" 
                  class="form-control custom-scrollbar" 
                  rows="3" 
                  placeholder="Provide precise details, machine numbers, affected sewing lines, and immediate instructions..." 
                  style="background: #1e293b; color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; font-size: 13px; width: 100%; box-sizing: border-box; resize: vertical;"
                  required
                >Sewing Line has encountered an urgent breakdown. Immediate mechanic & technician support required on floor.</textarea>
              </div>
            </div>

            <!-- Deep Link Action Destination -->
            <div style="margin-bottom: 20px;">
              <label for="inp-custom-target-url" style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
                🔗 On Tap / Click Navigation Destination
              </label>
              <select id="inp-custom-target-url" class="form-control" style="background: #1e293b; color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 9px 12px; font-size: 13px; width: 100%; box-sizing: border-box;">
                <option value="#dashboard">📊 Operations Dashboard (#dashboard)</option>
                <option value="#inventory">📦 Machinery Inventory (#inventory)</option>
                <option value="#machine-history">📜 Machine Lifetime (Passport) (#machine-history)</option>
                <option value="#breakdowns" selected>🚨 Machine Breakdowns &amp; Repairs (#breakdowns)</option>
                <option value="#preventive_maintenance">🔧 Preventive Maintenance (#preventive_maintenance)</option>
                <option value="#transfers">🔄 Machine Transfers &amp; Gate Passes (#transfers)</option>
                <option value="#et-lab">⚡ Electrical &amp; Utilities Lab (#et-lab)</option>
                <option value="#spare-parts">🔩 Spare Parts &amp; Store (#spare-parts)</option>
              </select>
            </div>

            <!-- Delivery Channels -->
            <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px 14px; margin-bottom: 20px;">
              <div style="font-size: 11.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.4px;">
                📡 Dispatch Channels
              </div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" id="chk-channel-inapp" checked style="accent-color: #38bdf8;">
                  <span>🔔 In-App Notification Center</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" id="chk-channel-hud" checked style="accent-color: #ef4444;">
                  <span>🖥️ Instant Full-Screen Alert HUD</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" id="chk-channel-push" checked style="accent-color: #10b981;">
                  <span>📲 Native Web Push (Mobile &amp; PC)</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #e2e8f0; cursor: pointer;">
                  <input type="checkbox" id="chk-channel-siren" checked style="accent-color: #f59e0b;">
                  <span>🔊 Audible Siren / Audio Tone</span>
                </label>
              </div>
            </div>

            <!-- Form Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
              <button type="button" id="btn-cancel-custom-notif" class="btn btn-ghost" style="color: #94a3b8; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 8px; cursor: pointer;">
                Cancel
              </button>
              <button type="button" id="btn-submit-custom-notif" class="btn btn-primary" style="background: linear-gradient(135deg, #ef4444, #dc2626); border: none; font-size: 13.5px; font-weight: 800; color: #fff; padding: 10px 24px; border-radius: 9px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.45); transition: all 0.2s;">
                <span>📢</span>
                <span>Dispatch Factory Alert Now</span>
              </button>
            </div>

          </div>

          <!-- TAB 2: SENT HISTORY & ACKNOWLEDGMENTS -->
          <div id="tab-pane-history" style="display: ${activeCustomNotifTab === 'history' ? 'block' : 'none'};">
            ${sentAlerts.length === 0 ? `
              <div style="text-align: center; padding: 48px 16px; color: #94a3b8;">
                <div style="font-size: 42px; margin-bottom: 12px; opacity: 0.6;">📭</div>
                <div style="font-size: 15px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">No Custom Broadcasts Dispatched Yet</div>
                <div style="font-size: 12.5px; max-width: 360px; margin: 0 auto;">
                  Broadcasts dispatched via the composer will appear here along with real-time recipient acknowledgment tracking.
                </div>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${sentAlerts.map(alert => {
                  const ackList = alert.acknowledgedBy || [];
                  const isEmerg = (alert.type === 'EMERGENCY' || alert.severity === 'EMERGENCY');
                  const borderCol = isEmerg ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.2)';
                  const bgGlow = isEmerg ? 'rgba(239, 68, 68, 0.06)' : 'rgba(15, 23, 42, 0.7)';
                  const formattedTime = new Date(alert.timestamp || Date.now()).toLocaleString();

                  return `
                    <div class="sent-alert-card" style="background: ${bgGlow}; border: 1px solid ${borderCol}; border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; gap: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span class="badge" style="background: ${isEmerg ? 'rgba(239, 68, 68, 0.2)' : 'rgba(14, 165, 233, 0.2)'}; color: ${isEmerg ? '#f87171' : '#38bdf8'}; border: 1px solid ${isEmerg ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)'}; font-size: 10.5px; font-weight: 800;">
                              ${alert.type || 'ALERT'}
                            </span>
                            <span style="font-size: 14px; font-weight: 800; color: #fff;">${escapeHtml(alert.title)}</span>
                          </div>
                          <div style="font-size: 12.5px; color: #cbd5e1; line-height: 1.4;">${escapeHtml(alert.message)}</div>
                        </div>
                        <div style="text-align: right; font-size: 11px; color: #94a3b8; flex-shrink: 0;">
                          <div>${formattedTime}</div>
                          <div style="color: #38bdf8; font-weight: 600; margin-top: 2px;">By: ${escapeHtml(alert.senderName || 'Staff')}</div>
                        </div>
                      </div>

                      <!-- Acknowledgment Summary Strip -->
                      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11.5px;">
                        <div style="display: flex; align-items: center; gap: 6px; color: #94a3b8;">
                          <span>🎯 Target:</span>
                          <span style="color: #cbd5e1; font-weight: 600;">
                            ${alert.isBroadcast ? 'All Factory Staff' : (alert.locationScope ? 'Physical Location Scope' : (alert.targetRoles ? alert.targetRoles.join(', ') : (alert.targetUserId || 'Targeted')))}
                          </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="color: ${ackList.length > 0 ? '#34d399' : '#94a3b8'}; font-weight: 700;">
                            ${ackList.length > 0 ? `✓ ${ackList.length} Staff Acknowledged` : '⏳ Awaiting Staff Acknowledgment'}
                          </span>
                          ${ackList.length > 0 ? `
                            <span style="color: #64748b; font-size: 11px;">(${ackList.map(a => a.userName || a.role).slice(0, 3).join(', ')}${ackList.length > 3 ? '...' : ''})</span>
                          ` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

        </div>

      </div>
    </div>
  `;
}

/**
 * Initializes interactive events for Custom Notification Center Modal
 */
export function initCustomNotificationModalEvents() {
  const overlay = document.getElementById('modal-custom-notification-overlay');
  if (!overlay) return;

  const closeModal = () => {
    closeCustomNotificationModal();
  };

  // Close triggers
  const btnClose = document.getElementById('btn-close-custom-notif-modal');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  const btnCancel = document.getElementById('btn-cancel-custom-notif');
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Tab switching
  const tabCompose = document.getElementById('tab-btn-compose');
  const tabHistory = document.getElementById('tab-btn-history');
  const paneCompose = document.getElementById('tab-pane-compose');
  const paneHistory = document.getElementById('tab-pane-history');

  if (tabCompose && tabHistory) {
    tabCompose.addEventListener('click', () => {
      activeCustomNotifTab = 'compose';
      tabCompose.classList.add('active');
      tabHistory.classList.remove('active');
      if (paneCompose) paneCompose.style.display = 'block';
      if (paneHistory) paneHistory.style.display = 'none';
      tabCompose.style.color = '#38bdf8';
      tabCompose.style.background = 'rgba(56, 189, 248, 0.15)';
      tabCompose.style.borderBottom = '2px solid #38bdf8';
      tabHistory.style.color = '#94a3b8';
      tabHistory.style.background = 'transparent';
      tabHistory.style.borderBottom = '2px solid transparent';
    });

    tabHistory.addEventListener('click', () => {
      activeCustomNotifTab = 'history';
      tabHistory.classList.add('active');
      tabCompose.classList.remove('active');
      if (paneHistory) paneHistory.style.display = 'block';
      if (paneCompose) paneCompose.style.display = 'none';
      tabHistory.style.color = '#38bdf8';
      tabHistory.style.background = 'rgba(56, 189, 248, 0.15)';
      tabHistory.style.borderBottom = '2px solid #38bdf8';
      tabCompose.style.color = '#94a3b8';
      tabCompose.style.background = 'transparent';
      tabCompose.style.borderBottom = '2px solid transparent';
    });
  }

  // Preset clicking
  document.querySelectorAll('.btn-preset-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-preset-id');
      const preset = ALERT_PRESETS.find(p => p.id === pId);
      if (!preset) return;

      const inpTitle = document.getElementById('inp-custom-alert-title');
      const inpMsg = document.getElementById('inp-custom-alert-msg');
      const inpUrl = document.getElementById('inp-custom-target-url');

      if (inpTitle) inpTitle.value = preset.title;
      if (inpMsg) inpMsg.value = preset.message;
      if (inpUrl) inpUrl.value = preset.targetUrl;

      // Select severity radio
      const radio = document.querySelector(`input[name="custom-severity"][value="${preset.severity}"]`);
      if (radio) {
        radio.checked = true;
        updateSeverityUI(preset.severity);
      }
    });
  });

  // Severity pill click & style update
  const severityRadios = document.querySelectorAll('input[name="custom-severity"]');
  function updateSeverityUI(val) {
    document.querySelectorAll('.severity-pill').forEach(pill => {
      pill.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      pill.style.boxShadow = 'none';
    });
    const selectedPill = document.querySelector(`.severity-pill.${val.toLowerCase()}`);
    if (selectedPill) {
      if (val === 'EMERGENCY') {
        selectedPill.style.borderColor = '#ef4444';
        selectedPill.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
      } else if (val === 'WARNING') {
        selectedPill.style.borderColor = '#f59e0b';
        selectedPill.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.35)';
      } else if (val === 'INFO') {
        selectedPill.style.borderColor = '#0ea5e9';
        selectedPill.style.boxShadow = '0 0 15px rgba(14, 165, 233, 0.35)';
      } else if (val === 'MAINTENANCE') {
        selectedPill.style.borderColor = '#a855f7';
        selectedPill.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.35)';
      } else if (val === 'SUCCESS') {
        selectedPill.style.borderColor = '#10b981';
        selectedPill.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.35)';
      }
    }
  }

  severityRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) updateSeverityUI(radio.value);
    });
  });

  // Audience Target Type Radio Handler
  const targetRadios = document.querySelectorAll('input[name="custom-target-type"]');
  const wrapLoc = document.getElementById('target-scope-location-wrap');
  const wrapRole = document.getElementById('target-scope-role-wrap');
  const wrapUser = document.getElementById('target-scope-user-wrap');

  targetRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (wrapLoc) wrapLoc.style.display = radio.value === 'LOCATION' ? 'grid' : 'none';
      if (wrapRole) wrapRole.style.display = radio.value === 'ROLE' ? 'block' : 'none';
      if (wrapUser) wrapUser.style.display = radio.value === 'USER' ? 'block' : 'none';
    });
  });

  // Submit Alert Dispatcher
  const btnSubmit = document.getElementById('btn-submit-custom-notif');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async () => {
      const inpTitle = document.getElementById('inp-custom-alert-title');
      const inpMsg = document.getElementById('inp-custom-alert-msg');
      const title = inpTitle?.value?.trim();
      const message = inpMsg?.value?.trim();

      if (!title) {
        notificationService.error('Please enter an alert title.');
        inpTitle?.focus();
        return;
      }
      if (!message) {
        notificationService.error('Please enter alert message details.');
        inpMsg?.focus();
        return;
      }

      const severity = document.querySelector('input[name="custom-severity"]:checked')?.value || 'ALERT';
      const targetType = document.querySelector('input[name="custom-target-type"]:checked')?.value || 'ALL';
      const unitId = document.getElementById('inp-target-unit')?.value || null;
      const floorId = document.getElementById('inp-target-floor')?.value || null;
      const lineId = document.getElementById('inp-target-line')?.value || null;
      const targetRoles = Array.from(document.querySelectorAll('input[name="custom-target-role"]:checked')).map(cb => cb.value);
      const targetUserId = document.getElementById('inp-target-user-id')?.value || null;
      const targetUrl = document.getElementById('inp-custom-target-url')?.value || '#dashboard';

      const inApp = document.getElementById('chk-channel-inapp')?.checked !== false;
      const popupHUD = document.getElementById('chk-channel-hud')?.checked !== false;
      const push = document.getElementById('chk-channel-push')?.checked !== false;
      const siren = document.getElementById('chk-channel-siren')?.checked !== false;

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>⏳</span><span>Dispatching Factory Alert...</span>';

      try {
        await notificationService.sendCustomAlert({
          title,
          message,
          severity,
          targetType,
          unitId,
          floorId,
          lineId,
          targetRoles,
          targetUserId,
          targetUrl,
          popupHUD,
          channels: { inApp, push, hud: popupHUD, siren }
        });

        closeModal();
      } catch (err) {
        console.error('Alert dispatch error:', err);
        notificationService.error('Failed to dispatch alert: ' + err.message);
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>📢</span><span>Dispatch Factory Alert Now</span>';
      }
    });
  }
}

/**
 * Open Custom Notification Composer Modal
 */
export function openCustomNotificationModal(options = {}) {
  const currentUser = authService.getCurrentUser();
  if (!authService.canBroadcastNotification(currentUser)) {
    if (typeof notificationService !== 'undefined' && typeof notificationService.error === 'function') {
      notificationService.error('⛔ Access Denied: Only Super Admin and Admin accounts can broadcast factory alerts.');
    }
    return;
  }

  closeCustomNotificationModal();
  const wrapper = document.createElement('div');
  wrapper.id = 'custom-notif-modal-root';
  wrapper.innerHTML = renderCustomNotificationModal();
  document.body.appendChild(wrapper);
  initCustomNotificationModalEvents();

  if (options.presetId) {
    const presetBtn = document.querySelector(`.btn-preset-card[data-preset-id="${options.presetId}"]`);
    if (presetBtn) presetBtn.click();
  }
}

/**
 * Close Custom Notification Composer Modal
 */
export function closeCustomNotificationModal() {
  const root = document.getElementById('custom-notif-modal-root');
  if (root) root.remove();
  const overlay = document.getElementById('modal-custom-notification-overlay');
  if (overlay) overlay.remove();
  if (state.get('activeModal') === 'custom-notification') {
    state.set('activeModal', null);
  }
}

/**
 * Enterprise Instant Alert HUD Overlay
 * Displays full-screen priority or emergency alert banner with audible siren and acknowledgment
 */
export function showInstantAlertHUD(notif) {
  if (!notif) return;

  // Check if current user is allowed to receive this notification
  const currentUser = authService.getCurrentUser();
  if (currentUser && !notificationService.isNotificationAllowedForUser(notif, currentUser)) {
    return; // Respect location / role boundaries
  }

  // Remove existing HUD if already open
  const existing = document.getElementById('modal-instant-alert-hud-overlay');
  if (existing) existing.remove();

  const isEmergency = (notif.type === 'EMERGENCY' || notif.severity === 'EMERGENCY');
  const isWarning = (notif.type === 'WARNING' || notif.severity === 'WARNING');
  
  const hudColor = isEmergency ? '#ef4444' : (isWarning ? '#f59e0b' : '#0ea5e9');
  const hudTitle = notif.title || (isEmergency ? 'CRITICAL FACTORY EMERGENCY' : 'PRIORITY FACTORY NOTICE');
  const hudMessage = notif.message || '';
  const senderInfo = `${notif.senderName || 'Factory Supervisor'} (${notif.senderRole || 'Staff'})`;
  const timeFormatted = new Date(notif.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Play audio siren/chime
  try {
    if (isEmergency && typeof webPushService.playEmergencySiren === 'function') {
      webPushService.playEmergencySiren();
    } else if (typeof webPushService.playChime === 'function') {
      webPushService.playChime();
    }
  } catch (_) {}

  const hudHtml = `
    <div id="modal-instant-alert-hud-overlay" style="position: fixed; inset: 0; background: rgba(2, 6, 23, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 100060; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="instant-alert-card ${isEmergency ? 'pulse-emergency' : ''}" style="width: 100%; max-width: 620px; background: #0b1120; border: 2px solid ${hudColor}; border-radius: 20px; box-shadow: 0 0 50px ${isEmergency ? 'rgba(239, 68, 68, 0.45)' : 'rgba(14, 165, 233, 0.35)'}, 0 25px 60px rgba(0,0,0,0.9); overflow: hidden; display: flex; flex-direction: column; animation: alertZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- Emergency Glowing Header Banner -->
        <div style="background: ${isEmergency ? 'linear-gradient(135deg, #7f1d1d, #991b1b, #b91c1c)' : 'linear-gradient(135deg, #0369a1, #0284c7)'}; padding: 18px 24px; color: #fff; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(0, 0, 0, 0.3); border: 1.5px solid rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; font-size: 22px;">
              ${isEmergency ? '🚨' : (isWarning ? '⚠️' : '📢')}
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: rgba(255, 255, 255, 0.85);">
                ${isEmergency ? '⚡ FACTORY FLOOR EMERGENCY' : '📢 REAL-TIME ALERT BROADCAST'}
              </div>
              <h2 style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #fff;">
                ${escapeHtml(hudTitle)}
              </h2>
            </div>
          </div>
          <button id="btn-hud-dismiss-x" style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.25); color: #fff; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer;" title="Dismiss (Esc)">✕</button>
        </div>

        <!-- HUD Body Content -->
        <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; font-size: 14.5px; line-height: 1.55; color: #f1f5f9;">
            ${escapeHtml(hudMessage)}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>👤</span>
              <span>Dispatched by: <strong style="color: #e2e8f0;">${escapeHtml(senderInfo)}</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>🕒</span>
              <span>${timeFormatted}</span>
            </div>
          </div>

        </div>

        <!-- HUD Action Footer -->
        <div style="padding: 16px 24px; background: rgba(15, 23, 42, 0.95); border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <button id="btn-hud-close" class="btn btn-ghost" style="color: #94a3b8; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 8px; cursor: pointer;">
            Dismiss
          </button>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${notif.targetUrl ? `
              <button id="btn-hud-open-target" class="btn btn-secondary" style="background: rgba(14, 165, 233, 0.15); border: 1.5px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <span>🔍</span>
                <span>Open Module View</span>
              </button>
            ` : ''}

            <button id="btn-hud-acknowledge" class="btn btn-primary" style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: #fff; font-size: 13.5px; font-weight: 800; padding: 10px 22px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
              <span>✓</span>
              <span>Acknowledge Alert</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  const hudElem = document.createElement('div');
  hudElem.id = 'instant-alert-hud-root';
  hudElem.innerHTML = hudHtml;
  document.body.appendChild(hudElem);

  // Attach HUD Event Handlers
  const dismissHUD = () => {
    const root = document.getElementById('instant-alert-hud-root');
    if (root) root.remove();
  };

  document.getElementById('btn-hud-dismiss-x')?.addEventListener('click', dismissHUD);
  document.getElementById('btn-hud-close')?.addEventListener('click', dismissHUD);

  document.getElementById('btn-hud-open-target')?.addEventListener('click', () => {
    dismissHUD();
    if (notif.targetUrl) {
      if (typeof router !== 'undefined' && typeof router.navigate === 'function') {
        router.navigate(notif.targetUrl);
      } else {
        window.location.hash = notif.targetUrl;
      }
    }
  });

  const btnAck = document.getElementById('btn-hud-acknowledge');
  if (btnAck) {
    btnAck.addEventListener('click', () => {
      notificationService.acknowledgeAlert(notif.id, currentUser);
      btnAck.style.background = '#059669';
      btnAck.innerHTML = '<span>✓</span><span>Acknowledged!</span>';
      setTimeout(() => {
        dismissHUD();
      }, 700);
    });
  }
}

// Attach global shortcuts onto window
if (typeof window !== 'undefined') {
  window.openCustomNotificationModal = openCustomNotificationModal;
  window.closeCustomNotificationModal = closeCustomNotificationModal;
  window.showInstantAlertHUD = showInstantAlertHUD;
}
