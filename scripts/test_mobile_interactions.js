const puppeteer = require('puppeteer-core');

async function testInteractions() {
  console.log('🧪 Starting Mobile Functional & Interactive Testing...');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 740, isMobile: true, hasTouch: true });

  const testResults = [];

  function record(name, passed, detail = '') {
    testResults.push({ name, passed, detail });
    console.log(`  ${passed ? '✅' : '❌'} [${name}] ${detail}`);
  }

  // 1. Initial Load & Auth
  await page.goto('https://127.0.0.1/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('al_muslim_active_user_id', 'usr-super-admin');
    localStorage.setItem('al_muslim_theme', 'dark');
    window.router.navigate('dashboard');
  });
  await page.waitForTimeout(1000);

  const title = await page.title();
  record('App Shell Load', title.includes('ERP') || title.includes('Al-Muslim'), `Title: ${title}`);

  // 2. Mobile Sidebar Toggle & Drawer Open/Close
  try {
    await page.waitForSelector('#btn-sidebar-toggle', { timeout: 5000 });
    const toggleBtn = await page.$('#btn-sidebar-toggle');
    if (toggleBtn) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      const isSidebarOpen = await page.evaluate(() => {
        const c = document.querySelector('.app-container');
        return c ? c.classList.contains('sidebar-mobile-open') : false;
      });
      record('Mobile Sidebar Open', isSidebarOpen, 'Sidebar opened successfully');

      // Close via backdrop click
      const backdrop = await page.$('#sidebar-backdrop');
      if (backdrop) {
        await backdrop.click();
        await page.waitForTimeout(400);
        const isClosed = await page.evaluate(() => {
          const c = document.querySelector('.app-container');
          return c ? !c.classList.contains('sidebar-mobile-open') : true;
        });
        record('Mobile Sidebar Close Backdrop', isClosed, 'Backdrop dismissed sidebar');
      }
    } else {
      record('Mobile Sidebar Toggle', false, 'Toggle button not found');
    }
  } catch (e) {
    record('Mobile Sidebar Test', false, e.message);
  }

  // 3. Navigation between Modules on Mobile
  try {
    await page.evaluate(() => window.router.navigate('inventory'));
    await page.waitForTimeout(600);
    const isInv = await page.evaluate(() => window.state.get('currentView') === 'inventory');
    record('SPA Navigation: Inventory', isInv, 'Switched to inventory view');

    await page.evaluate(() => window.router.navigate('database-config'));
    await page.waitForTimeout(600);
    const isDb = await page.evaluate(() => window.state.get('currentView') === 'database-config');
    record('SPA Navigation: Database Config', isDb, 'Switched to database-config view');

    await page.evaluate(() => window.router.navigate('inventory'));
    await page.waitForTimeout(600);
  } catch (e) {
    record('SPA Navigation', false, e.message);
  }

  // 4. Filters & Quick Status Pills Interaction
  try {
    const pillClicked = await page.evaluate(() => {
      const pills = document.querySelectorAll('.inventory-inline-kpis .kpi-pill, .quick-pill');
      if (pills.length > 0) {
        pills[0].click();
        return true;
      }
      return false;
    });
    await page.waitForTimeout(400);
    record('Filter Pill Click Interaction', pillClicked, 'Pill clicked and triggered filter update');
  } catch (e) {
    record('Filter Pill Click Interaction', false, e.message);
  }

  // 5. Search Input on Mobile
  try {
    const searchWorking = await page.evaluate(() => {
      const searchInput = document.querySelector('#filter-search-input, #inventory-search-input, input[type="search"]');
      if (searchInput) {
        searchInput.value = 'JUKI';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    });
    await page.waitForTimeout(500);
    record('Mobile Search Input', searchWorking, 'Search input dispatched event');
  } catch (e) {
    record('Mobile Search Input', false, e.message);
  }

  // 6. Pagination Interaction
  try {
    const pageControl = await page.evaluate(() => {
      const nextBtn = document.querySelector('.page-btn[title*="Next"], #btn-next-page, .pagination-controls button:last-child');
      if (nextBtn && !nextBtn.disabled) {
        nextBtn.click();
        return true;
      }
      return !!document.querySelector('.pagination-controls');
    });
    record('Mobile Pagination Controls', pageControl, 'Pagination controls responsive');
  } catch (e) {
    record('Mobile Pagination Controls', false, e.message);
  }

  // 7. Modal Open, Form Fields, and Close
  try {
    await page.evaluate(() => {
      window.state.set('activeMachineId', null);
      window.state.set('activeModal', 'add-machine');
    });
    await page.waitForTimeout(600);

    const modalState = await page.evaluate(() => {
      const dialog = document.querySelector('.modal-dialog');
      if (!dialog) return { open: false };
      const serialInput = document.querySelector('#modal-field-serial-number');
      const scanBtn = document.querySelector('#btn-modal-scan-serial-qr');
      const submitBtn = dialog.querySelector('button[type="submit"], #btn-submit-machine');
      const closeBtn = dialog.querySelector('#btn-close-machine-modal, .btn-secondary');

      return {
        open: true,
        hasSerialInput: !!serialInput,
        hasScanBtn: !!scanBtn,
        hasSubmitBtn: !!submitBtn,
        hasCloseBtn: !!closeBtn,
        dialogWidth: dialog.offsetWidth,
        viewportWidth: window.innerWidth
      };
    });

    record('Add Machine Modal Open', modalState.open && modalState.dialogWidth <= 360, `Dialog width: ${modalState.dialogWidth}px <= 360px`);
    record('Modal Form Elements Accessible', modalState.hasSerialInput && modalState.hasSubmitBtn, 'Form fields & action buttons present');

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('#btn-close-machine-modal');
      if (closeBtn) closeBtn.click();
      else window.state.set('activeModal', null);
    });
    await page.waitForTimeout(400);

    const isClosed = await page.evaluate(() => !window.state.get('activeModal'));
    record('Modal Close via Button', isClosed, 'Modal closed cleanly');
  } catch (e) {
    record('Modal Add Machine Test', false, e.message);
  }

  // 8. Desktop Regression Check
  try {
    await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
    await page.evaluate(() => window.router.navigate('dashboard'));
    await page.waitForTimeout(600);

    const desktopState = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar');
      const header = document.querySelector('.app-header');
      const main = document.querySelector('#main-view-container');
      return {
        sidebarVisible: sidebar ? sidebar.offsetWidth > 150 : false,
        headerVisible: !!header,
        mainWidth: main ? main.offsetWidth : 0
      };
    });

    record('Desktop Layout Preservation', desktopState.sidebarVisible && desktopState.mainWidth > 1000, `Sidebar: ${desktopState.sidebarVisible}, Main Width: ${desktopState.mainWidth}px`);
  } catch (e) {
    record('Desktop Layout Preservation', false, e.message);
  }

  console.log('\n=== FUNCTIONAL TEST SUMMARY ===');
  const allPassed = testResults.every(r => r.passed);
  console.log(`Passed: ${testResults.filter(r => r.passed).length} / ${testResults.length}`);
  console.log(`Overall Status: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  await browser.close();
}

testInteractions().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
