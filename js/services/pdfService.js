/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Corporate Branded PDF & Print Report Generator
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';
import { masterDataService } from './masterDataService.js';
import { resolveTransferMachineDetails } from './transferService.js';
import { getSignaturesForReport } from '../components/settingsView.js';

class PDFService {
  /**
   * Generates formatted corporate branded printable report document
   */
  generateReport({ title, subtitle, filterSummary, machines, generatedBy }) {
    const user = generatedBy || authService.getCurrentUser();
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const companyName = settings.companyName || 'AL-MUSLIM GROUP';
    const deptName = settings.departmentName || 'Central Maintenance & Mechanical Engineering Department';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build Table Rows
    const rowsHtml = machines.map((m, i) => {
      const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, m.machineNameId)?.name || 'N/A';
      const brand = storage.getItem(TABLE_NAMES.BRANDS, m.brandId)?.name || 'N/A';
      const model = storage.getItem(TABLE_NAMES.MODELS, m.modelId)?.name || 'N/A';
      const unit = storage.getItem(TABLE_NAMES.UNITS, m.unitId)?.name || 'N/A';
      const floor = storage.getItem(TABLE_NAMES.FLOORS, m.floorId)?.name || 'N/A';
      const line = storage.getItem(TABLE_NAMES.LINES, m.lineId)?.name || 'N/A';

      const statusBadgeClass = m.status === 'ACTIVE' ? 'status-active' : (m.status === 'MAINTENANCE' || m.status === 'UNDER_MAINTENANCE' ? 'status-maint' : 'status-other');

      return `
        <tr>
          <td style="text-align: center;">${i + 1}</td>
          <td style="font-weight: 600; text-align: center;">${mn}</td>
          <td style="text-align: center;">${brand}</td>
          <td style="text-align: center;">${model}</td>
          <td style="font-family: monospace; font-weight: 700; color: #0284c7; text-align: center;">${m.serialNumber}</td>
          <td style="text-align: center;">${floor}</td>
          <td style="text-align: center;">${line}</td>
          <td style="text-align: center;">${m.quantity || 1}</td>
          <td style="text-align: center;"><span class="badge ${statusBadgeClass}">${m.status}</span></td>
        </tr>
      `;
    }).join('');

    const totalQty = machines.reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
    const activeCount = machines.filter(m => m.status === 'ACTIVE').length;
    const maintCount = machines.filter(m => m.status === 'MAINTENANCE').length;
    const breakdownCount = machines.filter(m => m.status === 'BREAKDOWN').length;

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - ${companyName}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4 landscape;
            margin: 12mm 10mm 15mm 10mm;
          }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: #1e293b;
            background: #fff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
          }
          .report-header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .company-title {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .dept-title {
            font-size: 13px;
            font-weight: 600;
            color: #0284c7;
            margin-top: 2px;
          }
          .report-meta {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .report-title-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #0284c7;
            padding: 10px 14px;
            margin-bottom: 14px;
            border-radius: 4px;
          }
          .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
          }
          .report-filter-summary {
            font-size: 11px;
            color: #475569;
          }
          .kpi-bar {
            display: flex;
            gap: 16px;
            margin-bottom: 14px;
          }
          .kpi-item {
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          }
          .kpi-item span {
            font-weight: 800;
            color: #0284c7;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 10.5px;
            margin-bottom: 24px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            text-align: center;
            word-wrap: break-word;
            overflow-wrap: break-word;
            vertical-align: middle;
            line-height: 1.4;
          }
          th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            white-space: nowrap;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .status-active { background: #dcfce7; color: #15803d; }
          .status-maint { background: #fef3c7; color: #b45309; }
          .status-other { background: #fee2e2; color: #b91c1c; }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .sig-box {
            width: 28%;
            text-align: center;
            border-top: 1px solid #475569;
            padding-top: 6px;
            font-size: 11px;
            font-weight: 600;
            color: #334155;
          }
          .sig-title {
            font-size: 10px;
            color: #64748b;
            margin-top: 2px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; text-align: right;">
          <button onclick="window.print()" style="background: #0284c7; color: #fff; border: none; padding: 8px 18px; font-weight: bold; border-radius: 4px; cursor: pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <div class="report-header">
          <div>
            <div class="company-title">🏭 ${companyName}</div>
            <div class="dept-title">🔧 ${deptName}</div>
          </div>
          <div class="report-meta">
            <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
          </div>
        </div>

        <div class="report-title-box">
          <div class="report-title">📋 ${title}</div>
          <div class="report-filter-summary">${filterSummary || 'Scope: Complete Enterprise Inventory Across All Lines'}</div>
        </div>

        <div class="kpi-bar">
          <div class="kpi-item">Total Machines: <span>${machines.length}</span></div>
          <div class="kpi-item">Total Qty: <span>${totalQty}</span></div>
          <div class="kpi-item">Active Operational: <span style="color: #16a34a;">${activeCount}</span></div>
          <div class="kpi-item">Under Maintenance: <span style="color: #d97706;">${maintCount}</span></div>
          <div class="kpi-item">Breakdown / Standby: <span style="color: #dc2626;">${breakdownCount}</span></div>
        </div>

        <table>
          <colgroup>
            <col style="width: 4%;" />    <!-- SL -->
            <col style="width: 20%;" />   <!-- Machine Name -->
            <col style="width: 11%;" />   <!-- Brand -->
            <col style="width: 14%;" />   <!-- Model -->
            <col style="width: 10%;" />   <!-- Serial Number -->
            <col style="width: 16%;" />   <!-- Floor -->
            <col style="width: 10%;" />   <!-- Line -->
            <col style="width: 5%;" />    <!-- Qty -->
            <col style="width: 10%;" />   <!-- Status -->
          </colgroup>
          <thead>
            <tr>
              <th>Sl.</th>
              <th>Machine Name</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Serial Number</th>
              <th>Floor</th>
              <th>Line</th>
              <th>Qty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${(() => {
          const signatures = getSignaturesForReport('MACHINE_SUMMARY');
          const activeSigs = signatures.filter(s => s.enabled !== false && ((s.name && s.name.trim()) || (s.title && s.title.trim())));
          if (activeSigs.length === 0) return '';
          return `
          <div class="signature-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 40px; page-break-inside: avoid; flex-wrap: wrap;">
            ${activeSigs.map(sig => `
              <div class="sig-box" style="flex: 1; min-width: 140px; text-align: center; border-top: 1.5px solid #334155; padding-top: 8px; font-size: 10.5px; font-weight: 600; color: #334155;">
                <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${sig.name || ''}</div>
                <div class="sig-title" style="font-size: 9.5px; color: #64748b; margin-top: 3px;">${sig.title || ''}</div>
              </div>
            `).join('')}
          </div>
          `;
        })()}
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      try {
        printWin.document.open();
        printWin.document.write(reportHtml);
        printWin.document.close();
        printWin.document.title = title || 'Machine Inventory Report';
        printWin.focus();
        auditService.log('PDF_REPORT_GENERATED', 'REPORT', title, `Generated PDF report: ${title} (${machines.length} records).`);
      } catch (err) {
        console.warn('Direct print window write failed, falling back to iframe print:', err);
        this._fallbackIframePrint(reportHtml);
      }
    } else {
      this._fallbackIframePrint(reportHtml);
      auditService.log('PDF_REPORT_GENERATED', 'REPORT', title, `Generated PDF report via iframe: ${title} (${machines.length} records).`);
    }
  }

  /**
   * Generates Official Machine Transfer Gate Pass & Authorization Report
   */
  generateTransferGatePassPDF(req) {
    if (!req) return;
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const companyName = settings.companyName || 'AL-MUSLIM GROUP';
    const deptName = settings.departmentName || 'Central Maintenance & Mechanical Engineering Department';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Resolve equipment details using comprehensive engine
    const eq = resolveTransferMachineDetails(req);
    // ──────────────────────────────────────────────────────────────────────────

    // Status colors
    const isCompleted = req.status === 'COMPLETED' || req.status === 'APPROVED';
    const statusColor = isCompleted ? '#16a34a' : (req.status === 'REJECTED' ? '#dc2626' : '#d97706');

    // Build Approval History Table Rows
    const historyRows = (req.approvalHistory || []).map((h, i) => `
      <tr>
        <td style="text-align: center; font-weight: 700;">${h.level === 0 ? 'Init' : `L-${h.level}`}</td>
        <td style="font-weight: 600;">${h.approverName} <span style="font-size: 10px; color: #64748b;">(${h.approverRole})</span></td>
        <td style="text-align: center;">
          <span style="font-weight: 700; color: ${h.action === 'APPROVED' ? '#16a34a' : (h.action === 'REJECTED' ? '#dc2626' : '#0284c7')};">
            ${(h.action || 'APPROVED').replace(/_/g, ' ')}
          </span>
        </td>
        <td style="text-align: center; font-family: monospace;">${h.date} ${h.time || ''}</td>
        <td style="font-size: 11px;">${h.remarks || '—'}</td>
      </tr>
    `).join('');

    // Documents summary
    const docsHtml = (req.documents || []).map(d => `
      <li style="margin-bottom: 4px;">
        <strong>📄 ${d.name}</strong> (${d.size || 'Attached'}) — Uploaded by ${d.uploadedByName || 'User'}
      </li>
    `).join('') || '<li style="color: #94a3b8;">No attached documents.</li>';

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transfer Authorization Pass - ${req.requestNumber}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 15mm 12mm;
          }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: #0f172a;
            background: #fff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0284c7;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title-area h1 {
            font-size: 22px;
            margin: 0;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .title-area h3 {
            font-size: 12.5px;
            margin: 3px 0 0 0;
            color: #0284c7;
            font-weight: 700;
          }
          .doc-id-badge {
            text-align: right;
          }
          .doc-id {
            font-family: monospace;
            font-size: 16px;
            font-weight: 800;
            color: #0284c7;
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            padding: 4px 10px;
            border-radius: 4px;
            display: inline-block;
          }
          .pass-banner {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-left: 6px solid ${statusColor};
            padding: 12px 16px;
            border-radius: 4px;
            margin-bottom: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-bottom: 16px;
          }
          .section-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 12px 14px;
            background: #ffffff;
          }
          .section-title {
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0284c7;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .location-route {
            background: #f1f5f9;
            padding: 10px;
            border-radius: 4px;
            margin-top: 4px;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 16px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 700;
            font-size: 10.5px;
            text-transform: uppercase;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .signatures {
            margin-top: 36px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            page-break-inside: avoid;
          }
          .sig-box {
            text-align: center;
            border-top: 1px solid #475569;
            padding-top: 6px;
            font-size: 10.5px;
          }
          .sig-box strong {
            display: block;
            margin-bottom: 2px;
          }
          .sig-role {
            font-size: 9.5px;
            color: #64748b;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; text-align: right;">
          <button onclick="window.print()" style="background: #0284c7; color: #fff; border: none; padding: 8px 18px; font-weight: bold; border-radius: 4px; cursor: pointer;">
            🖨️ Print Transfer Pass / Save PDF
          </button>
        </div>

        <div class="header">
          <div class="title-area">
            <h1>🏭 ${companyName}</h1>
            <h3>🔧 ${deptName}</h3>
          </div>
          <div class="doc-id-badge">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Official Gate Pass / Transfer ID</div>
            <div class="doc-id">${req.requestNumber}</div>
          </div>
        </div>

        <div class="pass-banner">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
              MACHINERY RELOCATION &amp; TRANSFER AUTHORIZATION NOTE
            </div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              Applied Workflow: <strong>${req.workflowName || 'Standard Approval Protocol'}</strong>
            </div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; background: ${statusColor}; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; text-transform: uppercase;">
              ${(req.status || 'PENDING_APPROVAL').replace(/_/g, ' ')}
            </span>
            <div style="font-size: 10.5px; color: #64748b; margin-top: 3px;">Date: ${dateStr}</div>
          </div>
        </div>

        <div class="grid-2">
          <!-- Machine Technical Specifications -->
          <div class="section-card">
            <div class="section-title">🧵 1. Machine Asset Identity</div>
            <div style="font-size: 11.5px; display: flex; flex-direction: column; gap: 4px;">
              <div><strong>Machine Name:</strong> ${eq.machineName}</div>
              <div><strong>Brand &amp; Model:</strong> ${eq.brandModelText}</div>
              <div><strong>Serial Number:</strong> <span style="font-family: monospace; font-weight: 800; color: #0284c7;">${eq.serialNumber}</span></div>
              <div><strong>Category:</strong> ${eq.category}</div>
            </div>
          </div>

          <!-- Transfer Routing Details -->
          <div class="section-card">
            <div class="section-title">📍 2. Relocation Movement Route</div>
            <div style="font-size: 11px; display: flex; flex-direction: column; gap: 6px;">
              <div>
                <span style="color: #dc2626; font-weight: 700;">FROM (Source Location):</span>
                <div class="location-route" style="border-left: 3px solid #dc2626;">
                  ${req.sourcePath}
                </div>
              </div>
              <div>
                <span style="color: #16a34a; font-weight: 700;">TO (Target Destination):</span>
                <div class="location-route" style="border-left: 3px solid #16a34a;">
                  ${req.destPath}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Transfer Reason & Request Info -->
        <div class="section-card" style="margin-bottom: 16px;">
          <div class="section-title">📝 3. Transfer Reason &amp; Order Reference</div>
          <div style="font-size: 11.5px;">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #0f172a;">${req.reason}</p>
            <div style="font-size: 11px; color: #64748b;">
              Requested By: <strong>${req.requestedByName}</strong> (${req.requestedByRole}) &bull; Request Date: ${new Date(req.requestedAt).toLocaleString()}
            </div>
            ${req.remarks ? `<div style="font-size: 11px; color: #475569; margin-top: 4px;">Staff Notes: <em>"${req.remarks}"</em></div>` : ''}
          </div>
        </div>

        <!-- Attached Management Permission Documents -->
        <div class="section-card" style="margin-bottom: 16px;">
          <div class="section-title">📎 4. Management Approval / Supporting Documents</div>
          <ul style="margin: 0; padding-left: 18px; font-size: 11px;">
            ${docsHtml}
          </ul>
        </div>

        <!-- Step-by-Step Approval History Table -->
        <div class="section-title" style="margin-bottom: 6px;">🛡️ 5. Multi-Stage Approval Audit Trail</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">Level</th>
              <th>Approver Name &amp; Designation</th>
              <th style="width: 110px; text-align: center;">Action</th>
              <th style="width: 140px; text-align: center;">Date &amp; Time</th>
              <th>Remarks / Verification Note</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows}
          </tbody>
        </table>

        <!-- Formal Signatures -->
        ${(() => {
          const transferSigs = getSignaturesForReport('TRANSFER_GATE_PASS').filter(s => s.enabled !== false && ((s.name && s.name.trim()) || (s.title && s.title.trim())));
          if (transferSigs.length > 0) {
            const cols = Math.max(1, Math.min(transferSigs.length, 4));
            return `
            <div class="signatures" style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 14px; margin-top: 32px; page-break-inside: avoid;">
              ${transferSigs.map(sig => `
                <div class="sig-box" style="text-align: center; border-top: 1.5px solid #334155; padding-top: 8px;">
                  <strong style="display: block; font-size: 11px; color: #0f172a;">${sig.name || ''}</strong>
                  <div class="sig-role" style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${sig.title || ''}</div>
                </div>
              `).join('')}
            </div>
            `;
          }
          return `
          <div class="signatures" style="display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 32px; page-break-inside: avoid;">
            <div class="sig-box" style="text-align: center; border-top: 1.5px solid #334155; padding-top: 8px;">
              <strong style="display: block; font-size: 11px; color: #0f172a;">${req.requestedByName || 'Requester'}</strong>
              <div class="sig-role" style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Requester / Maintenance Tech</div>
            </div>
          </div>
          `;
        })()}

      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      try {
        printWin.document.write(reportHtml);
        printWin.document.close();
        printWin.focus();
        auditService.log('TRANSFER_PDF_GENERATED', 'TRANSFER', req.requestNumber, `Generated Official Transfer PDF Pass for ${req.requestNumber}`);
      } catch (err) {
        console.warn('Direct transfer window write failed, falling back to iframe print:', err);
        this._fallbackIframePrint(reportHtml);
      }
    } else {
      this._fallbackIframePrint(reportHtml);
      auditService.log('TRANSFER_PDF_GENERATED', 'TRANSFER', req.requestNumber, `Generated Official Transfer PDF Pass via iframe for ${req.requestNumber}`);
    }
  }

  /**
   * Generates Clean Grouped Machine Name -> Model Summary PDF / Print Report
   */
  generateMachineSummaryPDF({ title, subtitle, filterSummary, groupedData, grandTotals, generatedBy }) {
    const user = generatedBy || authService.getCurrentUser() || { name: 'Administrator', role: 'ADMIN' };
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const companyName = settings.companyName || 'AL-MUSLIM GROUP';
    const deptName = settings.departmentName || 'Central Maintenance & Mechanical Engineering Department';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build Active Dynamic Signatures List
    const signatures = getSignaturesForReport('MACHINE_SUMMARY') || [];
    const activeSignatures = signatures.filter(s => s && s.enabled !== false && ((s.name && s.name.trim()) || (s.title && s.title.trim())));
    const totals = grandTotals || { running: 0, usableIdle: 0, repairableIdle: 0, total: 0 };

    // Build Table Body Rows with merged Sl. and Machine Name and Grand Total cells per machine category
    let rowsHtml = '';
    if (!groupedData || groupedData.length === 0) {
      rowsHtml = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #64748b;">No machines found matching the selected filters.</td></tr>`;
    } else {
      groupedData.forEach((group, groupIdx) => {
        const modelCount = group.models.length;
        const serialNum = groupIdx + 1;
        group.models.forEach((mod, idx) => {
          const isFirstInGroup = idx === 0;
          const isLastInGroup = idx === modelCount - 1;
          const rowBg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
          rowsHtml += `
            <tr style="background: ${rowBg}; ${isFirstInGroup ? 'border-top: 2px solid #334155;' : ''} ${isLastInGroup ? 'border-bottom: 1.5px solid #475569;' : ''}">
              ${isFirstInGroup ? `
                <td rowspan="${modelCount}" style="text-align: center; font-weight: 800; color: #334155; padding: 8px 6px; font-family: 'Consolas', 'Segoe UI', monospace; border-right: 1px solid #cbd5e1; border-bottom: 1.5px solid #475569; font-size: 11.5px; vertical-align: middle; background: #f8fafc;">
                  ${serialNum}
                </td>
                <td rowspan="${modelCount}" style="vertical-align: middle; background: #f8fafc; font-weight: 800; color: #0f172a; border-right: 1.5px solid #64748b; border-bottom: 1.5px solid #475569; padding: 8px 10px; text-align: left;">
                  <span style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${group.machineName}</span>
                </td>
              ` : ''}
              <td style="font-weight: 600; color: #1e293b; padding: 5px 8px; text-align: left; border-right: 1px solid #cbd5e1; vertical-align: middle;">
                ${mod.model}
              </td>
              <td style="text-align: center; font-weight: 700; color: #15803d; padding: 5px 6px; font-family: 'Consolas', 'Segoe UI', monospace; border-right: 1px solid #cbd5e1; font-size: 11px; vertical-align: middle;">${mod.running}</td>
              <td style="text-align: center; font-weight: 700; color: #0284c7; padding: 5px 6px; font-family: 'Consolas', 'Segoe UI', monospace; border-right: 1px solid #cbd5e1; font-size: 11px; vertical-align: middle;">${mod.usableIdle}</td>
              <td style="text-align: center; font-weight: 700; color: #b45309; padding: 5px 6px; font-family: 'Consolas', 'Segoe UI', monospace; border-right: 1px solid #cbd5e1; font-size: 11px; vertical-align: middle;">${mod.repairableIdle}</td>
              <td style="text-align: center; font-weight: 800; color: #0f172a; padding: 5px 6px; font-family: 'Consolas', 'Segoe UI', monospace; border-right: 1.5px solid #64748b; font-size: 11px; vertical-align: middle; background: rgba(15, 23, 42, 0.02);">${mod.total}</td>
              ${isFirstInGroup ? `
                <td rowspan="${modelCount}" style="vertical-align: middle; text-align: center; background: #f8fafc; font-weight: 900; color: #0284c7; border-left: 1.5px solid #64748b; border-bottom: 1.5px solid #475569; padding: 8px 10px; font-size: 13px; font-family: 'Consolas', 'Segoe UI', monospace;">
                  ${group.total}
                </td>
              ` : ''}
            </tr>
          `;
        });
      });
    }

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title || 'Machine Summary Report'} - ${companyName}</title>
        <meta charset="utf-8">
        <style id="page-orientation-style">
          @page {
            size: A4 portrait;
            margin: 10mm 8mm 12mm 8mm;
          }
        </style>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: #1e293b;
            background: #e2e8f0;
            margin: 0;
            padding: 16px 20px 40px 20px;
            font-size: 11px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-container {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            background: #ffffff;
            padding: 15mm 12mm 15mm 12mm;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            transition: max-width 0.2s ease;
          }
          .report-header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .company-title {
            font-size: 19px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .dept-title {
            font-size: 11.5px;
            font-weight: 600;
            color: #0284c7;
            margin-top: 2px;
          }
          .report-meta {
            text-align: right;
            font-size: 10px;
            color: #64748b;
          }
          .report-title-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-left: 4px solid #0284c7;
            padding: 7px 12px;
            margin-bottom: 12px;
            border-radius: 4px;
          }
          .report-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 2px 0;
          }
          .report-filter-summary {
            font-size: 10px;
            color: #475569;
          }
          .kpi-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 12px;
          }
          .kpi-item {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            border-radius: 4px;
            text-align: center;
          }
          .kpi-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
          }
          .kpi-val {
            font-size: 16px;
            font-weight: 800;
            margin-top: 1px;
            font-family: 'Consolas', 'Segoe UI', monospace;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 10.5px;
            margin-bottom: 16px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            box-sizing: border-box;
            word-wrap: break-word;
          }
          th {
            background-color: #0f172a !important;
            color: #ffffff !important;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border: 1px solid #334155;
            vertical-align: middle;
          }
          tfoot tr td {
            background-color: #f1f5f9 !important;
            font-size: 11px;
            border-top: 2px solid #0f172a;
          }
          .signature-section {
            margin-top: 28px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .sig-box {
            width: 28%;
            text-align: center;
            border-top: 1.5px solid #475569;
            padding-top: 6px;
            font-size: 10px;
            font-weight: 600;
            color: #334155;
          }
          .sig-title {
            font-size: 9px;
            color: #64748b;
            margin-top: 2px;
          }
          @media print {
            body {
              padding: 0 !important;
              margin: 0 !important;
              background: #fff !important;
            }
            .report-container {
              max-width: 100% !important;
              width: 100% !important;
              padding: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100% !important;
              page-break-inside: auto;
            }
            thead {
              display: table-header-group !important; /* REPEATS HEADER ON EVERY PRINT PAGE */
            }
            tfoot {
              display: table-row-group !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            tfoot tr {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .report-header, .report-title-box, .kpi-bar {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .signature-section {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-before: avoid !important;
              break-before: avoid !important;
              margin-top: 50px !important;
            }
          }
        </style>
        <script>
          function setOrientation(mode) {
            const style = document.getElementById('page-orientation-style');
            const btnP = document.getElementById('btn-opt-portrait');
            const btnL = document.getElementById('btn-opt-landscape');
            const container = document.getElementById('report-page-container');
            if (mode === 'landscape') {
              style.innerHTML = '@page { size: A4 landscape; margin: 8mm 8mm 10mm 8mm; }';
              if (container) container.style.maxWidth = '280mm';
              btnL.style.background = '#0284c7'; btnL.style.color = '#fff'; btnL.style.borderColor = '#0284c7';
              btnP.style.background = '#fff'; btnP.style.color = '#334155'; btnP.style.borderColor = '#cbd5e1';
            } else {
              style.innerHTML = '@page { size: A4 portrait; margin: 10mm 8mm 12mm 8mm; }';
              if (container) container.style.maxWidth = '210mm';
              btnP.style.background = '#0284c7'; btnP.style.color = '#fff'; btnP.style.borderColor = '#0284c7';
              btnL.style.background = '#fff'; btnL.style.color = '#334155'; btnL.style.borderColor = '#cbd5e1';
            }
          }
          function setScale(scale) {
            const container = document.getElementById('report-page-container');
            if (container) container.style.zoom = scale;
          }
        </script>
      </head>
      <body>
        <!-- Page Setup & Print Controls Toolbar (Screen only, excluded in print) -->
        <div class="no-print" style="max-width: 210mm; margin: 0 auto 14px auto; padding: 10px 16px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-weight: 800; color: #0f172a; font-size: 12px; display: flex; align-items: center; gap: 4px;">
              <span>⚙️</span> Page Setup:
            </span>
            <button id="btn-opt-portrait" type="button" onclick="setOrientation('portrait')" style="background: #0284c7; color: #fff; border: 1px solid #0284c7; padding: 5px 12px; font-weight: 700; font-size: 11.5px; border-radius: 4px; cursor: pointer;">
              📄 Portrait (A4)
            </button>
            <button id="btn-opt-landscape" type="button" onclick="setOrientation('landscape')" style="background: #fff; color: #334155; border: 1px solid #cbd5e1; padding: 5px 12px; font-weight: 700; font-size: 11.5px; border-radius: 4px; cursor: pointer;">
              📃 Landscape (A4)
            </button>
            <span style="color: #cbd5e1;">|</span>
            <label style="font-size: 11.5px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 4px;">
              Zoom:
              <select id="scale-select" onchange="setScale(this.value)" style="padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11.5px; font-weight: 600;">
                <option value="1">100% (Standard)</option>
                <option value="0.95">95% (Compact)</option>
                <option value="0.9">90% (Fit More Rows)</option>
                <option value="0.85">85% (Max Density)</option>
              </select>
            </label>
          </div>
          <div>
            <button onclick="window.print()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 8px 22px; font-weight: 800; font-size: 12.5px; border-radius: 5px; cursor: pointer; box-shadow: 0 2px 8px rgba(2,132,199,0.35); display: flex; align-items: center; gap: 6px;">
              🖨️ Print / Save as PDF
            </button>
          </div>
        </div>

        <div id="report-page-container" class="report-container">

          <div class="report-header">
            <div>
              <div class="company-title">🏭 ${companyName}</div>
              <div class="dept-title">🔧 ${deptName}</div>
            </div>
            <div class="report-meta">
              <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
            </div>
          </div>

          <div class="report-title-box">
            <div class="report-title">📊 ${title || 'Machine Summary Report'}</div>
            <div class="report-filter-summary">${filterSummary || 'Scope: All Enterprise'}</div>
          </div>

          <div class="kpi-bar">
            <div class="kpi-item" style="border-left: 3px solid #16a34a;">
              <div class="kpi-label" style="color: #16a34a;">Running</div>
              <div class="kpi-val" style="color: #16a34a;">${totals.running ?? 0}</div>
            </div>
            <div class="kpi-item" style="border-left: 3px solid #0284c7;">
              <div class="kpi-label" style="color: #0284c7;">Usable Idle</div>
              <div class="kpi-val" style="color: #0284c7;">${totals.usableIdle ?? 0}</div>
            </div>
            <div class="kpi-item" style="border-left: 3px solid #d97706;">
              <div class="kpi-label" style="color: #d97706;">Repairable Idle</div>
              <div class="kpi-val" style="color: #d97706;">${totals.repairableIdle ?? 0}</div>
            </div>
            <div class="kpi-item" style="border-left: 3px solid #0f172a;">
              <div class="kpi-label" style="color: #0f172a;">Total Machines</div>
              <div class="kpi-val" style="color: #0f172a;">${totals.total ?? 0}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">Sl.</th>
                <th style="width: 22%; text-align: left;">Machine Name</th>
                <th style="width: 21%; text-align: left;">Model</th>
                <th style="width: 10.5%; text-align: center;">Running</th>
                <th style="width: 10.5%; text-align: center;">Usable Idle</th>
                <th style="width: 10.5%; text-align: center;">Repairable Idle</th>
                <th style="width: 10.5%; text-align: center;">Total</th>
                <th style="width: 10%; text-align: center;">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="font-weight: 800; border-top: 2px solid #0f172a;">
                <td style="text-align: center; color: #64748b; font-weight: 700; padding: 7px;">—</td>
                <td style="padding: 7px 10px; font-weight: 800; color: #0f172a; text-align: left;">GRAND TOTAL</td>
                <td style="text-align: center; color: #64748b; font-weight: 700; padding: 7px;">—</td>
                <td style="text-align: center; color: #15803d; font-weight: 800; padding: 7px; font-family: 'Consolas', 'Segoe UI', monospace;">${totals.running ?? 0}</td>
                <td style="text-align: center; color: #0284c7; font-weight: 800; padding: 7px; font-family: 'Consolas', 'Segoe UI', monospace;">${totals.usableIdle ?? 0}</td>
                <td style="text-align: center; color: #b45309; font-weight: 800; padding: 7px; font-family: 'Consolas', 'Segoe UI', monospace;">${totals.repairableIdle ?? 0}</td>
                <td style="text-align: center; color: #0f172a; font-weight: 800; padding: 7px; font-family: 'Consolas', 'Segoe UI', monospace;">${totals.total ?? 0}</td>
                <td style="text-align: center; color: #0284c7; font-weight: 900; padding: 7px; font-size: 13px; font-family: 'Consolas', 'Segoe UI', monospace;">${totals.total ?? 0}</td>
              </tr>
            </tfoot>
          </table>

          ${activeSignatures.length > 0 ? `
          <div class="signature-section" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 36px; page-break-inside: avoid; flex-wrap: wrap;">
            ${activeSignatures.map(sig => `
              <div class="sig-box" style="flex: 1; min-width: 140px; text-align: center; border-top: 1.5px solid #334155; padding-top: 8px; font-size: 10px; font-weight: 600; color: #334155;">
                <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${sig.name || ''}</div>
                <div class="sig-title" style="font-size: 9px; color: #64748b; margin-top: 3px;">${sig.title || ''}</div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          <script>
            // Automatic print preview trigger after page load
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => {
                try { window.focus(); window.print(); } catch (e) {}
              }, 400);
            });
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
              setTimeout(() => {
                try { window.focus(); window.print(); } catch (e) {}
              }, 400);
            }
          </script>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      try {
        printWin.document.open();
        printWin.document.write(reportHtml);
        printWin.document.close();
        printWin.document.title = title || 'Machine Summary Report';
        printWin.focus();
        auditService.log('MACHINE_SUMMARY_PDF_GENERATED', 'REPORT', title || 'Machine Summary', `Generated Machine Summary PDF Report.`);
      } catch (err) {
        console.warn('Direct summary window write failed, falling back to iframe print:', err);
        this._fallbackIframePrint(reportHtml);
      }
    } else {
      this._fallbackIframePrint(reportHtml);
      auditService.log('MACHINE_SUMMARY_PDF_GENERATED', 'REPORT', title || 'Machine Summary', `Generated Machine Summary PDF Report (Iframe fallback).`);
    }
  }

  /**
   * Generates formatted corporate branded PDF & Print document for ENT Lab Report
   */
  generateEtLabManagementReportPDF({ rows, filterSummary, generatedBy }) {
    const user = generatedBy || authService.getCurrentUser();
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const companyName = settings.companyName || 'AL-MUSLIM GROUP';
    const deptName = settings.departmentName || 'Central Maintenance & Electronics & Telecom (ENT) Lab Division';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const totalBoards = rows.length;
    const installedCount = rows.filter(r => r.status === 'INSTALLED').length;
    const spareCount = rows.filter(r => r.status === 'AVAILABLE_SPARE' || r.status === 'REPAIR_ACCEPTED').length;
    const repairCount = rows.filter(r => r.status === 'UNDER_INHOUSE_REPAIR' || r.status === 'REPAIR_REJECTED').length;
    const externalCount = rows.filter(r => r.status === 'SENT_EXTERNAL').length;

    const rowsHtml = rows.map((r, i) => `
      <tr>
        <td style="text-align: center; padding: 4px 6px;">${i + 1}</td>
        <td style="font-family: monospace; font-weight: 700; color: #0284c7; padding: 4px 6px;">${r.boardSerial}</td>
        <td style="font-weight: 600; padding: 4px 6px;">${r.partName}</td>
        <td style="font-family: monospace; padding: 4px 6px;">${r.modelNo || '—'}</td>
        <td style="font-family: monospace; padding: 4px 6px;">${r.serialNo || '—'}</td>
        <td style="text-align: center; padding: 4px 6px;">
          <span style="font-weight: 700; font-size: 9px;">${r.status}</span>
        </td>
        <td style="font-family: monospace; font-weight: 600; padding: 4px 6px;">${r.currentMachine || '—'}</td>
        <td style="font-family: monospace; padding: 4px 6px;">${r.machineSerial || '—'}</td>
        <td style="padding: 4px 6px;">${r.unitName || '—'}</td>
        <td style="padding: 4px 6px;">${r.floorName || '—'} / ${r.lineName || '—'}</td>
        <td style="padding: 4px 6px; font-family: monospace;">${r.installDate || '—'}</td>
        <td style="padding: 4px 6px; font-family: monospace;">${r.removeDate || '—'}</td>
        <td style="padding: 4px 6px;">${r.repairType || '—'}</td>
        <td style="padding: 4px 6px;">${r.externalCompany || '—'}</td>
        <td style="padding: 4px 6px; font-family: monospace;">${r.sendDate || '—'}</td>
        <td style="padding: 4px 6px; font-family: monospace;">${r.returnDate || '—'}</td>
        <td style="padding: 4px 6px; font-weight: 600;">${r.repairResult || '—'}</td>
        <td style="text-align: center; padding: 4px 6px; font-weight: 700;">${r.repairCount}</td>
        <td style="text-align: center; padding: 4px 6px; font-weight: 700; color: ${r.previousBill === 'YES' ? '#dc2626' : '#16a34a'};">${r.previousBill}</td>
        <td style="padding: 4px 6px; font-size: 9.5px;">${r.remarks || '—'}</td>
      </tr>
    `).join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ENT Lab Report - ${companyName}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 6mm 10mm 6mm;
          }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: #1e293b;
            background: #fff;
            margin: 0;
            padding: 12px;
            font-size: 10px;
          }
          .report-header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .company-title {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
          }
          .dept-title {
            font-size: 11.5px;
            font-weight: 600;
            color: #0284c7;
          }
          .report-meta {
            text-align: right;
            font-size: 10px;
            color: #64748b;
          }
          .report-title-box {
            background: #f8fafc;
            border-left: 4px solid #0284c7;
            padding: 6px 12px;
            margin-bottom: 10px;
          }
          .report-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          .report-filter-summary {
            font-size: 10px;
            color: #64748b;
          }
          .kpi-bar {
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
          }
          .kpi-item {
            flex: 1;
            background: #f1f5f9;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 10.5px;
            font-weight: 600;
          }
          .kpi-item span {
            font-weight: 800;
            font-size: 12px;
            margin-left: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
            margin-bottom: 12px;
          }
          th {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8.5px;
            padding: 6px 4px;
            border: 1px solid #334155;
            text-align: left;
          }
          td {
            border: 1px solid #cbd5e1;
            vertical-align: middle;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; text-align: right;">
          <button onclick="window.print()" style="background: #0284c7; color: #fff; border: none; padding: 7px 16px; font-weight: bold; border-radius: 4px; cursor: pointer;">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <div class="report-header">
          <div>
            <div class="company-title">🏭 ${companyName}</div>
            <div class="dept-title">⚡ ${deptName}</div>
          </div>
          <div class="report-meta">
            <div><strong>Generated:</strong> ${dateStr} ${timeStr}</div>
            <div><strong>By:</strong> ${user?.fullName || user?.username || 'Maintenance Admin'}</div>
          </div>
        </div>

        <div class="report-title-box">
          <div class="report-title">📊 ENT Lab Report</div>
          <div class="report-filter-summary">${filterSummary || 'Scope: Complete ENT Lab Inventory & Lifetime Ledger'}</div>
        </div>

        <div class="kpi-bar">
          <div class="kpi-item">Total Boards: <span>${totalBoards}</span></div>
          <div class="kpi-item">Installed on Machine: <span style="color: #16a34a;">${installedCount}</span></div>
          <div class="kpi-item">Available / Spares: <span style="color: #0284c7;">${spareCount}</span></div>
          <div class="kpi-item">Under Repair: <span style="color: #d97706;">${repairCount}</span></div>
          <div class="kpi-item">Sent Outside: <span style="color: #dc2626;">${externalCount}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 20px; text-align: center;">Sl</th>
              <th>Board ID</th>
              <th>Board Name</th>
              <th>Model</th>
              <th>Serial No.</th>
              <th style="text-align: center;">Status</th>
              <th>Current Machine</th>
              <th>Machine Serial</th>
              <th>Unit</th>
              <th>Floor / Line</th>
              <th>Install Date</th>
              <th>Remove Date</th>
              <th>Repair Type</th>
              <th>External Company</th>
              <th>Send Date</th>
              <th>Return Date</th>
              <th>Repair Result</th>
              <th style="text-align: center;">Repairs</th>
              <th style="text-align: center;">Prev Bill</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${(() => {
          const etLabSigs = getSignaturesForReport('ENT_LAB_REPORT').filter(s => s.enabled !== false && ((s.name && s.name.trim()) || (s.title && s.title.trim())));
          if (etLabSigs.length === 0) return '';
          return `
          <div style="margin-top: 28px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; page-break-inside: avoid; flex-wrap: wrap;">
            ${etLabSigs.map(sig => `
              <div style="flex: 1; min-width: 140px; text-align: center; border-top: 1.5px solid #334155; padding-top: 6px; font-size: 10px;">
                <strong style="display: block; font-size: 11px; color: #0f172a;">${sig.name || ''}</strong>
                <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${sig.title || ''}</div>
              </div>
            `).join('')}
          </div>
          `;
        })()}
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      try {
        printWin.document.open();
        printWin.document.write(reportHtml);
        printWin.document.close();
        printWin.document.title = 'ENT Lab Report';
        printWin.focus();
        auditService.log('ET_LAB_PDF_REPORT_GENERATED', 'REPORT', 'ENT Lab Report', `Generated ENT Lab PDF/Print Report.`);
      } catch (err) {
        console.warn('Direct ENT lab window write failed, falling back to iframe print:', err);
        this._fallbackIframePrint(reportHtml);
      }
    } else {
      this._fallbackIframePrint(reportHtml);
      auditService.log('ET_LAB_PDF_REPORT_GENERATED', 'REPORT', 'ENT Lab Report', `Generated ENT Lab PDF/Print Report (Iframe fallback).`);
    }
  }

  /**
   * Generates Official Machine Transfer & Relocation Audit Log PDF / Print Report
   */
  generateTransferReportPDF({ rows = [], filterSummary = '', generatedBy = null }) {
    const user = generatedBy || authService.getCurrentUser();
    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const companyName = settings.companyName || 'AL-MUSLIM GROUP';
    const deptName = settings.departmentName || 'Central Engineering & Maintenance Operations';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const totalTransfers = rows.length;
    const completedCount = rows.filter(r => r.status === 'COMPLETED' || r.status === 'APPROVED').length;
    const pendingCount = rows.filter(r => r.status === 'PENDING_APPROVAL' || r.status === 'PARTIALLY_APPROVED' || r.status === 'REVISION_REQUESTED').length;
    const rejectedCount = rows.filter(r => r.status === 'REJECTED').length;
    const cancelledCount = rows.filter(r => r.status === 'CANCELLED').length;

    const rowsHtml = rows.map((r, i) => {
      const d = r.requestedAt && r.requestedAt !== '—'
        ? (() => {
            try {
              const dt = new Date(r.requestedAt);
              return dt.toLocaleDateString('en-GB') + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (_) { return r.requestedAt; }
          })()
        : '—';
      const statusColor = r.status === 'COMPLETED' || r.status === 'APPROVED' ? '#16a34a'
        : (r.status === 'REJECTED' || r.status === 'CANCELLED' ? '#dc2626' : '#d97706');
      return `
        <tr>
          <td style="text-align: center; padding: 5px 4px; font-weight: bold;">${i + 1}</td>
          <td style="font-family: monospace; font-weight: 700; color: #0284c7; padding: 5px 6px;">${r.id || '—'}</td>
          <td style="font-family: monospace; font-weight: 700; color: #0f172a; padding: 5px 6px;">${r.machineSerial || '—'}</td>
          <td style="font-weight: 600; padding: 5px 6px;">${r.machineName || '—'}</td>
          <td style="padding: 5px 6px; font-size: 9.5px; color: #475569;">${r.sourceLocation || '—'}</td>
          <td style="padding: 5px 6px; font-size: 9.5px; font-weight: 600; color: #0f172a;">${r.destLocation || '—'}</td>
          <td style="padding: 5px 6px; font-family: monospace; font-size: 9.5px; white-space: nowrap;">${d}</td>
          <td style="padding: 5px 6px; font-size: 9.5px; font-weight: 600;">${r.transferredBy || '—'}</td>
          <td style="text-align: center; padding: 5px 6px;">
            <span style="font-weight: 700; font-size: 8.5px; padding: 2px 6px; border-radius: 3px; background: ${statusColor}15; color: ${statusColor}; border: 1px solid ${statusColor}40;">
              ${r.status}
            </span>
          </td>
          <td style="padding: 5px 6px; font-size: 9px; color: #64748b;">${r.reason || '—'}${r.remarks ? ` (${r.remarks})` : ''}</td>
        </tr>
      `;
    }).join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Machine Transfer &amp; Relocation Audit Report - ${companyName}</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; margin: 0; padding: 12px; }
          .report-header { border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
          .company-title { font-size: 18px; font-weight: 800; color: #0f172a; }
          .dept-title { font-size: 11px; font-weight: 600; color: #0284c7; }
          .report-meta { text-align: right; font-size: 9.5px; color: #64748b; }
          .kpi-bar { display: flex; gap: 10px; margin-bottom: 12px; }
          .kpi-item { flex: 1; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px 10px; background: #f8fafc; }
          .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
          .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          table.report-table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
          table.report-table th { background: #0f172a; color: #f8fafc; font-weight: 700; text-transform: uppercase; font-size: 8.5px; padding: 6px 4px; border: 1px solid #334155; }
          table.report-table td { border: 1px solid #e2e8f0; vertical-align: middle; }
          table.report-table tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div>
            <div class="company-title">${companyName}</div>
            <div class="dept-title">${deptName}</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 4px;">
              🔄 Machine Transfer &amp; Relocation Audit Log Report
            </div>
            ${filterSummary ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Filters: ${filterSummary}</div>` : ''}
          </div>
          <div class="report-meta">
            <div><strong>Generated:</strong> ${dateStr} ${timeStr}</div>
            <div><strong>Generated By:</strong> ${user?.name || 'Administrator'}</div>
            <div><strong>Total Records:</strong> ${totalTransfers}</div>
          </div>
        </div>

        <div class="kpi-bar">
          <div class="kpi-item">
            <div class="kpi-label">Total Records</div>
            <div class="kpi-val" style="color: #0284c7;">${totalTransfers}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Completed</div>
            <div class="kpi-val" style="color: #16a34a;">${completedCount}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Pending Approval</div>
            <div class="kpi-val" style="color: #d97706;">${pendingCount}</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Rejected / Cancelled</div>
            <div class="kpi-val" style="color: #dc2626;">${rejectedCount + cancelledCount}</div>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 25px;">SL</th>
              <th style="width: 90px;">Transfer ID</th>
              <th style="width: 85px;">Serial #</th>
              <th style="width: 110px;">Machine Name</th>
              <th>Previous Location (From)</th>
              <th>New Location (To)</th>
              <th style="width: 105px;">Transfer Date</th>
              <th style="width: 95px;">Transferred By</th>
              <th style="width: 75px;">Status</th>
              <th>Reason / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #64748b;">No transfer records match the filter criteria.</td></tr>' : rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      try {
        printWin.document.open();
        printWin.document.write(reportHtml);
        printWin.document.close();
        printWin.document.title = 'Machine Transfer & Relocation Report';
        printWin.focus();
        auditService.log('TRANSFER_PDF_REPORT_GENERATED', 'REPORT', 'Transfer Report', `Generated Transfer Audit Log PDF/Print Report (${rows.length} rows).`);
      } catch (err) {
        console.warn('Direct transfer report window write failed, falling back to iframe print:', err);
        this._fallbackIframePrint(reportHtml);
      }
    } else {
      this._fallbackIframePrint(reportHtml);
      auditService.log('TRANSFER_PDF_REPORT_GENERATED', 'REPORT', 'Transfer Report', `Generated Transfer Audit Log PDF/Print Report via iframe (${rows.length} rows).`);
    }
  }

  /**
   * Seamless Iframe Print Fallback
   * Automatically prints via hidden iframe when window.open is blocked by browser popup blockers.
   */
  _fallbackIframePrint(htmlContent) {
    try {
      let printIframe = document.getElementById('erp-report-print-fallback-iframe');
      if (printIframe) {
        printIframe.remove();
      }
      printIframe = document.createElement('iframe');
      printIframe.id = 'erp-report-print-fallback-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.style.visibility = 'hidden';
      document.body.appendChild(printIframe);

      const frameDoc = printIframe.contentWindow.document;
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow.focus();
          printIframe.contentWindow.print();
        } catch (e) {
          console.error('Iframe print error:', e);
          alert('Please allow pop-ups for this site to view and print reports.');
        }
      }, 400);
    } catch (err) {
      console.error('Print fallback error:', err);
      alert('Please allow pop-ups for this site to view and print reports.');
    }
  }
}

export const pdfService = new PDFService();


