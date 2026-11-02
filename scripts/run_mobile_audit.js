const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.join(__dirname, '..', 'audit_evidence', 'before');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: '320px', width: 320, height: 640 },
  { name: '360px', width: 360, height: 740 },
  { name: '375px', width: 375, height: 812 },
  { name: '390px', width: 390, height: 844 },
  { name: '412px', width: 412, height: 915 },
  { name: '430px', width: 430, height: 932 },
  { name: '480px', width: 480, height: 854 }
];

const VIEWS_TO_AUDIT = [
  'dashboard',
  'inventory',
  'relocate',
  'needle-operations',
  'qr-codes',
  'transfers',
  'transfer-workflows',
  'parts-trace',
  'machine-history',
  'preventive-maintenance',
  'reports',
  'resource-library',
  'excel-manager',
  'custom-fields',
  'et-lab',
  'spare-parts',
  'tools-management',
  'storage',
  'manpower',
  'master-data',
  'users',
  'homepage-manager',
  'email-config',
  'audit-logs',
  'settings',
  'database-config',
  'home',
  'login',
  'admin-login'
];

async function runAudit() {
  console.log('🚀 Starting Comprehensive Mobile Responsiveness Audit on Headless Chromium...');
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // Handle dialogs
  page.on('dialog', async dialog => {
    try { await dialog.dismiss(); } catch (_) {}
  });

  // Navigate to root to set localStorage authentication
  await page.goto('https://127.0.0.1/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('al_muslim_active_user_id', 'usr-super-admin');
    localStorage.setItem('al_muslim_theme', 'dark');
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForTimeout(1500);

  const auditResults = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.map(v => v.name),
    viewsAudited: [],
    modalsAudited: [],
    issues: []
  };

  // 1. AUDIT EACH VIEW
  console.log('\n--- AUDITING VIEWS ACROSS MOBILE VIEWPORTS ---');
  for (const view of VIEWS_TO_AUDIT) {
    console.log(`\nAuditing View: [${view}]`);
    const viewMetrics = { view, viewports: {} };

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      // Navigate to route
      await page.evaluate((targetView) => {
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate(targetView);
        } else if (window.state) {
          window.state.set('currentView', targetView);
        }
      }, view);

      await page.waitForTimeout(800);

      // Analyze page metrics
      const metrics = await page.evaluate((vpWidth) => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const hasHorizontalOverflow = scrollWidth > (vpWidth + 2); // 2px tolerance for rounding
        const overflowDelta = scrollWidth - vpWidth;

        // Find overflowing elements
        const overflowingElements = [];
        const allElements = document.querySelectorAll('#main-view-container *, .app-header *, .app-container *');
        allElements.forEach(el => {
          if (!el.getBoundingClientRect) return;
          const rect = el.getBoundingClientRect();
          if (rect.right > (vpWidth + 3) && rect.width > 0 && rect.height > 0) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              const tag = el.tagName.toLowerCase();
              const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
              const id = el.id ? `#${el.id}` : '';
              overflowingElements.push({
                selector: `${tag}${id}${cls ? '.' + cls : ''}`,
                rectRight: Math.round(rect.right),
                rectWidth: Math.round(rect.width),
                overflowPx: Math.round(rect.right - vpWidth)
              });
            }
          }
        });

        // Check buttons with small touch target (<32px height or width)
        const smallButtons = [];
        const buttons = document.querySelectorAll('button, .btn, a.btn, input[type="button"], input[type="submit"]');
        buttons.forEach(btn => {
          if (!btn.getBoundingClientRect) return;
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.width < 28 || rect.height < 28)) {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              smallButtons.push({
                text: (btn.innerText || btn.value || btn.title || 'button').slice(0, 20),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              });
            }
          }
        });

        // Header check
        const header = document.querySelector('.app-header');
        let headerOverflow = false;
        if (header) {
          const hRect = header.getBoundingClientRect();
          headerOverflow = header.scrollWidth > header.clientWidth;
        }

        return {
          scrollWidth,
          hasHorizontalOverflow,
          overflowDelta,
          overflowingElements: overflowingElements.slice(0, 8),
          smallButtonsCount: smallButtons.length,
          headerOverflow
        };
      }, vp.width);

      viewMetrics.viewports[vp.name] = metrics;

      if (metrics.hasHorizontalOverflow) {
        auditResults.issues.push({
          type: 'HORIZONTAL_OVERFLOW',
          priority: metrics.overflowDelta > 30 ? 'HIGH' : 'MEDIUM',
          view,
          viewport: vp.name,
          overflowDelta: metrics.overflowDelta,
          details: `View [${view}] overflows viewport (${vp.name}) by ${metrics.overflowDelta}px. Elements: ` +
            metrics.overflowingElements.map(e => `${e.selector} (+${e.overflowPx}px)`).join(', ')
        });
      }

      // Capture screenshot for key viewports: 360px and 412px
      if (vp.name === '360px' || vp.name === '412px') {
        const screenshotPath = path.join(EVIDENCE_DIR, `view_${view}_${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    }

    auditResults.viewsAudited.push(viewMetrics);
    console.log(`  ✓ ${view}: 360px overflow=${viewMetrics.viewports['360px'].hasHorizontalOverflow ? 'YES (' + viewMetrics.viewports['360px'].overflowDelta + 'px)' : 'NO'}`);
  }

  // 2. AUDIT MODALS & POPUPS
  console.log('\n--- AUDITING POPUPS & MODALS ---');
  const MODALS_TO_AUDIT = [
    { id: 'mobile-sidebar', trigger: async () => {
        const btn = await page.$('.btn-mobile-sidebar-toggle');
        if (btn) await btn.click();
      }, close: async () => {
        const backdrop = await page.$('#sidebar-backdrop');
        if (backdrop) await backdrop.click();
      }
    },
    { id: 'notifications-drawer', trigger: async () => {
        await page.evaluate(() => { window.state.set('activeModal', 'notifications'); });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'account-switcher', trigger: async () => {
        await page.evaluate(() => { window.state.set('activeModal', 'account-switcher'); });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'change-password', trigger: async () => {
        await page.evaluate(() => { window.state.set('activeModal', 'change-password'); });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'add-machine-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'inventory');
          window.state.set('activeModal', 'add-machine');
        });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'machine-details-modal', trigger: async () => {
        await page.evaluate(() => {
          const machines = window.state.get('machines') || [];
          if (machines.length > 0) {
            window.state.set('selectedMachine', machines[0]);
            window.state.set('activeModal', 'machine-details');
          }
        });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'transfer-machine-modal', trigger: async () => {
        await page.evaluate(() => {
          const machines = window.state.get('machines') || [];
          if (machines.length > 0) {
            window.state.set('selectedMachine', machines[0]);
            window.state.set('activeModal', 'transfer-machine');
          }
        });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'excel-import-modal', trigger: async () => {
        await page.evaluate(() => { window.state.set('activeModal', 'import-excel'); });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'column-visibility-modal', trigger: async () => {
        await page.evaluate(() => { window.state.set('activeModal', 'column-visibility'); });
      }, close: async () => {
        await page.evaluate(() => { window.state.set('activeModal', null); });
      }
    },
    { id: 'quick-help-modal', trigger: async () => {
        await page.evaluate(() => {
          if (typeof window.showQuickHelpModal === 'function') {
            window.showQuickHelpModal();
          } else {
            const btn = document.getElementById('btn-header-help');
            if (btn) btn.click();
          }
        });
      }, close: async () => {
        await page.evaluate(() => {
          const closeBtn = document.querySelector('.modal-overlay .btn-close, .modal-overlay [data-close], #btn-close-help');
          if (closeBtn) closeBtn.click();
          else window.state.set('activeModal', null);
        });
      }
    },
    { id: 'add-user-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'users');
        });
        await new Promise(r => setTimeout(r, 600));
        await page.evaluate(() => {
          const btn = document.querySelector('#btn-add-user, .btn-uam-add-user, [data-action="add-user"]');
          if (btn) btn.click();
          else if (window.uamShowAddUserModal) window.uamShowAddUserModal();
        });
      }, close: async () => {
        await page.evaluate(() => {
          const closeBtn = document.querySelector('#user-modal-layer .btn-close, #user-modal-layer .btn-secondary');
          if (closeBtn) closeBtn.click();
        });
      }
    },
    { id: 'tools-add-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'tools-management');
        });
        await new Promise(r => setTimeout(r, 600));
        await page.evaluate(() => {
          const btn = document.querySelector('#btn-tools-add-item, .btn-add-tool');
          if (btn) btn.click();
        });
      }, close: async () => {
        await page.evaluate(() => {
          const closeBtn = document.querySelector('#tools-modal-layer .btn-close, #tools-modal-layer [onclick*="close"]');
          if (closeBtn) closeBtn.click();
        });
      }
    },
    { id: 'pm-add-schedule-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'preventive-maintenance');
        });
        await new Promise(r => setTimeout(r, 600));
        await page.evaluate(() => {
          const btn = document.querySelector('#btn-pm-add-plan, #btn-add-pm-schedule, [data-action="add-pm"]');
          if (btn) btn.click();
        });
      }, close: async () => {
        await page.evaluate(() => {
          const closeBtn = document.querySelector('#pm-modal-layer .btn-close, .pm-modal .btn-close');
          if (closeBtn) closeBtn.click();
        });
      }
    },
    { id: 'storage-add-machine-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'storage');
        });
        await new Promise(r => setTimeout(r, 600));
        await page.evaluate(() => {
          const btn = document.querySelector('#btn-storage-add-machine, [data-action="add-storage-machine"]');
          if (btn) btn.click();
        });
      }, close: async () => {
        await page.evaluate(() => {
          const closeBtn = document.querySelector('#storage-modal-layer .btn-close');
          if (closeBtn) closeBtn.click();
        });
      }
    },
    { id: 'et-lab-add-board-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'et-lab');
        });
        await new Promise(r => setTimeout(r, 600));
        await page.evaluate(() => {
          const btn = document.querySelector('#btn-et-add-board, [data-action="add-board"]');
          if (btn) btn.click();
        });
      }, close: async () => {
        await page.evaluate(() => {
          const closeBtn = document.querySelector('.modal-overlay .btn-close');
          if (closeBtn) closeBtn.click();
        });
      }
    }
  ];

  for (const modal of MODALS_TO_AUDIT) {
    console.log(`Auditing Modal/Popup: [${modal.id}]`);
    await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });
    
    try {
      await modal.trigger();
      await page.waitForTimeout(600);

      // Check modal metrics
      const modalMetrics = await page.evaluate((vpWidth, vpHeight) => {
        const dialog = document.querySelector('.modal-dialog, .modal-card, .sidebar-drawer, .notifications-drawer, .modal-overlay > div, #sidebar-container');
        if (!dialog) return { found: false };

        const rect = dialog.getBoundingClientRect();
        const header = dialog.querySelector('.modal-header, .drawer-header');
        const body = dialog.querySelector('.modal-body, .drawer-body, form');
        const footer = dialog.querySelector('.modal-footer, .drawer-footer');

        const fitsHorizontally = rect.right <= (vpWidth + 4) && rect.left >= -4;
        const fitsVertically = rect.bottom <= (vpHeight + 4);
        
        let footerVisible = true;
        let footerHasButtons = false;
        let buttonsWrapped = false;
        if (footer) {
          const fRect = footer.getBoundingClientRect();
          footerVisible = fRect.bottom <= (vpHeight + 10);
          const btns = footer.querySelectorAll('button, .btn');
          footerHasButtons = btns.length > 0;
          if (btns.length > 1) {
            const b1 = btns[0].getBoundingClientRect();
            const b2 = btns[1].getBoundingClientRect();
            buttonsWrapped = b1.top !== b2.top;
          }
        }

        return {
          found: true,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          fitsHorizontally,
          fitsVertically,
          footerVisible,
          footerHasButtons,
          buttonsWrapped,
          bodyScrollable: body ? body.scrollHeight > body.clientHeight : false
        };
      }, 360, 740);

      const screenshotPath = path.join(EVIDENCE_DIR, `modal_${modal.id}_360px.png`);
      await page.screenshot({ path: screenshotPath });

      modalMetrics.modalId = modal.id;
      auditResults.modalsAudited.push(modalMetrics);

      if (modalMetrics.found && !modalMetrics.fitsHorizontally) {
        auditResults.issues.push({
          type: 'MODAL_HORIZONTAL_OVERFLOW',
          priority: 'CRITICAL',
          modal: modal.id,
          viewport: '360px',
          details: `Modal [${modal.id}] width (${modalMetrics.width}px) overflows screen width (360px). Left: ${modalMetrics.left}px, Right: ${modalMetrics.right}px.`
        });
      }

      await modal.close();
      await page.waitForTimeout(400);
    } catch (e) {
      console.warn(`Error during modal audit for ${modal.id}:`, e.message);
    }
  }

  // Save audit report JSON
  const reportPath = path.join(__dirname, '..', 'audit_evidence', 'mobile_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), 'utf8');
  console.log(`\n✅ Audit complete! Audit report saved to ${reportPath}`);
  console.log(`Total views audited: ${auditResults.viewsAudited.length}`);
  console.log(`Total modals audited: ${auditResults.modalsAudited.length}`);
  console.log(`Total issues detected: ${auditResults.issues.length}`);

  await browser.close();
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
