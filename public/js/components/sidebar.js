/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Ultra-Modern Enterprise Navigation Sidebar Component
 * 
 * ORGANIZED ARCHITECTURE:
 * 1. OPERATIONS: Dashboard, Machine Operations, Technical & Maintenance
 * 2. WORKFORCE & HR: Manpower Management
 * 3. REPORTS & ANALYTICS: Reports & Diagnostics, Excel Export Center
 * 4. ADMINISTRATION: System Administration & Configuration
 */

import { authService } from '../services/authService.js?v=4.46.1';
import { state } from '../state.js?v=4.46.1';
import { router } from '../services/router.js?v=4.46.1';
import { moduleLoader } from '../services/moduleLoader.js?v=4.46.1';

const STORAGE_KEY_EXPANDED = 'al_muslim_sidebar_expanded_menus';

/**
 * High-End Vector SVG Icons (Outlined, Scalable, Zero OS-dependent cartoon emojis)
 */
const SIDEBAR_ICONS = {
  // Navigation
  dashboard: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>`,
  machines: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><line x1="6" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="14" y2="12"></line></svg>`,
  inventory: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  transfers: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
  relocate: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
  qrCodes: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="6" y="6" width="1" height="1" fill="currentColor"></rect><rect x="17" y="6" width="1" height="1" fill="currentColor"></rect><rect x="6" y="17" width="1" height="1" fill="currentColor"></rect></svg>`,
  preventive: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`,
  needleOps: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"></line><path d="M10 6h4"></path><path d="M9 10h6"></path><circle cx="12" cy="3" r="1.5" fill="currentColor"></circle></svg>`,
  partsTrace: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="18" cy="18" r="3"></circle><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"></line><circle cx="18" cy="6" r="2.5"></circle><line x1="8.5" y1="6" x2="15.5" y2="6"></line></svg>`,
  machineHistory: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>`,

  // Specialized Units
  etLab: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  toolsEquipment: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
  resourceLibrary: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="8" y1="7" x2="16" y2="7"></line><line x1="8" y1="11" x2="13" y2="11"></line></svg>`,

  // Workforce & HR
  manpower: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  mpActive: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`,
  mpInactive: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="17" y1="11" x2="23" y2="11"></line></svg>`,
  mpTransfers: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path><path d="M4 4l5 5"></path></svg>`,
  mpLeaves: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  mpCustomFields: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><circle cx="4" cy="12" r="2" fill="currentColor"></circle><circle cx="12" cy="10" r="2" fill="currentColor"></circle><circle cx="20" cy="14" r="2" fill="currentColor"></circle></svg>`,

  // Reports & Analytics
  reports: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  reportMachine: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  reportTransfer: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
  reportSpare: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  reportEtLab: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8"></path><path d="M3 22h18"></path><path d="M14 22a7 7 0 1 0-7-7h1"></path><circle cx="9" cy="9" r="2"></circle><path d="M9 3v2"></path></svg>`,
  reportPm: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><polyline points="9 14 11 16 15 12"></polyline></svg>`,
  reportExport: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 18 15 15"></polyline></svg>`,

  // System Administration
  admin: `<svg class="sidebar-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  admUsers: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><circle cx="12" cy="8" r="3"></circle><path d="M7 16a5 5 0 0 1 10 0"></path></svg>`,
  admMasterData: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="18"></line><line x1="15" y1="22" x2="15" y2="18"></line><line x1="8" y1="6" x2="10" y2="6"></line><line x1="14" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="10" y2="10"></line><line x1="14" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="10" y2="14"></line><line x1="14" y1="14" x2="16" y2="14"></line></svg>`,
  admStorage: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
  admTransferConfig: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
  admExcelConfig: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>`,
  admEmailConfig: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
  admHomepage: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
  admLogs: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  admDatabase: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
  admSettings: `<svg class="sidebar-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,

  // Utilities & Brand
  brandLogo: `<svg class="brand-svg-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
  search: `<svg class="sidebar-search-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  arrowCollapse: `<svg class="sidebar-collapse-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
  lock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
};

function getExpandedGroups() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {}
  // Default: start with only group-machines open so the sidebar is tidy and compact
  return new Set(['group-machines']);
}

function saveExpandedGroups(set) {
  try {
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function renderSidebar() {
  const currentView = state.get('currentView') || 'dashboard';
  const user = authService.getCurrentUser();
  const isAdmin = authService.isAdmin();
  const isSuperAdmin = authService.isSuperAdmin();
  const expandedGroups = getExpandedGroups();
  const activeReportTab = state.get('reportActiveTab') || 'machines';
  const activeManpowerTab = state.get('manpowerActiveTab') || 'active';
  const activePmTab = state.get('pmActiveTab') || 'dashboard';

  // Auto expand parent group of current view
  if (['inventory', 'transfers', 'relocate', 'qr-codes', 'preventive-maintenance', 'needle-operations', 'parts-trace', 'machine-history'].includes(currentView)) {
    expandedGroups.add('group-machines');
  } else if (currentView === 'reports') {
    expandedGroups.add('group-reports');
  } else if (currentView === 'manpower') {
    expandedGroups.add('group-manpower');
  } else if (['users', 'email-config', 'master-data', 'transfer-workflows', 'excel-manager', 'audit-logs', 'settings', 'database-config', 'storage', 'homepage-manager'].includes(currentView)) {
    expandedGroups.add('group-admin');
  }

  // Helper to render an accordion group
  const renderNavGroup = (group) => {
    const isExpanded = expandedGroups.has(group.id);
    const hasActiveChild = group.items.some(sub => {
      if (currentView === 'reports') {
        return sub.targetView === 'reports' && sub.reportTab === activeReportTab;
      } else if (currentView === 'manpower') {
        return sub.targetView === 'manpower' && sub.manpowerTab === activeManpowerTab;
      }
      return sub.targetView === currentView;
    });

    return `
      <div class="nav-group" data-group-id="${group.id}">
        <!-- Group Header -->
        <div class="nav-group-header ${hasActiveChild ? 'parent-active' : ''}" data-group-toggle="${group.id}" title="${group.label}">
          <div class="nav-group-title">
            <span class="nav-icon-box">${group.icon}</span>
            <span>${group.label}</span>
          </div>
          <span class="group-chevron ${isExpanded ? 'expanded' : ''}" id="chevron-${group.id}">❯</span>
        </div>

        <!-- Submenu -->
        <div class="nav-submenu ${isExpanded ? 'expanded' : 'collapsed'}" id="submenu-${group.id}">
          ${group.items.map(sub => {
            let isSubActive = false;
            if (currentView === 'reports' && sub.targetView === 'reports') {
              isSubActive = (sub.reportTab === activeReportTab);
            } else if (currentView === 'manpower' && sub.targetView === 'manpower') {
              isSubActive = (sub.manpowerTab === activeManpowerTab);
            } else if (currentView === 'preventive-maintenance' && sub.targetView === 'preventive-maintenance') {
              isSubActive = sub.pmTab ? (sub.pmTab === activePmTab) : (!activePmTab || activePmTab === 'dashboard');
            } else {
              isSubActive = (sub.targetView === currentView);
            }

            return `
              <div 
                class="nav-subitem ${isSubActive ? 'active' : ''}" 
                data-view="${sub.targetView}" 
                data-sub-id="${sub.id}"
                ${sub.reportTab ? `data-report-tab="${sub.reportTab}"` : ''}
                ${sub.manpowerTab ? `data-manpower-tab="${sub.manpowerTab}"` : ''}
                ${sub.pmTab ? `data-pm-tab="${sub.pmTab}"` : ''}
                id="nav-subitem-${sub.id}"
                title="${sub.label}"
              >
                <span class="sub-icon-box">${sub.icon}</span>
                <span>${sub.label}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // Helper to render a direct item
  const renderDirectItem = (item) => {
    const isActive = currentView === item.targetView;
    return `
      <div class="nav-item ${isActive ? 'active' : ''}" data-view="${item.targetView}" id="nav-item-${item.id}" title="${item.label}">
        <div class="nav-group-title">
          <span class="nav-icon-box">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      </div>
    `;
  };

  // 1. OPERATIONS & MACHINERY SECTION
  const dashboardItem = {
    type: 'item',
    id: 'dashboard',
    targetView: 'dashboard',
    label: 'Dashboard',
    icon: SIDEBAR_ICONS.dashboard,
    moduleKey: 'dashboard'
  };

  // Machine Operations Group (Each item individually permission-controlled)
  const machineItems = [
    { id: 'sub-mach-inventory', targetView: 'inventory', label: 'Machine Inventory', icon: SIDEBAR_ICONS.inventory, moduleKey: 'machines' },
    { id: 'sub-mach-transfers', targetView: 'transfers', label: 'Machine Transfers', icon: SIDEBAR_ICONS.transfers, moduleKey: 'transfers' },
    { id: 'sub-mach-relocate', targetView: 'relocate', label: 'Relocate & Verify', icon: SIDEBAR_ICONS.relocate, moduleKey: 'relocate' },
    { id: 'sub-mach-qr-codes', targetView: 'qr-codes', label: 'QR Codes & Labels', icon: SIDEBAR_ICONS.qrCodes, moduleKey: 'qr_codes' },
    { id: 'sub-mach-preventive', targetView: 'preventive-maintenance', pmTab: 'dashboard', label: 'Preventive Maintenance', icon: SIDEBAR_ICONS.preventive, moduleKey: 'preventive_maintenance' },
    { id: 'sub-mach-needle-ops', targetView: 'needle-operations', label: 'Needle Flow', icon: SIDEBAR_ICONS.needleOps, moduleKey: 'machines' },
    { id: 'sub-mach-parts-trace', targetView: 'parts-trace', label: 'Parts Trace', icon: SIDEBAR_ICONS.partsTrace, moduleKey: 'parts_trace' },
    { id: 'sub-mach-history', targetView: 'machine-history', label: 'Machine Lifetime (Passport)', icon: SIDEBAR_ICONS.machineHistory, moduleKey: 'machine_history' }
  ].filter(it => authService.isModuleAllowed(it.moduleKey));

  // 2. SPECIALIZED TECHNICAL DEPARTMENTS (Separate Standalone Features with Discrete Access)
  const specializedFeatures = [
    {
      type: 'item',
      id: 'et-lab',
      targetView: 'et-lab',
      label: 'ENT Lab Management',
      icon: SIDEBAR_ICONS.etLab,
      moduleKey: 'et_lab'
    },
    {
      type: 'item',
      id: 'tools-equipment',
      targetView: 'tools-management',
      label: 'Tools & Equipment',
      icon: SIDEBAR_ICONS.toolsEquipment,
      moduleKey: 'tools_management'
    },
    {
      type: 'item',
      id: 'resource-library',
      targetView: 'resource-library',
      label: 'Document & Tech Library',
      icon: SIDEBAR_ICONS.resourceLibrary,
      moduleKey: 'document_library'
    }
  ].filter(it => authService.isModuleAllowed(it.moduleKey));

  // 3. WORKFORCE & HR SECTION
  const workforceItems = [
    { id: 'sub-mp-active', targetView: 'manpower', manpowerTab: 'active', label: 'Active Manpower', icon: SIDEBAR_ICONS.mpActive, moduleKey: 'manpower' },
    { id: 'sub-mp-inactive', targetView: 'manpower', manpowerTab: 'inactive', label: 'Inactive / Archive', icon: SIDEBAR_ICONS.mpInactive, moduleKey: 'manpower' },
    { id: 'sub-mp-transfers', targetView: 'manpower', manpowerTab: 'transfers', label: 'Employee Transfers', icon: SIDEBAR_ICONS.mpTransfers, moduleKey: 'manpower' },
    { id: 'sub-mp-leaves', targetView: 'manpower', manpowerTab: 'leaves', label: 'Leave Records', icon: SIDEBAR_ICONS.mpLeaves, moduleKey: 'manpower' },
    { id: 'sub-mp-cf', targetView: 'manpower', manpowerTab: 'custom-fields', label: 'Custom Fields (HR)', icon: SIDEBAR_ICONS.mpCustomFields, moduleKey: 'manpower' }
  ].filter(it => authService.isModuleAllowed(it.moduleKey));

  // 4. REPORTS & ANALYTICS SECTION (Discrete reports filtered by allowed module domains)
  const isReportsAllowed = authService.isAdmin() || authService.isModuleAllowed('reports');
  const reportItems = !isReportsAllowed ? [] : [
    { id: 'sub-report-machine', targetView: 'reports', reportTab: 'machines', label: 'Machine Reports', icon: SIDEBAR_ICONS.reportMachine, moduleKey: 'machines' },
    { id: 'sub-report-transfer', targetView: 'reports', reportTab: 'transfers', label: 'Transfer Reports', icon: SIDEBAR_ICONS.reportTransfer, moduleKey: 'transfers' },
    { id: 'sub-report-spare', targetView: 'reports', reportTab: 'spareparts', label: 'Spare Parts Reports', icon: SIDEBAR_ICONS.reportSpare, moduleKey: 'spare_parts' },
    { id: 'sub-report-etlab', targetView: 'reports', reportTab: 'etlab', label: 'ENT Lab Report', icon: SIDEBAR_ICONS.reportEtLab, moduleKey: 'et_lab' },
    { id: 'sub-report-pm', targetView: 'reports', reportTab: 'preventive', label: 'PM Report & Print', icon: SIDEBAR_ICONS.reportPm, moduleKey: 'preventive_maintenance' },
    { id: 'sub-report-export', targetView: 'reports', reportTab: 'export', label: 'Excel Export Center', icon: SIDEBAR_ICONS.reportExport, moduleKey: 'reports' }
  ].filter(it => authService.isAdmin() || (authService.isModuleAllowed('reports') && (it.moduleKey === 'reports' || authService.isModuleAllowed(it.moduleKey))));

  // 5. SYSTEM & ADMINISTRATION SECTION
  const adminMenuItems = [
    { id: 'adm-users', targetView: 'users', moduleKey: 'user_management', label: 'User Access Management', icon: SIDEBAR_ICONS.admUsers },
    { id: 'adm-master-data', targetView: 'master-data', moduleKey: 'master_data', label: 'Plant Hierarchy & Master Data', icon: SIDEBAR_ICONS.admMasterData },
    { id: 'adm-storage', targetView: 'storage', moduleKey: 'storage', label: 'Master Storage & Rules', icon: SIDEBAR_ICONS.admStorage },
    { id: 'adm-transfer-config', targetView: 'transfer-workflows', moduleKey: 'transfer_workflows', label: 'Transfer Workflows', icon: SIDEBAR_ICONS.admTransferConfig },
    { id: 'adm-excel-config', targetView: 'excel-manager', moduleKey: 'excel_manager', label: 'Excel Templates & Structure', icon: SIDEBAR_ICONS.admExcelConfig },
    { id: 'adm-email-config', targetView: 'email-config', moduleKey: 'email_config', label: 'Email Configuration', icon: SIDEBAR_ICONS.admEmailConfig },
    { id: 'adm-homepage', targetView: 'homepage-manager', moduleKey: 'homepage_management', label: 'Home Page Management', icon: SIDEBAR_ICONS.admHomepage },
    { id: 'adm-activity-logs', targetView: 'audit-logs', moduleKey: 'audit_logs', label: 'Activity & Audit Logs', icon: SIDEBAR_ICONS.admLogs },
    { id: 'adm-database', targetView: 'database-config', moduleKey: 'settings', label: 'Data Engine', icon: SIDEBAR_ICONS.admDatabase },
    { id: 'adm-settings', targetView: 'settings', moduleKey: 'settings', label: 'System Settings', icon: SIDEBAR_ICONS.admSettings }
  ];

  const allowedAdminItems = adminMenuItems.filter(it =>
    authService.isAdmin() || authService.isModuleAllowed(it.moduleKey || it.targetView)
  );

  const hasAnyAllowedSections = (authService.isModuleAllowed('dashboard') || machineItems.length > 0) ||
                                (specializedFeatures.length > 0) ||
                                ((authService.isAdmin() || authService.isModuleAllowed('manpower')) && workforceItems.length > 0) ||
                                (isReportsAllowed && reportItems.length > 0) ||
                                (allowedAdminItems.length > 0);
  const isNoAccessUser = user?.role === 'NO_ACCESS' || user?.roleId === 'role-no-access' || (!hasAnyAllowedSections && !isAdmin && !isSuperAdmin);
  const isMini = (typeof localStorage !== 'undefined' && 
    (localStorage.getItem('al_muslim_sidebar_mini') === 'true' || localStorage.getItem('al_muslim_sidebar_hidden') === 'true') && 
    (typeof window !== 'undefined' && window.innerWidth > 768));

  let html = `
    <aside class="app-sidebar" id="app-sidebar-root">
      <!-- Fixed Sidebar Brand Header -->
      <div class="sidebar-header" style="padding: 14px 14px 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #0c1222; flex-shrink: 0; box-sizing: border-box; width: 100%; gap: 10px;">
        <div class="sidebar-brand-wrapper" style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
          <div class="brand-logo-badge" title="Al-Muslim Group Maintenance Department ERP" style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(56, 189, 248, 0.35); box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);">${SIDEBAR_ICONS.brandLogo}</div>
          <div class="brand-text-container" style="min-width: 0; flex: 1; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
              <span class="brand-text-title" style="font-weight: 700; font-size: 14px; color: #ffffff; letter-spacing: -0.2px; white-space: nowrap;">Al-Muslim Group</span>
            </div>
            <div class="brand-text-sub" style="font-size: 10.5px; color: #94a3b8; font-weight: 500; margin-top: 2px; white-space: nowrap; letter-spacing: 0.1px;" title="Maintenance Department ERP">
              Maintenance ERP
            </div>
          </div>
        </div>
        <!-- Desktop Collapse / Expand Toggle Button (< / >) -->
        <button id="btn-sidebar-collapse" class="btn-sidebar-collapse" aria-label="Toggle Sidebar Compact Mode" title="${isMini ? 'Expand Sidebar (>)' : 'Collapse Sidebar (<)'}" style="margin-left: auto;">
          ${SIDEBAR_ICONS.arrowCollapse}
        </button>
        <button id="btn-sidebar-mobile-close" class="btn-sidebar-mobile-close" aria-label="Close navigation" title="Close navigation menu">✕</button>
      </div>

      <!-- Quick Search / Filter Bar -->
      <div class="sidebar-search-box">
        <div class="sidebar-search-inner">
          <span class="sidebar-search-icon">${SIDEBAR_ICONS.search}</span>
          <input 
            type="text" 
            id="sidebar-menu-search" 
            class="sidebar-search-input" 
            placeholder="Quick find menu... (Ctrl+K)" 
            autocomplete="off"
            spellcheck="false"
          />
          <button id="sidebar-search-clear" class="sidebar-search-clear" title="Clear search">✕</button>
        </div>
      </div>

      <!-- Scrollable Navigation Area -->
      <nav class="sidebar-menu" id="sidebar-menu-scrollable">
        ${isNoAccessUser && !isAdmin && !isSuperAdmin ? `
          <div style="padding: 24px 16px; text-align: center; background: rgba(239, 68, 68, 0.05); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 12px; margin: 12px 10px;">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: #f87171;">
              ${SIDEBAR_ICONS.lock}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #f87171; margin-bottom: 6px;">Zero Permissions</div>
            <p style="font-size: 11.5px; color: #94a3b8; line-height: 1.4; margin: 0 0 14px 0;">This account is awaiting administrative privilege assignment in User Access Management.</p>
            <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; font-size: 10px; font-weight: 800; letter-spacing: 0.5px;">DEFAULT NO ACCESS</span>
          </div>
        ` : ''}
        
        <!-- SECTION 1: OPERATIONS & MACHINERY -->
        ${(authService.isModuleAllowed('dashboard') || machineItems.length > 0) ? `
          <div class="menu-category-section" id="sec-operations">
            <div class="menu-category-header">
              <span class="menu-category-title">OPERATIONS & MACHINERY</span>
              <div class="menu-category-line"></div>
            </div>
            ${authService.isModuleAllowed('dashboard') ? renderDirectItem(dashboardItem) : ''}
            ${machineItems.length > 0 ? renderNavGroup({
              id: 'group-machines',
              label: 'Machine Operations',
              icon: SIDEBAR_ICONS.machines,
              items: machineItems
            }) : ''}
          </div>
        ` : ''}

        <!-- SECTION 2: SPECIALIZED UNITS (Individual Feature Access) -->
        ${specializedFeatures.length > 0 ? `
          <div class="menu-category-section" id="sec-specialized">
            <div class="menu-category-header">
              <span class="menu-category-title">SPECIALIZED UNITS</span>
              <div class="menu-category-line"></div>
            </div>
            ${specializedFeatures.map(feat => renderDirectItem(feat)).join('')}
          </div>
        ` : ''}

        <!-- SECTION 3: WORKFORCE & HR -->
        ${(authService.isAdmin() || authService.isModuleAllowed('manpower')) && workforceItems.length > 0 ? `
          <div class="menu-category-section" id="sec-workforce">
            <div class="menu-category-header">
              <span class="menu-category-title">WORKFORCE & HR</span>
              <div class="menu-category-line"></div>
            </div>
            ${renderNavGroup({
              id: 'group-manpower',
              label: 'Manpower Management',
              icon: SIDEBAR_ICONS.manpower,
              items: workforceItems
            })}
          </div>
        ` : ''}

        <!-- SECTION 4: REPORTS & ANALYTICS -->
        ${isReportsAllowed && reportItems.length > 0 ? `
          <div class="menu-category-section" id="sec-reports">
            <div class="menu-category-header">
              <span class="menu-category-title">REPORTS & ANALYTICS</span>
              <div class="menu-category-line"></div>
            </div>
            ${renderNavGroup({
              id: 'group-reports',
              label: 'Reports & Analytics',
              icon: SIDEBAR_ICONS.reports,
              items: reportItems
            })}
          </div>
        ` : ''}

        <!-- SECTION 5: SYSTEM & ADMINISTRATION -->
        ${allowedAdminItems.length > 0 ? `
          <div class="menu-category-section" id="sec-admin">
            <div class="menu-category-header">
              <span class="menu-category-title">SYSTEM & ADMINISTRATION</span>
              <div class="menu-category-line"></div>
            </div>
            ${renderNavGroup({
              id: 'group-admin',
              label: 'System Administration',
              icon: SIDEBAR_ICONS.admin,
              items: allowedAdminItems
            })}
          </div>
        ` : ''}

      </nav>

      <!-- User Profile Footer Card -->
      <div class="sidebar-footer" id="btn-sidebar-user-profile" style="cursor: pointer;" title="Click to view profile or change password">
        <div class="user-avatar-circle">
          ${user?.name?.charAt(0)?.toUpperCase() || 'U'}
          <span class="user-avatar-status"></span>
        </div>
        <div style="overflow: hidden; flex: 1; min-width: 0;">
          <div style="font-size: 12px; font-weight: 700; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
            ${user?.name || 'Authorized User'}
          </div>
          <div style="margin-top: 2px;">
            ${isSuperAdmin 
              ? `<span class="user-role-badge admin"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>Super Admin</span>`
              : isAdmin 
                ? `<span class="user-role-badge admin"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Admin</span>`
                : (isNoAccessUser 
                  ? `<span class="user-role-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>No Access</span>`
                  : `<span class="user-role-badge operator"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${user?.presetName || (user?.role === 'USER' ? 'Maintenance User' : (user?.role || 'User'))}</span>`
                )
            }
          </div>
        </div>
        <span style="font-size: 14px; opacity: 0.7; color: #94a3b8; display: flex; align-items: center; justify-content: center;" title="Security Settings">${SIDEBAR_ICONS.lock}</span>
      </div>
    </aside>
  `;

  return html;
}

export function initSidebarEvents() {
  const sidebar = document.getElementById('app-sidebar-root');
  if (!sidebar) return;

  // 1. Accordion Group Expand / Collapse Toggle & Instant Child Pre-warming
  sidebar.querySelectorAll('[data-group-toggle]').forEach(header => {
    const groupId = header.getAttribute('data-group-toggle');

    const warmAccordionChildren = () => {
      const submenu = document.getElementById(`submenu-${groupId}`);
      if (submenu) {
        submenu.querySelectorAll('[data-view]').forEach(childEl => {
          const cv = childEl.getAttribute('data-view');
          if (cv) moduleLoader.prefetch(cv, true);
        });
      }
    };

    // Pre-warm child modules on header hover and touch before the user even clicks a child item
    header.addEventListener('pointerenter', warmAccordionChildren, { passive: true });
    header.addEventListener('touchstart', warmAccordionChildren, { passive: true });

    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      warmAccordionChildren();
      const submenu = document.getElementById(`submenu-${groupId}`);
      const chevron = document.getElementById(`chevron-${groupId}`);

      if (!submenu) return;

      const expandedGroups = getExpandedGroups();
      const isCurrentlyCollapsed = submenu.classList.contains('collapsed') || !submenu.classList.contains('expanded');

      if (isCurrentlyCollapsed) {
        submenu.classList.remove('collapsed');
        submenu.classList.add('expanded');
        if (chevron) chevron.classList.add('expanded');
        expandedGroups.add(groupId);
      } else {
        submenu.classList.remove('expanded');
        submenu.classList.add('collapsed');
        if (chevron) chevron.classList.remove('expanded');
        expandedGroups.delete(groupId);
      }

      saveExpandedGroups(expandedGroups);
    });
  });

  // 2. Navigation Actions & Sub-item Click Handlers
  sidebar.addEventListener('click', (e) => {
    const el = e.target.closest('.nav-item, .nav-subitem');
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();

    const view = el.getAttribute('data-view');
    const subId = el.getAttribute('data-sub-id') || el.id?.replace('nav-subitem-', '');
    const reportTab = el.getAttribute('data-report-tab');
    const mpTab = el.getAttribute('data-manpower-tab');
    const userTab = el.getAttribute('data-user-tab');
    const pmTab = el.getAttribute('data-pm-tab');
    const curView = state.get('currentView');

    // Close mobile sidebar drawer if open
    if (window.innerWidth <= 992) {
      const appContainer = document.querySelector('.app-container');
      if (appContainer && appContainer.classList.contains('sidebar-mobile-open')) {
        appContainer.classList.remove('sidebar-mobile-open');
      }
    }

    // Set child tabs before view transition
    if (reportTab) {
      state.set('reportActiveTab', reportTab);
    }
    if (mpTab) {
      state.set('manpowerActiveTab', mpTab);
    }
    if (userTab) {
      state.set('userAccessActiveTab', userTab);
    }
    if (pmTab) {
      state.set('pmActiveTab', pmTab);
    }

    if (view) {
      const tab = reportTab || mpTab || userTab || pmTab || null;
      updateSidebarActiveState(view, subId);
      router.navigate(view, { tab });
    }
  });

  // 2.1 Intelligent Immediate Module Warmup (0ms instant transition preparation)
  sidebar.querySelectorAll('.nav-item, .nav-subitem').forEach(itemEl => {
    const v = itemEl.getAttribute('data-view');
    if (v) {
      itemEl.addEventListener('pointerenter', () => {
        moduleLoader.prefetch(v, true);
      }, { passive: true });
      itemEl.addEventListener('touchstart', () => {
        moduleLoader.prefetch(v, true);
      }, { passive: true });
      itemEl.addEventListener('pointerdown', () => {
        moduleLoader.prefetch(v, true);
      }, { passive: true });
    }
  });

  // 3. Quick Search / Filter Input
  const searchInput = document.getElementById('sidebar-menu-search');
  const searchClearBtn = document.getElementById('sidebar-search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = (e.target.value || '').toLowerCase().trim();
      if (searchClearBtn) {
        searchClearBtn.style.display = query ? 'flex' : 'none';
      }

      const items = sidebar.querySelectorAll('.nav-item, .nav-subitem');
      const groups = sidebar.querySelectorAll('.nav-group');
      const sections = sidebar.querySelectorAll('.menu-category-section');

      if (!query) {
        // Reset filter: restore all
        items.forEach(el => el.classList.remove('nav-filtered-out'));
        groups.forEach(el => el.classList.remove('nav-filtered-out'));
        sections.forEach(el => el.classList.remove('nav-filtered-out'));

        // Restore saved expanded accordion states
        const expandedGroups = getExpandedGroups();
        groups.forEach(group => {
          const gid = group.getAttribute('data-group-id');
          const submenu = document.getElementById(`submenu-${gid}`);
          const chevron = document.getElementById(`chevron-${gid}`);
          if (expandedGroups.has(gid)) {
            submenu?.classList.add('expanded');
            submenu?.classList.remove('collapsed');
            chevron?.classList.add('expanded');
          } else {
            submenu?.classList.remove('expanded');
            submenu?.classList.add('collapsed');
            chevron?.classList.remove('expanded');
          }
        });
        return;
      }

      // Filter subitems & direct items
      items.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes(query)) {
          el.classList.remove('nav-filtered-out');
        } else {
          el.classList.add('nav-filtered-out');
        }
      });

      // Filter groups
      groups.forEach(group => {
        const gid = group.getAttribute('data-group-id');
        const submenu = document.getElementById(`submenu-${gid}`);
        const chevron = document.getElementById(`chevron-${gid}`);
        const visibleChildren = group.querySelectorAll('.nav-subitem:not(.nav-filtered-out)');
        const groupTitle = group.querySelector('.nav-group-title')?.textContent.toLowerCase() || '';

        if (visibleChildren.length > 0 || groupTitle.includes(query)) {
          group.classList.remove('nav-filtered-out');
          // Auto-expand during search
          submenu?.classList.add('expanded');
          submenu?.classList.remove('collapsed');
          chevron?.classList.add('expanded');
          if (groupTitle.includes(query)) {
            group.querySelectorAll('.nav-subitem').forEach(sub => sub.classList.remove('nav-filtered-out'));
          }
        } else {
          group.classList.add('nav-filtered-out');
        }
      });

      // Filter category sections
      sections.forEach(sec => {
        const visibleInSec = sec.querySelectorAll('.nav-item:not(.nav-filtered-out), .nav-group:not(.nav-filtered-out)');
        if (visibleInSec.length > 0) {
          sec.classList.remove('nav-filtered-out');
        } else {
          sec.classList.add('nav-filtered-out');
        }
      });
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus({ preventScroll: true });
      });
    }

    // Hotkey: Ctrl+K or Cmd+K to focus search; Escape to clear
    const handleSearchHotkeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus({ preventScroll: true });
        searchInput.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.blur();
      }
    };

    document.removeEventListener('keydown', handleSearchHotkeys);
    document.addEventListener('keydown', handleSearchHotkeys);
  }

  // 4. Desktop Sidebar Collapse / Expand Toggle (< / >)
  const desktopCollapseBtn = document.getElementById('btn-sidebar-collapse');
  if (desktopCollapseBtn && !desktopCollapseBtn._hasCollapseListener) {
    desktopCollapseBtn._hasCollapseListener = true;
    desktopCollapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const appContainer = document.querySelector('.app-container');
      if (!appContainer) return;

      const isMini = appContainer.classList.toggle('sidebar-mini');
      appContainer.classList.toggle('sidebar-hidden', isMini);
      try {
        localStorage.setItem('al_muslim_sidebar_mini', isMini ? 'true' : 'false');
        localStorage.setItem('al_muslim_sidebar_hidden', isMini ? 'true' : 'false');
      } catch (_) {}

      desktopCollapseBtn.setAttribute('title', isMini ? 'Expand Sidebar (>)' : 'Collapse Sidebar (<)');
      const topToggleBtn = document.getElementById('btn-sidebar-toggle');
      if (topToggleBtn) {
        topToggleBtn.setAttribute('title', isMini ? 'Expand Sidebar' : 'Collapse Sidebar');
      }

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    });
  }

  // 4.1 Mini mode search box click auto-expands
  const searchBox = sidebar.querySelector('.sidebar-search-box');
  if (searchBox && !searchBox._hasMiniExpandListener) {
    searchBox._hasMiniExpandListener = true;
    searchBox.addEventListener('click', () => {
      const appContainer = document.querySelector('.app-container');
      if (appContainer && appContainer.classList.contains('sidebar-mini')) {
        appContainer.classList.remove('sidebar-mini');
        appContainer.classList.remove('sidebar-hidden');
        try {
          localStorage.setItem('al_muslim_sidebar_mini', 'false');
          localStorage.setItem('al_muslim_sidebar_hidden', 'false');
        } catch (_) {}
        if (desktopCollapseBtn) {
          desktopCollapseBtn.setAttribute('title', 'Collapse Sidebar (<)');
        }
        setTimeout(() => {
          const input = document.getElementById('sidebar-menu-search');
          if (input) input.focus();
          window.dispatchEvent(new Event('resize'));
        }, 300);
      }
    });
  }

  // 5. Mobile sidebar close button
  const mobileCloseBtn = document.getElementById('btn-sidebar-mobile-close');
  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', () => {
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.remove('sidebar-mobile-open');
      }
    });
  }

  // 5. User Profile Footer Click
  const footerProfile = document.getElementById('btn-sidebar-user-profile');
  if (footerProfile) {
    footerProfile.addEventListener('click', () => {
      state.set('activeModal', 'change-password');
    });
  }
}

/**
 * Updates sidebar active classes in-place without destroying DOM or resetting scroll position
 */
export function updateSidebarActiveState(currentView, activeSubId = null) {
  const activeReportTab = state.get('reportActiveTab') || 'machines';
  const activeManpowerTab = state.get('manpowerActiveTab') || 'active';
  const activePmTab = state.get('pmActiveTab') || 'dashboard';

  // Update direct items
  document.querySelectorAll('.nav-item').forEach(el => {
    const isTarget = el.getAttribute('data-view') === currentView;
    if (isTarget) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update subitems
  document.querySelectorAll('.nav-subitem').forEach(el => {
    const subId = el.getAttribute('data-sub-id') || el.id.replace('nav-subitem-', '');
    const view = el.getAttribute('data-view');
    const reportTab = el.getAttribute('data-report-tab');
    const mpTab = el.getAttribute('data-manpower-tab');
    const pmTab = el.getAttribute('data-pm-tab');

    let isActive = false;
    if (view === currentView) {
      if (currentView === 'reports') {
        isActive = (reportTab === activeReportTab);
      } else if (currentView === 'manpower') {
        isActive = (mpTab === activeManpowerTab);
      } else if (currentView === 'preventive-maintenance') {
        isActive = pmTab ? (pmTab === activePmTab) : (!activePmTab || activePmTab === 'dashboard');
      } else if (activeSubId) {
        isActive = (subId === activeSubId || el.id === `nav-subitem-${activeSubId}`);
      } else {
        isActive = true;
      }
    }

    if (isActive) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update parent group headers and auto-expand active group
  document.querySelectorAll('.nav-group').forEach(groupEl => {
    const groupId = groupEl.getAttribute('data-group-id');
    const header = groupEl.querySelector('.nav-group-header');
    const hasActiveChild = groupEl.querySelector('.nav-subitem.active') !== null;

    if (header) {
      if (hasActiveChild) {
        header.classList.add('parent-active');
        const submenu = document.getElementById(`submenu-${groupId}`);
        const chevron = document.getElementById(`chevron-${groupId}`);
        if (submenu && submenu.classList.contains('collapsed')) {
          submenu.classList.remove('collapsed');
          submenu.classList.add('expanded');
          if (chevron) chevron.classList.add('expanded');
          const expandedGroups = getExpandedGroups();
          expandedGroups.add(groupId);
          saveExpandedGroups(expandedGroups);
        }
      } else {
        header.classList.remove('parent-active');
      }
    }
  });
}
