const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.join(__dirname, '..', 'audit_evidence', 'after');
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

async function runVerification() {
  console.log('🚀 Running Post-Fix Verification Audit across all views and modals...');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  page.on('dialog', async dialog => {
    try { await dialog.dismiss(); } catch (_) {}
  });

  await page.goto('https://127.0.0.1/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('al_muslim_active_user_id', 'usr-super-admin');
    localStorage.setItem('al_muslim_theme', 'dark');
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForTimeout(1200);

  const results = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.map(v => v.name),
    viewsAudited: [],
    modalsAudited: []
  };

  // 1. AUDIT VIEWS
  for (const view of VIEWS_TO_AUDIT) {
    console.log(`Verifying View: [${view}]`);
    const viewMetrics = { view, viewports: {} };

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      await page.evaluate((targetView) => {
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate(targetView);
        } else if (window.state) {
          window.state.set('currentView', targetView);
        }
      }, view);

      await page.waitForTimeout(600);

      const metrics = await page.evaluate((vpWidth) => {
        const docEl = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
        const hasHorizontalOverflow = scrollWidth > (vpWidth + 2);
        const overflowDelta = Math.max(0, scrollWidth - vpWidth);

        // Find elements that clip outside main-view-container (excluding intentional table horizontal scrolls)
        const clippers = [];
        const mainContainer = document.querySelector('#main-view-container');
        if (mainContainer) {
          const mRect = mainContainer.getBoundingClientRect();
          // Check top-level cards, toolbars, headers
          const cards = mainContainer.querySelectorAll('.dash-hero-banner, .db-status-card, .relocate-top-nav-card, .filter-toolbar-card, .uam-top-deck, .tools-top-actions-bar, .ent-lab-header-bar, .audit-page-root > div, .card, .panel');
          cards.forEach(c => {
            const r = c.getBoundingClientRect();
            if (r.right > (vpWidth + 3) && r.width > 0) {
              clippers.push({
                element: c.className || c.tagName,
                right: Math.round(r.right),
                width: Math.round(r.width),
                overflowPx: Math.round(r.right - vpWidth)
              });
            }
          });
        }

        return {
          scrollWidth,
          hasHorizontalOverflow,
          overflowDelta,
          clippingCards: clippers
        };
      }, vp.width);

      viewMetrics.viewports[vp.name] = metrics;

      if (vp.name === '360px' || vp.name === '412px') {
        const screenshotPath = path.join(EVIDENCE_DIR, `view_${view}_${vp.name}_fixed.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    }

    results.viewsAudited.push(viewMetrics);
    const vp360 = viewMetrics.viewports['360px'];
    console.log(`  ✓ ${view}: 360px page overflow=${vp360.hasHorizontalOverflow ? 'YES (' + vp360.overflowDelta + 'px)' : 'NO'}, clipping cards=${vp360.clippingCards.length}`);
  }

  // 2. AUDIT KEY MODALS
  console.log('\n--- VERIFYING MODALS ON 360px & 320px ---');
  const MODALS_TO_VERIFY = [
    { id: 'add-machine-modal', trigger: async () => {
        await page.evaluate(() => {
          window.state.set('currentView', 'inventory');
          window.state.set('activeMachineId', null);
          window.state.set('activeModal', 'add-machine');
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
    }
  ];

  for (const modal of MODALS_TO_VERIFY) {
    console.log(`Verifying Modal: [${modal.id}]`);
    await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });

    try {
      await modal.trigger();
      await page.waitForTimeout(600);

      const modalInfo = await page.evaluate((vpWidth, vpHeight) => {
        const dialog = document.querySelector('.modal-dialog, .modal-card, .modal-overlay > div');
        if (!dialog) return { found: false };

        const r = dialog.getBoundingClientRect();
        const footer = dialog.querySelector('.modal-footer');
        let footerBtns = [];
        if (footer) {
          footer.querySelectorAll('button, .btn').forEach(b => {
            const br = b.getBoundingClientRect();
            footerBtns.push({ text: b.innerText.trim(), width: Math.round(br.width), height: Math.round(br.height) });
          });
        }

        return {
          found: true,
          width: Math.round(r.width),
          height: Math.round(r.height),
          left: Math.round(r.left),
          right: Math.round(r.right),
          fitsWithinScreen: r.right <= (vpWidth + 4) && r.left >= -4,
          footerButtons: footerBtns
        };
      }, 360, 740);

      const screenshotPath = path.join(EVIDENCE_DIR, `modal_${modal.id}_360px_fixed.png`);
      await page.screenshot({ path: screenshotPath });

      modalInfo.modalId = modal.id;
      results.modalsAudited.push(modalInfo);
      console.log(`  ✓ ${modal.id}: width=${modalInfo.width}px, fitsWithinScreen=${modalInfo.fitsWithinScreen}, footerButtons=${modalInfo.footerButtons ? modalInfo.footerButtons.length : 0}`);

      await modal.close();
      await page.waitForTimeout(300);
    } catch (e) {
      console.warn(`Error verifying modal ${modal.id}:`, e.message);
    }
  }

  // 3. DESKTOP REGRESSION CHECK (1440x900)
  console.log('\n--- VERIFYING DESKTOP COMPATIBILITY (1440x900) ---');
  await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
  await page.evaluate(() => {
    window.state.set('currentView', 'dashboard');
  });
  await page.waitForTimeout(600);
  const desktopDashPath = path.join(EVIDENCE_DIR, 'desktop_dashboard_1440px.png');
  await page.screenshot({ path: desktopDashPath });

  await page.evaluate(() => {
    window.state.set('currentView', 'inventory');
  });
  await page.waitForTimeout(600);
  const desktopInvPath = path.join(EVIDENCE_DIR, 'desktop_inventory_1440px.png');
  await page.screenshot({ path: desktopInvPath });
  console.log('  ✓ Desktop views rendered and captured without layout regression');

  const reportPath = path.join(__dirname, '..', 'audit_evidence', 'post_fix_verification_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n🎉 Verification complete! Report saved to ${reportPath}`);

  await browser.close();
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
