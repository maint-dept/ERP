/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Ultra-Responsive Native Mobile Bottom Navigation Bar
 * Optimized for One-Handed Factory Floor Operation (Thumb-Friendly, 60-120fps)
 */

import { router } from '../services/router.js?v=4.46.0';
import { state } from '../state.js?v=4.46.0';
import { authService } from '../services/authService.js?v=4.46.0';
import { moduleLoader } from '../services/moduleLoader.js?v=4.46.0';
import { renderQrScannerModal, initQrScannerModalEvents, playScanBeep } from './qrScannerModal.js?v=4.46.0';
import { openSmartMachineActionModal } from './smartSearchActionModal.js?v=4.46.0';

export function renderMobileBottomNav(currentView = null) {
  const user = authService.getCurrentUser();
  if (!user || user.status !== 'ACTIVE' || user.role === 'NO_ACCESS') {
    return '';
  }

  const cv = currentView || state.get('currentView') || 'dashboard';

  // Exclude on login, public homepage, or print modes
  if (['login', 'admin-login', 'secure-admin-gateway', 'home'].includes(cv)) {
    return '';
  }

  const canInventory = authService.isViewAllowed('inventory', user);
  const canRelocate = authService.isViewAllowed('relocate', user);
  const canTransfers = authService.isViewAllowed('transfers', user);

  // Fallbacks if user lacks access to specific views
  const primaryView1 = canInventory ? 'inventory' : (canTransfers ? 'transfers' : 'dashboard');
  const primaryLabel1 = canInventory ? 'Inventory' : (canTransfers ? 'Transfers' : 'Dashboard');
  const primaryIcon1 = canInventory ? '📦' : (canTransfers ? '🔄' : '📊');

  const primaryView2 = canRelocate ? 'relocate' : (canTransfers ? 'transfers' : 'qr-codes');
  const primaryLabel2 = canRelocate ? 'Relocate' : (canTransfers ? 'Transfers' : 'QR Codes');
  const primaryIcon2 = canRelocate ? '🔄' : (canTransfers ? '🚚' : '🏷️');

  return `
    <div class="mobile-bottom-nav-inner">
      <!-- 1. Dashboard -->
      <button type="button" class="mobile-bottom-nav-item ${cv === 'dashboard' ? 'active' : ''}" data-nav-view="dashboard" title="Dashboard">
        <span class="mobile-bottom-nav-icon">📊</span>
        <span class="mobile-bottom-nav-label">Dashboard</span>
      </button>

      <!-- 2. Primary 1: Machine Inventory -->
      <button type="button" class="mobile-bottom-nav-item ${cv === primaryView1 ? 'active' : ''}" data-nav-view="${primaryView1}" title="${primaryLabel1}">
        <span class="mobile-bottom-nav-icon">${primaryIcon1}</span>
        <span class="mobile-bottom-nav-label">${primaryLabel1}</span>
      </button>

      <!-- 3. Center Highlight: Instant Camera QR Scanner -->
      <button type="button" class="mobile-bottom-nav-item mobile-bottom-nav-scanner" id="btn-mobile-nav-qr" title="Scan Machine QR Code">
        <div class="mobile-nav-scanner-circle">
          <span class="mobile-bottom-nav-icon scanner-icon">📷</span>
        </div>
        <span class="mobile-bottom-nav-label" style="margin-top: 2px;">Scan QR</span>
      </button>

      <!-- 4. Primary 2: Relocate / Movement -->
      <button type="button" class="mobile-bottom-nav-item ${cv === primaryView2 ? 'active' : ''}" data-nav-view="${primaryView2}" title="${primaryLabel2}">
        <span class="mobile-bottom-nav-icon">${primaryIcon2}</span>
        <span class="mobile-bottom-nav-label">${primaryLabel2}</span>
      </button>

      <!-- 5. Menu Drawer Toggle -->
      <button type="button" class="mobile-bottom-nav-item" id="btn-mobile-nav-menu" title="Open Full Menu">
        <span class="mobile-bottom-nav-icon">☰</span>
        <span class="mobile-bottom-nav-label">Menu</span>
      </button>
    </div>
  `;
}

export function initMobileBottomNavEvents() {
  const container = document.getElementById('mobile-bottom-nav');
  if (!container) return;

  // View Navigation buttons
  container.querySelectorAll('.mobile-bottom-nav-item[data-nav-view]').forEach(btn => {
    const targetView = btn.getAttribute('data-nav-view');

    // Instant warmup on touch/pointerdown (starts download 100ms before click finishes)
    btn.addEventListener('pointerdown', () => {
      if (typeof moduleLoader !== 'undefined') {
        moduleLoader.prefetch(targetView, true);
      }
    }, { passive: true });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Close sidebar drawer if open
      document.querySelector('.app-container')?.classList.remove('sidebar-mobile-open');

      if (window.app && typeof window.app.switchView === 'function') {
        window.app.switchView(targetView);
      } else {
        router.navigate(targetView);
      }
      updateMobileBottomNavActiveState(targetView);
    });
  });

  // QR Scanner Button
  const btnQr = document.getElementById('btn-mobile-nav-qr');
  if (btnQr && !btnQr._bound) {
    btnQr._bound = true;
    btnQr.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.app-container')?.classList.remove('sidebar-mobile-open');
      openMobileQrScanner();
    });
  }

  // Menu Drawer Button
  const btnMenu = document.getElementById('btn-mobile-nav-menu');
  if (btnMenu && !btnMenu._bound) {
    btnMenu._bound = true;
    btnMenu.addEventListener('click', (e) => {
      e.preventDefault();
      const appContainer = document.querySelector('.app-container');
      if (appContainer) {
        appContainer.classList.toggle('sidebar-mobile-open');
      }
    });
  }
}

function openMobileQrScanner() {
  const modalContainer = document.getElementById('modal-container') || document.body;
  const existing = document.getElementById('modal-qr-scanner-overlay');
  if (existing) existing.remove();

  modalContainer.insertAdjacentHTML('beforeend', renderQrScannerModal());
  initQrScannerModalEvents({
    onScanSuccess: (decodedText) => {
      playScanBeep('success');
      openSmartMachineActionModal(decodedText);
    }
  });
}

export function updateMobileBottomNavActiveState(currentView) {
  const cv = currentView || state.get('currentView') || 'dashboard';
  document.querySelectorAll('.mobile-bottom-nav-item[data-nav-view]').forEach(item => {
    const view = item.getAttribute('data-nav-view');
    item.classList.toggle('active', view === cv);
  });
}
