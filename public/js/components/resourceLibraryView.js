/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Document & Resource Library Component
 * Hierarchical Folder System, Dynamic Dropdown Organization, File Uploads, URL Links & Instant Navigation
 */

import { resourceLibraryService, RESOURCE_TYPES } from '../services/resourceLibraryService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { icon, replaceEmojiInHtml } from './icons.js?v=4.47.0';

let currentFolderId = null;
let searchQuery = '';
let selectedTypeFilter = 'ALL';
let selectedAccessFilter = 'ALL';

export function renderResourceLibraryView() {
  const allCurrentItems = resourceLibraryService.getByParent(currentFolderId);
  const breadcrumbs = resourceLibraryService.getFolderPath(currentFolderId);
  const currentUser = authService.getCurrentUser();
  const isAdminOrManager = authService.isAdmin() || authService.isManager();

  // Separate folders and files/links
  const foldersList = allCurrentItems.filter(r => r.type === RESOURCE_TYPES.FOLDER);
  const filesAndLinksList = allCurrentItems.filter(r => r.type !== RESOURCE_TYPES.FOLDER);

  // Filter items based on active search and dropdown filters
  const filterItem = (item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (item.name || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchAccess = (item.access || '').toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchAccess) return false;
    }

    if (selectedTypeFilter !== 'ALL' && item.type !== selectedTypeFilter) {
      return false;
    }

    if (selectedAccessFilter !== 'ALL' && item.access !== selectedAccessFilter) {
      return false;
    }

    return true;
  };

  const filteredFolders = foldersList.filter(filterItem);
  const filteredFiles = filesAndLinksList.filter(filterItem);

  const getTypeBadge = (type) => {
    switch (type) {
      case RESOURCE_TYPES.PDF:
        return `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 700;">📄 PDF</span>`;
      case RESOURCE_TYPES.WORD:
        return `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;">📝 Word</span>`;
      case RESOURCE_TYPES.EXCEL:
        return `<span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4); font-weight: 700;">📊 Excel</span>`;
      case RESOURCE_TYPES.IMAGE:
        return `<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-weight: 700;">🖼️ Image</span>`;
      case RESOURCE_TYPES.URL:
        return `<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); font-weight: 700;">🔗 URL</span>`;
      case RESOURCE_TYPES.FOLDER:
        return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4); font-weight: 700;">📁 Folder</span>`;
      default:
        return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid var(--border-color); font-weight: 700;">📄 File</span>`;
    }
  };

  const getAccessBadge = (access, isAllowed) => {
    const lockIcon = isAllowed ? '🔓' : '🔒';
    const color = isAllowed ? '#38bdf8' : '#f87171';
    const bg = isAllowed ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)';
    const border = isAllowed ? 'rgba(56, 189, 248, 0.35)' : 'rgba(239, 68, 68, 0.35)';

    return `
      <span class="badge" style="background: ${bg}; color: ${color}; border: 1px solid ${border}; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
        <span>${lockIcon}</span>
        <span>${access || 'All Staff'}</span>
      </span>
    `;
  };

  // Breadcrumb Trail
  const breadcrumbsHtml = breadcrumbs.map((b, idx) => {
    const isLast = idx === breadcrumbs.length - 1;
    if (isLast) {
      return `<span style="font-weight: 800; color: #fff; display: inline-flex; align-items: center; gap: 4px;">${idx === 0 ? '🏠 Root Library' : `📁 ${b.name}`}</span>`;
    }
    return `
      <a href="javascript:void(0)" class="library-breadcrumb-nav" data-folder-id="${b.id || ''}" style="color: #38bdf8; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
        ${idx === 0 ? '🏠 Root' : `📁 ${b.name}`}
      </a>
      <span style="color: #64748b; margin: 0 6px;">/</span>
    `;
  }).join('');

  // Parent Folder ID for "Up / Back" button
  const currentFolderObj = currentFolderId ? resourceLibraryService.getById(currentFolderId) : null;
  const parentFolderId = currentFolderObj ? (currentFolderObj.parentId || null) : null;

  return replaceEmojiInHtml(`
    <div class="page-view" style="display: flex; flex-direction: column; gap: 18px;">
      
      <!-- Top Action Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px; margin: 0 0 4px 0;">
            <span>📚 Document &amp; Resource Library</span>
          </h1>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0;">
            Hierarchical factory document repository. Organize files, PDFs, Word manuals, Excel schedules, and Web Links inside customizable folders.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          ${isAdminOrManager ? `
            <button type="button" id="btn-create-folder-main" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #e2e8f0; border-color: rgba(255,255,255,0.15);">
              📁 New Folder
            </button>
            <button type="button" id="btn-add-resource-main" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #0284c7; padding: 8px 16px;">
              ➕ Add File / Link
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Navigation & Toolbar -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
        
        <!-- Breadcrumb & Back button -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          ${currentFolderId ? `
            <button type="button" class="btn btn-secondary btn-xs btn-nav-up" data-parent-id="${parentFolderId || ''}" style="font-weight: 700; color: #38bdf8; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;">
              ⬅️ Back
            </button>
          ` : ''}
          <div style="display: flex; align-items: center; font-size: 13px; background: rgba(15, 23, 42, 0.7); padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
            ${breadcrumbsHtml}
          </div>
        </div>

        <!-- Filter Controls -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="position: relative; min-width: 200px;">
            <input type="text" id="lib-search-input" class="form-control form-control-sm" placeholder="Search in this folder..." value="${searchQuery}" style="padding-left: 12px; font-size: 12.5px;" />
          </div>

          <select id="lib-type-filter" class="form-control form-control-sm" style="width: 130px; font-size: 12px; font-weight: 600;">
            <option value="ALL" ${selectedTypeFilter === 'ALL' ? 'selected' : ''}>All Types</option>
            <option value="${RESOURCE_TYPES.FOLDER}" ${selectedTypeFilter === RESOURCE_TYPES.FOLDER ? 'selected' : ''}>📁 Folders</option>
            <option value="${RESOURCE_TYPES.PDF}" ${selectedTypeFilter === RESOURCE_TYPES.PDF ? 'selected' : ''}>📄 PDF</option>
            <option value="${RESOURCE_TYPES.WORD}" ${selectedTypeFilter === RESOURCE_TYPES.WORD ? 'selected' : ''}>📝 Word</option>
            <option value="${RESOURCE_TYPES.EXCEL}" ${selectedTypeFilter === RESOURCE_TYPES.EXCEL ? 'selected' : ''}>📊 Excel</option>
            <option value="${RESOURCE_TYPES.IMAGE}" ${selectedTypeFilter === RESOURCE_TYPES.IMAGE ? 'selected' : ''}>🖼️ Images</option>
            <option value="${RESOURCE_TYPES.URL}" ${selectedTypeFilter === RESOURCE_TYPES.URL ? 'selected' : ''}>🔗 Web Links</option>
          </select>

          <select id="lib-access-filter" class="form-control form-control-sm" style="width: 155px; font-size: 12px; font-weight: 600;">
            <option value="ALL" ${selectedAccessFilter === 'ALL' ? 'selected' : ''}>All Access Levels</option>
            <option value="All Staff" ${selectedAccessFilter === 'All Staff' ? 'selected' : ''}>All Staff</option>
            <option value="Maintenance Team" ${selectedAccessFilter === 'Maintenance Team' ? 'selected' : ''}>Maintenance Team</option>
            <option value="Engineers" ${selectedAccessFilter === 'Engineers' ? 'selected' : ''}>Engineers</option>
            <option value="Admin + Manager" ${selectedAccessFilter === 'Admin + Manager' ? 'selected' : ''}>Admin + Manager</option>
          </select>
        </div>
      </div>

      <!-- SECTION 1: FOLDERS (Directory Grid) -->
      ${filteredFolders.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 13px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
            <span>📁 Directories &amp; Folders (${filteredFolders.length})</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">
            ${filteredFolders.map(folder => {
              const isAllowed = resourceLibraryService.hasAccess(folder, currentUser);
              const count = resourceLibraryService.getChildItemsCount(folder.id);

              return `
                <div class="folder-card-box" style="background: var(--bg-surface); border: 1.5px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg); padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s; box-shadow: 0 4px 14px rgba(0,0,0,0.25);" onmouseover="this.style.borderColor='#38bdf8'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.transform='none'">
                  
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px; cursor: ${isAllowed ? 'pointer' : 'not-allowed'};" class="${isAllowed ? 'btn-nav-folder' : ''}" data-folder-id="${folder.id}">
                      <span style="font-size: 28px; line-height: 1;">📁</span>
                      <div>
                        <div style="font-weight: 800; font-size: 14px; color: ${isAllowed ? '#fff' : '#94a3b8'};">
                          ${folder.name}
                        </div>
                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                          ${count} item${count === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    ${isAdminOrManager ? `
                      <div style="display: flex; align-items: center; gap: 4px;">
                        <button type="button" class="btn btn-ghost btn-xs btn-edit-resource" data-resource-id="${folder.id}" title="Edit / Move Folder" style="padding: 2px 5px; font-size: 12px; color: #94a3b8;">
                          ✏️
                        </button>
                        <button type="button" class="btn btn-ghost btn-xs btn-delete-resource" data-resource-id="${folder.id}" title="Delete Folder" style="padding: 2px 5px; font-size: 12px; color: #f87171;">
                          🗑️
                        </button>
                      </div>
                    ` : ''}
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; margin-top: 4px;">
                    <div>${getAccessBadge(folder.access, isAllowed)}</div>
                    ${isAllowed ? `
                      <button type="button" class="btn btn-secondary btn-xs btn-nav-folder" data-folder-id="${folder.id}" style="font-weight: 700; color: #38bdf8; padding: 3px 9px;">
                        Open Folder &rarr;
                      </button>
                    ` : `
                      <span style="font-size: 11px; color: #f87171; font-weight: 600;">🔒 Restricted</span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- SECTION 2: FILES & WEB LINKS TABLE -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 13px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
          <span>📄 Files &amp; Web Links (${filteredFiles.length})</span>
          ${currentFolderObj ? `
            <span style="font-size: 12px; color: #38bdf8; font-weight: 600; text-transform: none;">
              Inside: 📁 ${currentFolderObj.name}
            </span>
          ` : ''}
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: rgba(15, 23, 42, 0.8); border-bottom: 1.5px solid var(--border-color); text-align: left;">
                <th style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 40%;">Name &amp; Description</th>
                <th style="padding: 12px 14px; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 12%;">Type</th>
                <th style="padding: 12px 14px; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 18%;">Access</th>
                <th style="padding: 12px 14px; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; width: 12%;">Size / Format</th>
                <th style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: right; width: 18%;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFiles.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
                    <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
                    <div style="font-size: 14.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
                      ${filteredFolders.length > 0 ? 'No loose files in this folder (Folders listed above)' : 'This directory folder is empty'}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                      Use "➕ Add File / Link" to add files or web links here.
                    </div>
                  </td>
                </tr>
              ` : filteredFiles.map(item => {
                const isAllowed = resourceLibraryService.hasAccess(item, currentUser);
                const isUrl = item.type === RESOURCE_TYPES.URL;
                const isFile = !isUrl && item.type !== RESOURCE_TYPES.FOLDER;

                const icon = isUrl ? '🔗' : (item.type === RESOURCE_TYPES.PDF ? '📄' : (item.type === RESOURCE_TYPES.EXCEL ? '📊' : (item.type === RESOURCE_TYPES.WORD ? '📝' : (item.type === RESOURCE_TYPES.IMAGE ? '🖼️' : '📄'))));

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(56, 189, 248, 0.04)'" onmouseout="this.style.background='transparent'">
                    
                    <!-- Clickable Name Column -->
                    <td style="padding: 12px 16px; vertical-align: middle;">
                      <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 20px; line-height: 1; margin-top: 2px;">${icon}</span>
                        <div>
                          ${isAllowed ? `
                            <a href="javascript:void(0)" class="btn-open-item" data-resource-id="${item.id}" style="font-weight: 700; font-size: 13.5px; color: #38bdf8; text-decoration: none; display: inline-block;">
                              ${item.name}
                            </a>
                          ` : `
                            <span style="font-weight: 700; font-size: 13.5px; color: #94a3b8; cursor: not-allowed;" title="Access Restricted">
                              ${item.name} 🔒
                            </span>
                          `}
                          ${item.description ? `
                            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px; line-height: 1.4;">
                              ${item.description}
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    </td>

                    <!-- Type -->
                    <td style="padding: 12px 14px; vertical-align: middle;">
                      ${getTypeBadge(item.type)}
                    </td>

                    <!-- Access -->
                    <td style="padding: 12px 14px; vertical-align: middle;">
                      ${getAccessBadge(item.access, isAllowed)}
                    </td>

                    <!-- Size / Format -->
                    <td style="padding: 12px 14px; vertical-align: middle; font-size: 12px; color: var(--text-secondary); font-family: var(--font-mono);">
                      ${item.fileSize || (isUrl ? 'Web Link' : '1.0 MB')}
                    </td>

                    <!-- Actions -->
                    <td style="padding: 12px 16px; vertical-align: middle; text-align: right;">
                      <div style="display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end;">
                        
                        ${isFile ? `
                          <!-- View / Open ↗ -->
                          <button type="button" class="btn btn-secondary btn-xs btn-open-item" data-resource-id="${item.id}" style="font-weight: 700; color: #38bdf8; padding: 4px 9px;" title="Open document in new browser tab">
                            View ↗
                          </button>
                          <!-- Download ↓ -->
                          <button type="button" class="btn btn-primary btn-xs btn-download-item" data-resource-id="${item.id}" style="font-weight: 700; background: #0284c7; border-color: #0284c7; padding: 4px 9px;" title="Download original file">
                            ⬇ Download
                          </button>
                        ` : ''}

                        ${isUrl ? `
                          <!-- Open Link ↗ -->
                          <button type="button" class="btn btn-secondary btn-xs btn-open-item" data-resource-id="${item.id}" style="font-weight: 700; color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); padding: 4px 10px;" title="Open external URL in new browser tab">
                            Open Link ↗
                          </button>
                        ` : ''}

                        ${isAdminOrManager ? `
                          <button type="button" class="btn btn-ghost btn-xs btn-edit-resource" data-resource-id="${item.id}" style="color: #94a3b8; padding: 3px 5px; margin-left: 2px;" title="Edit / Move">
                            ✏️
                          </button>
                          <button type="button" class="btn btn-ghost btn-xs btn-delete-resource" data-resource-id="${item.id}" style="color: #f87171; padding: 3px 5px;" title="Delete">
                            🗑️
                          </button>
                        ` : ''}

                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal Layer Container -->
      <div id="library-modal-root"></div>
    </div>
  `);
}

export function initResourceLibraryEvents() {
  // 1. Folder Navigation (Clicking Folder Cards, Rows, or Breadcrumbs)
  document.querySelectorAll('.btn-nav-folder, .library-breadcrumb-nav, .btn-nav-up').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const folderId = el.getAttribute('data-folder-id') ?? el.getAttribute('data-parent-id');
      currentFolderId = (folderId === '' || folderId === 'null') ? null : folderId;
      renderUpdatedLibraryList();
    });
  });

  // 2. Open Resource (View in New Tab or URL)
  document.querySelectorAll('.btn-open-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const resId = el.getAttribute('data-resource-id');
      const res = resourceLibraryService.getById(resId);
      if (res) {
        resourceLibraryService.openResource(res);
      }
    });
  });

  // 3. Download Resource
  document.querySelectorAll('.btn-download-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const resId = el.getAttribute('data-resource-id');
      const res = resourceLibraryService.getById(resId);
      if (res) {
        resourceLibraryService.downloadResource(res);
      }
    });
  });

  // 4. Delete Resource
  document.querySelectorAll('.btn-delete-resource').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const resId = el.getAttribute('data-resource-id');
      const res = resourceLibraryService.getById(resId);
      if (res) {
        const confirmed = await notificationService.confirmDelete({
          title: 'Delete Resource',
          message: `Are you sure you want to delete '${res.name}'? This action cannot be undone.`,
          count: 1,
          itemName: res.name,
          itemType: 'Resource'
        });
        if (confirmed) {
          resourceLibraryService.deleteResource(resId);
          renderUpdatedLibraryList();
          notificationService.success(`Resource "${res.name}" deleted successfully.`);
        }
      }
    });
  });

  // 5. Edit / Move Resource
  document.querySelectorAll('.btn-edit-resource').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const resId = el.getAttribute('data-resource-id');
      const res = resourceLibraryService.getById(resId);
      if (res) {
        openEditResourceModal(res);
      }
    });
  });

  // 6. Search Filter
  const searchInput = document.getElementById('lib-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderUpdatedLibraryList();
    });
  }

  // 7. Type Filter
  const typeFilter = document.getElementById('lib-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      selectedTypeFilter = e.target.value;
      renderUpdatedLibraryList();
    });
  }

  // 8. Access Filter
  const accessFilter = document.getElementById('lib-access-filter');
  if (accessFilter) {
    accessFilter.addEventListener('change', (e) => {
      selectedAccessFilter = e.target.value;
      renderUpdatedLibraryList();
    });
  }

  // 9. Add Resource & Create Folder Triggers
  const btnAddRes = document.getElementById('btn-add-resource-main');
  if (btnAddRes) {
    btnAddRes.addEventListener('click', () => openCreateResourceModal(false));
  }

  const btnCreateFolder = document.getElementById('btn-create-folder-main');
  if (btnCreateFolder) {
    btnCreateFolder.addEventListener('click', () => openCreateResourceModal(true));
  }
}

function renderUpdatedLibraryList() {
  const container = document.getElementById('main-view-container');
  if (container) {
    container.innerHTML = renderResourceLibraryView();
    initResourceLibraryEvents();
  }
}

/**
 * Builds the Parent Folder Dropdown options tree
 */
function buildParentFolderOptionsHtml(selectedParentId = null, excludeFolderId = null) {
  const allFolders = resourceLibraryService.getAllFolders(excludeFolderId);
  const isRootSelected = (!selectedParentId || selectedParentId === '' || selectedParentId === 'null') ? 'selected' : '';

  let html = `<option value="" ${isRootSelected}>📁 Root Library (Top Level)</option>`;
  allFolders.forEach(f => {
    const isSelected = f.id === selectedParentId ? 'selected' : '';
    html += `<option value="${f.id}" ${isSelected}>${f.displayName}</option>`;
  });
  return html;
}

/**
 * Modal to Create New Folder or Upload File / Add Web Link
 */
function openCreateResourceModal(isFolderOnly = false) {
  const modalRoot = document.getElementById('library-modal-root');
  if (!modalRoot) return;

  const folderOptionsHtml = buildParentFolderOptionsHtml(currentFolderId);

  modalRoot.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px);">
      <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-xl); width: 580px; max-width: 95vw; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 16px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>${isFolderOnly ? '📁 Create New Folder' : '➕ Add Resource to Library'}</span>
          </h3>
          <button type="button" id="btn-close-create-modal" class="btn btn-ghost btn-sm" style="font-size: 18px; line-height: 1; padding: 4px 8px;">✕</button>
        </div>

        <form id="form-create-resource" style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Parent Folder Dropdown (KISHER POR KI FOLDER RAKHBO..ATA DROPDOWN KORE SAJABO) -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #38bdf8;">
              📁 Select Location / Parent Folder *
            </label>
            <select id="create-res-parent" class="form-control" style="font-weight: 600;">
              ${folderOptionsHtml}
            </select>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
              Choose which directory folder this item should be stored inside.
            </div>
          </div>

          <!-- Type Selector -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Resource Type *</label>
            <select id="create-res-type" class="form-control" ${isFolderOnly ? 'disabled' : ''}>
              ${isFolderOnly ? `
                <option value="${RESOURCE_TYPES.FOLDER}" selected>📁 Directory Folder</option>
              ` : `
                <option value="${RESOURCE_TYPES.PDF}" selected>📄 PDF Document</option>
                <option value="${RESOURCE_TYPES.WORD}">📝 Word Document (.docx, .doc)</option>
                <option value="${RESOURCE_TYPES.EXCEL}">📊 Excel Spreadsheet (.xlsx, .csv)</option>
                <option value="${RESOURCE_TYPES.IMAGE}">🖼️ Image / Schematic (.png, .jpg)</option>
                <option value="${RESOURCE_TYPES.URL}">🔗 External Web Link / URL</option>
                <option value="${RESOURCE_TYPES.FILE}">📦 Other Technical File</option>
                <option value="${RESOURCE_TYPES.FOLDER}">📁 Directory Folder</option>
              `}
            </select>
          </div>

          <!-- Name -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Title / Name *</label>
            <input type="text" id="create-res-name" class="form-control" required placeholder="e.g. Juki DDL-8700 Operation Guide" />
          </div>

          <!-- URL Input (shown when Type is URL) -->
          <div id="create-url-field" class="form-group" style="margin-bottom: 0; display: none;">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #fbbf24;">Web Link / URL Address *</label>
            <input type="url" id="create-res-url" class="form-control" placeholder="https://portal.almuslim.com/..." />
          </div>

          <!-- Real File Upload Area (shown for files) -->
          <div id="create-file-upload-field" class="form-group" style="margin-bottom: 0; display: ${isFolderOnly ? 'none' : 'block'};">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Choose File from Computer (Optional)</label>
            <input type="file" id="create-res-file-input" class="form-control" style="padding: 6px;" />
            <div id="file-upload-status" style="font-size: 11px; color: #34d399; margin-top: 4px;"></div>
          </div>

          <!-- Access Level -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Access Permissions</label>
            <select id="create-res-access" class="form-control">
              <option value="Maintenance Team" selected>Maintenance Team (Technicians &amp; Engineers)</option>
              <option value="Engineers">Engineers (Engineers &amp; Managers)</option>
              <option value="Admin + Manager">Admin + Manager (Management Restricted)</option>
              <option value="All Staff">All Staff (Open to all factory users)</option>
            </select>
          </div>

          <!-- Description -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Description / Notes</label>
            <textarea id="create-res-desc" class="form-control" rows="2" placeholder="Brief technical summary..."></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button type="button" id="btn-cancel-create-modal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700;">
              💾 Save Resource
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  document.getElementById('btn-close-create-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-create-modal')?.addEventListener('click', closeModal);

  const typeSelect = document.getElementById('create-res-type');
  const urlField = document.getElementById('create-url-field');
  const fileField = document.getElementById('create-file-upload-field');

  const toggleTypeFields = () => {
    const val = typeSelect ? typeSelect.value : '';
    if (urlField) urlField.style.display = val === RESOURCE_TYPES.URL ? 'block' : 'none';
    if (fileField) fileField.style.display = (val === RESOURCE_TYPES.FOLDER || val === RESOURCE_TYPES.URL) ? 'none' : 'block';
  };

  if (typeSelect) {
    typeSelect.addEventListener('change', toggleTypeFields);
  }

  // Real File Upload Reader
  let uploadedFileData = null;
  const fileInput = document.getElementById('create-res-file-input');
  const fileStatus = document.getElementById('file-upload-status');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          uploadedFileData = {
            fileName: file.name,
            fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
            fileType: file.type,
            content: evt.target.result
          };
          if (fileStatus) fileStatus.textContent = `✓ Selected: ${file.name} (${uploadedFileData.fileSize})`;
          const nameInput = document.getElementById('create-res-name');
          if (nameInput && !nameInput.value.trim()) {
            nameInput.value = file.name.replace(/\.[^/.]+$/, "");
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Form Submit
  const form = document.getElementById('form-create-resource');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const parentId = document.getElementById('create-res-parent')?.value || null;
      const type = typeSelect ? typeSelect.value : RESOURCE_TYPES.FILE;
      const name = document.getElementById('create-res-name')?.value.trim();
      const url = document.getElementById('create-res-url')?.value.trim();
      const access = document.getElementById('create-res-access')?.value || 'Maintenance Team';
      const desc = document.getElementById('create-res-desc')?.value.trim();

      if (!name) return;

      let accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER'];
      if (access === 'Maintenance Team') accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'];
      if (access === 'Engineers') accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
      if (access === 'Admin + Manager') accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

      const newResourceData = {
        name,
        type,
        parentId,
        access,
        accessRoles,
        url,
        description: desc,
        fileName: uploadedFileData ? uploadedFileData.fileName : `${name}.${type === 'pdf' ? 'pdf' : type === 'word' ? 'docx' : type === 'excel' ? 'xlsx' : 'txt'}`,
        fileSize: uploadedFileData ? uploadedFileData.fileSize : (type === 'folder' ? '' : (type === 'url' ? 'Web Link' : '1.2 MB')),
        fileType: uploadedFileData ? uploadedFileData.fileType : '',
        content: uploadedFileData ? uploadedFileData.content : ''
      };

      resourceLibraryService.addResource(newResourceData);
      closeModal();
      currentFolderId = parentId; // Navigate to the selected folder
      renderUpdatedLibraryList();
    });
  }
}

/**
 * Modal to Edit or Move Resource to Another Folder (Dropdown Selection)
 */
function openEditResourceModal(resource) {
  const modalRoot = document.getElementById('library-modal-root');
  if (!modalRoot) return;

  const folderOptionsHtml = buildParentFolderOptionsHtml(resource.parentId, resource.id);
  const isUrl = resource.type === RESOURCE_TYPES.URL;
  const isFolder = resource.type === RESOURCE_TYPES.FOLDER;

  modalRoot.innerHTML = `
    <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(5px);">
      <div style="background: var(--bg-surface); border: 1.5px solid var(--border-color); border-radius: var(--radius-xl); width: 560px; max-width: 95vw; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 16px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>✏️ Edit / Move: ${resource.name}</span>
          </h3>
          <button type="button" id="btn-close-edit-modal" class="btn btn-ghost btn-sm" style="font-size: 18px; line-height: 1; padding: 4px 8px;">✕</button>
        </div>

        <form id="form-edit-resource" style="display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Parent Folder Dropdown: Move Folder / File to another directory -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px; color: #38bdf8;">
              📁 Move to Parent Folder (Dropdown Selection)
            </label>
            <select id="edit-res-parent" class="form-control" style="font-weight: 600;">
              ${folderOptionsHtml}
            </select>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">
              Select a new folder to move this resource into.
            </div>
          </div>

          <!-- Name -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Resource Name *</label>
            <input type="text" id="edit-res-name" class="form-control" required value="${resource.name || ''}" />
          </div>

          <!-- URL if applicable -->
          ${isUrl ? `
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-weight: 700; font-size: 12px; color: #fbbf24;">Web Link / URL Address *</label>
              <input type="url" id="edit-res-url" class="form-control" value="${resource.url || ''}" />
            </div>
          ` : ''}

          <!-- Access Level -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Access Permissions</label>
            <select id="edit-res-access" class="form-control">
              <option value="Maintenance Team" ${resource.access === 'Maintenance Team' ? 'selected' : ''}>Maintenance Team (Technicians &amp; Engineers)</option>
              <option value="Engineers" ${resource.access === 'Engineers' ? 'selected' : ''}>Engineers (Engineers &amp; Managers)</option>
              <option value="Admin + Manager" ${resource.access === 'Admin + Manager' ? 'selected' : ''}>Admin + Manager (Restricted)</option>
              <option value="All Staff" ${resource.access === 'All Staff' ? 'selected' : ''}>All Staff (Open to all factory users)</option>
            </select>
          </div>

          <!-- Description -->
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-weight: 700; font-size: 12px;">Description / Notes</label>
            <textarea id="edit-res-desc" class="form-control" rows="2">${resource.description || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button type="button" id="btn-cancel-edit-modal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700;">
              💾 Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const closeModal = () => { modalRoot.innerHTML = ''; };
  document.getElementById('btn-close-edit-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-edit-modal')?.addEventListener('click', closeModal);

  const form = document.getElementById('form-edit-resource');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const newParentId = document.getElementById('edit-res-parent')?.value || null;
      const name = document.getElementById('edit-res-name')?.value.trim();
      const url = document.getElementById('edit-res-url')?.value.trim();
      const access = document.getElementById('edit-res-access')?.value || 'Maintenance Team';
      const desc = document.getElementById('edit-res-desc')?.value.trim();

      if (!name) return;

      let accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER'];
      if (access === 'Maintenance Team') accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'];
      if (access === 'Engineers') accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
      if (access === 'Admin + Manager') accessRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

      const updates = {
        name,
        parentId: newParentId,
        access,
        accessRoles,
        description: desc
      };
      if (isUrl) updates.url = url;

      resourceLibraryService.updateResource(resource.id, updates);
      closeModal();
      renderUpdatedLibraryList();
    });
  }
}
