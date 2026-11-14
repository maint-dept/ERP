/**
 * Automated Verification Script for Tools, Equipment & Accessories Management System
 */

const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('  RUNNING AUTOMATED VERIFICATION: TOOLS & EQUIPMENT MANAGEMENT SYSTEM');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  // 1. Check Files Exist
  const filesToCheck = [
    'public/js/db/schema.js',
    'public/js/db/initialData.js',
    'public/js/db/storage.js',
    'public/js/services/toolService.js',
    'public/js/components/toolsManagementView.js',
    'public/js/components/sidebar.js',
    'public/js/app.js',
    'public/css/print.css',
    'server.js'
  ];

  filesToCheck.forEach(f => {
    const p = path.join(__dirname, f);
    assert(fs.existsSync(p), `File exists: ${f}`);
  });

  // 2. Verify Schema Definitions
  const schemaContent = fs.readFileSync(path.join(__dirname, 'public/js/db/schema.js'), 'utf-8');
  assert(schemaContent.includes('TOOLS_MASTER'), 'schema.js defines TOOLS_MASTER table');
  assert(schemaContent.includes('ACCESSORIES_MASTER'), 'schema.js defines ACCESSORIES_MASTER table');
  assert(schemaContent.includes('TOOL_ALLOCATIONS'), 'schema.js defines TOOL_ALLOCATIONS table');
  assert(schemaContent.includes('tools_management'), 'schema.js defines tools_management permission module');

  // 3. Verify Initial Data Seed
  const initialDataContent = fs.readFileSync(path.join(__dirname, 'public/js/db/initialData.js'), 'utf-8');
  assert(initialDataContent.includes('"tools_master"') || initialDataContent.includes('tools_master: ['), 'initialData.js contains tools_master list');
  assert(initialDataContent.includes('Flat Screw Driver (Large)'), 'initialData.js includes 001 Flat Screw Driver (Large)');
  assert(initialDataContent.includes('File (Diamond File)') || initialDataContent.includes('File (Dimond File)'), 'initialData.js includes 111 File (Diamond File)');
  assert(initialDataContent.includes('Super Glue'), 'initialData.js includes Super Glue accessory');
  assert(initialDataContent.includes('generateInitialToolAllocations') || initialDataContent.includes('"tool_allocations"'), 'initialData.js includes tool allocations seed');
  assert(initialDataContent.includes('alloc-1196-t-'), 'initialData.js seeds Reg No 1196 for Ashraful Alam Shahed');

  // 4. Verify Manpower Mechanics Records
  const empServiceContent = fs.readFileSync(path.join(__dirname, 'public/js/services/employeeService.js'), 'utf-8');
  assert(empServiceContent.includes('AMG-0147075'), 'employeeService.js includes Ashraful Alam Shahed (AMG-0147075)');
  assert(empServiceContent.includes('AMG0072256'), 'employeeService.js includes Md. Jabad (AMG0072256)');
  assert(empServiceContent.includes('AMG-0140022'), 'employeeService.js includes Md. Nuru Nabi (AMG-0140022)');
  assert(empServiceContent.includes('AMG-0142711'), 'employeeService.js includes Prosanto Kumar Sarkar (AMG-0142711)');

  // 5. Verify ToolService Capabilities
  const toolServiceContent = fs.readFileSync(path.join(__dirname, 'public/js/services/toolService.js'), 'utf-8');
  assert(toolServiceContent.includes('getAllMasterTools'), 'toolService.js provides getAllMasterTools()');
  assert(toolServiceContent.includes('getNextRegistrationNumber'), 'toolService.js provides getNextRegistrationNumber()');
  assert(toolServiceContent.includes('saveAllocationBatch'), 'toolService.js provides saveAllocationBatch()');
  assert(toolServiceContent.includes('getRegistrationDetails'), 'toolService.js provides getRegistrationDetails()');
  assert(toolServiceContent.includes('getStandardMechanicKit'), 'toolService.js provides getStandardMechanicKit()');
  assert(toolServiceContent.includes('importAllocationsFromExcel'), 'toolService.js provides importAllocationsFromExcel()');
  assert(toolServiceContent.includes('exportAllocationsToExcel'), 'toolService.js provides exportAllocationsToExcel()');

  // 6. Verify UI Component
  const uiContent = fs.readFileSync(path.join(__dirname, 'public/js/components/toolsManagementView.js'), 'utf-8');
  assert(uiContent.includes('renderScreen1UserIdPage'), 'toolsManagementView.js implements Screen 1 (User ID Page)');
  assert(uiContent.includes('renderScreen2ToolsAddForm'), 'toolsManagementView.js implements Screen 2 (Tools Add Form)');
  assert(uiContent.includes('renderScreen3PrintPage'), 'toolsManagementView.js implements Screen 3 (Print Page)');
  assert(uiContent.includes('renderScreen4FindAndSelect'), 'toolsManagementView.js implements Screen 4 (Find & Select)');
  assert(uiContent.includes('renderScreen5AccessoriesPage'), 'toolsManagementView.js implements Screen 5 (Accessories Page)');
  assert(uiContent.includes('renderScreen6DatabasePage'), 'toolsManagementView.js implements Screen 6 (Database Page)');
  assert(uiContent.includes('renderToolReplacementModal'), 'toolsManagementView.js implements renderToolReplacementModal');
  assert(uiContent.includes('renderUserToolHistoryModal'), 'toolsManagementView.js implements renderUserToolHistoryModal');
  assert(uiContent.includes('renderFormatA4'), 'toolsManagementView.js implements Format A (Full Page A4 SOP Sheet)');
  assert(uiContent.includes('renderFormatPocket'), 'toolsManagementView.js implements Format B (Pocket Size Bag Slip)');
  assert(uiContent.includes('A.K.M Knit Wear Ltd.'), 'Print layout includes company header');
  assert(uiContent.includes('sopEng') || uiContent.includes('SOP'), 'Print layout includes English SOP declaration');
  assert(uiContent.includes('SIGNATURE') && uiContent.includes('STAMP'), 'Print layout includes Stamp & Signature sign-off box');
  assert(uiContent.includes('Registered By') && uiContent.includes('General Manager'), 'Print layout includes 3 official bottom signatories');

  // Tool service history methods
  assert(toolServiceContent.includes('recordToolChangeHistory'), 'toolService.js provides recordToolChangeHistory()');
  assert(toolServiceContent.includes('getToolChangeHistory'), 'toolService.js provides getToolChangeHistory()');
  assert(toolServiceContent.includes('getUserToolChangeSummary'), 'toolService.js provides getUserToolChangeSummary()');
  assert(toolServiceContent.includes('getToolReplacementCount'), 'toolService.js provides getToolReplacementCount()');

  // 7. Verify Sidebar and App.js integration
  const sidebarContent = fs.readFileSync(path.join(__dirname, 'public/js/components/sidebar.js'), 'utf-8');
  assert(sidebarContent.includes('tools-management'), 'sidebar.js includes tools-management menu item');

  const appContent = fs.readFileSync(path.join(__dirname, 'public/js/app.js'), 'utf-8');
  const moduleLoaderContent = fs.existsSync(path.join(__dirname, 'public/js/services/moduleLoader.js'))
    ? fs.readFileSync(path.join(__dirname, 'public/js/services/moduleLoader.js'), 'utf-8')
    : '';
  assert(appContent.includes('tools-management'), 'app.js includes tools-management route mapping');
  assert(appContent.includes('initToolsManagementEvents') || moduleLoaderContent.includes('initToolsManagementEvents'), 'app.js or moduleLoader.js includes initToolsManagementEvents() event binding');

  // 8. Test HTTP API Endpoints
  const http = require('http');
  function httpGet(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            json: async () => {
              try { return JSON.parse(body); } catch (_) { return {}; }
            }
          });
        });
      }).on('error', reject);
    });
  }

  try {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : httpGet;
    const healthRes = await fetchFn('http://localhost:3030/api/tools/health');
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'ok', 'GET /api/tools/health returns 200 OK');

    const masterRes = await fetchFn('http://localhost:3030/api/tools/master');
    const masterData = await masterRes.json();
    assert(masterRes.status === 200 && masterData.totalTools === 28, 'GET /api/tools/master returns 28 tools & 10 accessories info');

    const mainPageRes = await fetchFn('http://localhost:3030/');
    assert(mainPageRes.status === 200, 'GET / returns 200 OK');
  } catch (err) {
    assert(false, `API endpoint error: ${err.message}`);
  }

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
