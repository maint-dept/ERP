/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Document & Resource Library Service
 * Handles File Previews, Downloads, URL Navigation, Folder Hierarchy, and Role-Based Access Control
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';

export const RESOURCE_TYPES = {
  PDF: 'pdf',
  WORD: 'word',
  EXCEL: 'excel',
  IMAGE: 'image',
  FILE: 'file',
  URL: 'url',
  FOLDER: 'folder'
};

export const DEFAULT_RESOURCES = [
  // 1. Folders at Root Level
  {
    id: 'fld-manuals',
    name: 'Machine Operation Manuals',
    type: RESOURCE_TYPES.FOLDER,
    parentId: null,
    access: 'Maintenance Team',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user'],
    description: 'Technical instruction manuals, parts catalogs, and manufacturer machinery handbooks.',
    createdAt: '2026-08-01T10:00:00Z',
    createdByName: 'Engr. Tanvir Ahmed'
  },
  {
    id: 'fld-sops',
    name: 'Standard Operating Procedures (SOPs)',
    type: RESOURCE_TYPES.FOLDER,
    parentId: null,
    access: 'Engineers',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'role-super-admin', 'role-admin', 'role-manager'],
    description: 'Official factory SOPs, quality protocols, lubrication guidelines, and engineering checklists.',
    createdAt: '2026-08-02T11:00:00Z',
    createdByName: 'Engr. Delwar Hossain'
  },
  {
    id: 'fld-portals',
    name: 'Maintenance Portals & Web Links',
    type: RESOURCE_TYPES.FOLDER,
    parentId: null,
    access: 'Admin + Manager',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'role-super-admin', 'role-admin', 'role-manager'],
    description: 'Web dashboards, machinery vendor portals, and external cloud engineering repositories.',
    createdAt: '2026-08-03T12:00:00Z',
    createdByName: 'Super Administrator'
  },
  {
    id: 'fld-schedules',
    name: 'Maintenance Schedules & Overhaul',
    type: RESOURCE_TYPES.FOLDER,
    parentId: null,
    access: 'All Staff',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user', 'role-viewer'],
    description: 'Quarterly and monthly preventive maintenance calendars, parts replacement schedules.',
    createdAt: '2026-08-04T13:00:00Z',
    createdByName: 'Engr. Delwar Hossain'
  },
  {
    id: 'fld-layouts',
    name: 'Factory Layouts & Schematics',
    type: RESOURCE_TYPES.FOLDER,
    parentId: null,
    access: 'Maintenance Team',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user'],
    description: 'Machinery placement schematics, power line routes, and pneumatic pressure maps.',
    createdAt: '2026-08-05T14:00:00Z',
    createdByName: 'Engr. Tanvir Ahmed'
  },

  // 2. Resources inside 'Machine Operation Manuals' (fld-manuals)
  {
    id: 'res-1',
    name: 'Machine Manual (Juki DDL-8700)',
    type: RESOURCE_TYPES.PDF,
    parentId: 'fld-manuals',
    access: 'Maintenance Team',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user'],
    fileName: 'Juki_DDL_8700_Operation_Manual.pdf',
    fileSize: '2.4 MB',
    fileType: 'application/pdf',
    description: 'Complete operational, threading and timing adjustment handbook for Juki Single Needle Lockstitch.',
    content: 'AL-MUSLIM GROUP TECHNICAL ARCHIVE\nDOCUMENT: JUKI DDL-8700 OPERATION & MAINTENANCE MANUAL\n\n1. SPECIFICATIONS:\n- Max Sewing Speed: 5,500 sti/min\n- Needle: DBx1 (#14 #9-#18)\n- Lubrication: Automatic oil pump\n\n2. TIMING ADJUSTMENT:\n- Lower the needle bar to lowest point, align upper index line with bush edge.\n- Hook point should align with needle center, 0.05mm clearance.\n\n3. DAILY MAINTENANCE:\n- Check oil window clarity before shift start.\n- Clean hook race with blower or brush every 8 hours.\n\nAl-Muslim Group Central Maintenance Department Archive.',
    createdAt: '2026-08-10T09:00:00Z',
    createdByName: 'Engr. Tanvir Ahmed'
  },
  {
    id: 'res-4-1',
    name: 'Brother S-7200C Service Manual',
    type: RESOURCE_TYPES.PDF,
    parentId: 'fld-manuals',
    access: 'Maintenance Team',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user'],
    fileName: 'Brother_S7200C_Direct_Drive_Service_Manual.pdf',
    fileSize: '3.8 MB',
    fileType: 'application/pdf',
    description: 'Electronic direct drive direct motor service troubleshooting and error codes list.',
    content: 'BROTHER S-7200C ELECTRONIC DIRECT DRIVE SEWING MACHINE\nTECHNICAL SERVICE GUIDE\n\nError Codes:\n- E-01: Motor lock detected (check handwheel rotation & thread jam)\n- E-02: Synchronizer optical sensor abnormal\n- E-09: Overvoltage or supply fluctuation\n\nAl-Muslim Group Central Maintenance Department.',
    createdAt: '2026-08-05T14:20:00Z',
    createdByName: 'Engr. Tanvir Ahmed'
  },
  {
    id: 'res-4-2',
    name: 'Pegasus M-700 Overlock Parts Book',
    type: RESOURCE_TYPES.EXCEL,
    parentId: 'fld-manuals',
    access: 'Maintenance Team',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user'],
    fileName: 'Pegasus_M700_Overlock_Parts_Catalog.xlsx',
    fileSize: '1.2 MB',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Itemized spare parts numbers, knife assemblies, and looper timing specifications.',
    content: 'PART_NUMBER,PART_NAME,CATEGORY,LOCATION,PRICE_BDT\nPG-701-01,Upper Knife,Cutting,Bin A-12,450\nPG-701-02,Lower Carbide Knife,Cutting,Bin A-13,680\nPG-702-01,Upper Looper,Looper,Bin B-04,1250\nPG-702-02,Lower Looper,Looper,Bin B-05,1350\nPG-703-01,Needle Plate 4-Thread,Gauge,Bin C-01,2100',
    createdAt: '2026-08-08T16:45:00Z',
    createdByName: 'Md. Faruk Hossain'
  },

  // 3. Resources inside 'Standard Operating Procedures (SOPs)' (fld-sops)
  {
    id: 'res-2',
    name: 'Maintenance SOP & Daily Checklist',
    type: RESOURCE_TYPES.WORD,
    parentId: 'fld-sops',
    access: 'Engineers',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'role-super-admin', 'role-admin', 'role-manager'],
    fileName: 'Standard_Operating_Procedure_Maintenance.docx',
    fileSize: '850 KB',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Official Standard Operating Procedures for Garments Maintenance Engineers & Shift Technicians.',
    content: 'AL-MUSLIM GROUP GARMENTS APPAREL DIVISION\nSTANDARD OPERATING PROCEDURE (SOP) - MACHINERY PREVENTIVE CARE\n\nObjective: Ensure 99.5% line equipment uptime across all sewing lines.\nScope: All mechanical, electrical, and pneumatic machinery.\n\nResponsibilities:\n- Floor Maintenance Engineer: Daily audit of oil levels and motor temperature.\n- Line Mechanic: Respond to breakdown calls within 3 minutes.\n- Maintenance In-Charge: Sign off weekly lubrication log.\n\nApproved By: Chief Maintenance Director',
    createdAt: '2026-08-12T11:30:00Z',
    createdByName: 'Engr. Delwar Hossain'
  },

  // 4. Resources inside 'Maintenance Portals & Web Links' (fld-portals)
  {
    id: 'res-3',
    name: 'Maintenance Portal & Knowledge Hub',
    type: RESOURCE_TYPES.URL,
    parentId: 'fld-portals',
    access: 'Admin + Manager',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'role-super-admin', 'role-admin', 'role-manager'],
    url: 'https://portal.almuslim.com/maintenance',
    description: 'Central group enterprise engineering portal and vendor support documentation hub.',
    createdAt: '2026-08-15T08:15:00Z',
    createdByName: 'Super Administrator'
  },
  {
    id: 'res-3-2',
    name: 'Juki Global Technical Support Portal',
    type: RESOURCE_TYPES.URL,
    parentId: 'fld-portals',
    access: 'All Staff',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user', 'role-viewer'],
    url: 'https://www.juki.co.jp/industrial_e/support_e/',
    description: 'Official manufacturer parts catalog search and electronic board firmware downloads.',
    createdAt: '2026-08-16T09:00:00Z',
    createdByName: 'Super Administrator'
  },

  // 5. Resources inside 'Maintenance Schedules & Overhaul' (fld-schedules)
  {
    id: 'res-5',
    name: 'Monthly Preventive Maintenance Schedule',
    type: RESOURCE_TYPES.EXCEL,
    parentId: 'fld-schedules',
    access: 'All Staff',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user', 'role-viewer'],
    fileName: 'Preventive_Maintenance_Schedule_2026.xlsx',
    fileSize: '1.5 MB',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Factory-wide monthly overhaul and calibration timeline across Savar & Ashulia plants.',
    content: 'LINE_NAME,WEEK_1_TASK,WEEK_2_TASK,WEEK_3_TASK,WEEK_4_TASK,STATUS\nLine JA-A,Oil Flush & Filter,Needle Bar Alignment,Motor Belt Tension,Full Cleaning,COMPLETED\nLine JA-B,Air Jet Cleaning,Hook Lubrication,Trimmer Blade Sharpening,Sensor Calibration,IN_PROGRESS\nLine PB-01,Overhaul 10x Juki,5x Pegasus Servicing,3x Kansai Timing,Feed Dog Height,SCHEDULED',
    createdAt: '2026-08-16T10:00:00Z',
    createdByName: 'Engr. Delwar Hossain'
  },

  // 6. Resources inside 'Factory Layouts & Schematics' (fld-layouts)
  {
    id: 'res-6',
    name: 'Plant Machinery Floor Layout Map',
    type: RESOURCE_TYPES.IMAGE,
    parentId: 'fld-layouts',
    access: 'Maintenance Team',
    accessRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'role-super-admin', 'role-admin', 'role-manager', 'role-user'],
    fileName: 'Plant_Floor_Machinery_Layout.png',
    fileSize: '4.1 MB',
    fileType: 'image/png',
    description: 'High-resolution schematic showing line placements, power trunks, and pneumatic lines.',
    content: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><rect width="800" height="450" fill="%230f172a"/><text x="400" y="50" fill="%2338bdf8" font-size="20" font-weight="bold" text-anchor="middle" font-family="sans-serif">AL-MUSLIM GROUP - PLANT MACHINERY LAYOUT</text><rect x="60" y="90" width="310" height="130" fill="%231e293b" stroke="%2338bdf8" stroke-width="2" rx="8"/><text x="215" y="130" fill="%23e2e8f0" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">SEWING WING A (Line JA-A to JA-C)</text><text x="215" y="160" fill="%2394a3b8" font-size="12" text-anchor="middle" font-family="sans-serif">50x Lockstitch, 20x Overlock, 8x Flatlock</text><rect x="430" y="90" width="310" height="130" fill="%231e293b" stroke="%2334d399" stroke-width="2" rx="8"/><text x="585" y="130" fill="%23e2e8f0" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">SEWING WING B (Line JAF-A to JAF-C)</text><text x="585" y="160" fill="%2394a3b8" font-size="12" text-anchor="middle" font-family="sans-serif">45x Lockstitch, 18x Overlock, 6x Buttonhole</text><rect x="60" y="250" width="680" height="140" fill="%231e293b" stroke="%23fbbf24" stroke-width="2" rx="8"/><text x="400" y="295" fill="%23e2e8f0" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">CENTRAL MAINTENANCE WORKSHOP &amp; SPARE PARTS DEPOT</text><text x="400" y="330" fill="%2394a3b8" font-size="12" text-anchor="middle" font-family="sans-serif">Precision lathe, welding station, pneumatic compressor room, parts inventory</text></svg>',
    createdAt: '2026-08-14T12:00:00Z',
    createdByName: 'Engr. Tanvir Ahmed'
  }
];

class ResourceLibraryService {
  constructor() {
    this.ensureInitialized();
  }

  ensureInitialized() {
    const existing = storage.getTable(TABLE_NAMES.DOCUMENTS);
    const hasFolders = Array.isArray(existing) && existing.some(r => r.type === RESOURCE_TYPES.FOLDER && (r.id === 'fld-manuals' || r.id === 'res-4'));
    if (!Array.isArray(existing) || existing.length === 0 || !hasFolders) {
      storage.data[TABLE_NAMES.DOCUMENTS] = JSON.parse(JSON.stringify(DEFAULT_RESOURCES));
      storage.saveTable(TABLE_NAMES.DOCUMENTS);
    }
  }

  getAll() {
    this.ensureInitialized();
    return storage.getTable(TABLE_NAMES.DOCUMENTS) || [];
  }

  getByParent(parentId = null) {
    const all = this.getAll();
    const pid = (!parentId || parentId === '') ? null : parentId;
    return all.filter(r => (r.parentId || null) === pid);
  }

  getById(id) {
    if (!id) return null;
    return this.getAll().find(r => r.id === id) || null;
  }

  getFolderPath(folderId = null) {
    const crumbs = [{ id: null, name: 'Root Library' }];
    if (!folderId) return crumbs;

    const all = this.getAll();
    const path = [];
    let curId = folderId;

    while (curId) {
      const folder = all.find(r => r.id === curId);
      if (folder) {
        path.unshift({ id: folder.id, name: folder.name });
        curId = folder.parentId || null;
      } else {
        break;
      }
    }

    return crumbs.concat(path);
  }

  /**
   * Get all folders with hierarchical indentation for dropdown selectors
   */
  getAllFolders(excludeId = null) {
    const all = this.getAll().filter(r => r.type === RESOURCE_TYPES.FOLDER && r.id !== excludeId);
    const result = [];
    
    const traverse = (parentId = null, depth = 0) => {
      const children = all.filter(f => (f.parentId || null) === parentId);
      children.forEach(c => {
        result.push({
          id: c.id,
          name: c.name,
          depth,
          displayName: `${'— '.repeat(depth)}📁 ${c.name}`
        });
        traverse(c.id, depth + 1);
      });
    };

    traverse(null, 0);
    return result;
  }

  getChildItemsCount(folderId) {
    if (!folderId) return 0;
    return this.getAll().filter(r => r.parentId === folderId).length;
  }

  /**
   * Evaluates if active user has permission to access the resource
   */
  hasAccess(resource, user = null) {
    const u = user || authService.getCurrentUser();
    if (!u) return false;
    if (authService.isSuperAdmin()) return true;

    // If resource is configured for 'All Staff' or 'ALL'
    if (resource.access === 'All Staff' || resource.access === 'ALL' || resource.access === 'PUBLIC') {
      return true;
    }

    // Role-based matching
    const roles = resource.accessRoles || [];
    if (roles.length === 0) return true;

    const userRoleCode = (u.role || '').toUpperCase();
    const userRoleId = (u.roleId || '').toUpperCase();

    const allowed = roles.some(r => {
      const match = (r || '').toUpperCase();
      return match === userRoleCode ||
             match === userRoleId ||
             (match === 'MAINTENANCE TEAM' && ['ADMIN', 'MANAGER', 'USER'].includes(userRoleCode)) ||
             (match === 'ENGINEERS' && ['ADMIN', 'MANAGER'].includes(userRoleCode)) ||
             (match === 'ADMIN + MANAGER' && ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(userRoleCode));
    });

    return allowed;
  }

  /**
   * Action 1 & 2: View / Open or Open Link in New Tab
   */
  openResource(resource, user = null) {
    if (!resource) return { success: false, message: 'Resource not found.' };

    if (!this.hasAccess(resource, user)) {
      alert(`🚫 Access Denied: You do not have permission to access '${resource.name}'.\nRequired Access: ${resource.access || 'Restricted'}`);
      return { success: false, message: 'Access Denied: Missing permission.' };
    }

    // Audit view log
    auditService.log('VIEW_RESOURCE', `Opened resource '${resource.name}' (${resource.type})`);

    // Case 1: Web Link / URL -> Always open in a new browser tab
    if (resource.type === RESOURCE_TYPES.URL) {
      let targetUrl = resource.url || '';
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return { success: true };
    }

    // Case 2: Folder -> Open folder inside application via event
    if (resource.type === RESOURCE_TYPES.FOLDER) {
      window.dispatchEvent(new CustomEvent('erp:open-folder', { detail: { folderId: resource.id } }));
      return { success: true };
    }

    // Case 3: Image Data URL -> Open Image Tab
    if (resource.type === RESOURCE_TYPES.IMAGE && resource.content && resource.content.startsWith('data:image')) {
      const imgWin = window.open('', '_blank');
      if (imgWin) {
        imgWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${resource.name} - Al-Muslim Group</title>
              <style>body { margin: 0; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; color: #fff; }</style>
            </head>
            <body>
              <div style="text-align: center; padding: 20px;">
                <h2 style="color: #38bdf8; margin-bottom: 12px;">${resource.name}</h2>
                <img src="${resource.content}" style="max-width: 95vw; max-height: 80vh; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);" alt="${resource.name}" />
              </div>
            </body>
          </html>
        `);
        imgWin.document.close();
      }
      return { success: true };
    }

    // Case 4: Document Preview in New Tab (PDF / Word / Excel / Text)
    const previewWin = window.open('', '_blank');
    if (previewWin) {
      const isPdf = resource.type === RESOURCE_TYPES.PDF;
      const isWord = resource.type === RESOURCE_TYPES.WORD;
      const isExcel = resource.type === RESOURCE_TYPES.EXCEL;
      
      const themeColor = isPdf ? '#f87171' : (isWord ? '#38bdf8' : (isExcel ? '#34d399' : '#a855f7'));
      const typeBadge = isPdf ? '📄 PDF Document' : (isWord ? '📝 Word Document' : (isExcel ? '📊 Excel Spreadsheet' : '📁 Technical File'));

      previewWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${resource.name} - Al-Muslim Resource Library</title>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 30px; }
            .header-box { background: #1e293b; border: 1.5px solid #334155; border-radius: 12px; padding: 24px; max-width: 900px; margin: 0 auto 24px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .badge { display: inline-block; background: ${themeColor}22; color: ${themeColor}; border: 1px solid ${themeColor}66; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; }
            h1 { font-size: 22px; color: #fff; margin-bottom: 8px; }
            .meta { font-size: 13px; color: #94a3b8; line-height: 1.6; }
            .content-box { background: #1e293b; border: 1.5px solid #334155; border-radius: 12px; padding: 24px; max-width: 900px; margin: 0 auto; line-height: 1.8; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #cbd5e1; white-space: pre-wrap; word-break: break-word; }
            .btn-download { background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; margin-top: 16px; }
            .btn-download:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <span class="badge">${typeBadge}</span>
            <h1>${resource.name}</h1>
            <div class="meta">
              <div><strong>File Name:</strong> ${resource.fileName || resource.name} &bull; <strong>Size:</strong> ${resource.fileSize || '1.2 MB'}</div>
              <div><strong>Access Level:</strong> ${resource.access || 'Maintenance Team'} &bull; <strong>Uploaded By:</strong> ${resource.createdByName || 'Maintenance Director'}</div>
              ${resource.description ? `<div style="margin-top: 6px; color: #e2e8f0;">${resource.description}</div>` : ''}
            </div>
            <button class="btn-download" onclick="window.opener && window.opener.erpDownloadResource ? window.opener.erpDownloadResource('${resource.id}') : alert('Please download from main portal.');">
              ⬇️ Download Original File
            </button>
          </div>
          <div class="content-box">${resource.content || 'Document content archived in Al-Muslim Group Central Maintenance Repository.'}</div>
        </body>
        </html>
      `);
      previewWin.document.close();
      return { success: true };
    }

    return { success: false, message: 'Browser popup blocked.' };
  }

  /**
   * Action 3: Download Original File
   */
  downloadResource(resource, user = null) {
    if (!resource) return { success: false, message: 'Resource not found.' };

    if (!this.hasAccess(resource, user)) {
      alert(`🚫 Download Forbidden: You do not have download permission for '${resource.name}'.\nAccess Requirement: ${resource.access || 'Restricted'}`);
      return { success: false, message: 'Download Forbidden: Missing permission.' };
    }

    // Folders and URLs cannot be directly downloaded as a single raw file
    if (resource.type === RESOURCE_TYPES.FOLDER) {
      alert(`📁 '${resource.name}' is a directory folder. Open the folder to download specific documents inside it.`);
      return { success: false };
    }
    if (resource.type === RESOURCE_TYPES.URL) {
      this.openResource(resource, user);
      return { success: true };
    }

    // Generate downloadable file
    const fileName = resource.fileName || `${resource.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${resource.type === RESOURCE_TYPES.PDF ? 'pdf' : resource.type === RESOURCE_TYPES.WORD ? 'docx' : resource.type === RESOURCE_TYPES.EXCEL ? 'xlsx' : 'txt'}`;
    const content = resource.content || `AL-MUSLIM GROUP DOCUMENT ARCHIVE\nTitle: ${resource.name}\nType: ${resource.type.toUpperCase()}\nAccess: ${resource.access}\nExported: ${new Date().toISOString()}`;

    const mimeType = resource.fileType || (resource.type === RESOURCE_TYPES.PDF ? 'application/pdf' : resource.type === RESOURCE_TYPES.EXCEL ? 'text/csv' : 'text/plain');
    const blob = new Blob([content], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    auditService.log('DOWNLOAD_RESOURCE', `Downloaded resource '${resource.name}' (${fileName})`);
    return { success: true };
  }

  async addResource(resourceData) {
    this.ensureInitialized();
    const id = `res-${Date.now()}`;
    const user = authService.getCurrentUser();

    const newRes = {
      id,
      name: resourceData.name || 'Untitled Document',
      type: resourceData.type || RESOURCE_TYPES.FILE,
      parentId: resourceData.parentId || null,
      access: resourceData.access || 'Maintenance Team',
      accessRoles: resourceData.accessRoles || ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
      fileName: resourceData.fileName || '',
      fileSize: resourceData.fileSize || '1.0 MB',
      fileType: resourceData.fileType || '',
      url: resourceData.url || '',
      description: resourceData.description || '',
      content: resourceData.content || '',
      createdAt: new Date().toISOString(),
      createdByName: user?.name || 'Administrator',
      createdById: user?.id || 'usr-1'
    };

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.DOCUMENTS, (tbl) => { tbl.push(newRes); });
    auditService.log('ADD_RESOURCE', `Added new resource '${newRes.name}' (${newRes.type})`);
    return newRes;
  }

  async updateResource(id, updateData) {
    this.ensureInitialized();
    // CONFIRMED WRITE: await Database write
    let updated;
    await storage.writeAndConfirm(TABLE_NAMES.DOCUMENTS, (tbl) => {
      const idx = tbl.findIndex(r => r.id === id);
      if (idx !== -1) {
        tbl[idx] = { ...tbl[idx], ...updateData, updatedAt: new Date().toISOString() };
        updated = tbl[idx];
      }
    });
    if (!updated) return null;
    auditService.log('UPDATE_RESOURCE', `Updated resource '${updated.name}'`);
    return updated;
  }

  async deleteResource(id) {
    this.ensureInitialized();
    const list = storage.getTable(TABLE_NAMES.DOCUMENTS) || [];
    const target = list.find(r => r.id === id);
    if (!target) return false;

    // Delete item and any recursive child items if it's a folder — CONFIRMED WRITE
    await storage.writeAndConfirm(TABLE_NAMES.DOCUMENTS, (tbl) => {
      const indices = [];
      tbl.forEach((r, i) => { if (r.id === id || r.parentId === id) indices.unshift(i); });
      indices.forEach(i => tbl.splice(i, 1));
    });
    auditService.log('DELETE_RESOURCE', `Deleted resource '${target.name}'`);
    return true;
  }
}

export const resourceLibraryService = new ResourceLibraryService();

// Expose global helper for opened preview windows
window.erpDownloadResource = function(id) {
  const res = resourceLibraryService.getById(id);
  if (res) {
    resourceLibraryService.downloadResource(res);
  }
};
