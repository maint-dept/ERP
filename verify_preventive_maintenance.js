/**
 * Automated Verification Script for Preventive Machine Maintenance Module
 */

const storageMap = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storageMap.has(key) ? storageMap.get(key) : null;
  },
  setItem(key, val) {
    storageMap.set(key, String(val));
  },
  removeItem(key) {
    storageMap.delete(key);
  },
  clear() {
    storageMap.clear();
  }
};

globalThis.fetch = async function(url, options = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => ({ status: 'success', ok: true, count: 1 }),
    text: async () => JSON.stringify({ status: 'success', ok: true, count: 1 })
  };
};

globalThis.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { protocol: 'http:', host: 'localhost:3030', hostname: 'localhost', origin: 'http://localhost:3030' }
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type, eventInitDict) {
    this.type = type;
    this.detail = eventInitDict?.detail;
  }
};

globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => ({
    children: [],
    parentNode: { removeChild: () => {} },
    appendChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    classList: { add: () => {}, remove: () => {} },
    style: {}
  }),
  body: {
    appendChild: () => {}
  }
};

async function run() {
  const { storage } = await import('./public/js/db/storage.js');
  const { TABLE_NAMES } = await import('./public/js/db/schema.js');
  const { authService } = await import('./public/js/services/authService.js');
  const { masterDataService } = await import('./public/js/services/masterDataService.js');
  const { preventiveMaintenanceService } = await import('./public/js/services/preventiveMaintenanceService.js');

  authService.currentUser = {
    id: 'usr-1',
    username: 'superadmin',
    role: 'SUPER_ADMIN',
    name: 'Central System Administrator',
    status: 'ACTIVE'
  };

  console.log('========================================================================');
  console.log('🧪 RUNNING AUTOMATED TESTS FOR PREVENTIVE MACHINE MAINTENANCE');
  console.log('========================================================================');

  let passed = 0;
  let total = 0;

  function assert(cond, desc) {
    total++;
    if (cond) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Storage Init
  storage.init();
  await storage.resetToInitialData(false);
  assert(storage.isInitialized, 'Storage initialized in-memory');

  // Seed sample test machines and mechanics if needed
  const machTable = storage.getTable(TABLE_NAMES.MACHINES) || [];
  if (!machTable.some(m => m.serialNumber === 'JA-01')) {
    machTable.unshift({
      id: 'mc-ja-01',
      serialNumber: 'JA-01',
      machineName: 'Plane / Lock Stitch Machine',
      machineType: 'Plane / Lock Stitch Machine',
      brand: 'JUKI',
      model: 'DDL-8700-7',
      floor: 'Jamuna Floor',
      line: 'Line PB-01',
      status: 'ACTIVE'
    });
    storage.setTable(TABLE_NAMES.MACHINES, machTable);
  }

  const empTable = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
  const testEmployees = [
    {
      id: 'emp-101',
      name: 'Engr. Tanvir Ahmed',
      cardNumber: '1001',
      designation: 'Senior Maintenance Engineer',
      department: 'Mechanical Maintenance',
      phone: '+880 1711-234567',
      status: 'ACTIVE'
    },
    {
      id: 'emp-103',
      name: 'Rahim Uddin',
      cardNumber: '1088',
      designation: 'Senior Sewing Mechanic',
      department: 'Mechanical Maintenance',
      phone: '+880 1912-334455',
      status: 'ACTIVE'
    },
    {
      id: 'emp-104',
      name: 'Nurul Islam',
      cardNumber: '1105',
      designation: 'Electrical Technician',
      department: 'Electrical & Utility',
      phone: '+880 1711-445566',
      status: 'ACTIVE'
    },
    {
      id: 'emp-109',
      name: 'Ashraful Alam Shahed',
      cardNumber: 'AMG-0147075',
      designation: 'Senior Mechanic',
      department: 'Mechanical Maintenance',
      workingArea: 'Sewing - Jamuna',
      phone: '+880 1712-345678',
      status: 'ACTIVE'
    }
  ];
  testEmployees.forEach(te => {
    if (!empTable.some(e => e.cardNumber === te.cardNumber)) {
      empTable.push(te);
    }
  });
  storage.setTable(TABLE_NAMES.EMPLOYEES, empTable);

  // 2. Configs Verification & Auto-Sync with Master Data Storage
  const configs = preventiveMaintenanceService.getConfigs();
  assert(Array.isArray(configs) && configs.length >= 8, `Configs seeded & synced: ${configs.length} types`);

  // Verify Zero Duplicates in Configs
  const configNames = configs.map(c => c.machineType.toLowerCase().trim());
  const uniqueConfigNames = new Set(configNames);
  assert(configNames.length === uniqueConfigNames.size, `Zero duplicate machine types in configs (${configNames.length} unique)`);

  const ls = preventiveMaintenanceService.getConfigByMachineType('Plane / Lock Stitch Machine') || preventiveMaintenanceService.getConfigByMachineType('Lock Stitch');
  assert(ls && (ls.frequencyDays === 90 || ls.frequencyDays === 91), 'Plane / Lock Stitch Machine configured for 90/91 days');

  const ol = preventiveMaintenanceService.getConfigByMachineType('Overlock Machine') || preventiveMaintenanceService.getConfigByMachineType('Overlock');
  assert(ol && (ol.frequencyDays === 90 || ol.frequencyDays === 91), 'Overlock configured for 90/91 days');

  const fl = preventiveMaintenanceService.getConfigByMachineType('Flatlock Machine') || preventiveMaintenanceService.getConfigByMachineType('Flatlock');
  assert(fl && fl.frequencyDays === 60, 'Flatlock configured for 60 days');

  const bh = preventiveMaintenanceService.getConfigByMachineType('Button Hole Machine') || preventiveMaintenanceService.getConfigByMachineType('Button Hole');
  assert(bh && bh.frequencyDays === 30, 'Button Hole configured for 30 days');

  // 3. User spec test: 10 September 2026 + 91 Days = 10 December 2026
  const calcDate = preventiveMaintenanceService.calculateNextServiceDate('2026-09-10', 91);
  assert(calcDate === '2026-12-10', `Calculation verified: 2026-09-10 + 91d = ${calcDate} (expected 2026-12-10)`);

  // 4. Urgency Status Engine
  const today = new Date();
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dOverdue = new Date(today); dOverdue.setDate(dOverdue.getDate() - 5);
  const dToday = new Date(today);
  const dSoon = new Date(today); dSoon.setDate(dSoon.getDate() + 4);

  const urgOverdue = preventiveMaintenanceService.computeUrgencyStatus(fmt(dOverdue));
  assert(urgOverdue.status === 'OVERDUE', 'Past due date marked as OVERDUE');

  const urgToday = preventiveMaintenanceService.computeUrgencyStatus(fmt(dToday));
  assert(urgToday.status === 'DUE_TODAY', 'Today target date marked as DUE_TODAY');

  const urgSoon = preventiveMaintenanceService.computeUrgencyStatus(fmt(dSoon));
  assert(urgSoon.status === 'DUE_SOON', '4 days away marked as DUE_SOON');

  // 5. Machine Data Live Auto-Sync
  const prof = preventiveMaintenanceService.getMachinePreventiveProfile('JA-01');
  assert(prof !== null, 'Machine JA-01 resolved');
  assert(prof.serialNumber === 'JA-01', 'Serial Number matches JA-01');
  assert(prof.machineType.includes('Lock Stitch') || prof.machineType.includes('Plane'), `Machine Type auto-synced canonically: ${prof.machineType}`);
  assert(prof.frequencyDays === 90 || prof.frequencyDays === 91, 'Machine frequency auto-synced to 90/91 days');
  assert(prof.floor && prof.line, `Location auto-synced live from inventory: ${prof.floor} / ${prof.line}`);

  // 6. Smart Manpower Search & Machine Search
  const defaultMechanics = preventiveMaintenanceService.searchManpowerSuggestions('');
  assert(defaultMechanics.length > 0, `Empty query searchManpowerSuggestions returns ${defaultMechanics.length} active mechanics for instant click`);

  const rahimResults = preventiveMaintenanceService.searchManpowerSuggestions('Rahim');
  assert(rahimResults.length > 0 && rahimResults.some(r => r.name.includes('Rahim')), 'Smart search "Rahim" found mechanic');

  const cardResults = preventiveMaintenanceService.searchManpowerSuggestions('1088');
  assert(cardResults.length > 0 && cardResults[0].cardNumber === '1088', 'Search by Card Number "1088" found Rahim Uddin');

  const engineerResults = preventiveMaintenanceService.searchManpowerSuggestions('1001');
  assert(engineerResults.length > 0 && engineerResults[0].cardNumber === '1001', 'Search by Card Number "1001" found Engr. Tanvir Ahmed');

  // Machine Search for Service Entry Modal
  const machineSearchBySerial = preventiveMaintenanceService.searchMachines('JA-01');
  assert(machineSearchBySerial.length > 0 && machineSearchBySerial[0].serialNumber === 'JA-01', 'Search machine by serial "JA-01" resolved machine profile');

  const machineSearchAll = preventiveMaintenanceService.searchMachines('', 5);
  assert(machineSearchAll.length === 5, 'Search machine with empty query returns top machines for selection');

  // 7. Physical Sticker Serial (Sl No.) Generation: Next Sequential 6-digit number
  const nextStickerSl = preventiveMaintenanceService.getNextStickerSlNo();
  assert(/^\d{5,7}$/.test(nextStickerSl), `Generated next physical sticker Sl No: ${nextStickerSl}`);

  // 8. Service Entry Logging & Zero Duplication
  const initHist = (storage.getTable(TABLE_NAMES.MACHINE_HISTORY) || []).length;
  const newEntry = await preventiveMaintenanceService.createServiceEntry({
    machineId: prof.machineId,
    serialNumber: prof.serialNumber,
    serviceDate: '2026-09-09',
    serviceType: 'PREVENTIVE_SERVICE',
    frequencyDays: 90,
    serviceStickerSerial: nextStickerSl,
    servicedBy: 'Rahim Uddin',
    servicedByCardNumber: '1088',
    servicedByDesignation: 'Senior Sewing Mechanic',
    servicedByDepartment: 'Mechanical Maintenance',
    serviceChecklist: [
      { item: 'Motor & Drive Belt Inspection', checked: true, notes: 'OK' }
    ],
    serviceRemarks: 'Unit test verification service entry with physical sticker Sl No.'
  });

  assert(newEntry && newEntry.serviceStickerSerial === nextStickerSl, `Service entry saved with Sl No: ${newEntry?.serviceStickerSerial}`);
  assert(newEntry && (newEntry.nextServiceDate === '2026-12-08' || newEntry.nextServiceDate === '2026-12-09'), `Next service date automatically calculated: ${newEntry?.nextServiceDate}`);

  const postHist = (storage.getTable(TABLE_NAMES.MACHINE_HISTORY) || []).length;
  assert(postHist > initHist, `Machine Lifetime History auto-updated without duplication (count: ${initHist} -> ${postHist})`);

  // 9. Physical Sticker Lookup and Replacement Feature
  const foundBySticker = preventiveMaintenanceService.findMachineByStickerSerial(nextStickerSl);
  assert(foundBySticker && foundBySticker.serialNumber === 'JA-01', `Found machine JA-01 via sticker Sl No: ${nextStickerSl}`);

  const replacementStickerSl = '245999';
  const replaceRes = preventiveMaintenanceService.replaceMachineSticker(
    'JA-01', 
    replacementStickerSl, 
    'Old sticker damaged, detached or missing'
  );
  assert(replaceRes && replaceRes.newStickerSerial === replacementStickerSl, `Replaced sticker with new Sl No: ${replacementStickerSl}`);

  const foundReplaced = preventiveMaintenanceService.findMachineByStickerSerial(replacementStickerSl);
  assert(foundReplaced && foundReplaced.serialNumber === 'JA-01', 'Lookup by new replacement sticker confirmed machine JA-01');

  // Verify Audit Entry in Machine History for Replacement
  const historyAfterReplace = storage.getTable(TABLE_NAMES.MACHINE_HISTORY) || [];
  const replaceLog = historyAfterReplace.find(h => 
    (h.actionType === 'STICKER_REPLACED' || h.eventType === 'STICKER_REPLACEMENT') &&
    (h.newValue === replacementStickerSl || (h.details && h.details.includes(replacementStickerSl)))
  );
  assert(replaceLog !== undefined, 'Audit trail recorded for physical sticker replacement');

  // 10. Master Data Storage Consolidation (Zero Duplication)
  const syncResult = preventiveMaintenanceService.syncConfigsFromMasterData();
  assert(syncResult.length > 0, `Sync configs returned ${syncResult.length} consolidated configs`);
  const namesAfterSync = syncResult.map(c => c.machineType.toLowerCase().trim());
  const uniqueNamesAfterSync = new Set(namesAfterSync);
  assert(namesAfterSync.length === uniqueNamesAfterSync.size, 'Zero duplicate machine types after syncConfigsFromMasterData()');

  // 11. Cascading Lines Verification
  const tistaFloor = (storage.getTable(TABLE_NAMES.FLOORS) || []).find(f => f.name.toLowerCase().includes('tista'));
  assert(tistaFloor !== undefined, 'Tista Floor found in Master Data');
  const tistaLines = masterDataService.getLines(tistaFloor?.id);
  assert(tistaLines.length > 0, `Retrieved ${tistaLines.length} lines for Tista floor`);
  const hasOnlyTistaLines = tistaLines.every(l => l.code.startsWith('TS-') || l.floorId === tistaFloor?.id);
  assert(hasOnlyTistaLines, 'All lines under Tista floor belong strictly to Tista floor (no Buriganga BG- lines)');

  // 12. Dynamic KPI Metrics and Filtering
  const allMetrics = preventiveMaintenanceService.getDashboardMetrics();
  assert(allMetrics.totalMachines > 0, `Global machine count: ${allMetrics.totalMachines}`);

  // Filter by Floor
  const tistaMetrics = preventiveMaintenanceService.getDashboardMetrics({ floorId: tistaFloor?.id });
  assert(tistaMetrics.isFiltered === true, 'Metrics flagged as filtered when floor filter is active');
  assert(tistaMetrics.totalMachines <= allMetrics.totalMachines, `Tista machine count: ${tistaMetrics.totalMachines} of ${tistaMetrics.globalTotalMachines}`);

  // Filter by Machine Type
  const flMachines = preventiveMaintenanceService.getAllMachinesWithMaintenance({ machineType: 'Flatlock Machine' });
  assert(flMachines.length > 0, `Filtered machines by Flatlock Machine found: ${flMachines.length} machines`);

  // 13. Admin Does NOT Pre-Assign Manpower (User/Technician Part at Servicing)
  const configsAfterCheck = preventiveMaintenanceService.getConfigs();
  const hasPreassignedMechanic = configsAfterCheck.some(c => c.defaultManpowerName !== null && c.defaultManpowerName !== undefined && c.defaultManpowerName !== '');
  assert(!hasPreassignedMechanic, 'Admin Schedule Config has zero pre-assigned mechanics (Admin does not assign manpower)');

  // 14. Unserviced Machine Shows No Assigned Manpower
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const unservicedMachine = allMachines.find(m => {
    const prof = preventiveMaintenanceService.getMachinePreventiveProfile(m.id);
    return prof && prof.lastServiceDate === null;
  });
  if (unservicedMachine) {
    const unservicedProf = preventiveMaintenanceService.getMachinePreventiveProfile(unservicedMachine.id);
    assert(unservicedProf.lastServiceDate === null, `Machine ${unservicedProf.serialNumber} has no prior service history`);
    assert(unservicedProf.assignedManpower === null, `Unserviced machine ${unservicedProf.serialNumber} assignedManpower is null ("Not Assigned Yet")`);
  }

  // 15. Servicing Technician Assignment on Service Entry (User Part)
  const testEntry = await preventiveMaintenanceService.createServiceEntry({
    machineId: unservicedMachine ? unservicedMachine.id : prof.machineId,
    serialNumber: unservicedMachine ? unservicedMachine.serialNumber : prof.serialNumber,
    serviceDate: '2026-09-09',
    serviceType: 'PREVENTIVE_SERVICE',
    frequencyDays: 90,
    serviceStickerSerial: '245239',
    servicedBy: 'Tariqul Islam',
    servicedByCardNumber: '2045',
    servicedByDesignation: 'Maintenance Technician',
    servicedByDepartment: 'Mechanical Maintenance',
    serviceChecklist: [{ item: 'General Check', checked: true }],
    serviceRemarks: 'Service performed by technician'
  });
  const updatedProf = preventiveMaintenanceService.getMachinePreventiveProfile(testEntry.machineId);
  assert(updatedProf.assignedManpower === 'Tariqul Islam', `Technician who performed service is now assigned: ${updatedProf.assignedManpower}`);
  assert(updatedProf.lastServicedByCardNumber === '2045', `Technician card number recorded: ${updatedProf.lastServicedByCardNumber}`);

  // 16. Universal Manpower Search by ANY Attribute
  console.log('\n--- Test 16: Universal Manpower Search by ANY Attribute ---');
  // Card Number search
  const card1088Results = preventiveMaintenanceService.searchManpowerSuggestions('1088');
  assert(card1088Results.length > 0 && card1088Results[0].cardNumber === '1088', 'Search by Card "1088" found Rahim Uddin as #1 match');

  const amgCardResults = preventiveMaintenanceService.searchManpowerSuggestions('AMG-0147075');
  assert(amgCardResults.length > 0 && amgCardResults[0].name.includes('Ashraful Alam Shahed'), 'Search by alphanumeric Card "AMG-0147075" found Shahed');

  // Name search
  const nameTanvirResults = preventiveMaintenanceService.searchManpowerSuggestions('Tanvir');
  assert(nameTanvirResults.length > 0 && nameTanvirResults[0].name.includes('Tanvir'), 'Search by Name "Tanvir" found Engr. Tanvir Ahmed');

  // Designation search
  const desigMechanicResults = preventiveMaintenanceService.searchManpowerSuggestions('Mechanic');
  assert(desigMechanicResults.length > 0 && desigMechanicResults.every(m => (m.designation || '').toLowerCase().includes('mechanic') || (m.department || '').toLowerCase().includes('maint')), 'Search by Designation "Mechanic" returns mechanics/maintenance personnel');

  // Department search
  const deptElectricalResults = preventiveMaintenanceService.searchManpowerSuggestions('Electrical & Utility');
  assert(deptElectricalResults.length > 0 && deptElectricalResults.some(m => m.name === 'Nurul Islam'), 'Search by Department "Electrical & Utility" found Nurul Islam');

  // Location / Working Area search
  const locationJamunaResults = preventiveMaintenanceService.searchManpowerSuggestions('Jamuna');
  assert(locationJamunaResults.length > 0 && locationJamunaResults.some(m => (m.workingArea || '').includes('Jamuna')), 'Search by Working Area "Jamuna" found Shahed in Sewing - Jamuna');

  // Phone search
  const phone01711Results = preventiveMaintenanceService.searchManpowerSuggestions('01711');
  assert(phone01711Results.length > 0 && phone01711Results.some(m => (m.phone || '').includes('1711')), 'Search by Phone number "01711" found matching personnel (+8801711...)');

  // Multi-token search (Name + Card or Designation + Location)
  const multiTokenResults = preventiveMaintenanceService.searchManpowerSuggestions('Rahim 1088');
  assert(multiTokenResults.length > 0 && multiTokenResults[0].cardNumber === '1088', 'Multi-token search "Rahim 1088" uniquely identified Rahim Uddin');

  // 17. Admin-Controlled Inspection Checklist (Add, Edit, Remove & Persist)
  console.log('\n--- Test 17: Admin-Controlled Standard Inspection Checklist ---');
  const btnConfig = preventiveMaintenanceService.getConfigByMachineType('Button Hole') || preventiveMaintenanceService.getConfigByMachineType('Botton Hole');
  assert(btnConfig !== null, 'Button Hole / Botton Hole config located');
  const initialChecklistCount = (btnConfig.checklist || []).length;
  assert(initialChecklistCount > 0, `Initial Button Hole checklist has ${initialChecklistCount} items`);

  // Admin Adds an Item
  const newItemText = 'Check Bobbin Winder Tension & Cutter Spring';
  const updatedAddChecklist = [...btnConfig.checklist, newItemText];
  const configAfterAdd = await preventiveMaintenanceService.updateChecklistForMachineType('Button Hole', updatedAddChecklist);
  assert(configAfterAdd.checklist.length === initialChecklistCount + 1, `Admin added 1 item: count updated to ${configAfterAdd.checklist.length}`);
  assert(configAfterAdd.checklist.includes(newItemText), 'New checklist item is present in updated config');

  // Admin Edits an Item
  const editedItemText = 'Check Bobbin Winder Tension & Cutter Spring (Calibrated)';
  const updatedEditChecklist = configAfterAdd.checklist.map(it => it === newItemText ? editedItemText : it);
  const configAfterEdit = await preventiveMaintenanceService.updateChecklistForMachineType('Button Hole', updatedEditChecklist);
  assert(configAfterEdit.checklist.includes(editedItemText) && !configAfterEdit.checklist.includes(newItemText), 'Admin edited checklist item successfully');

  // Admin Removes an Item
  const updatedRemoveChecklist = configAfterEdit.checklist.filter(it => it !== editedItemText);
  const configAfterRemove = await preventiveMaintenanceService.updateChecklistForMachineType('Button Hole', updatedRemoveChecklist);
  assert(configAfterRemove.checklist.length === initialChecklistCount, `Admin removed item: count returned to ${initialChecklistCount}`);
  assert(!configAfterRemove.checklist.includes(editedItemText), 'Removed checklist item is no longer in configuration');

  // Verify that machine profile reflects the updated checklist
  const bhProfile = preventiveMaintenanceService.getAllMachinesWithMaintenance().find(m => m.machineName.toLowerCase().includes('botton') || m.machineName.toLowerCase().includes('button'));
  if (bhProfile) {
    const profFresh = preventiveMaintenanceService.getMachinePreventiveProfile(bhProfile.machineId);
    assert(profFresh.configChecklist.length === initialChecklistCount, `Machine ${profFresh.serialNumber} profile reflects ${profFresh.configChecklist.length} checklist items`);
  }

  // --- Test 18: Top Action Buttons & Dynamic Filter Controls ---
  console.log('\n--- Test 18: Top Action Buttons & Filter Interactivity ---');
  const allM = preventiveMaintenanceService.getAllMachinesWithMaintenance();
  assert(allM.length > 0, `Factory registry has ${allM.length} machines`);

  // Verify resolving active machine without hardcoded 'm-1'
  const firstMachine = allM.find(m => m.floorId && m.urgency && m.urgency.status) || allM[0];
  const resolvedProfile = preventiveMaintenanceService.getMachinePreventiveProfile(firstMachine.machineId);
  assert(resolvedProfile !== null && resolvedProfile.machineId === firstMachine.machineId, `Active machine profile dynamically resolved: ${resolvedProfile.serialNumber} (${resolvedProfile.machineId})`);

  // Verify combined filter query
  const combinedFiltered = preventiveMaintenanceService.getAllMachinesWithMaintenance({
    floorId: firstMachine.floorId,
    urgencyStatus: firstMachine.urgency.status
  });
  assert(combinedFiltered.length > 0, `Combined floor + urgency filter returned ${combinedFiltered.length} matching machines`);
  assert(combinedFiltered.every(m => 
    (m.floorId === firstMachine.floorId || (m.floor && firstMachine.floor && (m.floor.toLowerCase().includes(firstMachine.floor.toLowerCase()) || firstMachine.floor.toLowerCase().includes(m.floor.toLowerCase())))) &&
    m.urgency.status === firstMachine.urgency.status
  ), 'Every filtered machine strictly satisfies floor and urgency criteria');

  // Verify search query filter matching
  const searchResults = preventiveMaintenanceService.getAllMachinesWithMaintenance({ search: firstMachine.serialNumber });
  assert(searchResults.length >= 1 && searchResults.some(m => m.serialNumber === firstMachine.serialNumber), `Search machine by serial '${firstMachine.serialNumber}' returns active machine`);

  // --- Test 19: Strict System Auto-Generated Next Servicing Date (No User Edit) ---
  console.log('\n--- Test 19: Strict Auto-Generated Next Servicing Date ---');
  // Configure a custom machine frequency as Admin (e.g. 45 days)
  const testFreqDays = 45;
  const cfgTarget = await preventiveMaintenanceService.saveConfig({
    machineType: 'Custom Auto-Date Test Type',
    frequencyDays: testFreqDays
  });
  assert(cfgTarget.frequencyDays === testFreqDays, `Admin configured frequency of ${testFreqDays} days for machine type`);

  // Record service on a specific date (e.g. 2026-10-01)
  const entryDate = '2026-10-01';
  const expectedAutoNextDate = preventiveMaintenanceService.calculateNextServiceDate(entryDate, firstMachine.frequencyDays);
  
  // Even if a user attempts to send an invalid or manually overridden date (e.g. 2099-01-01), the system ignores it
  const createdRecord = await preventiveMaintenanceService.createServiceEntry({
    machineId: firstMachine.machineId,
    serviceDate: entryDate,
    nextServiceDate: '2099-01-01', // User attempt to edit/override date
    serviceStickerSerial: '249111',
    servicedBy: 'Test Auto Mechanic'
  });

  assert(createdRecord.nextServiceDate === expectedAutoNextDate, `Next Service Date is strictly auto-generated by system: ${createdRecord.nextServiceDate} (matches ${entryDate} + ${firstMachine.frequencyDays}d)`);
  assert(createdRecord.nextServiceDate !== '2099-01-01', 'User manual override was completely rejected and system auto-generated date was enforced');
  assert(createdRecord.isNextDateOverridden === false, 'isNextDateOverridden is strictly false');

  // --- Test 20: DD-MM-YYYY Date Formatting & Interoperability ---
  console.log('\n--- Test 20: DD-MM-YYYY Date Formatting & Display ---');
  const d1 = preventiveMaintenanceService.formatDateDMY('2026-11-07');
  assert(d1 === '07-11-2026', `Date '2026-11-07' formatted to DD-MM-YYYY: ${d1} (expected 07-11-2026)`);

  const d2 = preventiveMaintenanceService.formatDateDMY('2026-09-08');
  assert(d2 === '08-09-2026', `Date '2026-09-08' formatted to DD-MM-YYYY: ${d2} (expected 08-09-2026)`);

  const dNull = preventiveMaintenanceService.formatDateDMY(null);
  assert(dNull === null, 'Null date handled safely');

  const dNA = preventiveMaintenanceService.formatDateDMY('N/A');
  assert(dNA === 'N/A', "'N/A' handled safely");

  // Verify computeUrgencyStatus accepts DD-MM-YYYY
  const urgDmy = preventiveMaintenanceService.computeUrgencyStatus('07-11-2026');
  assert(urgDmy.status === 'SCHEDULED' || urgDmy.status === 'DUE_SOON' || urgDmy.status === 'OVERDUE', 'computeUrgencyStatus parsed DD-MM-YYYY string successfully');

  console.log('========================================================================');
  console.log(`🎉 SUMMARY: ${passed}/${total} TESTS PASSED SUCCESSFULLY`);
  console.log('========================================================================');
  process.exit(passed === total ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

