/**
 * Al-Muslim Group Maintenance ERP
 * Dual-Bot Enterprise Architecture:
 * 
 * 1. Operations Bot (@MainterpBot):
 *    - Designed for factory floor mechanics, supervisors, and line staff.
 *    - Machine lookup, breakdown reporting with admin sirens, PM checklists,
 *      tool allocations, line status summaries, photo attachments.
 * 
 * 2. Executive Admin Sentinel Bot (@MaintAdminbot):
 *    - Strictly for Super Admin (Engr. Motaher Hossain) & Top Management.
 *    - Real-time audit trail feed (Sentinel Stream), instant gate pass authorization
 *      with tamper-proof digital verification slips, emergency breakdown sirens,
 *      executive morning briefs, database engine health, user unlocking & lockdown.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Tokens
const USER_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9262458473:AAG4epyvoUizmJfEfdo5C-sJhgtywPidIGU';
const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || '9095096714:AAHLyOZupWmNbyoMH-4rSQTicDFZnLdukFI';

const USER_API_BASE = `https://api.telegram.org/bot${USER_BOT_TOKEN}`;
const ADMIN_API_BASE = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}`;

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'erp_database.json');
const PUBLIC_DB_FILE = path.join(__dirname, 'public', 'data', 'erp_database.json');
const SECURE_API_KEY = 'AMG_MNT_SECURE_API_v4_89f2a7';

// Pending 6-digit link codes: { code: { userId, expiresAt } }
const pendingLinkCodes = new Map();

// Pending Link Code Management (In-Memory + Disk Persistent)
function getPendingCodeEntry(code) {
  if (!code) return null;
  const cleanCode = String(code).trim();
  let entry = pendingLinkCodes.get(cleanCode);
  if (!entry) {
    const db = getDatabase();
    if (db.pending_telegram_codes && db.pending_telegram_codes[cleanCode]) {
      entry = db.pending_telegram_codes[cleanCode];
      pendingLinkCodes.set(cleanCode, entry);
    }
  }
  return entry;
}

function storePendingCode(code, data) {
  const cleanCode = String(code).trim();
  pendingLinkCodes.set(cleanCode, data);
  try {
    const db = getDatabase();
    if (!db.pending_telegram_codes) db.pending_telegram_codes = {};
    db.pending_telegram_codes[cleanCode] = data;
    saveDatabase(db);
  } catch (_) {}
}

function removePendingCode(code) {
  const cleanCode = String(code).trim();
  pendingLinkCodes.delete(cleanCode);
  try {
    const db = getDatabase();
    if (db.pending_telegram_codes && db.pending_telegram_codes[cleanCode]) {
      delete db.pending_telegram_codes[cleanCode];
      saveDatabase(db);
    }
  } catch (_) {}
}

// Universal Code & Token Extractor
function extractCodeOrToken(text) {
  if (!text) return null;
  const str = String(text).trim();

  // 1. Direct claim or API key
  if (str.startsWith('/claim ')) {
    return str.replace('/claim ', '').trim();
  }
  if (str.toLowerCase() === '/claim' || str.toLowerCase() === 'claim') {
    return 'motaher';
  }

  // 2. Start AMG_<code> or start <code>
  if (str.startsWith('/start AMG_')) {
    return str.replace('/start AMG_', '').trim();
  }
  if (str.startsWith('/start ')) {
    const candidate = str.replace('/start ', '').trim();
    if (/^\d{6}$/.test(candidate) || candidate.startsWith('AMG_')) {
      return candidate.replace('AMG_', '').trim();
    }
  }

  // 3. /link <code> or link <code>
  if (/^\/?link\s+/i.test(str)) {
    return str.replace(/^\/?link\s+/i, '').replace(/\s+/g, '').trim();
  }

  // 4. Any 6 consecutive digits anywhere in message (e.g. "code: 123456" or "123 456")
  const stripped = str.replace(/\s+/g, '');
  const digit6Match = stripped.match(/\d{6}/);
  if (digit6Match) {
    return digit6Match[0];
  }

  // 5. In memory / db match
  const db = getDatabase();
  const dbCodes = Object.keys(db.pending_telegram_codes || {});
  for (const c of dbCodes) {
    if (str.includes(c)) return c;
  }
  for (const c of pendingLinkCodes.keys()) {
    if (str.includes(c)) return c;
  }

  return str;
}

// Helper: Make Telegram Bot API Request
function telegramApi(apiBase, method, data = {}) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const url = new URL(`${apiBase}/${method}`);
    
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 35000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            resolve({ error: parsed.description || 'Telegram API Error', code: parsed.error_code });
          }
        } catch (e) {
          resolve({ error: 'Failed to parse Telegram API response', raw: body });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Telegram API timeout' });
    });

    req.write(payload);
    req.end();
  });
}

const userBotRequest = (method, data) => telegramApi(USER_API_BASE, method, data);
const adminBotRequest = (method, data) => telegramApi(ADMIN_API_BASE, method, data);

// Database Helpers
function getDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
    }
  } catch (err) {
    console.error('[Telegram] Error reading DB_FILE:', err.message);
  }
  return { users: [], machines: [], transfers: [], transfer_requests: [], preventive_maintenance: [], audit_logs: [], settings: {} };
}

function saveDatabase(db) {
  try {
    const serialized = JSON.stringify(db, null, 2);
    fs.writeFileSync(DB_FILE, serialized, 'utf8');
    try {
      fs.writeFileSync(PUBLIC_DB_FILE, serialized, 'utf8');
    } catch (_) {}
    return true;
  } catch (err) {
    console.error('[Telegram] Error saving DB_FILE:', err.message);
    return false;
  }
}

// User Helpers
function findUserByChatId(chatId) {
  const db = getDatabase();
  const cid = String(chatId);
  return (db.users || []).find(u => 
    (String(u.telegramChatId) === cid || String(u.telegramAdminChatId) === cid) && 
    u.status === 'ACTIVE'
  );
}

function findSuperAdminUser() {
  const db = getDatabase();
  return (db.users || []).find(u => u.id === 'usr-super-admin' || u.role === 'SUPER_ADMIN');
}

function getAdminChatIds() {
  const db = getDatabase();
  const list = [];
  (db.users || []).forEach(u => {
    if (u.status === 'ACTIVE' && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN')) {
      if (u.telegramAdminChatId) list.push(u.telegramAdminChatId);
      else if (u.telegramChatId) list.push(u.telegramChatId);
    }
  });
  return [...new Set(list)];
}

function hasPermission(user, moduleKey, actionKey) {
  if (!user || user.status !== 'ACTIVE') return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (!user.permissions || !user.permissions[moduleKey]) return false;
  const modPerms = user.permissions[moduleKey];
  return Array.isArray(modPerms) && (modPerms.includes(actionKey) || modPerms.includes('ALL'));
}

// Scope checker (Unit / Floor / Line)
function isLocationInUserScope(user, loc = {}, db = null) {
  if (!user || user.status !== 'ACTIVE' || user.role === 'NO_ACCESS') return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;

  const scope = user.assignedScope;
  if (!scope) return false;

  // Global bypass
  if (Boolean(scope.allGroups) && (Boolean(scope.allUnits) || (!scope.unitIds?.length && !scope.floorIds?.length && !scope.lineIds?.length))) {
    return true;
  }

  let { groupId, unitId, floorId, lineId, unit, floor, line } = loc;

  // Resolve IDs from names if IDs are absent
  if (db) {
    if (!unitId && unit && db.units) {
      const uObj = db.units.find(u => u.name && u.name.toLowerCase() === unit.toLowerCase());
      if (uObj) unitId = uObj.id;
    }
    if (!floorId && floor && db.floors) {
      const fObj = db.floors.find(f => f.name && f.name.toLowerCase() === floor.toLowerCase());
      if (fObj) floorId = fObj.id;
    }
    if (!lineId && line && db.lines) {
      const lObj = db.lines.find(l => l.name && l.name.toLowerCase() === line.toLowerCase());
      if (lObj) lineId = lObj.id;
    }
  }

  // Check Unit
  if (!scope.allUnits) {
    if (Array.isArray(scope.unitIds) && scope.unitIds.length > 0) {
      if (!unitId || !scope.unitIds.includes(unitId)) return false;
    } else if (!scope.allGroups) {
      return false;
    }
  }

  // Check Floor
  if (!scope.allFloors) {
    if (Array.isArray(scope.floorIds) && scope.floorIds.length > 0) {
      if (floorId && !scope.floorIds.includes(floorId)) return false;
      if (!floorId && scope.floorIds.length > 0) return false;
    } else if (!scope.allUnits && !scope.allGroups && floorId) {
      return false;
    }
  }

  // Check Line
  if (!scope.allLines) {
    if (Array.isArray(scope.lineIds) && scope.lineIds.length > 0) {
      if (lineId && !scope.lineIds.includes(lineId)) return false;
      if (!lineId && scope.lineIds.length > 0) return false;
    } else if (!scope.allFloors && !scope.allUnits && !scope.allGroups && lineId) {
      return false;
    }
  }

  return true;
}

function isMachineInUserScope(user, machine, db = null) {
  if (!machine) return false;
  return isLocationInUserScope(user, {
    groupId: machine.groupId,
    unitId: machine.unitId,
    unit: machine.unit,
    floorId: machine.floorId,
    floor: machine.floor,
    lineId: machine.lineId,
    line: machine.line
  }, db);
}

function formatUserScopeDescription(user, db = null) {
  if (!db) {
    try { db = getDatabase(); } catch (_) {}
  }
  if (!user || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin') return 'Factory-Wide (Unrestricted)';
  const s = user.assignedScope;
  if (!s) return 'No Location Assigned';
  if (s.allGroups && s.allUnits) return 'Factory-Wide (All Units & Floors)';

  const parts = [];
  if (s.unitIds?.length && db?.units) {
    const names = db.units.filter(u => s.unitIds.includes(u.id)).map(u => u.name || u.code);
    if (names.length) parts.push(`Unit: ${names.join(', ')}`);
  }
  if (s.floorIds?.length && db?.floors) {
    const names = db.floors.filter(f => s.floorIds.includes(f.id)).map(f => f.name || f.code);
    if (names.length) parts.push(`Floor: ${names.join(', ')}`);
  }
  if (s.lineIds?.length && db?.lines) {
    const names = db.lines.filter(l => s.lineIds.includes(l.id)).map(l => l.name || l.code);
    if (names.length) parts.push(`Line: ${names.join(', ')}`);
  }
  return parts.length ? parts.join(' | ') : 'Specific Scoped Access';
}

// Audit logger & Sentinel Dispatcher
function logAuditAndAlert(db, user, action, entity, entityId, details, isHighPriority = false) {
  if (!db.audit_logs) db.audit_logs = [];
  const logItem = {
    id: `aud-tg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: user?.id || 'SYSTEM',
    username: user?.username || 'SYSTEM',
    action: action,
    entity: entity,
    entityId: entityId,
    details: details,
    oldData: null,
    newData: null,
    ip: '127.0.0.1 (Telegram Bot)',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.audit_logs.unshift(logItem);
  if (db.audit_logs.length > 500) db.audit_logs = db.audit_logs.slice(0, 500);

  // Stream alert to Admin Sentinel Bot (@MaintAdminbot)
  sendSentinelAlert(action, entity, details, user, isHighPriority);
}

// Sentinel Alert Stream to Admin Bot
async function sendSentinelAlert(action, entity, details, user = null, isUrgent = false) {
  const adminChatIds = getAdminChatIds();
  if (adminChatIds.length === 0) return;

  const siren = isUrgent ? '🚨🚨🚨 <b>[URGENT ACTION REQUIRED]</b>' : '🛡️ <b>[AUDIT SENTINEL]</b>';
  const text = `
${siren}
━━━━━━━━━━━━━━━━━━━━
📌 <b>Action:</b> <code>${action}</code>
📦 <b>Entity:</b> <code>${entity}</code>
👤 <b>Operator:</b> ${user ? `${user.name} (@${user.username})` : 'System Core'}
📝 <b>Details:</b> ${details}
⏱️ <b>Time:</b> ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' })} (Dhaka)
`.trim();

  for (const cid of adminChatIds) {
    adminBotRequest('sendMessage', {
      chat_id: cid,
      text: text,
      parse_mode: 'HTML'
    }).catch(() => {});
  }
}

// Real-time Event Broadcaster Hook
let globalBroadcaster = null;
function setRealtimeBroadcaster(broadcasterFn) {
  globalBroadcaster = broadcasterFn;
}

function broadcastEvent(type, data) {
  if (typeof globalBroadcaster === 'function') {
    try {
      globalBroadcaster({ type, data, timestamp: new Date().toISOString() });
    } catch (_) {}
  }
}

// Link Code Generator for Web UI
function generateLinkCodeForUser(userId) {
  const db = getDatabase();
  const user = (db.users || []).find(u => u.id === userId);
  if (!user) return null;

  const now = Date.now();
  for (const [code, val] of pendingLinkCodes.entries()) {
    if (val.expiresAt < now) removePendingCode(code);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeData = {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: now + (60 * 60 * 1000) // 1 Hour Validity
  };
  storePendingCode(code, codeData);

  const isExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';
  const targetBot = isExecutive ? 'MaintAdminbot' : 'MainterpBot';

  return {
    code,
    expiresInSeconds: 3600,
    botUsername: targetBot,
    userBotUsername: 'MainterpBot',
    adminBotUsername: 'MaintAdminbot',
    isExecutive,
    deepLink: `https://t.me/${targetBot}?start=AMG_${code}`,
    userBotDeepLink: `https://t.me/MainterpBot?start=AMG_${code}`,
    adminBotDeepLink: `https://t.me/MaintAdminbot?start=AMG_${code}`
  };
}

function unlinkUserTelegram(userId) {
  const db = getDatabase();
  const user = (db.users || []).find(u => u.id === userId);
  if (!user) return false;

  user.telegramChatId = null;
  user.telegramAdminChatId = null;
  user.telegramUsername = null;
  user.telegramLinkedAt = null;
  saveDatabase(db);
  return true;
}

// Format Machine Card
function formatMachineCard(m) {
  const statusEmoji = (m.status === 'RUNNING' || m.running) ? '🟢' : (m.isAmbulance ? '🚑' : '🟡');
  const ambBadge = m.isAmbulance ? ' [🚑 AMBULANCE STANDBY]' : '';
  return `
⚙️ <b>${m.machineName || 'Sewing Machine'}</b>${ambBadge}
━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Serial:</b> <code>${m.serialNumber || '—'}</code>
🆔 <b>Asset ID:</b> <code>${m.systemAssetId || '—'}</code>
🏭 <b>Brand / Model:</b> ${m.brand || '—'} / ${m.model || '—'}
🏢 <b>Unit:</b> ${m.unit || 'AKM Knit Wear Ltd.'}
📍 <b>Location:</b> ${m.floor || '—'}, Line: ${m.line || '—'}
📊 <b>Status:</b> ${statusEmoji} ${m.isAmbulance ? 'Standby Ambulance' : (m.status || (m.running ? 'Running' : 'Usable'))}
${m.manufacturing_serial ? `🔢 <b>Mfg Serial:</b> <code>${m.manufacturing_serial}</code>\n` : ''}
`.trim();
}

// Format Transfer Card
function formatTransferCard(tr) {
  const machineName = tr.machineName || tr.machineInfo?.machineName || 'Machine';
  const serial = tr.serialNumber || tr.machineInfo?.serialNumber || '—';
  const src = tr.sourcePath || `${tr.sourceLocation?.floor || ''} > ${tr.sourceLocation?.line || ''}`;
  const dst = tr.destPath || `${tr.destLocation?.floor || ''} > ${tr.destLocation?.line || ''}`;
  const reqBy = tr.requestedByName || tr.transferredByName || 'Factory Floor';

  return `
🚚 <b>Machine Transfer #${tr.requestNumber || tr.id}</b>
━━━━━━━━━━━━━━━━━━━━
🔧 <b>Machine:</b> ${machineName} (<code>${serial}</code>)
🚩 <b>From:</b> ${src}
🎯 <b>To:</b> ${dst}
👤 <b>Requested By:</b> ${reqBy}
📝 <b>Reason:</b> ${tr.reason || 'Floor capacity rebalancing'}
🚦 <b>Status:</b> <b>${tr.status || 'PENDING'}</b>
`.trim();
}

// Format Tamper-Proof Digital Gate Pass
function formatDigitalGatePass(tr, authorizerName) {
  const token = `AMG-GP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toLocaleDateString('en-GB');
  const timeStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' });

  return `
🎫 <b>OFFICIAL DIGITAL GATE PASS (AUTHORIZED)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 <b>Gate Pass ID:</b> <code>${tr.requestNumber || tr.id}</code>
🔐 <b>Auth Token:</b> <code>${token}</code>
📅 <b>Authorized At:</b> ${dateStr} • ${timeStr} (Dhaka)
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ <b>Machine:</b> ${tr.machineName || tr.machineInfo?.machineName || 'Sewing Machine'}
🏷️ <b>Serial No:</b> <code>${tr.serialNumber || tr.machineInfo?.serialNumber || '—'}</code>
🏭 <b>Origin:</b> ${tr.sourcePath || 'Factory Floor'}
🎯 <b>Destination:</b> ${tr.destPath || 'Destination Line'}
👤 <b>Requester:</b> ${tr.requestedByName || 'Production Department'}
✍️ <b>Authorized By:</b> <b>${authorizerName}</b> (Central Head of Maintenance)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ <i>Digital seal verified by Al-Muslim Group Security & Maintenance. Legitimate pass for factory floor release.</i>
`.trim();
}

// Render Interactive Quick Features Hub Card with Scoped Metrics
function renderQuickFeaturesHub(user, db, isExecutive = false) {
  if (!db) {
    try { db = getDatabase(); } catch (_) {}
  }
  const metrics = calculateScopedServiceMetrics(db, user, 7);
  const metrics30 = calculateScopedServiceMetrics(db, user, 30);
  const scopeDesc = formatUserScopeDescription(user, db);

  const text = `
⚡ <b>AL-MUSLIM GROUP • QUICK FEATURES HUB</b> ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>ইউজার:</b> <b>${user.name}</b> (<code>${user.presetName || user.role}</code>)
📍 <b>লোকেশন স্কোপ:</b> <code>${scopeDesc}</code>
🏭 <b>আওতাভুক্ত মেশিন বহর:</b> <code>${metrics.totalScopeMachines.toLocaleString()}</code> টি
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 <b>লাইভ স্কোপড মেট্রিক্স (LIVE SCOPE METRICS):</b>
🛠️ <b>গত ৭ দিনে সম্পন্ন সার্ভিস:</b> <b>${metrics.recentServicedCount}</b> টি | <b>(৩০ দিনে):</b> <b>${metrics30.recentServicedCount}</b> টি
⏰ <b>আজ/শিডিউলে ডিউ (Due Now):</b> <b>${metrics.dueCount}</b> টি
🔴 <b>জরুরি ওভারডিউ অ্যালার্ট:</b> <b>${metrics.overdueCount}</b> টি
🚚 <b>চলমান ট্রান্সফার রিকোয়েস্ট:</b> <b>${metrics.pendingTransfersCount}</b> টি
━━━━━━━━━━━━━━━━━━━━━━━━━━
👇 <i>নিচের ওয়ান-ক্লিক বাটন প্রেস করে সরাসরি সম্পন্ন করুন:</i>
`.trim();

  const inline_keyboard = [
    [
      { text: '🔍 Instant Search', callback_data: 'HUB_FIND' },
      { text: '🚚 Transfer Request', callback_data: 'HUB_TRANSFER' }
    ],
    [
      { text: '🛠️ Service & Sticker', callback_data: 'HUB_SERVICE' },
      { text: '🚨 Report Breakdown', callback_data: 'HUB_BREAKDOWN' }
    ],
    [
      { text: `⏰ Due Services (${metrics.dueCount})`, callback_data: 'HUB_DUE' },
      { text: `🔴 Overdue Alerts (${metrics.overdueCount})`, callback_data: 'HUB_OVERDUE' }
    ],
    [
      { text: '📊 7-Day Metrics', callback_data: 'HUB_SERVICES_7' },
      { text: '📊 30-Day Metrics', callback_data: 'HUB_SERVICES_30' }
    ],
    [
      { text: '📋 PM Checklist', callback_data: 'HUB_PM' },
      { text: '🚑 Ambulance Fleet', callback_data: 'HUB_AMBULANCE' }
    ],
    [
      { text: '📊 Factory Status', callback_data: 'HUB_STATUS' },
      { text: '📦 Pending Transfers', callback_data: 'HUB_TRANSFERS' }
    ]
  ];

  if (isExecutive) {
    inline_keyboard.push([
      { text: '📋 Executive Brief', callback_data: 'ADMIN_BRIEF' },
      { text: '🛡️ Executive Audit', callback_data: 'ADMIN_AUDIT' }
    ]);
    inline_keyboard.push([
      { text: '💾 Backup Database', callback_data: 'ADMIN_BACKUP' },
      { text: '🗄️ Database Health', callback_data: 'ADMIN_DB_HEALTH' }
    ]);
  }

  inline_keyboard.push([
    { text: '🔄 Refresh Hub Metrics', callback_data: 'HUB_REFRESH' }
  ]);

  return { text, inline_keyboard, metrics, metrics30 };
}

// Robust In-Place Message Editor with fallback and suppression of unmodified error
async function safeEditMessage(botReqFn, chatId, messageId, text, reply_markup) {
  try {
    return await botReqFn('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: reply_markup
    });
  } catch (err) {
    if (err.message && err.message.includes('message is not modified')) {
      return { ok: true, not_modified: true };
    }
    return await botReqFn('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: reply_markup
    });
  }
}

// In-Place Renderers for Quick Features Hub sub-views
function renderDueView(user, db) {
  const metrics = calculateScopedServiceMetrics(db, user, 7);
  let text = `⏰ <b>Due Maintenance Fleet (${metrics.dueCount} machines):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (metrics.dueItems.length === 0) {
    text += '<i>✅ No pending due services found in your operational scope.</i>\n';
  } else {
    metrics.dueItems.forEach((d, idx) => {
      text += `${idx + 1}. <b>${d.machineName}</b> (<code>${d.serialNumber}</code>)\n   📍 Line: <b>${d.line || '—'}</b>, Floor: ${d.floor || '—'} | Due: <code>${d.dueDate}</code>\n`;
    });
    if (metrics.dueCount > metrics.dueItems.length) {
      text += `\n<i>...and ${metrics.dueCount - metrics.dueItems.length} more machines scheduled.</i>\n`;
    }
  }
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Due', callback_data: 'HUB_DUE' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderOverdueView(user, db) {
  const metrics = calculateScopedServiceMetrics(db, user, 7);
  let text = `🚨 <b>CRITICAL OVERDUE MAINTENANCE (${metrics.overdueCount} machines):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (metrics.overdueItems.length === 0) {
    text += '<i>✅ Zero overdue machines! Maintenance schedule 100% compliant.</i>\n';
  } else {
    metrics.overdueItems.forEach((d, idx) => {
      text += `${idx + 1}. <b>${d.machineName}</b> (<code>${d.serialNumber}</code>)\n   📍 Line: <b>${d.line || '—'}</b>, Floor: ${d.floor || '—'} | Overdue: <code>${d.dueDate}</code>\n`;
    });
    if (metrics.overdueCount > metrics.overdueItems.length) {
      text += `\n<i>...and ${metrics.overdueCount - metrics.overdueItems.length} more overdue machines.</i>\n`;
    }
  }
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Overdue', callback_data: 'HUB_OVERDUE' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderServicesView(user, db, days = 7) {
  const metrics = calculateScopedServiceMetrics(db, user, days);
  let text = `🛠️ <b>Completed Maintenance Services (Past ${days} Days - ${metrics.recentServicedCount}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (metrics.recentServiced.length === 0) {
    text += `<i>No services recorded in the last ${days} days for your scope.</i>\n`;
  } else {
    metrics.recentServiced.forEach((p, idx) => {
      text += `${idx + 1}. <b>${p.machineName || 'Machine'}</b> (<code>${p.serialNumber || '—'}</code>)\n   📅 Date: <code>${p.serviceDate || '—'}</code> | 👤 <b>${p.servicedBy || '—'}</b>\n`;
    });
    if (metrics.recentServicedCount > metrics.recentServiced.length) {
      text += `\n<i>...and ${metrics.recentServicedCount - metrics.recentServiced.length} more records.</i>\n`;
    }
  }
  const otherDays = days === 7 ? 30 : 7;
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: `📊 View ${otherDays} Days`, callback_data: otherDays === 7 ? 'HUB_SERVICES_7' : 'HUB_SERVICES_30' }
      ],
      [
        { text: '🔄 Refresh Log', callback_data: days === 7 ? 'HUB_SERVICES_7' : 'HUB_SERVICES_30' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderPmView(user, db) {
  const today = new Date().toISOString().split('T')[0];
  const pms = (db.preventive_maintenance || []).filter(p => isLocationInUserScope(user, p, db) && (p.serviceDate === today || p.nextServiceDate === today || p.status === 'SCHEDULED' || p.serviceStatus === 'DUE'));
  let text = `📋 <b>Preventive Maintenance Checklist:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (pms.length === 0) {
    text += '<i>✅ No pending PM routines scheduled for today in your area.</i>\n';
  } else {
    pms.slice(0, 8).forEach((p, i) => {
      text += `${i+1}. <b>${p.machineName || 'Machine'}</b> (<code>${p.serialNumber || '—'}</code>)\n   📍 Line: ${p.line || '—'} | Status: <b>${p.serviceStatus || p.status || 'PENDING'}</b>\n`;
    });
    if (pms.length > 8) {
      text += `\n<i>...and ${pms.length - 8} more scheduled PMs.</i>\n`;
    }
  }
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh PM', callback_data: 'HUB_PM' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderAmbulanceView(user, db) {
  const ambulances = (db.machines || []).filter(m => m.isAmbulance === true && isMachineInUserScope(user, m, db));
  let text = `🚑 <b>Standby Ambulance Fleet (${ambulances.length} Ready):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (ambulances.length === 0) {
    text += '<i>No standby ambulance machines located in your current scope.</i>\n';
  } else {
    ambulances.slice(0, 10).forEach((m, i) => {
      text += `${i+1}. <b>${m.machineName || 'Sewing Machine'}</b> (<code>${m.serialNumber || '—'}</code>)\n   📍 Floor: ${m.floor || '—'}, Line: ${m.line || '—'}\n`;
    });
    if (ambulances.length > 10) {
      text += `\n<i>...and ${ambulances.length - 10} more ready.</i>\n`;
    }
  }
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Fleet', callback_data: 'HUB_AMBULANCE' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderStatusView(user, db) {
  const machines = (db.machines || []).filter(m => isMachineInUserScope(user, m, db));
  const total = machines.length;
  const running = machines.filter(m => m.running || m.status === 'RUNNING').length;
  const ambulance = machines.filter(m => m.isAmbulance).length;
  const repairable = machines.filter(m => m.status === 'REPAIRABLE' || m.repairable).length;
  const other = Math.max(0, total - running - ambulance - repairable);

  let text = `📊 <b>Factory Operational Status (Scoped):</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 <b>Scope:</b> <code>${formatUserScopeDescription(user, db)}</code>\n` +
    `🏭 <b>Total Fleet:</b> <code>${total.toLocaleString()}</code> machines\n` +
    `🟢 <b>Running:</b> <code>${running.toLocaleString()}</code> (${total > 0 ? ((running/total)*100).toFixed(1) : 0}%)\n` +
    `🚑 <b>Ambulance Standby:</b> <code>${ambulance}</code>\n` +
    `🟡 <b>Repairable / Maintenance:</b> <code>${repairable}</code>\n` +
    `⚪ <b>Idle / Usable:</b> <code>${other}</code>\n`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Status', callback_data: 'HUB_STATUS' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderTransfersView(user, db) {
  const pendingTransfers = (db.transfer_requests || []).filter(r => {
    if (r.status !== 'PENDING' && r.status !== 'IN_PROGRESS') return false;
    const isOwner = r.requestedBy === user.name || r.requestedBy === user.username || r.userId === user.id;
    if (isOwner) return true;
    const fromMatch = isLocationInUserScope(user, { floor: r.fromFloor, unit: r.fromUnit, line: r.fromLine }, db);
    const toMatch = isLocationInUserScope(user, { floor: r.toFloor, unit: r.toUnit, line: r.toLine }, db);
    return fromMatch || toMatch;
  });

  let text = `📦 <b>Active Machine Transfers (${pendingTransfers.length}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (pendingTransfers.length === 0) {
    text += '<i>✅ No pending transfer requests in your scope.</i>\n';
  } else {
    pendingTransfers.slice(0, 6).forEach((t, i) => {
      text += `${i+1}. <b>${t.machineName || 'Machine'}</b> (<code>${t.serialNumber || '—'}</code>)\n` +
        `   From: ${t.fromFloor || '—'} (${t.fromLine || '—'}) ➔ To: ${t.toFloor || '—'} (${t.toLine || '—'})\n` +
        `   Status: <b>${t.status}</b>\n`;
    });
    if (pendingTransfers.length > 6) {
      text += `\n<i>...and ${pendingTransfers.length - 6} more transfers.</i>\n`;
    }
  }

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Transfers', callback_data: 'HUB_TRANSFERS' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderAuditView(db) {
  const logs = (db.audit_logs || []).slice(0, 8);
  let text = `🛡️ <b>Recent Executive Audit Trail:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
  if (logs.length === 0) {
    text += '<i>No audit logs recorded yet.</i>\n';
  } else {
    logs.forEach((l, idx) => {
      text += `${idx + 1}. [<code>${l.action || 'LOG'}</code>] <b>${l.username || 'System'}</b>\n   ${l.details || '—'} (<i>${l.timestamp ? l.timestamp.split('T')[0] : '—'}</i>)\n`;
    });
  }
  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Audit', callback_data: 'ADMIN_AUDIT' }
      ]
    ]
  };
  return { text: text.trim(), reply_markup };
}

function renderBriefView(db) {
  const machines = db.machines || [];
  const total = machines.length || 1;
  const running = machines.filter(m => m.running || m.status === 'RUNNING').length;
  const underMaint = machines.filter(m => m.status === 'UNDER_MAINTENANCE').length;
  const ambulance = machines.filter(m => m.isAmbulance).length;
  const pms = db.preventive_maintenance || [];
  const overduePm = pms.filter(p => p.serviceStatus === 'OVERDUE').length;
  const pendingTr = (db.transfer_requests || []).filter(r => r.status === 'PENDING').length;
  const uptimePct = ((running / total) * 100).toFixed(1);

  const text = `
📋 <b>EXECUTIVE FACTORY MAINTENANCE BRIEF</b>
📅 <b>Date:</b> ${new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })} (Dhaka)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏭 <b>Fleet Capacity:</b> <code>${total.toLocaleString()}</code> machines
⚡ <b>Factory Uptime:</b> <b>${uptimePct}%</b> (Target: &gt;90%)
🟢 <b>Active Running:</b> <code>${running.toLocaleString()}</code>
🔴 <b>Breakdowns:</b> <code>${underMaint}</code>
🚑 <b>Ambulance Standby:</b> <code>${ambulance}</code> ready for emergency deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <b>PM Compliance:</b> ${pms.length - overduePm} on-schedule / <b>${overduePm} overdue</b>
🚚 <b>Pending Gate Passes:</b> <b>${pendingTr}</b> awaiting executive signature
🗄️ <b>Data Engine:</b> JSON Primary • MySQL Primary • SSE Active
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>System operational. Zero unauthorized perimeter breaches detected.</i>
`.trim();

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Brief', callback_data: 'ADMIN_BRIEF' }
      ]
    ]
  };
  return { text, reply_markup };
}

function renderDbHealthView(db) {
  const fs = require('fs');
  let diskStat = 'Normal';
  try {
    const stat = fs.statSync('/root/erp/data/erp_database.json');
    diskStat = `${(stat.size / (1024 * 1024)).toFixed(2)} MB`;
  } catch (_) {}

  const text = `
🗄️ <b>CENTRAL DATABASE & ARCHITECTURE HEALTH</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 <b>Primary Store:</b> JSON Master Disk Database (Healthy)
💾 <b>Primary Database Size:</b> <code>${diskStat}</code>
🔄 <b>MySQL Sync:</b> Auto-sync active via API pipeline
⚡ <b>SSE Live Stream:</b> Real-time broadcast engine connected
📦 <b>Total Fleet:</b> <code>${(db.machines || []).length.toLocaleString()}</code> records
🚚 <b>Transfers Archive:</b> <code>${(db.transfer_requests || []).length.toLocaleString()}</code> records
🛠️ <b>Maintenance Log:</b> <code>${(db.preventive_maintenance || []).length.toLocaleString()}</code> records
🛡️ <b>Audit History:</b> <code>${(db.audit_logs || []).length.toLocaleString()}</code> entries
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>All subsystems operating normally. Zero data collisions detected.</i>
`.trim();

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' },
        { text: '🔄 Refresh Health', callback_data: 'ADMIN_DB_HEALTH' }
      ]
    ]
  };
  return { text, reply_markup };
}

// Clean, spacious 3-row, 2-column Speed Launcher Keyboard for Admin Sentinel Bot
function getAdminKeyboard() {
  return [
    [{ text: '⚡ Quick Features Hub' }, { text: '🔍 Search Machine' }],
    [{ text: '🚚 Pending Gate Passes' }, { text: '📊 Factory Status' }],
    [{ text: '🚚 Request Transfer' }, { text: '🛠️ Service Machine' }]
  ];
}

// Register native Telegram Command Menu Drawer (setMyCommands) for both bots
async function registerBotCommands() {
  const userCommands = [
    { command: 'hub', description: '⚡ Open Quick Features Hub' },
    { command: 'find', description: '🔍 Search Machine by Serial/Model' },
    { command: 'due', description: '⏰ Due Maintenance & Schedules' },
    { command: 'overdue', description: '🚨 Critical Overdue Alerts' },
    { command: 'services', description: '📊 7/30-Day Serviced Fleet' },
    { command: 'status', description: '📊 Factory Operational Status' },
    { command: 'pm', description: '📋 PM Schedule & Checklist' },
    { command: 'transfer', description: '🚚 Request Machine Transfer' },
    { command: 'service', description: '🛠️ Quick Log Service Entry' },
    { command: 'breakdown', description: '🚨 Report Machine Breakdown' },
    { command: 'ambulance', description: '🚑 Standby Ambulance Fleet' },
    { command: 'help', description: '❓ View Allowed Commands' }
  ];

  const adminCommands = [
    { command: 'hub', description: '⚡ Central Quick Features Hub' },
    { command: 'status', description: '📊 Live Factory Health & Fleet' },
    { command: 'transfers', description: '🚚 Pending Gate Passes & Transfers' },
    { command: 'find', description: '🔍 Machine Finder & Tracking' },
    { command: 'due', description: '⏰ Factory Due Maintenance' },
    { command: 'overdue', description: '🚨 Factory Critical Overdue Alerts' },
    { command: 'services', description: '📊 Fleet Servicing History (7/30D)' },
    { command: 'pm', description: '📋 PM Schedule & Checklist' },
    { command: 'brief', description: '📋 Daily Executive Brief' },
    { command: 'audit', description: '🛡️ Real-time System Audit Trail' },
    { command: 'backup', description: '💾 Database Backup & Disk Snapshot' },
    { command: 'ambulance', description: '🚑 Ambulance Fleet Standby' },
    { command: 'help', description: '❓ Executive Command Reference' }
  ];

  try {
    const resUser = await userBotRequest('setMyCommands', { commands: userCommands });
    console.log('[Telegram] ✅ User Bot Commands registered:', resUser);
  } catch (err) {
    console.error('[Telegram] Failed to register user bot commands:', err.message);
  }

  try {
    const resAdmin = await adminBotRequest('setMyCommands', { commands: adminCommands });
    console.log('[Telegram] ✅ Admin Sentinel Bot Commands registered:', resAdmin);
  } catch (err) {
    console.error('[Telegram] Failed to register admin bot commands:', err.message);
  }
}

// Dynamic Adaptive RBAC Menu Builder for Operations Bot (@MainterpBot)
function buildDynamicUserMenu(user) {
  const keyboard = [];
  const commands = [];

  const isExec = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';
  const canMachines = hasPermission(user, 'machines', 'VIEW') || isExec;
  const canPM = hasPermission(user, 'preventive_maintenance', 'VIEW') || isExec;
  const canTools = hasPermission(user, 'tools_management', 'VIEW') || isExec;
  const canTransfers = hasPermission(user, 'transfers', 'VIEW') || isExec;
  const canReportBreakdown = canMachines || canPM || canTransfers;

  // Row 1: Quick Features Hub & Machine Search (Clean 2-column)
  const row1 = [{ text: '⚡ Quick Features Hub' }];
  commands.push('⚡ /quick — কুইক ফিচার হাব ও লাইভ মেট্রিক্স ড্যাশবোর্ড');
  if (canMachines) {
    row1.push({ text: '🔍 Search Machine' });
    commands.push('🔍 /find <serial> — মেশিন সার্চ ও অবস্থা পর্যবেক্ষণ');
  }
  keyboard.push(row1);

  // Row 2: Service & Transfer (Clean 2-column)
  const row2 = [];
  if (canPM) {
    row2.push({ text: '🛠️ Service Machine' });
    commands.push('🛠️ /service <serial> <remarks> — সার্ভিসিং ও পিএম সম্পন্ন লগ');
  }
  if (canTransfers) {
    row2.push({ text: '🚚 Request Transfer' });
    commands.push('🚚 /transfer <serial> <dest_line> [reason] — মেশিন স্থানান্তর রিকোয়েস্ট');
  }
  if (row2.length > 0) keyboard.push(row2);

  // Row 3: Breakdown & Factory Status (Clean 2-column)
  const row3 = [
    { text: '🚨 Report Breakdown' },
    { text: '📊 Factory Status' }
  ];
  commands.push('🚨 /breakdown <serial> <details> — জরুরি ব্রেকডাউন নোটিশ');
  commands.push('📊 /status — ফ্যাক্টরি ও লাইন বর্তমান অবস্থা');
  keyboard.push(row3);

  return {
    keyboard,
    commandsText: commands.length > 0 
      ? commands.join('\n') 
      : '⚠️ আপনার অ্যাকাউন্টে বর্তমানে কোনো সক্রিয় ফিচার পারমিশন বরাদ্দ নেই।'
  };
}

// ==========================================
// MACHINE TRANSFER ENGINE (TELEGRAM CORE)
// ==========================================
function processMachineTransferRequest(db, user, serialOrQuery, destText, reason, isAutoApprove = false) {
  const cleanSerial = String(serialOrQuery || '').trim().toLowerCase();
  const machine = (db.machines || []).find(m => 
    (m.serialNumber && m.serialNumber.toLowerCase() === cleanSerial) ||
    (m.systemAssetId && m.systemAssetId.toLowerCase() === cleanSerial) ||
    (m.id && m.id.toLowerCase() === cleanSerial)
  );

  if (!machine) {
    return { error: `❌ '<code>${serialOrQuery}</code>' সিরিয়ালের কোনো মেশিন খুঁজে পাওয়া যায়নি।` };
  }

  // Check user permission & scope
  if (!isLocationInUserScope(user, machine, db)) {
    return { error: `⛔ <b>অ্যাক্সেস সীমাবদ্ধ:</b> মেশিন <code>${machine.serialNumber}</code> আপনার নির্ধারিত ইউনিটের বাইরে।` };
  }

  // Parse destination
  const cleanDest = String(destText || '').trim();
  if (!cleanDest) {
    return { error: '❌ গন্তব্য লাইন বা ফ্লোরের নাম উল্লেখ করুন (যেমন: <code>BG-B</code> বা <code>Jamuna</code>)।' };
  }

  // Resolve target Line, Floor, Unit
  let targetLine = null;
  let targetFloor = null;
  let targetUnit = null;

  const qDestLower = cleanDest.toLowerCase();
  // 1. Try Line exact/partial
  targetLine = (db.lines || []).find(l => l.name && l.name.toLowerCase() === qDestLower) ||
               (db.lines || []).find(l => l.name && l.name.toLowerCase().includes(qDestLower));

  if (targetLine) {
    targetFloor = (db.floors || []).find(f => f.id === targetLine.floorId);
    if (targetFloor) {
      targetUnit = (db.units || []).find(u => u.id === targetFloor.unitId);
    }
  }

  // 2. If line not found, check floor
  if (!targetFloor) {
    targetFloor = (db.floors || []).find(f => f.name && f.name.toLowerCase() === qDestLower) ||
                  (db.floors || []).find(f => f.name && f.name.toLowerCase().includes(qDestLower));
    if (targetFloor) {
      targetUnit = (db.units || []).find(u => u.id === targetFloor.unitId);
    }
  }

  // 3. Fallback unit
  if (!targetUnit) {
    targetUnit = (db.units || []).find(u => u.name && u.name.toLowerCase().includes(qDestLower)) ||
                 (db.units || []).find(u => u.id === machine.unitId);
  }

  const destLineName = targetLine ? targetLine.name : cleanDest;
  const destFloorName = targetFloor ? targetFloor.name : (machine.floor || 'Floor');
  const destUnitName = targetUnit ? targetUnit.name : (machine.unit || 'AKM Knit Wear Ltd.');

  const sourcePath = `${machine.unit || 'AKM'} > ${machine.floor || '—'} > ${machine.line || '—'}`;
  const destPath = `${destUnitName} > ${destFloorName} > ${destLineName}`;

  if (sourcePath.toLowerCase() === destPath.toLowerCase()) {
    return { error: '❌ <b>একই লোকেশন:</b> মেশিনটি ইতিমধ্যে এই লাইনেই অবস্থান করছে।' };
  }

  const reqNumber = `TR-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const reqId = `trq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const cleanReason = reason || 'Floor line capacity rebalancing';

  if (!db.transfer_requests) db.transfer_requests = [];

  const trRecord = {
    id: reqId,
    requestNumber: reqNumber,
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    machineName: machine.machineName,
    machineInfo: {
      machineName: machine.machineName,
      brand: machine.brand,
      model: machine.model,
      serialNumber: machine.serialNumber
    },
    sourceGroupId: machine.groupId || 'grp-1',
    sourceUnitId: machine.unitId,
    sourceFloorId: machine.floorId,
    sourceLineId: machine.lineId,
    sourceLocation: {
      unit: machine.unit,
      floor: machine.floor,
      line: machine.line
    },
    sourcePath: sourcePath,
    destGroupId: targetUnit ? (targetUnit.groupId || 'grp-1') : 'grp-1',
    destUnitId: targetUnit ? targetUnit.id : machine.unitId,
    destFloorId: targetFloor ? targetFloor.id : machine.floorId,
    destLineId: targetLine ? targetLine.id : null,
    destLocation: {
      unit: destUnitName,
      floor: destFloorName,
      line: destLineName
    },
    destPath: destPath,
    destUnit: destUnitName,
    destFloor: destFloorName,
    destLine: destLineName,
    reason: cleanReason,
    status: isAutoApprove ? 'APPROVED' : 'PENDING',
    requestedBy: user.id,
    requestedByName: user.name,
    requestedAt: new Date().toISOString(),
    approvedBy: isAutoApprove ? user.id : null,
    approvedByName: isAutoApprove ? user.name : null,
    approvedAt: isAutoApprove ? new Date().toISOString() : null
  };

  db.transfer_requests.unshift(trRecord);

  // If auto-approved by Admin, also update machine immediately
  if (isAutoApprove) {
    if (targetUnit) machine.unitId = targetUnit.id;
    machine.unit = destUnitName;
    if (targetFloor) machine.floorId = targetFloor.id;
    machine.floor = destFloorName;
    if (targetLine) machine.lineId = targetLine.id;
    machine.line = destLineName;
    machine.updatedAt = new Date().toISOString();

    if (!db.machine_history) db.machine_history = [];
    db.machine_history.unshift({
      id: `hist-tr-${Date.now()}`,
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      action: 'MACHINE_TRANSFERRED',
      details: `Direct transferred to ${destPath} by ${user.name} (#${reqNumber})`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      username: user.username
    });
  }

  saveDatabase(db);

  // Audit
  logAuditAndAlert(db, user, isAutoApprove ? 'MACHINE_TRANSFERRED_DIRECT' : 'MACHINE_TRANSFER_REQUESTED', 'TRANSFER', trRecord.id, `Transfer #${reqNumber} for ${machine.serialNumber}: ${sourcePath} -> ${destPath} (${cleanReason})`, true);
  broadcastEvent(isAutoApprove ? 'transfer:approved' : 'transfer:created', { transferId: trRecord.id, serialNumber: machine.serialNumber });

  if (!isAutoApprove) {
    notifyApproversOfTransfer(trRecord);
  }

  return { ok: true, transfer: trRecord, machine, isAutoApprove };
}

// ==========================================
// MACHINE SERVICING & PM ENGINE (TELEGRAM)
// ==========================================
function processMachineServicingEntry(db, user, serialOrQuery, remarksText, customSticker = null) {
  const cleanSerial = String(serialOrQuery || '').trim().toLowerCase();
  const machine = (db.machines || []).find(m => 
    (m.serialNumber && m.serialNumber.toLowerCase() === cleanSerial) ||
    (m.systemAssetId && m.systemAssetId.toLowerCase() === cleanSerial) ||
    (m.id && m.id.toLowerCase() === cleanSerial)
  );

  if (!machine) {
    return { error: `❌ '<code>${serialOrQuery}</code>' সিরিয়ালের কোনো মেশিন খুঁজে পাওয়া যায়নি।` };
  }

  // Check user permission & scope
  if (!isLocationInUserScope(user, machine, db)) {
    return { error: `⛔ <b>অ্যাক্সেস সীমাবদ্ধ:</b> মেশিন <code>${machine.serialNumber}</code> আপনার নির্ধারিত আওতাভুক্ত নয়।` };
  }

  const cleanRemarks = String(remarksText || '').trim() || 'General servicing and maintenance maintenance check.';
  const stickerNo = customSticker || `STK-${Math.floor(100000 + Math.random() * 900000)}`;

  // Update Machine: restore to Active/Running if under maintenance or breakdown
  const wasUnderMaintenance = machine.status === 'UNDER_MAINTENANCE' || machine.running === 0;
  machine.status = 'ACTIVE';
  machine.running = 1;
  machine.usable_idle = 0;
  machine.repairable_idle = 0;
  machine.remarks = `Serviced on ${new Date().toLocaleDateString('en-GB')}: ${cleanRemarks}`;
  machine.lastServiceDate = new Date().toISOString().split('T')[0];
  machine.serviceStickerSerial = stickerNo;
  machine.updatedAt = new Date().toISOString();

  // Create PM Record in db.preventive_maintenance
  if (!db.preventive_maintenance) db.preventive_maintenance = [];

  const pmRecord = {
    id: `pm-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    machineName: machine.machineName,
    brand: machine.brand,
    model: machine.model,
    unit: machine.unit,
    unitId: machine.unitId,
    floor: machine.floor,
    floorId: machine.floorId,
    line: machine.line,
    lineId: machine.lineId,
    serviceDate: new Date().toISOString().split('T')[0],
    serviceType: wasUnderMaintenance ? 'BREAKDOWN_RESTORATION' : 'PREVENTIVE_SERVICE',
    serviceStatus: 'COMPLETED',
    approvalStatus: 'APPROVED',
    serviceStickerSerial: stickerNo,
    servicedBy: user.name,
    servicedById: user.id,
    serviceRemarks: cleanRemarks,
    nextServiceDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    loggedBy: user.username,
    loggedById: user.id
  };

  db.preventive_maintenance.unshift(pmRecord);

  // Add to machine history
  if (!db.machine_history) db.machine_history = [];
  db.machine_history.unshift({
    id: `hist-${Date.now()}`,
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    action: 'MACHINE_SERVICED',
    details: `Serviced by ${user.name} (${stickerNo}): ${cleanRemarks}. Status restored to ACTIVE & RUNNING.`,
    timestamp: new Date().toISOString(),
    userId: user.id,
    username: user.username
  });

  saveDatabase(db);

  // Audit and alert
  logAuditAndAlert(db, user, 'MACHINE_SERVICED_TELEGRAM', 'MACHINE', machine.serialNumber, `Serviced (${stickerNo}) by ${user.name}: ${cleanRemarks}. Restored to RUNNING.`, true);
  broadcastEvent('machine:serviced', { serialNumber: machine.serialNumber, servicedBy: user.name, sticker: stickerNo });

  return { ok: true, machine, pmRecord, stickerNo, wasUnderMaintenance };
}

// ==========================================
// SCOPED SERVICE METRICS ENGINE (TELEGRAM CORE)
// ==========================================
function calculateScopedServiceMetrics(db, user, days = 7) {
  const numDays = Math.max(1, parseInt(days, 10) || 7);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - numDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const machines = (db.machines || []).filter(m => isMachineInUserScope(user, m, db));
  const machineMap = new Map();
  machines.forEach(m => {
    if (m.serialNumber) machineMap.set(m.serialNumber.toLowerCase(), m);
    if (m.id) machineMap.set(m.id, m);
  });

  const pms = (db.preventive_maintenance || []).filter(p => {
    const m = (p.serialNumber && machineMap.get(p.serialNumber.toLowerCase())) ||
              (p.machineId && machineMap.get(p.machineId)) ||
              (db.machines || []).find(x => (x.serialNumber === p.serialNumber || x.id === p.machineId));
    return m ? isMachineInUserScope(user, m, db) : isLocationInUserScope(user, p, db);
  });

  // 1. Recently completed services in the last X days
  const recentServiced = pms.filter(p => {
    const sDate = p.serviceDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
    return sDate >= cutoffStr && (p.serviceStatus === 'COMPLETED' || p.status === 'COMPLETED');
  });

  // 2. Due & Overdue services
  const overdueItems = [];
  const dueItems = [];
  const seenSerials = new Set();

  pms.forEach(p => {
    const serial = (p.serialNumber || '').trim();
    if (!serial || seenSerials.has(serial.toLowerCase())) return;
    const nextDate = p.nextServiceDate;
    if (p.serviceStatus === 'OVERDUE' || (nextDate && nextDate < todayStr && p.serviceStatus !== 'COMPLETED')) {
      seenSerials.add(serial.toLowerCase());
      overdueItems.push({
        serialNumber: serial,
        machineName: p.machineName || 'Machine',
        line: p.line || '—',
        floor: p.floor || '—',
        dueDate: nextDate || 'Past schedule',
        servicedBy: p.servicedBy || '—'
      });
    } else if (p.serviceStatus === 'DUE' || (nextDate && nextDate <= todayStr && p.serviceStatus !== 'COMPLETED')) {
      seenSerials.add(serial.toLowerCase());
      dueItems.push({
        serialNumber: serial,
        machineName: p.machineName || 'Machine',
        line: p.line || '—',
        floor: p.floor || '—',
        dueDate: nextDate || todayStr,
        servicedBy: p.servicedBy || '—'
      });
    }
  });

  // Also check machines directly if not already in PM records
  machines.forEach(m => {
    const serial = (m.serialNumber || '').trim();
    if (!serial || seenSerials.has(serial.toLowerCase())) return;
    const nextDate = m.nextServiceDate || m.nextPmDate || m.pmDueDate;
    if (nextDate) {
      if (nextDate < todayStr) {
        seenSerials.add(serial.toLowerCase());
        overdueItems.push({
          serialNumber: serial,
          machineName: m.machineName || m.name || 'Machine',
          line: m.line || '—',
          floor: m.floor || '—',
          dueDate: nextDate,
          servicedBy: '—'
        });
      } else if (nextDate <= todayStr) {
        seenSerials.add(serial.toLowerCase());
        dueItems.push({
          serialNumber: serial,
          machineName: m.machineName || m.name || 'Machine',
          line: m.line || '—',
          floor: m.floor || '—',
          dueDate: nextDate,
          servicedBy: '—'
        });
      }
    }
  });

  // Pending transfers in user's scope
  const pendingTransfers = (db.transfer_requests || []).filter(r => {
    if (r.status !== 'PENDING' && r.status !== 'IN_PROGRESS') return false;
    const isOwner = r.requestedBy === user.name || r.requestedBy === user.username || r.userId === user.id;
    if (isOwner) return true;
    const fromMatch = isLocationInUserScope(user, { floor: r.fromFloor, unit: r.fromUnit, line: r.fromLine }, db);
    const toMatch = isLocationInUserScope(user, { floor: r.toFloor, unit: r.toUnit, line: r.toLine }, db);
    return fromMatch || toMatch;
  });

  return {
    numDays,
    cutoffStr,
    totalScopeMachines: machines.length,
    recentServicedCount: recentServiced.length,
    recentServiced: recentServiced.slice(0, 8),
    dueCount: dueItems.length,
    dueItems: dueItems.slice(0, 8),
    overdueCount: overdueItems.length,
    overdueItems: overdueItems.slice(0, 8),
    pendingTransfersCount: pendingTransfers.length
  };
}

// ============================================================================
// 1. OPERATIONS BOT HANDLER (@MainterpBot) - General Users & Floor Staff
// ============================================================================
async function handleUserBotMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const db = getDatabase();
  const user = findUserByChatId(chatId);

  // Photo attachment upload handler (e.g. Broken machine part photo)
  if (msg.photo && msg.photo.length > 0 && user) {
    const caption = (msg.caption || '').trim();
    logAuditAndAlert(db, user, 'PHOTO_UPLOAD_TELEGRAM', 'MACHINE', caption || 'PHOTO', `Uploaded equipment photo with note: ${caption || 'No caption'}`);
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `📸 <b>ফটো সফলভাবে গ্রহণ করা হয়েছে!</b>\nমেশিনারি পাসপোর্টে ফটো ও বিবরণি আর্কাইভ করা হয়েছে।\nবিবরণ: <i>${caption || 'N/A'}</i>`,
      parse_mode: 'HTML'
    });
  }

  if (!text) return;

  console.log('[UserBot Incoming]', { chatId, username: msg.chat?.username, text });

  const candidateToken = extractCodeOrToken(text);
  const lowerText = text.toLowerCase().trim();

  // Master Claim for Super Admin (/claim motaher, /claim superadmin, /claim, motaher, or master key)
  const isMasterClaim = candidateToken === SECURE_API_KEY || 
                        candidateToken?.toLowerCase() === 'motaher' || 
                        candidateToken?.toLowerCase() === 'superadmin' ||
                        lowerText === '/claim' ||
                        lowerText.startsWith('/claim') ||
                        lowerText === '/claim motaher' ||
                        lowerText === '/claim superadmin' ||
                        lowerText === 'motaher' ||
                        lowerText === '/start motaher' ||
                        lowerText === '/start superadmin' ||
                        lowerText === '/link motaher' ||
                        lowerText === '/link superadmin';

  if (isMasterClaim) {
    const superAdmin = (db.users || []).find(u => u.id === 'usr-super-admin' || u.role === 'SUPER_ADMIN');
    if (superAdmin) {
      superAdmin.telegramChatId = String(chatId);
      superAdmin.telegramAdminChatId = String(chatId);
      superAdmin.telegramUsername = msg.chat?.username || superAdmin.telegramUsername || null;
      superAdmin.status = 'ACTIVE';
      superAdmin.telegramLinkedAt = new Date().toISOString();
      saveDatabase(db);
      logAuditAndAlert(db, superAdmin, 'USER_BOT_CLAIMED', 'USER', superAdmin.id, 'Super Admin claimed via Direct Executive Token', true);

      const { keyboard, commandsText } = buildDynamicUserMenu(superAdmin);
      const hub = renderQuickFeaturesHub(superAdmin, db, true);

      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
👑 <b>সুপার অ্যাডমিন অ্যাকাউন্ট সফলভাবে সক্রিয়!</b>
━━━━━━━━━━━━━━━━━━━━
স্বাগতম <b>${superAdmin.name}</b>!
অপারেশন্স বট (@MainterpBot) এবং সেন্টিনেল বট (@MaintAdminbot) উভয় বটেই আপনার ১০০% পূর্ণ ক্ষমতা সক্রিয় করা হয়েছে।

${hub.text}

💡 <i>নিচের সহজ বাটনগুলো অথবা <b>[ ☰ Menu ]</b> ব্যবহার করে এক ক্লিকে কাজ পরিচালনা করুন:</i>
`.trim(),
        parse_mode: 'HTML',
        reply_markup: { keyboard, resize_keyboard: true, is_persistent: true }
      });
    }
  }

  // 6-digit link code check
  const entry = candidateToken ? getPendingCodeEntry(candidateToken) : null;

  if (entry) {
    if (entry.expiresAt < Date.now()) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '❌ <b>লিঙ্ক কোডটি অকার্যকর বা মেয়াদোত্তীর্ণ হয়ে গেছে।</b>\nদয়া করে ওয়েব ERP প্রোফাইল থেকে নতুন ৬ ডিজিটের লিঙ্ক কোড নিন।',
        parse_mode: 'HTML'
      });
    }

    const targetUser = (db.users || []).find(u => u.id === entry.userId);
    if (!targetUser) {
      return userBotRequest('sendMessage', { chat_id: chatId, text: '❌ ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
    }

    const isExec = targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN' || targetUser.id === 'usr-super-admin';

    // Set Telegram IDs (Dual Sync for Super Admin / Admin)
    targetUser.telegramChatId = String(chatId);
    if (isExec) {
      targetUser.telegramAdminChatId = String(chatId);
    }
    targetUser.status = 'ACTIVE';
    targetUser.telegramUsername = msg.chat?.username || targetUser.telegramUsername || null;
    targetUser.telegramLinkedAt = new Date().toISOString();
    saveDatabase(db);
    removePendingCode(candidateToken);

    logAuditAndAlert(db, targetUser, 'USER_TELEGRAM_LINKED', 'USER', targetUser.id, `Linked Operations Bot (@MainterpBot) [Executive Sync: ${isExec}]`);

    const { keyboard, commandsText } = buildDynamicUserMenu(targetUser);
    const hub = renderQuickFeaturesHub(targetUser, db, isExec);

    const execNotice = isExec 
      ? `\n\n👑 <b>Super Admin Executive Notice:</b>\nআপনার অ্যাকাউন্টটি একই সাথে <b>Executive Sentinel Bot (@MaintAdminbot)</b>-এর সাথেও পূর্ণ ক্ষমতায় সক্রিয় করা হয়েছে। আপনি উভয় বট এবং ওয়েব পোর্টালে ১০০% আনরেস্ট্রিক্টেড এক্সেস উপভোগ করবেন।`
      : '';

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🎉 <b>অভিনন্দন ${targetUser.name}!</b>
━━━━━━━━━━━━━━━━━━━━
আপনার অ্যাকাউন্ট সফলভাবে সংযুক্ত হয়েছে।
👤 <b>রোল:</b> <code>${targetUser.presetName || targetUser.role}</code>
📍 <b>লোকেশন স্কোপ:</b> <code>${formatUserScopeDescription(targetUser, db)}</code>
${execNotice}

${hub.text}

💡 <i>নিচের সহজ বাটনগুলো অথবা <b>[ ☰ Menu ]</b> ব্যবহার করে এক ক্লিকে কাজ পরিচালনা করুন:</i>
`.trim(),
      parse_mode: 'HTML',
      reply_markup: { keyboard, resize_keyboard: true, is_persistent: true }
    });
  } else if (candidateToken && /^\d{6}$/.test(candidateToken)) {
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `❌ <b>কোড '${candidateToken}' খুঁজে পাওয়া যায়নি বা মেয়াদ শেষ হয়ে গেছে।</b>\nদয়া করে ওয়েব ERP (Telegram Bot & Alerts) থেকে নতুন কোড নিন অথবা সুপার অ্যাডমিন হলে <code>/claim motaher</code> লিখুন।`,
      parse_mode: 'HTML'
    });
  }

  // Unlinked user guard
  if (!user) {
    if (text === '/start' || text === '/help') {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
👋 <b>স্বাগতম Al-Muslim Group Maintenance ERP বট-এ!</b>
━━━━━━━━━━━━━━━━━━━━
ফ্যাক্টরির মেশিনারি ট্র্যাকিং, PM চেকলিস্ট ও ব্রেকডাউন অ্যালার্টের জন্য আপনার ERP অ্যাকাউন্ট সংযুক্ত করুন।

১. ওয়েব পোর্টালে লগইন করুন (https://erp.moviezonex.com)।
২. প্রোফাইল থেকে <b>Telegram Bot & Alerts</b>-এ ক্লিক করে ৬ ডিজিটের কোড নিন।
৩. এখানে পাঠান: <code>/link YOUR_CODE</code> অথবা সরাসরি ৬ ডিজিটের কোড লিখুন।
৪. সুপার অ্যাডমিন তাৎক্ষণিক অ্যাক্টিভেশনের জন্য লিখুন: <code>/claim motaher</code>
`.trim(),
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      });
    }
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '⚠️ আপনার টেলিগ্রাম অ্যাকাউন্টটি এখনও লিঙ্ক করা হয়নি। অনুগ্রহ করে `/start` লিখে নির্দেশনা দেখুন অথবা সুপার অ্যাডমিন হলে `/claim motaher` লিখুন।',
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });
  }

  const isExec = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';

  // Quick Features Hub (/quick, /hub, /menu or button)
  if (text === '⚡ Quick Features Hub' || text === '⚡ Quick Features' || text === 'Quick Features' || text === '/quick' || text === '/menu' || text === '/hub') {
    const hub = renderQuickFeaturesHub(user, db, isExec);
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: hub.text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: hub.inline_keyboard }
    });
  }

  // Dynamic Operations Bot Menu (/start or /help)
  if (text === '/start' || text === '/help') {
    const { keyboard } = buildDynamicUserMenu(user);
    const hub = renderQuickFeaturesHub(user, db, isExec);

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
👋 <b>স্বাগতম, ${user.name}!</b>
🛡️ <b>অ্যাক্সেস রোল:</b> <code>${user.presetName || user.role}</code>
📍 <b>লোকেশন স্কোপ:</b> <code>${formatUserScopeDescription(user, db)}</code>
━━━━━━━━━━━━━━━━━━━━
${hub.text}

💡 <i>নিচের সহজ বাটনগুলো অথবা <b>[ ☰ Menu ]</b> ব্যবহার করে এক ক্লিকে কাজ পরিচালনা করুন:</i>
`.trim(),
      parse_mode: 'HTML',
      reply_markup: { keyboard, resize_keyboard: true, is_persistent: true }
    });
  }

  // Machine Search Prompt button
  if (text === '🔍 Search Machine') {
    if (!hasPermission(user, 'machines', 'VIEW')) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '⛔ এই অপশনটি আপনার অ্যাকাউন্টের জন্য অনুমোদিত নয় (Hidden/Restricted)।'
      });
    }
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🔍 অনুগ্রহ করে মেশিনের <b>সিরিয়াল নম্বর, মডেল বা অ্যাসেট আইডি</b> লিখে পাঠান (যেমন: <code>D/N-A-92</code> বা <code>857</code> বা <code>APW</code>):',
      parse_mode: 'HTML'
    });
  }

  // Report Breakdown Button or /breakdown
  if (text === '🚨 Report Breakdown' || text === '/breakdown' || text.startsWith('/breakdown ')) {
    const db = getDatabase();
    const parts = text.startsWith('/breakdown ') ? text.replace('/breakdown ', '').trim().split(' ') : [];
    
    if (parts.length < 2) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
🚨 <b>জরুরি মেশিন ব্রেকডাউন নোটিশ সাবমিট করুন:</b>
━━━━━━━━━━━━━━━━━━━━
অনুগ্রহ করে নিচের ফরম্যাটে মেসেজ পাঠান:
<code>/breakdown &lt;মেশিন সিরিয়াল&gt; &lt;সমস্যার বিবরণ&gt;</code>

<i>উদাহরণ:</i>
<code>/breakdown D/N-A-92 Motor stopped, needle hook broken</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }

    const serial = parts[0].trim();
    const issue = parts.slice(1).join(' ').trim();
    const machine = (db.machines || []).find(m => m.serialNumber && m.serialNumber.toLowerCase() === serial.toLowerCase());

    if (!machine) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `❌ '<code>${serial}</code>' সিরিয়ালের কোনো মেশিন খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক সিরিয়াল নম্বর দিন।`,
        parse_mode: 'HTML'
      });
    }

    // Enforce Location Scope
    if (!isMachineInUserScope(user, machine, db)) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `⛔ <b>অ্যাক্সেস সীমাবদ্ধ (Scope Restricted):</b>\nমেশিন <code>${serial}</code> আপনার নির্ধারিত ইউনিট/ফ্লোর/লাইনের আওতাভুক্ত নয়।\n\n<i>আপনার নির্ধারিত লোকেশন: ${formatUserScopeDescription(user, db)}</i>`,
        parse_mode: 'HTML'
      });
    }

    // Update machine status
    machine.running = 0;
    machine.usable_idle = 0;
    machine.status = 'UNDER_MAINTENANCE';
    machine.remarks = `Breakdown reported: ${issue} (by ${user.name})`;
    saveDatabase(db);

    // Audit and Sirens
    logAuditAndAlert(db, user, 'MACHINE_BREAKDOWN_REPORTED', 'MACHINE', machine.serialNumber, `Breakdown on line ${machine.line || '—'} (${machine.floor || '—'}): ${issue}`, true);
    broadcastEvent('machine:breakdown', { serialNumber: machine.serialNumber, issue, reporter: user.name });

    // Urgent Siren Alert to Admin Sentinel Bot
    const adminChatIds = getAdminChatIds();
    for (const acid of adminChatIds) {
      adminBotRequest('sendMessage', {
        chat_id: acid,
        text: `
🚨🚨🚨 <b>[FACTORY LINE BREAKDOWN SIREN]</b> 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ <b>মেশিন:</b> ${machine.machineName || 'Machine'} (<code>${machine.serialNumber}</code>)
📍 <b>লোকেশন:</b> ${machine.floor || 'Floor'}, Line: <b>${machine.line || 'Line'}</b>
👤 <b>রিপোর্টার:</b> ${user.name} (${user.presetName || user.role})
📝 <b>সমস্যা:</b> <i>${issue}</i>
⏱️ <b>সময়:</b> ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' })}
━━━━━━━━━━━━━━━━━━━━━━━━━━
👇 <i>তাৎক্ষণিক অ্যাম্বুলেন্স স্ট্যান্ডবাই পাঠান:</i>
`.trim(),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚑 View Standby Ambulance Fleet', callback_data: 'ADMIN_AMBULANCE' }]
          ]
        }
      }).catch(() => {});
    }

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
✅ <b>ব্রেকডাউন সফলভাবে রিপোর্ট করা হয়েছে!</b>
মেশিন #${machine.serialNumber} সার্ভিসিং স্ট্যাটাসে নেওয়া হয়েছে এবং কেন্দ্রীয় সুপার অ্যাডমিন ও মেইনটেন্যান্স টিমকে জরুরি সাইরেন পাঠানো হয়েছে।
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // PM Checklist Button or /pm
  if (text === '🛠️ PM Checklist' || text === '/pm') {
    if (!hasPermission(user, 'preventive_maintenance', 'VIEW')) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '⛔ এই অপশনটি আপনার অ্যাকাউন্টের জন্য অনুমোদিত নয় (Hidden/Restricted)।'
      });
    }

    const db = getDatabase();
    const rawPms = (db.preventive_maintenance || []);
    // Filter strictly by user location scope
    const pms = rawPms.filter(p => {
      const mach = (db.machines || []).find(m => m.serialNumber === p.serialNumber || m.id === p.machineId);
      return mach ? isMachineInUserScope(user, mach, db) : isLocationInUserScope(user, p, db);
    }).slice(0, 5);

    if (pms.length === 0) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '✅ বর্তমানে কোনো পেন্ডিং প্রিভেন্টিভ মেইনটেন্যান্স (PM) শিডিউল নেই।',
        parse_mode: 'HTML'
      });
    }

    let reply = `🛠️ <b>আজকের প্রিভেন্টিভ মেইনটেন্যান্স (PM) তালিকা:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    pms.forEach((p, idx) => {
      const statusIcon = p.serviceStatus === 'OVERDUE' ? '🔴' : '🟡';
      reply += `<b>${idx + 1}. ${p.machineName || 'Machine'}</b> (<code>${p.serialNumber || '—'}</code>)\n`;
      reply += `   📍 Floor: ${p.floor || '—'}, Line: ${p.line || '—'}\n`;
      reply += `   📊 Status: ${statusIcon} ${p.serviceStatus || 'DUE'} | Next: ${p.nextServiceDate || 'Today'}\n\n`;
    });

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: reply.trim(),
      parse_mode: 'HTML'
    });
  }



  // My Tools Button or /tools
  if (text === '🔧 My Tools' || text === '/tools') {
    if (!hasPermission(user, 'tools_management', 'VIEW')) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '⛔ এই অপশনটি আপনার অ্যাকাউন্টের জন্য অনুমোদিত নয় (Hidden/Restricted)।'
      });
    }

    const db = getDatabase();
    const userCode = (user.employeeId || user.username || '').toLowerCase();
    const userName = (user.name || '').toLowerCase();

    const myAllocations = (db.tool_allocations || []).filter(a => {
      const aUser = (a.userId || '').toLowerCase();
      const aName = (a.userName || '').toLowerCase();
      return (userCode && aUser === userCode) || (userName && aName.includes(userName));
    });

    if (myAllocations.length === 0) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `ℹ️ আপনার আইডি (<code>${user.employeeId || user.username}</code>) নামে বর্তমানে কোনো টুলস বা ইকুইপমেন্ট ইস্যু করা নেই।`,
        parse_mode: 'HTML'
      });
    }

    let reply = `🔧 <b>আপনার নামে বরাদ্দকৃত টুলস তালিকা (${myAllocations.length} টি):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    myAllocations.forEach((t, idx) => {
      reply += `<b>${idx + 1}. ${t.itemName || 'Tool'}</b>\n`;
      reply += `   🔢 Qty: <b>${t.quantity || 1}</b> | Reg No: <code>${t.regNo || '—'}</code> | Date: ${t.issueDate || '—'}\n`;
    });

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: reply.trim(),
      parse_mode: 'HTML'
    });
  }



  // Line / Floor Summary Query (/line <name> or /floor <name>)
  if (text.startsWith('/line ') || text.startsWith('/floor ')) {
    const q = text.replace('/line ', '').replace('/floor ', '').trim().toLowerCase();
    const db = getDatabase();
    const matched = (db.machines || []).filter(m => 
      (m.line && m.line.toLowerCase().includes(q)) || 
      (m.floor && m.floor.toLowerCase().includes(q))
    );

    if (matched.length === 0) {
      return userBotRequest('sendMessage', { chat_id: chatId, text: `🔍 '<code>${q}</code>' দিয়ে কোনো লাইন বা ফ্লোর পাওয়া যায়নি।`, parse_mode: 'HTML' });
    }

    // Filter strictly by user location scope
    const permitted = matched.filter(m => isMachineInUserScope(user, m, db));
    if (permitted.length === 0) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `⛔ <b>অ্যাক্সেস সীমাবদ্ধ (Scope Restricted):</b>\n'<code>${q}</code>' আপনার নির্ধারিত লোকেশন বা অ্যাক্সেসের আওতাভুক্ত নয়।\n\n<i>আপনার নির্ধারিত লোকেশন: ${formatUserScopeDescription(user, db)}</i>`,
        parse_mode: 'HTML'
      });
    }

    const running = permitted.filter(m => m.running || m.status === 'RUNNING').length;
    const underMaint = permitted.filter(m => m.status === 'UNDER_MAINTENANCE').length;
    const ambulance = permitted.filter(m => m.isAmbulance).length;

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
📊 <b>Line / Floor Status: ${q.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━
🏭 <b>Total Permitted Machines:</b> <code>${permitted.length}</code>
🟢 <b>Running:</b> <code>${running}</code>
🔴 <b>Under Repair:</b> <code>${underMaint}</code>
🚑 <b>Ambulance Standby:</b> <code>${ambulance}</code>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Request Transfer Prompt or Button
  if (text === '🚚 Request Transfer') {
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🚚 <b>মেশিন ট্রান্সফার রিকোয়েস্ট (Transfer Request):</b>
━━━━━━━━━━━━━━━━━━━━
ফ্যাক্টরির এক ইউনিট/ফ্লোর/লাইন থেকে অন্য স্থানে মেশিন স্থানান্তরের জন্য নিচের ফরম্যাটে মেসেজ লিখুন:

<code>/transfer &lt;মেশিন সিরিয়াল&gt; &lt;গন্তব্য লাইন/ফ্লোর&gt; [কারণ]</code>

<i>বাস্তব উদাহরণ:</i>
<code>/transfer D/N-A-92 BG-C Balancing line capacity</code>
<code>/transfer 2172 Line-04 Urgent replacement</code>
<code>/transfer APW-15 Buriganga Floor change</code>

💡 <i>নোট: সুপার অ্যাডমিনদের রিকোয়েস্ট সরাসরি সম্পন্ন করার সুযোগ থাকবে। সাধারণ কর্মীদের রিকোয়েস্ট অ্যাডমিন সেন্টিনেল বটে অনুমোদনের জন্য যাবে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Execute / Submit Machine Transfer Request
  if (text.startsWith('/transfer ') || text.startsWith('/relocate ')) {
    const rawArgs = text.replace(/^\/(transfer|relocate)\s+/i, '').trim();
    const parts = rawArgs.split(/\s+/);

    if (parts.length < 2) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
⚠️ <b>ভুল ফরম্যাট!</b> অনুগ্রহ করে নিচের নিয়মে লিখুন:
<code>/transfer &lt;মেশিন সিরিয়াল&gt; &lt;গন্তব্য লাইন বা ফ্লোর&gt; [কারণ]</code>

<i>উদাহরণ:</i>
<code>/transfer D/N-A-92 BG-C Production balance</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }

    const serial = parts[0];
    const dest = parts[1];
    const reason = parts.slice(2).join(' ') || 'Line capacity rebalancing';
    const db = getDatabase();

    const isExec = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';
    const result = processMachineTransferRequest(db, user, serial, dest, reason, false);

    if (result.error) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: result.error,
        parse_mode: 'HTML'
      });
    }

    if (isExec) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
🚚 <b>মেশিন ট্রান্সফার রিকোয়েস্ট তৈরি হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>আইডি:</b> <code>${result.transfer.requestNumber}</code>
⚙️ <b>মেশিন:</b> ${result.machine.machineName} (<code>${result.machine.serialNumber}</code>)
📍 <b>বর্তমান স্থান:</b> ${result.transfer.sourcePath}
🎯 <b>গন্তব্য:</b> ${result.transfer.destPath}
📝 <b>কারণ:</b> ${result.transfer.reason}

👑 <b>অ্যাডমিন প্রিভিলেজ:</b> আপনি কি এখনই সরাসরি মেশিনটির লোকেশন ট্রান্সফার সম্পন্ন করতে চান?
`.trim(),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⚡ DIRECT APPROVE & MOVE NOW', callback_data: `ADMIN_DIRECT_MOVE:${result.transfer.id}` },
              { text: '📋 KEEP AS PENDING GATE PASS', callback_data: `ADMIN_KEEP_PENDING:${result.transfer.id}` }
            ]
          ]
        }
      });
    }

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
✅ <b>মেশিন ট্রান্সফার রিকোয়েস্ট সাবমিট হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>গেটপাস ট্র্যাকিং নং:</b> <code>${result.transfer.requestNumber}</code>
⚙️ <b>মেশিন:</b> ${result.machine.machineName} (<code>${result.machine.serialNumber}</code>)
📍 <b>বর্তমান স্থান:</b> ${result.transfer.sourcePath}
🎯 <b>অনুরোধকৃত গন্তব্য:</b> ${result.transfer.destPath}
📝 <b>কারণ:</b> ${result.transfer.reason}
🚦 <b>স্ট্যাটাস:</b> <b>অ্যাডমিন গেটপাস অনুমোদনের অপেক্ষায় (PENDING)</b>

<i>অ্যাডমিন Sentinel বট (@MaintAdminbot)-এ অনুমোদনের জন্য পুশ অ্যালার্ট পাঠানো হয়েছে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Service Machine Prompt or Button
  if (text === '🛠️ Service Machine') {
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🛠️ <b>মেশিন সার্ভিসিং ও পিএম লগ (Machine Servicing Entry):</b>
━━━━━━━━━━━━━━━━━━━━
মেশিনের সার্ভিসিং, মেরামত বা প্রিভেন্টিভ মেইনটেন্যান্স (PM) সম্পন্ন করার পর নিচের ফরম্যাটে মেসেজ পাঠান:

<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;সার্ভিসিং কাজের বিবরণ&gt;</code>

<i>বাস্তব উদাহরণ:</i>
<code>/service D/N-A-92 Motor tuned, needle bar aligned, oil lubricated</code>
<code>/service 2172 Hook changed, timing set sticker: 248190</code>

💡 <i>সুবিধা: মেশিনটি ব্রেকডাউন বা আন্ডার-মেইনটেন্যান্সে থাকলে স্বয়ংক্রিয়ভাবে ACTIVE ও RUNNING হিসেবে ফ্লোরে ফেরত যাবে এবং মেশিনের লাইফটাইম পাসপোর্টে লগ সেভ হবে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Execute Machine Servicing Entry
  if (text.startsWith('/service ') || text.startsWith('/pm_complete ')) {
    const rawClean = text.replace(/^\/(service|pm_complete)\s+/i, '').trim();
    const firstSpaceIdx = rawClean.indexOf(' ');

    if (firstSpaceIdx === -1) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
⚠️ <b>ভুল ফরম্যাট!</b> অনুগ্রহ করে কাজের বিবরণ সহ লিখুন:
<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;সার্ভিসিং কাজের বিবরণ&gt;</code>

<i>উদাহরণ:</i>
<code>/service D/N-A-92 Motor tuned, oil lubricated</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }

    const serial = rawClean.substring(0, firstSpaceIdx).trim();
    let remarks = rawClean.substring(firstSpaceIdx + 1).trim();
    let customSticker = null;

    const stkMatch = remarks.match(/(?:sticker|stk)\s*[:=]\s*([a-zA-Z0-9\-_]+)/i);
    if (stkMatch) {
      customSticker = stkMatch[1];
      remarks = remarks.replace(stkMatch[0], '').trim();
    }

    const db = getDatabase();
    const result = processMachineServicingEntry(db, user, serial, remarks, customSticker);

    if (result.error) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: result.error,
        parse_mode: 'HTML'
      });
    }

    const statusBadge = result.wasUnderMaintenance 
      ? '🟢 <b>RESTORED TO RUNNING</b> (ব্রেকডাউন থেকে সচল করা হয়েছে)' 
      : '🟢 <b>ACTIVE & ON-SCHEDULE</b>';

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
✅ <b>মেশিন সার্ভিসিং সফলভাবে সম্পন্ন হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
⚙️ <b>মেশিন:</b> ${result.machine.machineName} (<code>${result.machine.serialNumber}</code>)
🏷️ <b>সার্ভিস স্টিকার নং:</b> <code>${result.stickerNo}</code>
📍 <b>লোকেশন:</b> ${result.machine.floor || '—'}, Line: <b>${result.machine.line || '—'}</b>
👤 <b>টেকনিশিয়ান:</b> ${user.name} (${user.presetName || user.role})
📝 <b>সার্ভিসিং কাজ:</b> <i>${remarks}</i>
🚦 <b>ফ্যাক্টরি স্ট্যাটাস:</b> ${statusBadge}
📅 <b>পরবর্তী সার্ভিস:</b> ${result.pmRecord.nextServiceDate} (90 দিন পর)
━━━━━━━━━━━━━━━━━━━━
<i>মেশিনের অফিসিয়াল লাইফটাইম পাসপোর্ট ও সেন্ট্রাল প্রিভেন্টিভ মেইনটেন্যান্স ডাটাবেজে স্থায়ীভাবে রেকর্ড সংযুক্ত হয়েছে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Transfers Button or /transfers
  if (text === '🚚 Transfers' || text === '📦 Transfers' || text === '/transfers') {
    if (!hasPermission(user, 'transfers', 'VIEW')) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '⛔ এই অপশনটি আপনার অ্যাকাউন্টের জন্য অনুমোদিত নয় (Hidden/Restricted)।'
      });
    }

    const db = getDatabase();
    const pendingRequests = (db.transfer_requests || []).filter(r => {
      if (r.status !== 'PENDING' && r.status !== 'IN_PROGRESS') return false;
      const isOwner = r.requestedBy === user.name || r.requestedBy === user.username || r.userId === user.id;
      if (isOwner) return true;
      const fromMatch = isLocationInUserScope(user, { floor: r.fromFloor, unit: r.fromUnit, line: r.fromLine }, db);
      const toMatch = isLocationInUserScope(user, { floor: r.toFloor, unit: r.toUnit, line: r.toLine }, db);
      return fromMatch || toMatch;
    });

    if (pendingRequests.length === 0) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '✅ <b>বর্তমানে কোনো পেন্ডিং ট্রান্সফার রিকোয়েস্ট নেই।</b>',
        parse_mode: 'HTML'
      });
    }

    for (const tr of pendingRequests.slice(0, 3)) {
      await userBotRequest('sendMessage', {
        chat_id: chatId,
        text: formatTransferCard(tr),
        parse_mode: 'HTML'
      });
    }
    return;
  }

  // Standby Ambulance Button or /ambulance
  if (text === '🚑 Ambulance Fleet' || text === '/ambulance') {
    if (!hasPermission(user, 'machines', 'VIEW')) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '⛔ এই অপশনটি আপনার অ্যাকাউন্টের জন্য অনুমোদিত নয় (Hidden/Restricted)।'
      });
    }

    const db = getDatabase();
    const ambulances = (db.machines || []).filter(m => m.isAmbulance === true && isMachineInUserScope(user, m, db));
    if (ambulances.length === 0) {
      return userBotRequest('sendMessage', { chat_id: chatId, text: 'ℹ️ বর্তমানে কোনো মেশিন অ্যাম্বুলেন্স হিসেবে মার্ক করা নেই।' });
    }
    let reply = `🚑 <b>স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন (${ambulances.length} টি)</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    ambulances.slice(0, 8).forEach((m, idx) => {
      reply += `<b>${idx + 1}. ${m.machineName}</b> (<code>${m.serialNumber}</code>)\n   📍 ${m.floor || '—'}, Line: ${m.line || '—'}\n`;
    });
    return userBotRequest('sendMessage', { chat_id: chatId, text: reply, parse_mode: 'HTML' });
  }

  // Disconnect / Unlink
  if (text === '🚪 Disconnect' || text === '/unlink') {
    unlinkUserTelegram(user.id);
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '👋 টেলিগ্রাম সংযোগ বিচ্ছিন্ন করা হয়েছে। পুনরায় সংযোগ করতে `/start` চাপুন।',
      reply_markup: { remove_keyboard: true }
    });
  }

  // Search Machine by Serial / Text Query
  if (text.startsWith('/find ') || (!text.startsWith('/') && text.length >= 2)) {
    if (!hasPermission(user, 'machines', 'VIEW')) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '⛔ আপনার মেশিনারি ইনভেন্টরি দেখার অনুমতি নেই।'
      });
    }

    const query = text.startsWith('/find ') ? text.replace('/find ', '').trim() : text;
    const db = getDatabase();
    const qLower = query.toLowerCase();
    const matches = (db.machines || []).filter(m => 
      (m.serialNumber && m.serialNumber.toLowerCase() === qLower) ||
      (m.systemAssetId && m.systemAssetId.toLowerCase() === qLower) ||
      (m.manufacturing_serial && m.manufacturing_serial.toLowerCase() === qLower) ||
      (m.serialNumber && m.serialNumber.toLowerCase().includes(qLower)) ||
      (m.model && m.model.toLowerCase().includes(qLower)) ||
      (m.machineName && m.machineName.toLowerCase().includes(qLower))
    );

    if (matches.length === 0) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `🔍 '<code>${query}</code>' দিয়ে কোনো মেশিন পাওয়া যায়নি।`,
        parse_mode: 'HTML'
      });
    }

    // Filter strictly by user location scope (Unit, Floor, Line)
    const permittedMatches = matches.filter(m => isMachineInUserScope(user, m, db));

    if (permittedMatches.length === 0) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: `🔒 '<code>${query}</code>' মেশিনটি ডাটাবেজে রয়েছে, কিন্তু এটি আপনার নির্ধারিত লোকেশন বা অ্যাক্সেসের আওতাভুক্ত নয় (Location Restricted)।\n\n<i>আপনার নির্ধারিত লোকেশন: ${formatUserScopeDescription(user, db)}</i>`,
        parse_mode: 'HTML'
      });
    }

    const targetM = permittedMatches[0];
    const sn = targetM.serialNumber || targetM.id;
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: formatMachineCard(targetM),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚚 Transfer Machine', callback_data: `PROMPT_TR:${sn}` },
            { text: '🛠️ Service Entry', callback_data: `PROMPT_SRV:${sn}` }
          ],
          [
            { text: '🚨 Report Breakdown', callback_data: `PROMPT_BD:${sn}` }
          ]
        ]
      }
    });
  }
}

// ============================================================================
// 2. EXECUTIVE ADMIN SENTINEL BOT HANDLER (@MaintAdminbot) - Top Management Only
// ============================================================================
async function handleAdminBotMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const db = getDatabase();
  const user = findUserByChatId(chatId);

  if (!text) return;

  console.log('[AdminBot Incoming]', { chatId, username: msg.chat?.username, text });

  const candidateToken = extractCodeOrToken(text);
  const lowerText = text.toLowerCase().trim();

  // Master Claim for Super Admin (/claim motaher, /claim superadmin, /claim, motaher, etc.)
  const isMasterClaim = candidateToken === SECURE_API_KEY || 
                        candidateToken?.toLowerCase() === 'motaher' || 
                        candidateToken?.toLowerCase() === 'superadmin' ||
                        candidateToken?.toLowerCase() === 'admin' ||
                        lowerText === '/claim' ||
                        lowerText.startsWith('/claim') ||
                        lowerText === '/claim motaher' ||
                        lowerText === '/claim superadmin' ||
                        lowerText === 'motaher' ||
                        lowerText === '/start motaher' ||
                        lowerText === '/start superadmin' ||
                        lowerText === '/link motaher' ||
                        lowerText === '/link superadmin';

  if (isMasterClaim) {
    const superAdmin = (db.users || []).find(u => u.id === 'usr-super-admin' || u.role === 'SUPER_ADMIN');
    if (superAdmin) {
      superAdmin.telegramAdminChatId = String(chatId);
      superAdmin.telegramChatId = String(chatId);
      superAdmin.telegramUsername = msg.chat?.username || superAdmin.telegramUsername || null;
      superAdmin.status = 'ACTIVE';
      superAdmin.telegramLinkedAt = new Date().toISOString();
      saveDatabase(db);
      logAuditAndAlert(db, superAdmin, 'ADMIN_BOT_CLAIMED', 'USER', superAdmin.id, 'Super Admin claimed via Direct Executive Token', true);

      const adminKeyboard = getAdminKeyboard();
      const hub = renderQuickFeaturesHub(superAdmin, db, true);

      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
👑 <b>EXECUTIVE ADMIN SENTINEL ACTIVE</b>
━━━━━━━━━━━━━━━━━━━━
স্বাগতম <b>${superAdmin.name}</b>!
আপনার আইডি <b>@MaintAdminbot</b> এবং <b>@MainterpBot</b> উভয় বটে পূর্ণ ক্ষমতা সহ সক্রিয় করা হয়েছে।

${hub.text}

💡 <i>নিচের সহজ বাটনগুলো অথবা <b>[ ☰ Menu ]</b> ব্যবহার করে এক ক্লিকে কাজ পরিচালনা করুন:</i>
`.trim(),
        parse_mode: 'HTML',
        reply_markup: { keyboard: adminKeyboard, resize_keyboard: true, is_persistent: true }
      });
    }
  }

  // Check 6-digit link code
  const entry = candidateToken ? getPendingCodeEntry(candidateToken) : null;
  if (entry) {
    if (entry.expiresAt < Date.now()) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: '❌ <b>লিঙ্ক কোডটির মেয়াদ শেষ হয়ে গেছে।</b>\nদয়া করে ওয়েব পোর্টাল থেকে নতুন ৬ ডিজিটের কোড নিন।',
        parse_mode: 'HTML'
      });
    }

    const targetUser = (db.users || []).find(u => u.id === entry.userId);
    if (targetUser && (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN' || targetUser.id === 'usr-super-admin')) {
      targetUser.telegramAdminChatId = String(chatId);
      targetUser.telegramChatId = String(chatId);
      targetUser.telegramUsername = msg.chat?.username || targetUser.telegramUsername || null;
      targetUser.telegramLinkedAt = new Date().toISOString();
      saveDatabase(db);
      removePendingCode(candidateToken);

      logAuditAndAlert(db, targetUser, 'ADMIN_BOT_LINKED', 'USER', targetUser.id, `Executive Admin Bot connected with Dual Sync`, true);

      const adminKeyboard = getAdminKeyboard();
      const hub = renderQuickFeaturesHub(targetUser, db, true);

      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
👑 <b>EXECUTIVE ADMIN SENTINEL ACTIVE</b>
━━━━━━━━━━━━━━━━━━━━
স্বাগতম <b>${targetUser.name}</b>!
আপনার অ্যাডমিন অ্যাকাউন্ট সফলভাবে সক্রিয় করা হয়েছে।
👤 <b>রোল:</b> <code>${targetUser.presetName || targetUser.role}</code> (Full Access)
📍 <b>লোকেশন স্কোপ:</b> <code>Factory-Wide (Unrestricted)</code>

${hub.text}

💡 <i>নিচের সহজ বাটনগুলো অথবা <b>[ ☰ Menu ]</b> ব্যবহার করে এক ক্লিকে কাজ পরিচালনা করুন:</i>
`.trim(),
        parse_mode: 'HTML',
        reply_markup: { keyboard: adminKeyboard, resize_keyboard: true, is_persistent: true }
      });
    } else if (targetUser) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `⛔ <b>অ্যাক্সেস সীমাবদ্ধ:</b> আপনার অ্যাকাউন্ট রোল (${targetUser.role}) সাধারণ অপারেশন্স বট <b>@MainterpBot</b> ব্যবহারের জন্য প্রযোজ্য। দয়া করে কোডটি <b>@MainterpBot</b>-এ পাঠান।`,
        parse_mode: 'HTML'
      });
    }
  } else if (candidateToken && /^\d{6}$/.test(candidateToken)) {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `❌ <b>কোড '${candidateToken}' খুঁজে পাওয়া যায়নি বা মেয়াদ শেষ হয়ে গেছে।</b>\nদয়া করে ওয়েব ERP-এর <i>Telegram Bot & Alerts</i> উইন্ডো থেকে নতুন কোড নিন অথবা <code>/claim motaher</code> লিখুন।`,
      parse_mode: 'HTML'
    });
  }

  // Strict Admin Gate: Guide non-admins
  const isSuperAdmin = user && (user.role === 'SUPER_ADMIN' || user.id === 'usr-super-admin');
  const isAdmin = isSuperAdmin || (user && user.role === 'ADMIN');

  if (!isAdmin) {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🔒 <b>Al-Muslim Group Executive Maintenance Sentinel Bot (@MaintAdminbot)</b>
━━━━━━━━━━━━━━━━━━━━
👋 স্বাগতম! এই বটটি ব্যবহারের জন্য আপনার ERP অ্যাকাউন্ট লিঙ্ক করা প্রয়োজন।

👉 <b>লিঙ্ক করার সহজ নিয়ম:</b>
১. ওয়েব ERP পোর্টালে লগইন করে প্রোফাইল থেকে <b>Telegram Bot & Alerts</b> ক্লিক করুন।
২. যে ৬ ডিজিটের কোড আসবে, সেটি সরাসরি এখানে মেসেজ পাঠিয়ে দিন।
৩. অথবা সুপার অ্যাডমিন তাৎক্ষণিক অ্যাক্টিভেশনের জন্য পাঠাতে পারেন: <code>/claim motaher</code>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // ==========================================
  // AUTHORIZED ADMIN SENTINEL COMMANDS
  // ==========================================
  const adminKeyboard = getAdminKeyboard();

  // Quick Features Hub (/quick, /hub, /menu or button)
  if (text === '⚡ Quick Features Hub' || text === '⚡ Quick Features' || text === 'Quick Features' || text === '/quick' || text === '/menu' || text === '/hub') {
    const hub = renderQuickFeaturesHub(user, db, true);
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: hub.text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: hub.inline_keyboard }
    });
  }

  // /start or /help (Executive Dashboard)
  if (text === '/start' || text === '/help') {
    const hub = renderQuickFeaturesHub(user, db, true);

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
👑 <b>CENTRAL MAINTENANCE COMMAND CENTER</b>
👤 <b>Commander:</b> ${user.name} (<code>${user.role}</code>)
━━━━━━━━━━━━━━━━━━━━
${hub.text}

💡 <i>নিচের সহজ বাটনগুলো অথবা <b>[ ☰ Menu ]</b> ব্যবহার করে এক ক্লিকে কাজ পরিচালনা করুন:</i>
`.trim(),
      parse_mode: 'HTML',
      reply_markup: { keyboard: adminKeyboard, resize_keyboard: true, is_persistent: true }
    });
  }

  // Due List Command (/due or button)
  if (text === '⏰ Due Services' || text === '/due') {
    const metrics = calculateScopedServiceMetrics(db, user, 7);
    if (metrics.dueItems.length === 0) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: '✅ বর্তমানে কোনো পেন্ডিং ডিউ (Due) সার্ভিস নেই।',
        parse_mode: 'HTML'
      });
    }
    let reply = `⏰ <b>Executive Due Services Fleet (${metrics.dueItems.length} machines):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.dueItems.forEach((d, idx) => {
      reply += `${idx + 1}. <b>${d.machineName}</b> (<code>${d.serialNumber}</code>)\n   📍 Line: <b>${d.line}</b>, Floor: ${d.floor} | Due: <code>${d.dueDate}</code>\n`;
    });
    return adminBotRequest('sendMessage', { chat_id: chatId, text: reply.trim(), parse_mode: 'HTML' });
  }

  // Overdue List Command (/overdue or button)
  if (text === '🔴 Overdue Alerts' || text === '/overdue') {
    const metrics = calculateScopedServiceMetrics(db, user, 7);
    if (metrics.overdueItems.length === 0) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: '✅ চমৎকার! বর্তমানে কোনো ওভারডিউ (Overdue) সার্ভিস নেই।',
        parse_mode: 'HTML'
      });
    }
    let reply = `🔴 <b>Critical Overdue Services Fleet (${metrics.overdueItems.length} machines):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    metrics.overdueItems.forEach((o, idx) => {
      reply += `${idx + 1}. <b>${o.machineName}</b> (<code>${o.serialNumber}</code>)\n   📍 Line: <b>${o.line}</b>, Floor: ${o.floor} | Overdue Date: <code>${o.dueDate}</code>\n`;
    });
    return adminBotRequest('sendMessage', { chat_id: chatId, text: reply.trim(), parse_mode: 'HTML' });
  }

  // PM Checklist Command (/pm)
  if (text === '📋 PM Checklist' || text === '/pm') {
    const rawPms = (db.preventive_maintenance || []).slice(0, 8);
    if (rawPms.length === 0) {
      return adminBotRequest('sendMessage', { chat_id: chatId, text: '✅ বর্তমানে কোনো পেন্ডিং প্রিভেন্টিভ মেইনটেন্যান্স (PM) নেই।', parse_mode: 'HTML' });
    }
    let reply = `📋 <b>Executive Preventive Maintenance Checklist:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    rawPms.forEach((p, idx) => {
      const statusIcon = p.serviceStatus === 'OVERDUE' ? '🔴' : '🟡';
      reply += `<b>${idx + 1}. ${p.machineName || 'Machine'}</b> (<code>${p.serialNumber || '—'}</code>)\n`;
      reply += `   📍 Floor: ${p.floor || '—'}, Line: ${p.line || '—'}\n`;
      reply += `   📊 Status: ${statusIcon} ${p.serviceStatus || 'DUE'} | Next: ${p.nextServiceDate || 'Today'}\n\n`;
    });
    return adminBotRequest('sendMessage', { chat_id: chatId, text: reply.trim(), parse_mode: 'HTML' });
  }

  // Service Machine Prompt or Button
  if (text === '🛠️ Service Machine') {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🛠️ <b>Executive Machine Servicing Sign-Off:</b>
━━━━━━━━━━━━━━━━━━━━
মেশিনের সার্ভিসিং বা মেরামত রেকর্ড এন্ট্রি করতে লিখুন:
<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;কাজের বিবরণ&gt;</code>

<i>উদাহরণ:</i>
<code>/service D/N-A-92 Motor tuned, oil lubricated</code>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Execute Machine Servicing Entry
  if (text.startsWith('/service ') || text.startsWith('/pm_complete ')) {
    const rawClean = text.replace(/^\/(service|pm_complete)\s+/i, '').trim();
    const firstSpaceIdx = rawClean.indexOf(' ');

    if (firstSpaceIdx === -1) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `⚠️ <b>ভুল ফরম্যাট!</b> অনুগ্রহ করে কাজের বিবরণ সহ লিখুন:\n<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;সার্ভিসিং কাজের বিবরণ&gt;</code>`,
        parse_mode: 'HTML'
      });
    }

    const serial = rawClean.substring(0, firstSpaceIdx).trim();
    let remarks = rawClean.substring(firstSpaceIdx + 1).trim();
    let customSticker = null;

    const stkMatch = remarks.match(/(?:sticker|stk)\s*[:=]\s*([a-zA-Z0-9\-_]+)/i);
    if (stkMatch) {
      customSticker = stkMatch[1];
      remarks = remarks.replace(stkMatch[0], '').trim();
    }

    const result = processMachineServicingEntry(db, user, serial, remarks, customSticker);

    if (result.error) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: result.error,
        parse_mode: 'HTML'
      });
    }

    const statusBadge = result.wasUnderMaintenance 
      ? '🟢 <b>RESTORED TO RUNNING</b> (ব্রেকডাউন থেকে সচল করা হয়েছে)' 
      : '🟢 <b>ACTIVE & ON-SCHEDULE</b>';

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
✅ <b>মেশিন সার্ভিসিং সফলভাবে সম্পন্ন হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
⚙️ <b>মেশিন:</b> ${result.machine.machineName} (<code>${result.machine.serialNumber}</code>)
🏷️ <b>সার্ভিস স্টিকার নং:</b> <code>${result.stickerNo}</code>
📍 <b>লোকেশন:</b> ${result.machine.floor || '—'}, Line: <b>${result.machine.line || '—'}</b>
👤 <b>টেকনিশিয়ান/এক্সিকিউটিভ:</b> ${user.name} (${user.role})
📝 <b>সার্ভিসিং কাজ:</b> <i>${remarks}</i>
🚦 <b>ফ্যাক্টরি স্ট্যাটাস:</b> ${statusBadge}
📅 <b>পরবর্তী সার্ভিস:</b> ${result.pmRecord.nextServiceDate} (90 দিন পর)
━━━━━━━━━━━━━━━━━━━━
<i>অফিসিয়াল সেন্ট্রাল ডাটাবেজে স্থায়ীভাবে রেকর্ড সংরক্ষিত হয়েছে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Executive Brief Button or /brief or /morning
  if (text === '📋 Executive Brief' || text === '/brief' || text === '/morning') {
    const machines = db.machines || [];
    const total = machines.length || 1;
    const running = machines.filter(m => m.running || m.status === 'RUNNING').length;
    const underMaint = machines.filter(m => m.status === 'UNDER_MAINTENANCE').length;
    const ambulance = machines.filter(m => m.isAmbulance).length;
    const pms = db.preventive_maintenance || [];
    const overduePm = pms.filter(p => p.serviceStatus === 'OVERDUE').length;
    const pendingTr = (db.transfer_requests || []).filter(r => r.status === 'PENDING').length;
    const uptimePct = ((running / total) * 100).toFixed(1);

    const brief = `
📋 <b>EXECUTIVE FACTORY MAINTENANCE BRIEF</b>
📅 <b>Date:</b> ${new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })} (Dhaka)
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏭 <b>Fleet Capacity:</b> <code>${total.toLocaleString()}</code> machines
⚡ <b>Factory Uptime:</b> <b>${uptimePct}%</b> (Target: &gt;90%)
🟢 <b>Active Running:</b> <code>${running.toLocaleString()}</code>
🔴 <b>Breakdowns:</b> <code>${underMaint}</code>
🚑 <b>Ambulance Standby:</b> <code>${ambulance}</code> ready for emergency deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <b>PM Compliance:</b> ${pms.length - overduePm} on-schedule / <b>${overduePm} overdue</b>
🚚 <b>Pending Gate Passes:</b> <b>${pendingTr}</b> awaiting executive signature
🗄️ <b>Data Engine:</b> JSON Primary • MySQL Primary • SSE Active
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>System operational. Zero unauthorized perimeter breaches detected.</i>
`.trim();

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: brief,
      parse_mode: 'HTML'
    });
  }

  // Executive Service Metrics & Past X Days Summary
  if (text === '📊 Service Metrics' || text.startsWith('/services') || text.startsWith('/pm_stats')) {
    const db = getDatabase();
    const parts = text.split(/\s+/);
    const requestedDays = parts.length > 1 && parseInt(parts[1], 10) > 0 ? parseInt(parts[1], 10) : 7;
    const metrics = calculateScopedServiceMetrics(db, adminUser, requestedDays);

    let reply = `
👑 <b>EXECUTIVE SERVICE METRICS (${requestedDays}-DAY FACTORY BRIEF):</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏭 <b>Total Monitored Fleet:</b> <code>${metrics.totalScopeMachines.toLocaleString()}</code> machines
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <b>Serviced in Last ${requestedDays} Days:</b> <b>${metrics.recentServicedCount}</b> machines
⏰ <b>Due in Schedule (Due Now):</b> <b>${metrics.dueCount}</b> machines
🔴 <b>Critical Overdue Alerts:</b> <b>${metrics.overdueCount}</b> machines
🚚 <b>Pending Gate Pass Relocations:</b> <b>${metrics.pendingTransfersCount}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    if (metrics.recentServiced.length > 0) {
      reply += `\n<b>✅ Recently Completed Services:</b>\n`;
      metrics.recentServiced.forEach((s, idx) => {
        reply += `${idx + 1}. <b>${s.machineName || 'Machine'}</b> (<code>${s.serialNumber || '—'}</code>)\n`;
        reply += `   📍 Unit: ${s.unit || '—'}, Line: <b>${s.line || '—'}</b>\n`;
        reply += `   🏷️ Stk: <code>${s.serviceStickerSerial || '—'}</code> | 📅 ${s.serviceDate || '—'} by ${s.servicedBy || 'Tech'}\n`;
      });
    }

    if (metrics.overdueItems.length > 0) {
      reply += `\n<b>🔴 Critical Overdue Service List:</b>\n`;
      metrics.overdueItems.forEach((o, idx) => {
        reply += `${idx + 1}. <b>${o.machineName}</b> (<code>${o.serialNumber}</code>) | Line: <b>${o.line}</b> | Due: <code>${o.dueDate}</code>\n`;
      });
    }

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: reply.trim(),
      parse_mode: 'HTML'
    });
  }

  // Database Health Button or /db
  if (text === '🗄️ Database Health' || text === '/db') {
    let fileSizeMb = 0;
    try {
      const stats = fs.statSync(DB_FILE);
      fileSizeMb = (stats.size / (1024 * 1024)).toFixed(2);
    } catch (_) {}

    let backupCount = 0;
    try {
      backupCount = fs.readdirSync(path.join(DATA_DIR, 'backups')).length;
    } catch (_) {}

    const reply = `
🗄️ <b>MULTI-DATABASE ENGINE HEALTH REPORT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 <b>Primary Storage:</b> <code>data/erp_database.json</code> (${fileSizeMb} MB)
💾 <b>Rolling Snapshots:</b> <code>${backupCount}</code> restore points on disk
🐬 <b>MySQL Primary:</b> 🟢 Configured (<code>motaherh_maint-erp</code>)
🐘 <b>PostgreSQL Backup:</b> 🟢 Synced (<code>motaherh_Maintenance</code>)
⚡ <b>Real-time Hub:</b> 🟢 SSE Stream Active
🛡️ <b>Maintenance Mode:</b> ${db.settings?.maintenanceMode ? '🔴 ACTIVE (Web Locked)' : '🟢 Normal Operations'}
`.trim();

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: reply,
      parse_mode: 'HTML'
    });
  }

  // User Unlock Command (/unlock <username>)
  if (text.startsWith('/unlock ')) {
    const targetUsername = text.replace('/unlock ', '').trim().toLowerCase();
    const targetUser = (db.users || []).find(u => (u.username || '').toLowerCase() === targetUsername || (u.email || '').toLowerCase() === targetUsername);

    if (!targetUser) {
      return adminBotRequest('sendMessage', { chat_id: chatId, text: `❌ ইউজার '<code>${targetUsername}</code>' পাওয়া যায়নি।`, parse_mode: 'HTML' });
    }

    targetUser.status = 'ACTIVE';
    targetUser.failedLoginAttempts = 0;
    saveDatabase(db);
    logAuditAndAlert(db, user, 'USER_UNLOCKED_TELEGRAM', 'USER', targetUser.id, `Executive unlocked user @${targetUser.username}`, true);

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `✅ <b>ইউজার আনলক সম্পন্ন!</b>\nইউজার <b>@${targetUser.username}</b> (${targetUser.name})-এর অ্যাকাউন্ট সক্রিয় করা হয়েছে।`,
      parse_mode: 'HTML'
    });
  }

  // Emergency Maintenance Mode Lockdown (/lockdown)
  if (text === '/lockdown' || text === '/maintenance') {
    if (!db.settings) db.settings = {};
    db.settings.maintenanceMode = !db.settings.maintenanceMode;
    saveDatabase(db);
    broadcastEvent('settings:updated', { maintenanceMode: db.settings.maintenanceMode });

    const statusText = db.settings.maintenanceMode 
      ? '🔴 <b>EMERGENCY LOCKDOWN ACTIVATED!</b>\nWeb portal is now locked in Maintenance Mode. Only Admins can log in.' 
      : '🟢 <b>LOCKDOWN LIFTED!</b>\nWeb portal normal operations restored for all personnel.';

    logAuditAndAlert(db, user, 'LOCKDOWN_TOGGLE_TELEGRAM', 'SETTINGS', 'MAINTENANCE_MODE', `Set maintenanceMode=${db.settings.maintenanceMode}`, true);

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: statusText,
      parse_mode: 'HTML'
    });
  }

  // Pending Gate Passes Button or /transfers
  if (text === '🚚 Pending Gate Passes' || text === '/transfers') {
    const pendingRequests = (db.transfer_requests || []).filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS');

    if (pendingRequests.length === 0) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: '✅ <b>পেন্ডিং কোনো গেটপাস রিকোয়েস্ট নেই।</b>\nসমস্ত ট্রান্সফার সম্পন্ন ও অনুমোদিত।',
        parse_mode: 'HTML'
      });
    }

    for (const tr of pendingRequests.slice(0, 4)) {
      const card = formatTransferCard(tr);
      await adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: card,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ AUTHORIZE GATE PASS', callback_data: `ADMIN_APPROVE_TR:${tr.id}` },
              { text: '❌ REJECT', callback_data: `ADMIN_REJECT_TR:${tr.id}` }
            ]
          ]
        }
      });
    }
    return;
  }

  // Audit Trail Button or /audit
  if (text === '🛡️ Audit Trail' || text === '/audit') {
    const logs = (db.audit_logs || []).slice(0, 7);
    if (logs.length === 0) {
      return adminBotRequest('sendMessage', { chat_id: chatId, text: 'ℹ️ কোনো অডিট লগ রেকর্ড নেই।' });
    }

    let report = `🛡️ <b>Recent Executive Audit Trail (Last 7 events):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    logs.forEach((l, idx) => {
      const time = l.timestamp ? new Date(l.timestamp).toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' }) : '—';
      report += `<b>${idx + 1}. [${l.action}]</b> by <i>${l.username}</i> at ${time}\n   ${l.details}\n\n`;
    });

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: report.trim(),
      parse_mode: 'HTML'
    });
  }

  // Factory Status Button or /status
  if (text === '📊 Factory Status' || text === '/status') {
    const machines = db.machines || [];
    const total = machines.length;
    const running = machines.filter(m => m.running || m.status === 'RUNNING').length;
    const ambulance = machines.filter(m => m.isAmbulance).length;
    const pendingTr = (db.transfer_requests || []).filter(r => r.status === 'PENDING').length;
    const users = db.users || [];

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
📊 <b>CENTRAL FACTORY OPERATIONS OVERVIEW</b>
━━━━━━━━━━━━━━━━━━━━
🏭 <b>Total Registered Machines:</b> <code>${total.toLocaleString()}</code>
🟢 <b>Running on Floor:</b> <code>${running.toLocaleString()}</code> (${((running / (total || 1)) * 100).toFixed(1)}% Active)
🚑 <b>Emergency Ambulance Ready:</b> <code>${ambulance}</code>
🚚 <b>Pending Gate Passes:</b> <code>${pendingTr}</code>
👥 <b>Total ERP Users:</b> <code>${users.length}</code>
🗄️ <b>Data Engines:</b> JSON Primary • MySQL Synced • SSE Active
⏱️ <b>Dhaka Time:</b> <code>${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</code>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Ambulance Fleet Button or /ambulance
  if (text === '🚑 Ambulance Fleet' || text === '/ambulance') {
    const ambulances = (db.machines || []).filter(m => m.isAmbulance === true);
    if (ambulances.length === 0) {
      return adminBotRequest('sendMessage', { chat_id: chatId, text: 'ℹ️ বর্তমানে কোনো মেশিন অ্যাম্বুলেন্স হিসেবে মার্ক করা নেই।' });
    }
    let reply = `🚑 <b>Ambulance Fleet Status (${ambulances.length} Ready):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    ambulances.slice(0, 10).forEach((m, i) => {
      reply += `${i+1}. <b>${m.machineName}</b> (<code>${m.serialNumber}</code>) — Floor: ${m.floor || '—'}, Line: ${m.line || '—'}\n`;
    });
    return adminBotRequest('sendMessage', { chat_id: chatId, text: reply, parse_mode: 'HTML' });
  }

  // Backup Database Button or /backup
  if (text === '💾 Backup Database' || text === '/backup') {
    const snapshotName = `backup-manual-${Date.now()}.json`;
    const dest = path.join(DATA_DIR, 'backups', snapshotName);
    try {
      fs.copyFileSync(DB_FILE, dest);
      logAuditAndAlert(db, user, 'MANUAL_BACKUP_TRIGGERED', 'SYSTEM', snapshotName, `Created disk backup: ${snapshotName}`);
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `💾 <b>Backup Snapshot Created!</b>\nSaved to: <code>${snapshotName}</code>`,
        parse_mode: 'HTML'
      });
    } catch (e) {
      return adminBotRequest('sendMessage', { chat_id: chatId, text: `❌ Backup failed: ${e.message}` });
    }
  }

  // Broadcast Alert Prompt
  if (text === '📢 Broadcast Alert') {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '📢 সমস্ত কর্মীদের কাছে জরুরি নোটিশ পাঠাতে নিচের ফরম্যাটে মেসেজ লিখুন:\n\n<code>/broadcast আপনার মেসেজ এখানে লিখুন</code>',
      parse_mode: 'HTML'
    });
  }

  // Broadcast message execution
  if (text.startsWith('/broadcast ')) {
    const msgText = text.replace('/broadcast ', '').trim();
    if (!msgText) return;

    const users = (db.users || []).filter(u => u.telegramChatId && u.status === 'ACTIVE');
    for (const u of users) {
      userBotRequest('sendMessage', {
        chat_id: u.telegramChatId,
        text: `📢 <b>CENTRAL FACTORY NOTICE</b>\nFrom: <b>${user.name}</b> (Head of Maintenance)\n━━━━━━━━━━━━━━━━━━━━\n${msgText}`,
        parse_mode: 'HTML'
      }).catch(() => {});
    }

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `✅ <b>Broadcast Notice Dispatched!</b>\nSent to ${users.length} registered personnel via Operations Bot (@MainterpBot).`,
      parse_mode: 'HTML'
    });
  }

  // Search Machine Button for Executive Sentinel Bot
  if (text === '🔍 Search Machine') {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🔍 অনুগ্রহ করে মেশিনের <b>সিরিয়াল নম্বর, মডেল বা অ্যাসেট আইডি</b> লিখে পাঠান (যেমন: <code>/find D/N-A-92</code> বা <code>/find LK-1900</code> বা সরাসরি <code>857</code>):',
      parse_mode: 'HTML'
    });
  }

  // Request Transfer Prompt or Button
  if (text === '🚚 Request Transfer') {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🚚 <b>এক্সিকিউটিভ মেশিন ট্রান্সফার (Executive Relocation):</b>
━━━━━━━━━━━━━━━━━━━━
ফ্যাক্টরির যেকোনো মেশিন এক ইউনিট/ফ্লোর/লাইন থেকে অন্য স্থানে ট্রান্সফার করতে লিখুন:

<code>/transfer &lt;মেশিন সিরিয়াল&gt; &lt;গন্তব্য লাইন/ফ্লোর&gt; [কারণ]</code>

<i>উদাহরণ:</i>
<code>/transfer D/N-A-92 BG-C Capacity rebalance</code>
<code>/transfer 2172 Line-04 Line change</code>
<code>/transfer APW-15 Buriganga Floor transfer</code>

💡 <i>সুপার অ্যাডমিন হিসেবে আপনি রিকোয়েস্ট তৈরি করার সাথে সাথে ১-ক্লিকে সরাসরি ট্রান্সফার এক্সিকিউট করতে পারবেন।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Execute / Submit Machine Transfer Request in Admin Bot
  if (text.startsWith('/transfer ') || text.startsWith('/relocate ')) {
    const rawArgs = text.replace(/^\/(transfer|relocate)\s+/i, '').trim();
    const parts = rawArgs.split(/\s+/);

    if (parts.length < 2) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
⚠️ <b>ভুল ফরম্যাট!</b> অনুগ্রহ করে নিচের নিয়মে লিখুন:
<code>/transfer &lt;মেশিন সিরিয়াল&gt; &lt;গন্তব্য লাইন বা ফ্লোর&gt; [কারণ]</code>

<i>উদাহরণ:</i>
<code>/transfer D/N-A-92 BG-C Production balance</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }

    const serial = parts[0];
    const dest = parts[1];
    const reason = parts.slice(2).join(' ') || 'Executive capacity rebalancing';
    const result = processMachineTransferRequest(db, user, serial, dest, reason, false);

    if (result.error) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: result.error,
        parse_mode: 'HTML'
      });
    }

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🚚 <b>এক্সিকিউটিভ মেশিন ট্রান্সফার রিকোয়েস্ট তৈরি হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
🆔 <b>গেটপাস আইডি:</b> <code>${result.transfer.requestNumber}</code>
⚙️ <b>মেশিন:</b> ${result.machine.machineName} (<code>${result.machine.serialNumber}</code>)
📍 <b>বর্তমান স্থান:</b> ${result.transfer.sourcePath}
🎯 <b>অনুরোধকৃত গন্তব্য:</b> ${result.transfer.destPath}
📝 <b>কারণ:</b> ${result.transfer.reason}

👑 <i>আপনি কি এখনই সরাসরি মেশিনটির লোকেশন ট্রান্সফার সম্পন্ন করতে চান?</i>
`.trim(),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚡ DIRECT APPROVE & MOVE NOW', callback_data: `ADMIN_DIRECT_MOVE:${result.transfer.id}` },
            { text: '📋 KEEP AS PENDING GATE PASS', callback_data: `ADMIN_KEEP_PENDING:${result.transfer.id}` }
          ]
        ]
      }
    });
  }

  // Service Machine Prompt or Button
  if (text === '🛠️ Service Machine') {
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🛠️ <b>মেশিন সার্ভিসিং ও পিএম লগ (Machine Servicing Entry):</b>
━━━━━━━━━━━━━━━━━━━━
মেশিনের সার্ভিসিং, মেরামত বা প্রিভেন্টিভ মেইনটেন্যান্স (PM) সম্পন্ন করার পর নিচের ফরম্যাটে মেসেজ পাঠান:

<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;সার্ভিসিং কাজের বিবরণ&gt;</code>

<i>বাস্তব উদাহরণ:</i>
<code>/service D/N-A-92 Motor tuned, needle bar aligned, oil lubricated</code>
<code>/service 2172 Hook changed, timing set sticker: 248190</code>

💡 <i>সুবিধা: মেশিনটি ব্রেকডাউন বা আন্ডার-মেইনটেন্যান্সে থাকলে স্বয়ংক্রিয়ভাবে ACTIVE ও RUNNING হিসেবে ফ্লোরে ফেরত যাবে এবং মেশিনের লাইফটাইম পাসপোর্টে লগ সেভ হবে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Execute Machine Servicing Entry in Admin Bot
  if (text.startsWith('/service ') || text.startsWith('/pm_complete ')) {
    const rawClean = text.replace(/^\/(service|pm_complete)\s+/i, '').trim();
    const firstSpaceIdx = rawClean.indexOf(' ');

    if (firstSpaceIdx === -1) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
⚠️ <b>ভুল ফরম্যাট!</b> অনুগ্রহ করে কাজের বিবরণ সহ লিখুন:
<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;সার্ভিসিং কাজের বিবরণ&gt;</code>

<i>উদাহরণ:</i>
<code>/service D/N-A-92 Motor tuned, oil lubricated</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }

    const serial = rawClean.substring(0, firstSpaceIdx).trim();
    let remarks = rawClean.substring(firstSpaceIdx + 1).trim();
    let customSticker = null;

    const stkMatch = remarks.match(/(?:sticker|stk)\s*[:=]\s*([a-zA-Z0-9\-_]+)/i);
    if (stkMatch) {
      customSticker = stkMatch[1];
      remarks = remarks.replace(stkMatch[0], '').trim();
    }

    const result = processMachineServicingEntry(db, user, serial, remarks, customSticker);

    if (result.error) {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: result.error,
        parse_mode: 'HTML'
      });
    }

    const statusBadge = result.wasUnderMaintenance 
      ? '🟢 <b>RESTORED TO RUNNING</b> (ব্রেকডাউন থেকে সচল করা হয়েছে)' 
      : '🟢 <b>ACTIVE & ON-SCHEDULE</b>';

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
✅ <b>মেশিন সার্ভিসিং সফলভাবে সম্পন্ন হয়েছে!</b>
━━━━━━━━━━━━━━━━━━━━
⚙️ <b>মেশিন:</b> ${result.machine.machineName} (<code>${result.machine.serialNumber}</code>)
🏷️ <b>সার্ভিস স্টিকার নং:</b> <code>${result.stickerNo}</code>
📍 <b>লোকেশন:</b> ${result.machine.floor || '—'}, Line: <b>${result.machine.line || '—'}</b>
👤 <b>এক্সিকিউটিভ/টেকনিশিয়ান:</b> ${user.name} (${user.role})
📝 <b>সার্ভিসিং কাজ:</b> <i>${remarks}</i>
🚦 <b>ফ্যাক্টরি স্ট্যাটাস:</b> ${statusBadge}
📅 <b>পরবর্তী সার্ভিস:</b> ${result.pmRecord.nextServiceDate} (90 দিন পর)
━━━━━━━━━━━━━━━━━━━━
<i>মেশিনের অফিসিয়াল লাইফটাইম পাসপোর্ট ও সেন্ট্রাল প্রিভেন্টিভ মেইনটেন্যান্স ডাটাবেজে স্থায়ীভাবে রেকর্ড সংযুক্ত হয়েছে।</i>
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Machine Search Query for Admin (/find <query>, /search <query>, or direct serial/model lookup)
  if (text.startsWith('/find ') || text.startsWith('/search ') || (!text.startsWith('/') && text.length >= 2)) {
    const isSpecialButton = [
      '🔍 Search Machine', '🚚 Pending Gate Passes', '🚚 Request Transfer', 
      '🛠️ Service Machine', '📊 Factory Status', '📋 Executive Brief', 
      '🛡️ Audit Trail', '🚑 Ambulance Fleet', '🗄️ Database Health', 
      '💾 Backup Database', '📢 Broadcast Alert'
    ].includes(text);

    if (!isSpecialButton) {
      const query = (text.startsWith('/find ') || text.startsWith('/search '))
        ? text.replace(/^\/(find|search)\s+/i, '').trim()
        : text;

      const qLower = query.toLowerCase();
      const matches = (db.machines || []).filter(m => 
        (m.serialNumber && m.serialNumber.toLowerCase() === qLower) ||
        (m.systemAssetId && m.systemAssetId.toLowerCase() === qLower) ||
        (m.manufacturing_serial && m.manufacturing_serial.toLowerCase() === qLower) ||
        (m.serialNumber && m.serialNumber.toLowerCase().includes(qLower)) ||
        (m.model && m.model.toLowerCase().includes(qLower)) ||
        (m.machineName && m.machineName.toLowerCase().includes(qLower))
      );

      if (matches.length > 0) {
        return adminBotRequest('sendMessage', {
          chat_id: chatId,
          text: formatMachineCard(matches[0]),
          parse_mode: 'HTML'
        });
      } else if (text.startsWith('/find ') || text.startsWith('/search ')) {
        return adminBotRequest('sendMessage', {
          chat_id: chatId,
          text: `🔍 '<code>${query}</code>' দিয়ে কোনো মেশিন পাওয়া যায়নি।`,
          parse_mode: 'HTML'
        });
      }
    }
  }
}

// Callback Query Handler for Admin Bot
async function handleAdminBotCallback(cbQuery) {
  const queryId = cbQuery.id;
  const data = cbQuery.data || '';
  const chatId = cbQuery.message?.chat?.id;
  const messageId = cbQuery.message?.message_id;
  const user = findUserByChatId(chatId);

  if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
    return adminBotRequest('answerCallbackQuery', {
      callback_query_id: queryId,
      text: '⛔ Unauthorized.',
      show_alert: true
    });
  }

  const db = getDatabase();

  // Authorize Gate Pass with Official Digital Verification Slip
  if (data.startsWith('ADMIN_APPROVE_TR:') || data.startsWith('ADMIN_DIRECT_MOVE:')) {
    const isDirect = data.startsWith('ADMIN_DIRECT_MOVE:');
    const trId = isDirect ? data.replace('ADMIN_DIRECT_MOVE:', '') : data.replace('ADMIN_APPROVE_TR:', '');
    const tr = (db.transfer_requests || []).find(r => r.id === trId);
    if (!tr) {
      return adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: 'রেকর্ড পাওয়া যায়নি।' });
    }

    tr.status = 'APPROVED';
    tr.approvedBy = user.id;
    tr.approvedByName = user.name;
    tr.approvedAt = new Date().toISOString();

    // Physically move machine in db.machines
    const targetMachine = (db.machines || []).find(m => m.id === tr.machineId || (m.serialNumber && m.serialNumber === tr.serialNumber));
    if (targetMachine) {
      if (tr.destUnitId) targetMachine.unitId = tr.destUnitId;
      if (tr.destUnit || tr.destLocation?.unit) targetMachine.unit = tr.destUnit || tr.destLocation.unit;
      if (tr.destFloorId) targetMachine.floorId = tr.destFloorId;
      if (tr.destFloor || tr.destLocation?.floor) targetMachine.floor = tr.destFloor || tr.destLocation.floor;
      if (tr.destLineId) targetMachine.lineId = tr.destLineId;
      if (tr.destLine || tr.destLocation?.line) targetMachine.line = tr.destLine || tr.destLocation.line;
      targetMachine.updatedAt = new Date().toISOString();

      if (!db.machine_history) db.machine_history = [];
      db.machine_history.unshift({
        id: `hist-tr-${Date.now()}`,
        machineId: targetMachine.id,
        serialNumber: targetMachine.serialNumber,
        action: 'MACHINE_TRANSFERRED',
        details: `Transferred to ${tr.destPath || tr.destLocation?.line || 'New Location'} via Gate Pass #${tr.requestNumber || tr.id}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username
      });
    }

    saveDatabase(db);
    logAuditAndAlert(db, user, 'APPROVE_GATE_PASS_EXECUTIVE', 'TRANSFER', tr.id, `Executive authorized gate pass #${tr.requestNumber || tr.id}`, true);
    broadcastEvent('transfer:approved', { transferId: tr.id, approver: user.name });

    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: `✅ Digital Gate Pass Authorized!` });

    const digitalSlip = formatDigitalGatePass(tr, user.name);

    return adminBotRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: digitalSlip,
      parse_mode: 'HTML'
    });
  }

  if (data.startsWith('ADMIN_KEEP_PENDING:')) {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: '📋 Saved as pending gate pass.' });
    return adminBotRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '📋 <b>ট্রান্সফার রিকোয়েস্ট পেন্ডিং হিসেবে সংরক্ষিত রাখা হয়েছে।</b>\nপ্রয়োজনে পরবর্তীতে <code>Pending Gate Passes</code> মেনু থেকে অনুমোদন করতে পারবেন।',
      parse_mode: 'HTML'
    });
  }

  if (data.startsWith('ADMIN_REJECT_TR:')) {
    const trId = data.replace('ADMIN_REJECT_TR:', '');
    const tr = (db.transfer_requests || []).find(r => r.id === trId);
    if (tr) {
      tr.status = 'REJECTED';
      tr.rejectedBy = user.id;
      tr.rejectedByName = user.name;
      tr.rejectedAt = new Date().toISOString();
      saveDatabase(db);
      logAuditAndAlert(db, user, 'REJECT_GATE_PASS_EXECUTIVE', 'TRANSFER', tr.id, `Executive rejected transfer #${tr.requestNumber || tr.id}`);
      broadcastEvent('transfer:rejected', { transferId: tr.id, rejector: user.name });
    }

    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: '❌ Gate Pass Rejected.' });

    return adminBotRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `${formatTransferCard(tr || { id: trId, status: 'REJECTED' })}\n\n❌ <b>GATE PASS REJECTED BY EXECUTIVE</b>`,
      parse_mode: 'HTML'
    });
  }

  if (data === 'HUB_MAIN' || data === 'HUB_REFRESH') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: '🔄 Updated!' });
    const hub = renderQuickFeaturesHub(user, db, true);
    return safeEditMessage(adminBotRequest, chatId, messageId, hub.text, { inline_keyboard: hub.inline_keyboard });
  }

  if (data === 'LAUNCH_QUICK_HUB') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const hub = renderQuickFeaturesHub(user, db, true);
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: hub.text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: hub.inline_keyboard }
    });
  }

  if (data === 'ADMIN_TRANSFERS' || data === 'HUB_TRANSFERS') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderTransfersView(user, db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'ADMIN_STATUS' || data === 'HUB_STATUS') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderStatusView(user, db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'ADMIN_AUDIT') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderAuditView(db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'ADMIN_BACKUP' || data === 'HUB_BACKUP') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: '💾 Backup created!' });
    saveDatabase(db);
    const snapTime = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' });
    return safeEditMessage(adminBotRequest, chatId, messageId,
      `💾 <b>DATABASE SNAPSHOT SUCCESSFUL!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ Instant database snapshot persisted to disk at <b>${snapTime}</b> (Dhaka Time).\n` +
      `📦 <b>Fleet Total:</b> ${(db.machines || []).length.toLocaleString()} machines\n` +
      `🛡️ <b>Audit Logs:</b> ${(db.audit_logs || []).length.toLocaleString()} records`,
      {
        inline_keyboard: [
          [{ text: '⬅️ Back to Quick Hub', callback_data: 'HUB_MAIN' }]
        ]
      }
    );
  }

  if (data === 'ADMIN_BRIEF') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderBriefView(db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'ADMIN_DB_HEALTH') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderDbHealthView(db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'ADMIN_AMBULANCE' || data === 'HUB_AMBULANCE') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderAmbulanceView(user, db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_DUE') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderDueView(user, db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_OVERDUE') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderOverdueView(user, db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_SERVICES_7') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderServicesView(user, db, 7);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_SERVICES_30') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderServicesView(user, db, 30);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_PM') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderPmView(user, db);
    return safeEditMessage(adminBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_FIND') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🔍 অনুগ্রহ করে মেশিনের <b>সিরিয়াল নম্বর, মডেল বা অ্যাসেট আইডি</b> লিখে পাঠান (যেমন: <code>D/N-A-92</code> বা <code>857</code>):',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data === 'HUB_TRANSFER') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🚚 <b>ট্রান্সফার রিকোয়েস্ট করতে নিচের ফরম্যাটে লিখে পাঠান:</b>\n\n<code>/transfer &lt;মেশিন সিরিয়াল&gt; &lt;গন্তব্য লাইন বা ফ্লোর&gt; [কারণ]</code>\n\n<i>উদাহরণ:</i>\n<code>/transfer D/N-A-92 BG-C Line rebalance</code>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data === 'HUB_SERVICE') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🛠️ <b>সার্ভিসিং লগ করতে নিচের ফরম্যাটে লিখে পাঠান:</b>\n\n<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;কাজের বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/service D/N-A-92 Needle changed, timing adjusted, oil lubricated</code>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data === 'HUB_BREAKDOWN') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🚨 <b>জরুরি ব্রেকডাউন নোটিশ পাঠাতে লিখুন:</b>\n\n<code>/breakdown &lt;মেশিন সিরিয়াল&gt; &lt;সমস্যা&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/breakdown D/N-A-92 Motor jammed, needle stuck</code>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  // Pre-filled prompts for machine actions in Admin Bot
  if (data.startsWith('PROMPT_TR:')) {
    const serial = data.replace('PROMPT_TR:', '');
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🚚 <b>ট্রান্সফার রিকোয়েস্ট ফরম্যাট:</b>\nমেশিন <code>${serial}</code> ট্রান্সফার করতে লিখুন:\n\n<code>/transfer ${serial} &lt;গন্তব্য লাইন বা ফ্লোর&gt; [কারণ]</code>\n\n<i>উদাহরণ:</i>\n<code>/transfer ${serial} BG-C Line rebalance</code>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data.startsWith('PROMPT_SRV:')) {
    const serial = data.replace('PROMPT_SRV:', '');
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🛠️ <b>সার্ভিসিং লগ ফরম্যাট:</b>\nমেশিন <code>${serial}</code> সার্ভিসিং শেষে এন্ট্রি করতে লিখুন:\n\n<code>/service ${serial} &lt;কাজের বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/service ${serial} Needle set, timing tuned, oil added</code>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data.startsWith('PROMPT_BD:')) {
    const serial = data.replace('PROMPT_BD:', '');
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🚨 <b>ব্রেকডাউন নোটিশ ফরম্যাট:</b>\nমেশিন <code>${serial}</code> নষ্ট হলে জরুরি নোটিশ পাঠাতে লিখুন:\n\n<code>/breakdown ${serial} &lt;সমস্যার বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/breakdown ${serial} Motor stopped, needle broken</code>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }
}

// Callback Query Handler for Operations Bot (@MainterpBot)
async function handleUserBotCallback(cbQuery) {
  const queryId = cbQuery.id;
  const data = cbQuery.data || '';
  const chatId = cbQuery.message?.chat?.id;
  const messageId = cbQuery.message?.message_id;
  const db = getDatabase();
  const user = findUserByChatId(chatId);

  if (!user) {
    return userBotRequest('answerCallbackQuery', {
      callback_query_id: queryId,
      text: '⚠️ অনুগ্রহ করে প্রথমে আপনার অ্যাকাউন্ট লিঙ্ক করুন।',
      show_alert: true
    });
  }

  const isExec = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';

  if (data === 'HUB_MAIN' || data === 'HUB_REFRESH') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: '🔄 Updated!' });
    const hub = renderQuickFeaturesHub(user, db, isExec);
    return safeEditMessage(userBotRequest, chatId, messageId, hub.text, { inline_keyboard: hub.inline_keyboard });
  }

  if (data === 'LAUNCH_QUICK_HUB') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const hub = renderQuickFeaturesHub(user, db, isExec);
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: hub.text,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: hub.inline_keyboard }
    });
  }

  if (data === 'HUB_DUE') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderDueView(user, db);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_OVERDUE') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderOverdueView(user, db);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_SERVICES_7') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderServicesView(user, db, 7);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_SERVICES_30') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderServicesView(user, db, 30);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_PM') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderPmView(user, db);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_AMBULANCE') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderAmbulanceView(user, db);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_STATUS') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderStatusView(user, db);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_TRANSFERS') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const view = renderTransfersView(user, db);
    return safeEditMessage(userBotRequest, chatId, messageId, view.text, view.reply_markup);
  }

  if (data === 'HUB_FIND') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🔍 অনুগ্রহ করে মেশিনের <b>সিরিয়াল নম্বর, মডেল বা অ্যাসেট আইডি</b> লিখে পাঠান (যেমন: <code>D/N-A-92</code> বা <code>857</code>):',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data === 'HUB_TRANSFER') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🚚 <b>ট্রান্সফার রিকোয়েস্ট করতে নিচের ফরম্যাটে লিখে পাঠান:</b>\n\n<code>/transfer &lt;মেশিন সিরিয়াল&gt; &lt;গন্তব্য লাইন বা ফ্লোর&gt; [কারণ]</code>\n\n<i>উদাহরণ:</i>\n<code>/transfer D/N-A-92 BG-C Line rebalance</code>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data === 'HUB_SERVICE') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🛠️ <b>সার্ভিসিং লগ করতে নিচের ফরম্যাটে লিখে পাঠান:</b>\n\n<code>/service &lt;মেশিন সিরিয়াল&gt; &lt;কাজের বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/service D/N-A-92 Needle changed, timing adjusted, oil lubricated</code>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data === 'HUB_BREAKDOWN') {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '🚨 <b>জরুরি ব্রেকডাউন নোটিশ পাঠাতে লিখুন:</b>\n\n<code>/breakdown &lt;মেশিন সিরিয়াল&gt; &lt;সমস্যার বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/breakdown D/N-A-92 Motor jammed, needle stuck</code>',
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  // Pre-filled prompts for machine actions
  if (data.startsWith('PROMPT_TR:')) {
    const serial = data.replace('PROMPT_TR:', '');
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🚚 <b>ট্রান্সফার রিকোয়েস্ট ফরম্যাট:</b>\nমেশিন <code>${serial}</code> ট্রান্সফার করতে লিখুন:\n\n<code>/transfer ${serial} &lt;গন্তব্য লাইন বা ফ্লোর&gt; [কারণ]</code>\n\n<i>উদাহরণ:</i>\n<code>/transfer ${serial} BG-C Line rebalance</code>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data.startsWith('PROMPT_SRV:')) {
    const serial = data.replace('PROMPT_SRV:', '');
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🛠️ <b>সার্ভিসিং লগ ফরম্যাট:</b>\nমেশিন <code>${serial}</code> সার্ভিসিং শেষে এন্ট্রি করতে লিখুন:\n\n<code>/service ${serial} &lt;কাজের বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/service ${serial} Needle set, timing tuned, oil added</code>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  if (data.startsWith('PROMPT_BD:')) {
    const serial = data.replace('PROMPT_BD:', '');
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🚨 <b>ব্রেকডাউন নোটিশ ফরম্যাট:</b>\nমেশিন <code>${serial}</code> নষ্ট হলে জরুরি নোটিশ পাঠাতে লিখুন:\n\n<code>/breakdown ${serial} &lt;সমস্যার বিবরণ&gt;</code>\n\n<i>উদাহরণ:</i>\n<code>/breakdown ${serial} Motor stopped, needle broken</code>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '⚡ Open Quick Hub', callback_data: 'LAUNCH_QUICK_HUB' }]]
      }
    });
  }

  // Direct move or gate pass approve in UserBot for Executives
  if (isExec && (data.startsWith('ADMIN_APPROVE_TR:') || data.startsWith('ADMIN_DIRECT_MOVE:'))) {
    const isDirect = data.startsWith('ADMIN_DIRECT_MOVE:');
    const trId = isDirect ? data.replace('ADMIN_DIRECT_MOVE:', '') : data.replace('ADMIN_APPROVE_TR:', '');
    const tr = (db.transfer_requests || []).find(r => r.id === trId);
    if (!tr) {
      return userBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: 'রেকর্ড পাওয়া যায়নি।' });
    }

    tr.status = 'APPROVED';
    tr.approvedBy = user.id;
    tr.approvedByName = user.name;
    tr.approvedAt = new Date().toISOString();

    const targetMachine = (db.machines || []).find(m => m.id === tr.machineId || (m.serialNumber && m.serialNumber === tr.serialNumber));
    if (targetMachine) {
      if (tr.destUnitId) targetMachine.unitId = tr.destUnitId;
      if (tr.destUnit || tr.destLocation?.unit) targetMachine.unit = tr.destUnit || tr.destLocation.unit;
      if (tr.destFloorId) targetMachine.floorId = tr.destFloorId;
      if (tr.destFloor || tr.destLocation?.floor) targetMachine.floor = tr.destFloor || tr.destLocation.floor;
      if (tr.destLineId) targetMachine.lineId = tr.destLineId;
      if (tr.destLine || tr.destLocation?.line) targetMachine.line = tr.destLine || tr.destLocation.line;
      targetMachine.updatedAt = new Date().toISOString();

      if (!db.machine_history) db.machine_history = [];
      db.machine_history.unshift({
        id: `hist-tr-${Date.now()}`,
        machineId: targetMachine.id,
        serialNumber: targetMachine.serialNumber,
        action: 'MACHINE_TRANSFERRED',
        details: `Transferred to ${tr.destPath || tr.destLocation?.line || 'New Location'} via Gate Pass #${tr.requestNumber || tr.id}`,
        timestamp: new Date().toISOString(),
        userId: user.id,
        username: user.username
      });
    }

    saveDatabase(db);
    logAuditAndAlert(db, user, 'APPROVE_GATE_PASS_EXECUTIVE', 'TRANSFER', tr.id, `Executive authorized gate pass #${tr.requestNumber || tr.id}`, true);
    broadcastEvent('transfer:approved', { transferId: tr.id, approver: user.name });

    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: `✅ Digital Gate Pass Authorized!` });

    const digitalSlip = formatDigitalGatePass(tr, user.name);

    return userBotRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: digitalSlip,
      parse_mode: 'HTML'
    });
  }

  if (isExec && data.startsWith('ADMIN_KEEP_PENDING:')) {
    await userBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: '📋 Saved as pending gate pass.' });
    return userBotRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: '📋 <b>ট্রান্সফার রিকোয়েস্ট পেন্ডিং হিসেবে সংরক্ষিত রাখা হয়েছে।</b>\nপ্রয়োজনে পরবর্তীতে <code>Pending Gate Passes</code> মেনু থেকে অনুমোদন করতে পারবেন।',
      parse_mode: 'HTML'
    });
  }

  await userBotRequest('answerCallbackQuery', { callback_query_id: queryId });
}

// Background Dual-Bot Polling Daemon
let userPollingActive = false;
let userOffset = 0;
let adminPollingActive = false;
let adminOffset = 0;

async function startUserBotPolling() {
  if (userPollingActive) return;
  userPollingActive = true;
  console.log('[Telegram] 🤖 User Operations Bot Polling Started (@MainterpBot)...');

  while (userPollingActive) {
    try {
      const updates = await userBotRequest('getUpdates', {
        offset: userOffset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });

      if (Array.isArray(updates) && updates.length > 0) {
        for (const update of updates) {
          userOffset = update.update_id + 1;
          if (update.message) {
            handleUserBotMessage(update.message).catch(err => console.error('[UserBot] Error:', err));
          } else if (update.callback_query) {
            handleUserBotCallback(update.callback_query).catch(err => console.error('[UserBot Callback] Error:', err));
          }
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function startAdminBotPolling() {
  if (adminPollingActive) return;
  adminPollingActive = true;
  console.log('[Telegram] 🛡️ Executive Admin Sentinel Bot Polling Started (@MaintAdminbot)...');

  while (adminPollingActive) {
    try {
      const updates = await adminBotRequest('getUpdates', {
        offset: adminOffset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });

      if (Array.isArray(updates) && updates.length > 0) {
        for (const update of updates) {
          adminOffset = update.update_id + 1;
          if (update.message) {
            handleAdminBotMessage(update.message).catch(err => console.error('[AdminBot] Error:', err));
          } else if (update.callback_query) {
            handleAdminBotCallback(update.callback_query).catch(err => console.error('[AdminBot Callback] Error:', err));
          }
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

function startPollingLoop() {
  registerBotCommands().catch(err => console.error('[Telegram] registerBotCommands failed:', err.message));
  startUserBotPolling();
  startAdminBotPolling();
}

// Push notification for new transfer gate passes
async function notifyApproversOfTransfer(transfer) {
  const card = formatTransferCard(transfer);
  const adminChatIds = getAdminChatIds();

  for (const cid of adminChatIds) {
    adminBotRequest('sendMessage', {
      chat_id: cid,
      text: `🚨 <b>NEW GATE PASS REQUISITION SUBMITTED!</b>\n━━━━━━━━━━━━━━━━━━━━\n${card}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ AUTHORIZE GATE PASS', callback_data: `ADMIN_APPROVE_TR:${transfer.id}` },
            { text: '❌ REJECT', callback_data: `ADMIN_REJECT_TR:${transfer.id}` }
          ]
        ]
      }
    }).catch(() => {});
  }
}

module.exports = {
  startPollingLoop,
  setRealtimeBroadcaster,
  generateLinkCodeForUser,
  unlinkUserTelegram,
  notifyApproversOfTransfer,
  sendSentinelAlert,
  userBotRequest,
  adminBotRequest,
  handleUserBotMessage,
  handleAdminBotMessage
};
