/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Interactive Quick Help & User Guide Modal Component
 */

import { state } from '../state.js';

export function renderQuickHelpModal() {
  return `
    <div class="modal-overlay" id="modal-quick-help-overlay">
      <div class="modal-dialog modal-dialog-lg">
        <div class="modal-header">
          <div class="modal-title">
            <span>📖 User Guide & Quick Reference Manual</span>
            <span style="font-size: 11px; background: var(--primary-light); color: #38bdf8; padding: 2px 8px; border-radius: 9999px;">
              Al-Muslim Group • Asset Management
            </span>
          </div>
          <button id="btn-close-help-modal" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
        </div>

        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px; max-height: 520px; overflow-y: auto; flex: 1; min-height: 0;">
          <!-- Card 1: Fundamental Machine Identity Rule -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #38bdf8; border-radius: var(--radius-md); padding: 14px 18px;">
            <h3 style="font-size: 14.5px; font-weight: 700; color: #38bdf8; margin-bottom: 6px;">
              🧵 1. Core Rule: Infinite Machines with Same Name & Model
            </h3>
            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
              In a large garments manufacturing group, <strong>Machine Name</strong> (e.g. <em>Lock Stitch, Overlock</em>) is a general category classification. Thousands of machines can share the exact same Name, Brand, and Model across production lines.
              <br/>
              <strong>Each physical machine is uniquely tracked by its Serial Number</strong> (e.g., <code style="color: #34d399;">JS-00001</code> to <code style="color: #34d399;">JS-00060...</code>) and optional Asset ID (<code style="color: #38bdf8;">MC-LS-00001</code>).
            </p>
          </div>

          <!-- Card 2: Excel-Like Grid & Fast Inline Editing -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #34d399; border-radius: var(--radius-md); padding: 14px 18px;">
            <h3 style="font-size: 14.5px; font-weight: 700; color: #34d399; margin-bottom: 6px;">
              📊 2. Excel-Like Inventory Grid & Quick Filters
            </h3>
            <ul style="font-size: 12px; color: var(--text-secondary); line-height: 1.7; padding-left: 18px;">
              <li><strong>Frozen Columns:</strong> Sl., Checkbox, Serial Number, and Machine Name remain pinned on the left when scrolling horizontally.</li>
              <li><strong>Quick Status Pills:</strong> 1-click filter buttons on top of the grid to filter by Active, Maintenance, Breakdown, or Pending Approval.</li>
              <li><strong>1-Click Column Sorting:</strong> Click any table header (Sl, Serial Number, Name, Brand, Status) to toggle Ascending / Descending order.</li>
              <li><strong>Inline Cell Editing:</strong> Double-click on Status or Remarks cells to edit directly.</li>
            </ul>
          </div>

          <!-- Card 3: Dynamic Custom Fields & Excel Layouts -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #c084fc; border-radius: var(--radius-md); padding: 14px 18px;">
            <h3 style="font-size: 14.5px; font-weight: 700; color: #c084fc; margin-bottom: 6px;">
              ⚙️ 3. Admin Dynamic Custom Fields & Excel Builder
            </h3>
            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
              Administrators can add technical parameters (*Motor HP, RPM, Voltage, Bed Type, Lubrication*) without developer assistance. Parameters automatically appear across forms, table columns, filter dropdowns, Excel templates, and PDF reports.
            </p>
          </div>

          <!-- Card 4: 1-Click Role Testing & Location Scoping -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid #fbbf24; border-radius: var(--radius-md); padding: 14px 18px;">
            <h3 style="font-size: 14.5px; font-weight: 700; color: #fbbf24; margin-bottom: 6px;">
              🎭 4. Granular RBAC & Role Switcher
            </h3>
            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
              Use the <strong>Role Switcher dropdown in the top header</strong> to test permissions:
              <br/>
              • <strong>superadmin / admin:</strong> Full enterprise access.
              <br/>
              • <strong>user_akm:</strong> Scoped Technician strictly restricted to <em>AKM Knitwear &rarr; 5th Floor &rarr; Lines JA-A & JA-B</em>.
              <br/>
              • <strong>viewer:</strong> Read-only compliance auditor.
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button id="btn-dismiss-help-modal" class="btn btn-primary">Got it, thanks!</button>
        </div>
      </div>
    </div>
  `;
}

export function initQuickHelpEvents() {
  const overlay = document.getElementById('modal-quick-help-overlay');
  const closeBtn = document.getElementById('btn-close-help-modal');
  const dismissBtn = document.getElementById('btn-dismiss-help-modal');

  const closeModal = () => state.set('activeModal', null);

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
}
