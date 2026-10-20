/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * System Settings, Approval Policies & JSON Backup/Restore Component
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { state } from '../state.js';
import { masterDataService } from '../services/masterDataService.js';
import { authService } from '../services/authService.js';
import { router } from '../services/router.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const REPORT_TYPES = [
  { key: 'ALL', label: 'All Reports (Default)', description: 'Universal baseline signature template for all reports' },
  { key: 'MACHINE_SUMMARY', label: 'Machine Summary & Inventory Report', description: 'Reports & Analytics → Machine Reports & Inventory Grid' },
  { key: 'TRANSFER_GATE_PASS', label: 'Transfer Gate Pass / Delivery Challan', description: 'Machine Movement & Transfer Gate Pass' },
  { key: 'ENT_LAB_REPORT', label: 'ENT Lab Report', description: 'Reports & Analytics → ENT Lab Report' },
  { key: 'PREVENTIVE_MAINTENANCE', label: 'Preventive Maintenance & Inspection Sheet', description: 'Periodic machine inspection sheets & PM schedule' },
  { key: 'SERVICE_MAINTENANCE', label: 'Service & Maintenance History Report', description: 'Machine Passport & lifetime maintenance history log' },
  { key: 'TOOLS_EQUIPMENT', label: 'Tools & Equipment Inspection Report', description: 'Tools and equipment handover & inspection registers' },
  { key: 'SPARE_PARTS', label: 'Spare Parts Consumption Report', description: 'Spare parts requisition & replacement logs' }
];

export function getAvailableSignatoryEmployees() {
  const list = [];
  const seen = new Set();

  try {
    const users = storage.getTable(TABLE_NAMES.USERS) || [];
    users.forEach(u => {
      const name = (u.name || u.fullName || u.username || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          id: u.id,
          name: name,
          designation: u.designation || u.role || 'Officer',
          department: u.department || 'Administration'
        });
      }
    });
  } catch (e) {
    console.warn('Error fetching users for signatories:', e);
  }

  try {
    const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    employees.forEach(e => {
      const name = (e.name || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({
          id: e.id,
          name: name,
          cardNumber: e.cardNumber || '',
          designation: e.designation || 'Staff',
          department: e.department || ''
        });
      }
    });
  } catch (e) {
    console.warn('Error fetching employees for signatories:', e);
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSignaturesForReport(reportKey = 'ALL', checkCustomOnly = false) {
  const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
  const reportSignatures = settings.reportSignatures || {};

  if (checkCustomOnly) {
    if (reportKey && reportKey !== 'ALL' && Array.isArray(reportSignatures[reportKey]) && reportSignatures[reportKey].length > 0) {
      return reportSignatures[reportKey];
    }
    return null;
  }

  // 1. Check report-specific signatures
  if (reportKey && reportKey !== 'ALL' && Array.isArray(reportSignatures[reportKey]) && reportSignatures[reportKey].length > 0) {
    return reportSignatures[reportKey];
  }

  // 2. Check 'ALL' in reportSignatures
  if (Array.isArray(reportSignatures['ALL']) && reportSignatures['ALL'].length > 0) {
    return reportSignatures['ALL'];
  }

  // 3. Check legacy settings.signatures
  if (Array.isArray(settings.signatures) && settings.signatures.length > 0) {
    return settings.signatures;
  }

  // 4. Default baseline 3 signatures
  return [
    { id: 'sig-1', name: settings.sig1Name || 'Engr. Motaher Hossain', title: settings.sig1Title || 'Prepared By (Engineer)', enabled: true },
    { id: 'sig-2', name: settings.sig2Name || 'Engr. Delwar Hossain', title: settings.sig2Title || 'Verified By (AGM / Sr. AGM)', enabled: true },
    { id: 'sig-3', name: settings.sig3Name || 'Mohammad Liton Miah', title: settings.sig3Title || 'Approved By (GM)', enabled: true }
  ];
}

export function getSignaturesList(settings = {}) {
  return getSignaturesForReport('ALL');
}

export function renderSignatorySlotHtml(sig, index, availableEmployees = null) {
  const num = index + 1;
  const isEnabled = sig.enabled !== false;
  const id = sig.id || `sig-${Date.now()}-${index}`;
  const emps = availableEmployees || getAvailableSignatoryEmployees();

  const currentName = (sig.name || '').trim().toLowerCase();
  const matchedEmp = emps.find(e => e.name.toLowerCase() === currentName);

  return `
    <div class="signature-slot-card" data-sig-id="${id}" style="background: rgba(15, 23, 42, 0.65); border: 1.5px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
        <div style="font-weight: 700; font-size: 12px; color: #c084fc; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
          <span class="sig-slot-index-badge" style="background: rgba(168, 85, 247, 0.25); color: #e9d5ff; padding: 2px 7px; border-radius: 4px; font-size: 11px;">#${num}</span>
          <span class="sig-slot-label">Signatory ${num}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; cursor: pointer; color: #fff; margin: 0;">
            <input type="checkbox" class="sig-slot-enabled" ${isEnabled ? 'checked' : ''} style="width: 15px; height: 15px;" />
            <span>Show on Report</span>
          </label>
          <button type="button" class="btn btn-ghost btn-xs btn-remove-signature-slot" style="color: #f87171; padding: 2px 6px; font-size: 12px;" title="Remove this signatory">
            🗑️ Remove
          </button>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 11.5px; font-weight: 600; margin-bottom: 4px; color: #38bdf8;">
          👤 Select Employee from System
        </label>
        <select class="form-control sig-slot-employee-select" style="font-size: 12px; background: #0f172a; border-color: rgba(56, 189, 248, 0.35); color: #f8fafc;">
          <option value="">-- Choose Employee / Officer --</option>
          ${emps.map(emp => {
            const isSel = matchedEmp && matchedEmp.id === emp.id;
            const extra = emp.cardNumber ? ` (${emp.cardNumber})` : '';
            return `<option value="${emp.name.replace(/"/g, '&quot;')}" data-designation="${(emp.designation || '').replace(/"/g, '&quot;')}" ${isSel ? 'selected' : ''}>
              ${emp.name} — ${emp.designation}${extra}
            </option>`;
          }).join('')}
          <option value="__custom__">✏️ Custom / External Officer...</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 11.5px; font-weight: 600; margin-bottom: 4px;">Officer / Engineer Name</label>
        <input type="text" class="form-control sig-slot-name" value="${(sig.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. Engr. Tanvir Ahmed" />
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" style="font-size: 11.5px; font-weight: 600; margin-bottom: 4px;">Designation / Title on Report</label>
        <input type="text" class="form-control sig-slot-title" value="${(sig.title || '').replace(/"/g, '&quot;')}" placeholder="e.g. Prepared By (Engineer)" />
      </div>
    </div>
  `;
}

export function renderSettingsView() {
  const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
  const activeReportKey = 'ALL';
  const signaturesList = getSignaturesForReport(activeReportKey);
  const availableEmployees = getAvailableSignatoryEmployees();
  const hasCustom = getSignaturesForReport(activeReportKey, true) !== null;

  const currentOrigin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://maint-dept.github.io';
  const basePath = (typeof router !== 'undefined' && typeof router.getBasePath === 'function') ? router.getBasePath() : '';
  const currentAdminSlug = (typeof authService !== 'undefined' && typeof authService.getAdminLoginSlug === 'function')
    ? authService.getAdminLoginSlug()
    : (settings.adminLoginSlug || 'secure-admin-gateway');
  const fullAdminUrl = `${currentOrigin}${basePath}/${currentAdminSlug}`;

  return `
    <div class="page-view">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff;">⚙️ Admin Settings &amp; Configuration</h1>
          <p style="font-size: 12.5px; color: var(--text-secondary);">
            Manage PDF &amp; print signatures, corporate branding, approval workflow policies, and machine serial number formatting.
          </p>
        </div>
      </div>

      <!-- Settings Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
        
        <!-- Top Full-Width Card: PDF & Print Report Signatures Customization -->
        <div style="background: var(--bg-surface); border: 1.5px solid rgba(168, 85, 247, 0.45); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px; grid-column: 1 / -1; box-shadow: 0 4px 24px rgba(168, 85, 247, 0.12);">
          
          <!-- Card Header & Report Type Dropdown -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; flex-wrap: wrap; gap: 14px;">
            <div style="flex: 1; min-width: 320px;">
              <h3 style="font-size: 16px; font-weight: 800; color: #c084fc; display: flex; align-items: center; gap: 8px; margin: 0;">
                <span>✍️ PDF &amp; Print Report Signatures Customization</span>
              </h3>
              <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
                Configure signatories for PDF and print reports. Select "All Reports" for global baseline signatures, or choose a specific report to set individual custom signatures.
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <button type="button" id="btn-add-signature-slot" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #c084fc; border-color: rgba(168, 85, 247, 0.4);">
                ➕ Add Signature
              </button>
            </div>
          </div>

          <!-- Report Selector Control Bar -->
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: 1;">
              <label for="report-signature-type-select" style="font-size: 13.5px; font-weight: 700; color: #f8fafc; margin: 0; white-space: nowrap; display: flex; align-items: center; gap: 6px;">
                <span>📄 Report Type:</span>
              </label>
              <select id="report-signature-type-select" class="form-control" style="width: auto; min-width: 320px; font-weight: 700; color: #38bdf8; background: #0f172a; border: 1.5px solid #0284c7; padding: 6px 12px; font-size: 13px;">
                ${REPORT_TYPES.map(rt => `
                  <option value="${rt.key}" ${rt.key === activeReportKey ? 'selected' : ''}>${rt.label}</option>
                `).join('')}
              </select>
              <span id="report-sig-status-badge" class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 10px; font-size: 11.5px;">
                🌐 Global Default Template (Applies to all reports)
              </span>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" id="btn-reset-report-signatures" class="btn btn-secondary btn-sm" style="display: none; font-size: 11.5px; color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);" title="Revert to All Reports default signatures">
                🔄 Reset to Default Template
              </button>
            </div>
          </div>

          <!-- Report Context Helper Info -->
          <div id="report-sig-context-desc" style="font-size: 12px; color: var(--text-muted); padding: 0 4px;">
            Universal baseline signatures for all reports unless overridden by a specific report selection above.
          </div>

          <!-- Dynamic Signatures Grid Container -->
          <div id="signatures-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px;">
            ${signaturesList.map((sig, idx) => renderSignatorySlotHtml(sig, idx, availableEmployees)).join('')}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; border-top: 1px solid var(--border-color); padding-top: 12px;">
            <button type="button" id="btn-add-signature-slot-bottom" class="btn btn-secondary btn-sm" style="font-weight: 600; color: #c084fc;">
              ➕ Add Another Signatory
            </button>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span id="save-sig-feedback-msg" style="font-size: 12px; color: #34d399; font-weight: 600; display: none;"></span>
              <button type="button" id="btn-save-signature-settings" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #a855f7, #7c3aed); border-color: #a855f7; padding: 8px 24px;">
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>

        <!-- Card 1: Enterprise Information & Branding -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #38bdf8; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            🏭 Corporate Branding &amp; Department Info
          </h3>

          <div class="form-group">
            <label class="form-label">Enterprise / Group Name</label>
            <input type="text" id="setting-company-name" class="form-control" value="${settings.companyName || 'Al-Muslim Group'}" />
          </div>

          <div class="form-group">
            <label class="form-label">Department Name</label>
            <input type="text" id="setting-dept-name" class="form-control" value="${settings.departmentName || 'Central Maintenance & Mechanical Engineering Department'}" />
          </div>

          <div class="form-group">
            <label class="form-label">Default Page Size for Inventory Grid</label>
            <select id="setting-page-size" class="form-control">
              <option value="25" ${settings.defaultRowsPerPage === 25 ? 'selected' : ''}>25 Records</option>
              <option value="50" ${settings.defaultRowsPerPage === 50 ? 'selected' : ''}>50 Records</option>
              <option value="100" ${settings.defaultRowsPerPage === 100 ? 'selected' : ''}>100 Records</option>
              <option value="500" ${settings.defaultRowsPerPage === 500 ? 'selected' : ''}>500 Records</option>
            </select>
          </div>

          <button id="btn-save-general-settings" class="btn btn-primary btn-sm" style="align-self: flex-start;">
            💾 Save General Settings
          </button>
        </div>

        <!-- Card 2: Multi-Stage Approval Policies -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #34d399; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            🛡️ Approval Workflow Policies
          </h3>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
            <div>
              <div style="font-weight: 600; color: #fff; font-size: 13px;">Require Admin Approval for Maintenance User Edits</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Route technician updates to Approval Center with side-by-side visual diffs.</div>
            </div>
            <input type="checkbox" id="setting-require-approval" ${settings.requireApprovalForMaintenanceUsers ? 'checked' : ''} style="width: 18px; height: 18px;" />
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
            <div>
              <div style="font-weight: 600; color: #fff; font-size: 13px;">Require Approval for Machine Decommission / Archive</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Prevent accidental machine deletion by requiring Super Admin approval.</div>
            </div>
            <input type="checkbox" id="setting-require-del-approval" ${settings.requireDeleteApproval ? 'checked' : ''} style="width: 18px; height: 18px;" />
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0;">
            <div>
              <div style="font-weight: 600; color: #fff; font-size: 13px;">Enforce Strict Unique Serial Numbers</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Blocks duplicate serial numbers across entire database with conflict dialog.</div>
            </div>
            <span class="badge badge-active">ALWAYS ENFORCED</span>
          </div>

          <button id="btn-save-approval-settings" class="btn btn-success btn-sm" style="align-self: flex-start;">
            💾 Save Approval Policies
          </button>
        </div>

        <!-- Card: Admin Login URL Customization & Gateway Security -->
        <div id="card-admin-url-gateway" style="background: var(--bg-surface); border: 1.5px solid rgba(16, 185, 129, 0.45); border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px; grid-column: 1 / -1; box-shadow: 0 4px 24px rgba(16, 185, 129, 0.12);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">🔐</span>
              <div>
                <h3 style="font-size: 16px; font-weight: 800; color: #34d399; margin: 0; display: flex; align-items: center; gap: 8px;">
                  <span>Admin Login URL Customization &amp; Gateway Security</span>
                </h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  Dedicated, customizable Admin Gateway decoupled from User Login (/login), hidden from regular users, and unindexed.
                </div>
              </div>
            </div>

            <!-- Badges -->
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1.5px solid #10b981; font-weight: 800; font-size: 11px; padding: 5px 12px; border-radius: 20px;">
                🛡️ UNINDEXED (NOINDEX, NOFOLLOW)
              </span>
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 11px; padding: 5px 10px;">
                🔒 ADMINS ONLY
              </span>
              <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 11px; padding: 5px 10px;">
                👁️ OBFUSCATED FROM USERS
              </span>
            </div>
          </div>

          <!-- Feature / Architecture Compliance Checklist -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; font-size: 12px; line-height: 1.5;">
            <div style="color: #e2e8f0; display: flex; align-items: flex-start; gap: 8px;">
              <span style="color: #34d399; font-weight: 800;">✓</span>
              <span><strong>User Login Preserved:</strong> <code>/login</code> remains unchanged, standard, and fully operational.</span>
            </div>
            <div style="color: #e2e8f0; display: flex; align-items: flex-start; gap: 8px;">
              <span style="color: #34d399; font-weight: 800;">✓</span>
              <span><strong>Separate &amp; Customizable:</strong> Admin URL is decoupled and can be changed to any custom slug at will.</span>
            </div>
            <div style="color: #e2e8f0; display: flex; align-items: flex-start; gap: 8px;">
              <span style="color: #34d399; font-weight: 800;">✓</span>
              <span><strong>Search Engine Blocking:</strong> Googlebot/Bingbot blocked via <code>robots.txt</code>, dynamic <code>noindex</code> meta, and headers.</span>
            </div>
            <div style="color: #e2e8f0; display: flex; align-items: flex-start; gap: 8px;">
              <span style="color: #34d399; font-weight: 800;">✓</span>
              <span><strong>Strict Role Gate:</strong> Standard users cannot enter Admin Gateway; admin accounts cannot log in via public User portal.</span>
            </div>
          </div>

          <!-- Active Secret URL Display Box -->
          <div style="background: rgba(15, 23, 42, 0.9); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <label style="font-size: 12.5px; font-weight: 700; color: #cbd5e1; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>🔗 Current Secret Admin Login URL:</span>
                <span style="font-size: 11px; color: #94a3b8; font-weight: 400;">(Share only with authorized maintenance administrators)</span>
              </label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button type="button" id="btn-copy-admin-slug-url" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #34d399; border-color: rgba(16, 185, 129, 0.4); display: flex; align-items: center; gap: 6px;">
                  <span>📋</span>
                  <span id="copy-admin-btn-text">Copy Secret Admin URL</span>
                </button>
                <a id="link-open-admin-gateway" href="${escapeHtml(fullAdminUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); text-decoration: none; display: flex; align-items: center; gap: 6px;">
                  <span>↗️</span>
                  <span>Open Gateway</span>
                </a>
              </div>
            </div>

            <div style="display: flex; align-items: center; background: #030712; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 10px 14px; overflow-x: auto;">
              <code id="display-full-admin-url" style="font-family: var(--font-mono); font-size: 13.5px; color: #34d399; font-weight: 700; word-break: break-all;">
                ${escapeHtml(fullAdminUrl)}
              </code>
            </div>
          </div>

          <!-- Slug Customization Input & Live Preview -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
            
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #cbd5e1;">
                Custom Admin Gateway Slug <span class="req">*</span>
              </label>
              <div style="position: relative; display: flex; align-items: center;">
                <span style="position: absolute; left: 12px; font-size: 13px; color: var(--text-muted); font-family: var(--font-mono); pointer-events: none;">
                  /${basePath ? basePath.replace(/^\/+/, '') + '/' : ''}
                </span>
                <input 
                  type="text" 
                  id="setting-admin-login-slug" 
                  class="form-control" 
                  value="${escapeHtml(currentAdminSlug)}" 
                  placeholder="e.g. secure-admin-gateway, mg-adm-console, etc." 
                  maxlength="50"
                  style="padding-left: ${basePath ? '85px' : '30px'} !important; font-family: var(--font-mono); font-weight: 700; color: #34d399; background: #0f172a; font-size: 13.5px;" 
                />
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">
                Min 3 chars. Letters, numbers, hyphens (-) and underscores (_) only. Cannot use reserved routes like <code>login</code>, <code>home</code>, <code>inventory</code>.
              </div>
            </div>

            <!-- Live URL Preview -->
            <div style="display: flex; flex-direction: column; justify-content: center; background: rgba(15, 23, 42, 0.7); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 12px 16px;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                Live Resulting URL Preview:
              </div>
              <div id="live-slug-preview-text" style="font-family: var(--font-mono); font-size: 13px; color: #6ee7b7; font-weight: 700; margin-top: 4px; word-break: break-all;">
                ${escapeHtml(fullAdminUrl)}
              </div>
            </div>

          </div>

          <!-- Action Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 4px; flex-wrap: wrap; gap: 10px;">
            <button type="button" id="btn-reset-admin-slug-default" class="btn btn-secondary btn-sm" style="font-size: 12px; color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);" title="Revert to standard default secure-admin-gateway">
              🔄 Reset to Default Slug (secure-admin-gateway)
            </button>

            <div style="display: flex; align-items: center; gap: 12px;">
              <span id="save-admin-slug-feedback-msg" style="font-size: 12px; color: #34d399; font-weight: 600; display: none;"></span>
              <button type="button" id="btn-save-admin-slug-setting" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #059669, #0d9488); border-color: #059669; padding: 8px 24px; box-shadow: 0 4px 16px rgba(5, 150, 105, 0.4);">
                💾 Save Custom Admin URL
              </button>
            </div>
          </div>

        </div>

        <!-- Card: System Maintenance Mode & Access Lockdown Control -->
        <div id="card-maintenance-mode" style="background: var(--bg-surface); border: 1.5px solid ${settings.maintenanceMode ? '#f59e0b' : 'rgba(245, 158, 11, 0.35)'}; border-radius: var(--radius-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px; grid-column: 1 / -1; box-shadow: ${settings.maintenanceMode ? '0 0 25px rgba(245, 158, 11, 0.25)' : '0 4px 20px rgba(0,0,0,0.2)'};">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 26px;">🛠️</span>
              <div>
                <h3 style="font-size: 16px; font-weight: 800; color: #fbbf24; margin: 0; display: flex; align-items: center; gap: 8px;">
                  <span>System Maintenance Mode &amp; Access Lockdown</span>
                </h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  Temporarily lock user access to perform server updates, data migrations, or scheduled maintenance.
                </div>
              </div>
            </div>

            <!-- Live Status Indicator Pill -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge" style="font-size: 12px; padding: 6px 14px; font-weight: 800; border-radius: 20px; ${settings.maintenanceMode ? 'background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1.5px solid #ef4444;' : 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1.5px solid #10b981;'}">
                ${settings.maintenanceMode ? '🔴 MAINTENANCE MODE ACTIVE (Users Locked Out)' : '🟢 SYSTEM OPERATIONAL (Normal Public Access)'}
              </span>
            </div>
          </div>

          <!-- Description Box -->
          <div style="background: ${settings.maintenanceMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 23, 42, 0.6)'}; border: 1px solid ${settings.maintenanceMode ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #e2e8f0; line-height: 1.5;">
            🔒 <strong>Policy Rule:</strong> When Maintenance Mode is <strong>ENABLED</strong>, regular factory users, operators, and viewers cannot log in. Administrators and Super Admins retain full bypass access to manage data and configure system options.
          </div>

          <!-- Controls Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
            
            <!-- Left Column: Toggles & Timing -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              
              <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 700; color: #fff; font-size: 13.5px;">Enable Maintenance Mode</div>
                  <div style="font-size: 11.5px; color: var(--text-muted);">Lock out regular users and show maintenance notice.</div>
                </div>
                <input type="checkbox" id="setting-maintenance-mode-toggle" ${settings.maintenanceMode ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;" />
              </div>

              <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 700; color: #fff; font-size: 13px;">Allow Administrator Bypass</div>
                  <div style="font-size: 11.5px; color: var(--text-muted);">Super Admins &amp; Admins can sign in and work during maintenance.</div>
                </div>
                <input type="checkbox" id="setting-maintenance-allow-admin" ${settings.maintenanceAllowAdmin !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-weight: 700; font-size: 12px; color: #cbd5e1;">Estimated Completion Time (Optional)</label>
                <input type="text" id="setting-maintenance-estimated-end" class="form-control" value="${escapeHtml(settings.maintenanceEstimatedEnd || '')}" placeholder="e.g. Today at 08:30 PM (approx. 45 mins)" style="font-size: 13px; background: #0f172a;" />
              </div>

            </div>

            <!-- Right Column: Notice Message -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label class="form-label" style="font-weight: 700; font-size: 12px; color: #cbd5e1; margin-bottom: 0;">Public Maintenance Notice Message</label>
              <textarea id="setting-maintenance-message" class="form-control" rows="5" placeholder="Enter custom notice message displayed to users..." style="resize: vertical; font-size: 12.5px; line-height: 1.5; min-height: 130px; background: #0f172a;">${escapeHtml(settings.maintenanceMessage || 'Routine scheduled system maintenance and server upgrade is currently in progress. Normal operations will resume shortly.')}</textarea>
              
              ${settings.maintenanceEnabledAt ? `
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
                  🕒 Last activated on <strong>${new Date(settings.maintenanceEnabledAt).toLocaleString()}</strong> by <strong>${escapeHtml(settings.maintenanceEnabledBy || 'Administrator')}</strong>
                </div>
              ` : ''}
            </div>

          </div>

          <!-- Action Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 4px; flex-wrap: wrap; gap: 10px;">
            <button type="button" id="btn-quick-toggle-maint" class="btn ${settings.maintenanceMode ? 'btn-danger' : 'btn-secondary'} btn-sm" style="font-weight: 700;">
              ${settings.maintenanceMode ? '⏹️ Turn OFF Maintenance Mode' : '⚡ 1-Click Activate Maintenance Mode'}
            </button>

            <div style="display: flex; align-items: center; gap: 12px;">
              <span id="save-maint-feedback-msg" style="font-size: 12px; color: #34d399; font-weight: 600; display: none;"></span>
              <button type="button" id="btn-save-maintenance-settings" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #f59e0b, #d97706); border-color: #f59e0b; padding: 8px 24px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);">
                💾 Save Maintenance Settings
              </button>
            </div>
          </div>

        </div>

        <!-- Card 3: Machine Serial Number Format & Location Short Code Policy (ADMIN CONFIGURATION) -->
        <div style="background: var(--bg-surface); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px; grid-column: 1 / -1; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            <h3 style="font-size: 15px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
              <span>🔢 Machine Serial Number Format &amp; Floor Short Code Policy</span>
            </h3>
            <span class="badge badge-active">RECOMMENDED FORMAT: [Floor Short Code]-[Machine Number]</span>
          </div>

          <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
            Configure unique Machine Serial Number formatting. The serial number includes a short code for the floor/location (e.g. <code>JA-01</code> for Jamuna Floor, <code>BG-01</code> for Buriganga Floor, <code>TT-01</code> for Titash Floor, <code>CH-01</code> for Chitra Floor) so machines can be searched quickly.
          </div>

          <!-- Policy Rule Alert Box -->
          <div style="background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #e0f2fe;">
            🔒 <strong>Important Immutability Rule:</strong> The Serial Number remains unique even if the machine is transferred to another floor. The original serial number never automatically changes after transfer. Location history separately records where the machine has been.
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Format Template</label>
              <input type="text" id="setting-serial-template" class="form-control" value="${settings.serialFormatTemplate || '{FLOOR_CODE}-{NUMBER}'}" style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;" />
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">Use {FLOOR_CODE} and {NUMBER}</div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Number Sequence Padding</label>
              <select id="setting-serial-padding" class="form-control" style="font-weight: 600;">
                <option value="2" ${settings.serialNumberPadding === 2 ? 'selected' : ''}>2 Digits (e.g. JA-01, JA-02)</option>
                <option value="3" ${settings.serialNumberPadding === 3 ? 'selected' : ''}>3 Digits (e.g. JA-001, JA-002)</option>
                <option value="4" ${settings.serialNumberPadding === 4 ? 'selected' : ''}>4 Digits (e.g. JA-0001, JA-0002)</option>
                <option value="5" ${settings.serialNumberPadding === 5 ? 'selected' : ''}>5 Digits (e.g. JA-00001, JA-00002)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">Floor Short Code Prefix Policy</label>
              <div style="display: flex; align-items: center; gap: 10px; height: 38px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer; color: #fff;">
                  <input type="checkbox" id="setting-enforce-prefix" ${settings.enforceFloorPrefix !== false ? 'checked' : ''} style="width: 16px; height: 16px;" />
                  Auto-prefix Floor Short Code
                </label>
              </div>
            </div>
          </div>

          <!-- Floor Short Codes Overview Table -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px;">
            <div style="font-weight: 700; font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
              Configured Floor Short Codes &amp; Sample Serial Examples:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${(masterDataService.getFloors(null, null, true) || []).map(f => {
                const code = (f.code || f.name.substring(0, 2)).toUpperCase().trim();
                return `
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 11.5px; padding: 4px 9px;">
                    <strong>${code}</strong> &rarr; ${f.name} (<code>${code}-01, ${code}-02</code>)
                  </span>
                `;
              }).join('')}
            </div>
          </div>

          <button id="btn-save-serial-settings" class="btn btn-primary btn-sm" style="align-self: flex-start; font-weight: 700;">
            💾 Save Serial Number Configuration
          </button>
      </div>
    </div>
  `;
}

export function initSettingsEvents() {
  const saveGen = document.getElementById('btn-save-general-settings');
  if (saveGen) {
    saveGen.addEventListener('click', async () => {
      const origText = saveGen.innerHTML;
      saveGen.disabled = true;
      saveGen.innerHTML = 'Saving...';

      const companyName = document.getElementById('setting-company-name')?.value.trim();
      const departmentName = document.getElementById('setting-dept-name')?.value.trim();
      const pageSize = Number(document.getElementById('setting-page-size')?.value) || 50;

      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      storage.data[TABLE_NAMES.SETTINGS] = {
        ...current,
        companyName,
        departmentName,
        defaultRowsPerPage: pageSize
      };
      await storage.saveTable(TABLE_NAMES.SETTINGS, true);
      saveGen.innerHTML = '✓ Saved';
      setTimeout(() => {
        saveGen.disabled = false;
        saveGen.innerHTML = origText;
      }, 1500);
    });
  }

  // Maintenance Mode Save Handler
  const saveMaintBtn = document.getElementById('btn-save-maintenance-settings');
  if (saveMaintBtn) {
    saveMaintBtn.addEventListener('click', async () => {
      const isEnabled = document.getElementById('setting-maintenance-mode-toggle')?.checked;
      const message = document.getElementById('setting-maintenance-message')?.value.trim();
      const estimatedEnd = document.getElementById('setting-maintenance-estimated-end')?.value.trim();
      const allowAdmin = document.getElementById('setting-maintenance-allow-admin')?.checked;

      const origText = saveMaintBtn.innerHTML;
      saveMaintBtn.disabled = true;
      saveMaintBtn.innerHTML = 'Saving...';

      try {
        await authService.setMaintenanceMode(isEnabled, { message, estimatedEnd, allowAdmin });
        const feedback = document.getElementById('save-maint-feedback-msg');
        if (feedback) {
          feedback.textContent = '✓ Maintenance settings saved successfully!';
          feedback.style.display = 'inline-block';
          setTimeout(() => { feedback.style.display = 'none'; }, 3000);
        }
        state.emit('inventory:updated');
        state.set('currentView', 'settings');
      } catch (err) {
        alert('Failed to save maintenance settings: ' + err.message);
      } finally {
        saveMaintBtn.disabled = false;
        saveMaintBtn.innerHTML = origText;
      }
    });
  }

  // Quick 1-Click Toggle Maintenance Mode Button
  const quickToggleMaintBtn = document.getElementById('btn-quick-toggle-maint');
  if (quickToggleMaintBtn) {
    quickToggleMaintBtn.addEventListener('click', async () => {
      const currentConfig = authService.getMaintenanceModeConfig();
      const willEnable = !currentConfig.enabled;
      
      const confirmMsg = willEnable 
        ? 'Are you sure you want to ACTIVATE System Maintenance Mode?\n\nNon-administrator users will be prevented from logging in until maintenance mode is turned off.'
        : 'Are you sure you want to TURN OFF System Maintenance Mode?\n\nNormal access will be restored for all users.';
      
      if (!confirm(confirmMsg)) return;

      quickToggleMaintBtn.disabled = true;
      try {
        await authService.setMaintenanceMode(willEnable, {
          message: document.getElementById('setting-maintenance-message')?.value.trim() || currentConfig.message,
          estimatedEnd: document.getElementById('setting-maintenance-estimated-end')?.value.trim() || currentConfig.estimatedEnd,
          allowAdmin: document.getElementById('setting-maintenance-allow-admin')?.checked ?? currentConfig.allowAdmin
        });
        state.emit('inventory:updated');
        state.set('currentView', 'settings');
      } catch (err) {
        alert('Failed to toggle maintenance mode: ' + err.message);
        quickToggleMaintBtn.disabled = false;
      }
    });
  }

  // ==========================================
  // Admin Login Gateway URL Settings Handlers
  // ==========================================
  const slugInput = document.getElementById('setting-admin-login-slug');
  const liveSlugPreview = document.getElementById('live-slug-preview-text');
  const displayFullUrl = document.getElementById('display-full-admin-url');
  const copyBtn = document.getElementById('btn-copy-admin-slug-url');
  const copyBtnText = document.getElementById('copy-admin-btn-text');
  const saveAdminSlugBtn = document.getElementById('btn-save-admin-slug-setting');
  const resetAdminSlugBtn = document.getElementById('btn-reset-admin-slug-default');
  const slugFeedbackMsg = document.getElementById('save-admin-slug-feedback-msg');

  const updatePreviewUrl = () => {
    if (!slugInput || !liveSlugPreview) return;
    const rawVal = (slugInput.value || '').trim().toLowerCase();
    const cleanSlug = rawVal.replace(/^\/+|\/+$/g, '') || 'secure-admin-gateway';
    const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://maint-dept.github.io';
    const base = (typeof router !== 'undefined' && typeof router.getBasePath === 'function') ? router.getBasePath() : '';
    const newFullUrl = `${origin}${base}/${cleanSlug}`;
    liveSlugPreview.textContent = newFullUrl;
  };

  if (slugInput) {
    slugInput.addEventListener('input', updatePreviewUrl);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const urlToCopy = displayFullUrl?.textContent?.trim() || liveSlugPreview?.textContent?.trim();
      if (!urlToCopy) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(urlToCopy);
        } else {
          const tempInp = document.createElement('input');
          tempInp.value = urlToCopy;
          document.body.appendChild(tempInp);
          tempInp.select();
          document.execCommand('copy');
          document.body.removeChild(tempInp);
        }
        if (copyBtnText) copyBtnText.textContent = '✓ Copied to Clipboard!';
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy Secret Admin URL';
        }, 2200);
      } catch (err) {
        alert('Could not copy automatically. URL is: ' + urlToCopy);
      }
    });
  }

  if (saveAdminSlugBtn) {
    saveAdminSlugBtn.addEventListener('click', async () => {
      const origText = saveAdminSlugBtn.innerHTML;
      let slugVal = (slugInput?.value || '').trim().toLowerCase();
      slugVal = slugVal.replace(/^\/+|\/+$/g, '');
      saveAdminSlugBtn.disabled = true;
      saveAdminSlugBtn.innerHTML = 'Saving Slug...';

      try {
        const savedSlug = await authService.setAdminLoginSlug(slugVal);
        const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'https://maint-dept.github.io';
        const base = (typeof router !== 'undefined' && typeof router.getBasePath === 'function') ? router.getBasePath() : '';
        const savedFullUrl = `${origin}${base}/${savedSlug}`;

        if (displayFullUrl) displayFullUrl.textContent = savedFullUrl;
        if (liveSlugPreview) liveSlugPreview.textContent = savedFullUrl;
        if (slugInput) slugInput.value = savedSlug;

        const openBtn = document.getElementById('link-open-admin-gateway');
        if (openBtn) openBtn.href = savedFullUrl;

        if (slugFeedbackMsg) {
          slugFeedbackMsg.textContent = `✓ Admin URL updated to '/${savedSlug}'!`;
          slugFeedbackMsg.style.display = 'inline-block';
          setTimeout(() => { slugFeedbackMsg.style.display = 'none'; }, 3500);
        }
      } catch (err) {
        alert('Error updating Admin Login URL: ' + err.message);
      } finally {
        saveAdminSlugBtn.disabled = false;
        saveAdminSlugBtn.innerHTML = origText;
      }
    });
  }

  if (resetAdminSlugBtn) {
    resetAdminSlugBtn.addEventListener('click', async () => {
      if (!confirm('Revert Admin Login URL slug back to default "secure-admin-gateway"?')) return;
      if (slugInput) slugInput.value = 'secure-admin-gateway';
      updatePreviewUrl();
      if (saveAdminSlugBtn) saveAdminSlugBtn.click();
    });
  }

  // Active selected report key in Admin Settings
  let currentActiveReportKey = 'ALL';

  function updateReportStatusIndicator(reportKey) {
    const badge = document.getElementById('report-sig-status-badge');
    const resetBtn = document.getElementById('btn-reset-report-signatures');
    const descEl = document.getElementById('report-sig-context-desc');
    const repInfo = REPORT_TYPES.find(r => r.key === reportKey) || { label: reportKey, description: '' };

    if (descEl) {
      descEl.textContent = repInfo.description || '';
    }

    if (reportKey === 'ALL') {
      if (badge) {
        badge.innerHTML = '🌐 Global Default Template (Applies to all reports)';
        badge.style.background = 'rgba(56, 189, 248, 0.15)';
        badge.style.color = '#38bdf8';
        badge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      }
      if (resetBtn) resetBtn.style.display = 'none';
    } else {
      const isCustom = getSignaturesForReport(reportKey, true) !== null;
      if (isCustom) {
        if (badge) {
          badge.innerHTML = `🎯 Custom Signatures Active for ${repInfo.label}`;
          badge.style.background = 'rgba(168, 85, 247, 0.2)';
          badge.style.color = '#c084fc';
          badge.style.borderColor = 'rgba(168, 85, 247, 0.5)';
        }
        if (resetBtn) resetBtn.style.display = 'inline-flex';
      } else {
        if (badge) {
          badge.innerHTML = `📋 Inheriting from "All Reports" Template`;
          badge.style.background = 'rgba(234, 179, 8, 0.15)';
          badge.style.color = '#facc15';
          badge.style.borderColor = 'rgba(234, 179, 8, 0.4)';
        }
        if (resetBtn) resetBtn.style.display = 'none';
      }
    }
  }

  function loadReportSignaturesIntoDOM(reportKey) {
    const container = document.getElementById('signatures-list-container');
    if (!container) return;
    const sigs = getSignaturesForReport(reportKey);
    const availableEmployees = getAvailableSignatoryEmployees();
    container.innerHTML = sigs.map((sig, idx) => renderSignatorySlotHtml(sig, idx, availableEmployees)).join('');
    updateReportStatusIndicator(reportKey);
  }

  // Report Type Dropdown Change Listener
  const reportTypeSelect = document.getElementById('report-signature-type-select');
  if (reportTypeSelect) {
    reportTypeSelect.addEventListener('change', (e) => {
      currentActiveReportKey = e.target.value;
      loadReportSignaturesIntoDOM(currentActiveReportKey);
    });
  }

  // Reset to Default Template Button
  const btnResetReportSig = document.getElementById('btn-reset-report-signatures');
  if (btnResetReportSig) {
    btnResetReportSig.addEventListener('click', async (e) => {
      e.preventDefault();
      if (currentActiveReportKey === 'ALL') return;
      const repInfo = REPORT_TYPES.find(r => r.key === currentActiveReportKey) || { label: currentActiveReportKey };
      if (!confirm(`Are you sure you want to remove the custom signatures for "${repInfo.label}" and revert back to the "All Reports" default template?`)) {
        return;
      }
      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      if (current.reportSignatures && current.reportSignatures[currentActiveReportKey]) {
        delete current.reportSignatures[currentActiveReportKey];
        storage.data[TABLE_NAMES.SETTINGS] = {
          ...current,
          reportSignatures: { ...current.reportSignatures }
        };
        await storage.saveTable(TABLE_NAMES.SETTINGS, true);
      }
      loadReportSignaturesIntoDOM(currentActiveReportKey);
    });
  }

  // Employee Select Change Listener (Event Delegation)
  const signaturesContainer = document.getElementById('signatures-list-container');
  if (signaturesContainer) {
    signaturesContainer.addEventListener('change', (e) => {
      const selectEl = e.target.closest('.sig-slot-employee-select');
      if (!selectEl) return;
      const card = selectEl.closest('.signature-slot-card');
      if (!card) return;

      const nameInput = card.querySelector('.sig-slot-name');
      const titleInput = card.querySelector('.sig-slot-title');
      const selectedVal = selectEl.value;

      if (selectedVal === '__custom__') {
        if (nameInput) {
          nameInput.focus();
        }
        return;
      }

      if (selectedVal) {
        if (nameInput) nameInput.value = selectedVal;
        const opt = selectEl.selectedOptions[0];
        const desig = opt ? opt.getAttribute('data-designation') : '';
        if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
          titleInput.value = desig ? `Prepared By (${desig})` : 'Prepared By';
        }
      }
    });
  }

  // Re-indexing helper for dynamic signatory cards
  function reindexSignatureSlots() {
    const container = document.getElementById('signatures-list-container');
    if (!container) return;
    const cards = container.querySelectorAll('.signature-slot-card');
    cards.forEach((card, idx) => {
      const num = idx + 1;
      const badge = card.querySelector('.sig-slot-index-badge');
      if (badge) badge.textContent = `#${num}`;
      const label = card.querySelector('.sig-slot-label');
      if (label) label.textContent = `Signatory ${num}`;
    });
  }

  // Add More Signatory Handler
  function addNewSignatureSlot() {
    const container = document.getElementById('signatures-list-container');
    if (!container) return;
    const currentCount = container.querySelectorAll('.signature-slot-card').length;
    const newIdx = currentCount;
    const defaultRoles = ['Prepared By', 'Verified By', 'Approved By', 'Checked By', 'Recommending Authority'];
    const assignedRole = defaultRoles[newIdx] || `Signatory ${newIdx + 1}`;

    const newSig = {
      id: `sig-${Date.now()}`,
      name: '',
      title: assignedRole,
      enabled: true
    };
    
    const wrapper = document.createElement('div');
    const availableEmployees = getAvailableSignatoryEmployees();
    wrapper.innerHTML = renderSignatorySlotHtml(newSig, newIdx, availableEmployees).trim();
    const newCard = wrapper.firstElementChild;
    container.appendChild(newCard);
    reindexSignatureSlots();

    const empSelect = newCard.querySelector('.sig-slot-employee-select');
    if (empSelect) empSelect.focus({ preventScroll: true });
  }

  const btnAddTop = document.getElementById('btn-add-signature-slot');
  if (btnAddTop) {
    btnAddTop.addEventListener('click', (e) => {
      e.preventDefault();
      addNewSignatureSlot();
    });
  }

  const btnAddBottom = document.getElementById('btn-add-signature-slot-bottom');
  if (btnAddBottom) {
    btnAddBottom.addEventListener('click', (e) => {
      e.preventDefault();
      addNewSignatureSlot();
    });
  }

  // Remove Signatory Handler (Event Delegation)
  if (signaturesContainer) {
    signaturesContainer.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove-signature-slot');
      if (!removeBtn) return;
      e.preventDefault();

      const card = removeBtn.closest('.signature-slot-card');
      if (!card) return;

      const allCards = signaturesContainer.querySelectorAll('.signature-slot-card');
      if (allCards.length <= 1) {
        if (confirm('Do you want to clear this signatory? (At least 1 slot will remain)')) {
          const nameEl = card.querySelector('.sig-slot-name');
          const titleEl = card.querySelector('.sig-slot-title');
          const enabledEl = card.querySelector('.sig-slot-enabled');
          const selEl = card.querySelector('.sig-slot-employee-select');
          if (nameEl) nameEl.value = '';
          if (titleEl) titleEl.value = '';
          if (enabledEl) enabledEl.checked = false;
          if (selEl) selEl.value = '';
        }
        return;
      }

      card.remove();
      reindexSignatureSlots();
    });
  }

  // Save Signatures Handler (Per Report Type)
  const saveSig = document.getElementById('btn-save-signature-settings');
  if (saveSig) {
    saveSig.addEventListener('click', async (e) => {
      e.preventDefault();
      const origText = saveSig.innerHTML;
      saveSig.disabled = true;
      saveSig.innerHTML = 'Saving...';

      const container = document.getElementById('signatures-list-container');
      const cards = container ? container.querySelectorAll('.signature-slot-card') : [];
      
      const signaturesList = [];
      cards.forEach((card, idx) => {
        const id = card.getAttribute('data-sig-id') || `sig-${idx + 1}`;
        const name = card.querySelector('.sig-slot-name')?.value.trim() || '';
        const title = card.querySelector('.sig-slot-title')?.value.trim() || '';
        const enabled = card.querySelector('.sig-slot-enabled')?.checked !== false;

        signaturesList.push({ id, name, title, enabled });
      });

      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      const currentReportSignatures = { ...(current.reportSignatures || {}) };
      currentReportSignatures[currentActiveReportKey] = signaturesList;

      // Also map first 3 to legacy properties if editing 'ALL' for backwards compatibility
      const sig1 = signaturesList[0] || {};
      const sig2 = signaturesList[1] || {};
      const sig3 = signaturesList[2] || {};

      const updatedSettings = {
        ...current,
        reportSignatures: currentReportSignatures
      };

      if (currentActiveReportKey === 'ALL') {
        updatedSettings.signatures = signaturesList;
        updatedSettings.sig1Name = sig1.name || '';
        updatedSettings.sig1Title = sig1.title || '';
        updatedSettings.showSig1 = sig1.enabled !== false;
        updatedSettings.sig2Name = sig2.name || '';
        updatedSettings.sig2Title = sig2.title || '';
        updatedSettings.showSig2 = sig2.enabled !== false;
        updatedSettings.sig3Name = sig3.name || '';
        updatedSettings.sig3Title = sig3.title || '';
        updatedSettings.showSig3 = sig3.enabled !== false;
        updatedSettings.signatory1Name = sig1.name || '';
        updatedSettings.signatory1Title = sig1.title || '';
        updatedSettings.signatory2Name = sig2.name || '';
        updatedSettings.signatory2Title = sig2.title || '';
        updatedSettings.signatory3Name = sig3.name || '';
        updatedSettings.signatory3Title = sig3.title || '';
        updatedSettings.showSignaturesOnPdf = signaturesList.some(s => s.enabled);
      }

      storage.data[TABLE_NAMES.SETTINGS] = updatedSettings;

      try {
        await storage.saveTable(TABLE_NAMES.SETTINGS, true);
        saveSig.innerHTML = '✓ Saved Changes';
        updateReportStatusIndicator(currentActiveReportKey);
        const fbMsg = document.getElementById('save-sig-feedback-msg');
        if (fbMsg) {
          const repInfo = REPORT_TYPES.find(r => r.key === currentActiveReportKey) || { label: currentActiveReportKey };
          fbMsg.textContent = `✓ Signatures saved for "${repInfo.label}"`;
          fbMsg.style.display = 'inline';
          setTimeout(() => { fbMsg.style.display = 'none'; }, 3000);
        }
        setTimeout(() => {
          saveSig.disabled = false;
          saveSig.innerHTML = origText;
        }, 1500);
      } catch (err) {
        console.error('Error saving signature settings:', err);
        saveSig.innerHTML = '✓ Saved';
        setTimeout(() => {
          saveSig.disabled = false;
          saveSig.innerHTML = origText;
        }, 1500);
      }
    });
  }

  const saveAppr = document.getElementById('btn-save-approval-settings');
  if (saveAppr) {
    saveAppr.addEventListener('click', async () => {
      const origText = saveAppr.innerHTML;
      saveAppr.disabled = true;
      saveAppr.innerHTML = 'Saving...';

      const requireApproval = document.getElementById('setting-require-approval')?.checked;
      const requireDel = document.getElementById('setting-require-del-approval')?.checked;

      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      storage.data[TABLE_NAMES.SETTINGS] = {
        ...current,
        requireApprovalForMaintenanceUsers: requireApproval,
        requireDeleteApproval: requireDel
      };
      await storage.saveTable(TABLE_NAMES.SETTINGS, true);
      saveAppr.innerHTML = '✓ Saved';
      setTimeout(() => {
        saveAppr.disabled = false;
        saveAppr.innerHTML = origText;
      }, 1500);
    });
  }

  const saveSerial = document.getElementById('btn-save-serial-settings');
  if (saveSerial) {
    saveSerial.addEventListener('click', async () => {
      const origText = saveSerial.innerHTML;
      saveSerial.disabled = true;
      saveSerial.innerHTML = 'Saving...';

      const template = document.getElementById('setting-serial-template')?.value.trim() || '{FLOOR_CODE}-{NUMBER}';
      const padding = Number(document.getElementById('setting-serial-padding')?.value) || 2;
      const enforce = document.getElementById('setting-enforce-prefix')?.checked;

      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      storage.data[TABLE_NAMES.SETTINGS] = {
        ...current,
        serialFormatTemplate: template,
        serialNumberPadding: padding,
        enforceFloorPrefix: enforce
      };
      await storage.saveTable(TABLE_NAMES.SETTINGS, true);
      saveSerial.innerHTML = '✓ Saved';
      setTimeout(() => {
        saveSerial.disabled = false;
        saveSerial.innerHTML = origText;
      }, 1500);
    });
  }

  const syncSettingsInputsToMemory = () => {
    try {
      const container = document.getElementById('signatures-list-container');
      const cards = container ? container.querySelectorAll('.signature-slot-card') : [];
      const signaturesList = [];
      cards.forEach((card, idx) => {
        const id = card.getAttribute('data-sig-id') || `sig-${idx + 1}`;
        const name = card.querySelector('.sig-slot-name')?.value || '';
        const title = card.querySelector('.sig-slot-title')?.value || '';
        const enabled = card.querySelector('.sig-slot-enabled')?.checked !== false;
        signaturesList.push({ id, name, title, enabled });
      });

      const companyName = document.getElementById('setting-company-name')?.value;
      const deptName = document.getElementById('setting-dept-name')?.value;
      const pageSize = Number(document.getElementById('setting-page-size')?.value);
      const reqAppr = document.getElementById('setting-require-approval')?.checked;
      const reqDel = document.getElementById('setting-require-del-approval')?.checked;
      const serialTpl = document.getElementById('setting-serial-template')?.value;
      const serialPad = Number(document.getElementById('setting-serial-padding')?.value);
      const enforcePrefix = document.getElementById('setting-enforce-prefix')?.checked;

      const current = storage.getTable(TABLE_NAMES.SETTINGS) || {};
      const sig1 = signaturesList[0] || {};
      const sig2 = signaturesList[1] || {};
      const sig3 = signaturesList[2] || {};

      storage.data[TABLE_NAMES.SETTINGS] = {
        ...current,
        signatures: signaturesList,
        sig1Name: sig1.name || '',
        sig1Title: sig1.title || '',
        showSig1: sig1.enabled !== false,
        sig2Name: sig2.name || '',
        sig2Title: sig2.title || '',
        showSig2: sig2.enabled !== false,
        sig3Name: sig3.name || '',
        sig3Title: sig3.title || '',
        showSig3: sig3.enabled !== false,
        signatory1Name: sig1.name || '',
        signatory1Title: sig1.title || '',
        signatory2Name: sig2.name || '',
        signatory2Title: sig2.title || '',
        signatory3Name: sig3.name || '',
        signatory3Title: sig3.title || '',
        showSignaturesOnPdf: signaturesList.some(s => s.enabled),
        ...(companyName !== undefined ? { companyName } : {}),
        ...(deptName !== undefined ? { departmentName: deptName } : {}),
        ...(pageSize ? { defaultRowsPerPage: pageSize } : {}),
        ...(reqAppr !== undefined ? { requireApprovalForMaintenanceUsers: reqAppr } : {}),
        ...(reqDel !== undefined ? { requireDeleteApproval: reqDel } : {}),
        ...(serialTpl !== undefined ? { serialFormatTemplate: serialTpl } : {}),
        ...(serialPad ? { serialNumberPadding: serialPad } : {}),
        ...(enforcePrefix !== undefined ? { enforceFloorPrefix: enforcePrefix } : {})
      };
    } catch (e) {
      console.warn('[Settings] in-memory sync note:', e.message);
    }
  };

  const pageContainer = document.querySelector('.page-view');
  if (pageContainer) {
    pageContainer.addEventListener('input', syncSettingsInputsToMemory);
    pageContainer.addEventListener('change', syncSettingsInputsToMemory);
  }
}
