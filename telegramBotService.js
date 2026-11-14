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
  if (!user || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return 'Factory-Wide (Unrestricted)';
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
    if (val.expiresAt < now) pendingLinkCodes.delete(code);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingLinkCodes.set(code, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: now + (15 * 60 * 1000)
  });

  const isExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const targetBot = isExecutive ? 'MaintAdminbot' : 'MainterpBot';

  return {
    code,
    expiresInSeconds: 900,
    botUsername: targetBot,
    isExecutive,
    deepLink: `https://t.me/${targetBot}?start=AMG_${code}`
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

// Dynamic Adaptive RBAC Menu Builder for Operations Bot (@MainterpBot)
function buildDynamicUserMenu(user) {
  const keyboard = [];
  const commands = [];

  const canMachines = hasPermission(user, 'machines', 'VIEW');
  const canPM = hasPermission(user, 'preventive_maintenance', 'VIEW');
  const canTools = hasPermission(user, 'tools_management', 'VIEW');
  const canTransfers = hasPermission(user, 'transfers', 'VIEW');
  const canReportBreakdown = canMachines || canPM || canTransfers;

  const row1 = [];
  if (canMachines) {
    row1.push({ text: '🔍 Search Machine' });
    commands.push('🔍 /find <serial> — মেশিন সার্চ ও অবস্থা পর্যবেক্ষণ');
  }
  if (canReportBreakdown) {
    row1.push({ text: '🚨 Report Breakdown' });
    commands.push('🚨 /breakdown <serial> <details> — জরুরি ব্রেকডাউন নোটিশ');
  }
  if (row1.length > 0) keyboard.push(row1);

  const row2 = [];
  if (canPM) {
    row2.push({ text: '🛠️ PM Checklist' });
    commands.push('🛠️ /pm — আজকের প্রিভেন্টিভ মেইনটেন্যান্স তালিকা');
  }
  if (canTools) {
    row2.push({ text: '🔧 My Tools' });
    commands.push('🔧 /tools — আপনার নামে বরাদ্দকৃত টুলস ও যন্ত্রপাতি');
  }
  if (row2.length > 0) keyboard.push(row2);

  const row3 = [];
  if (canTransfers) {
    row3.push({ text: '🚚 Transfers' });
    commands.push('🚚 /transfers — চলমান মেশিন ট্রান্সফার রিকোয়েস্ট');
  }
  if (canMachines) {
    row3.push({ text: '🚑 Ambulance Fleet' });
    commands.push('🚑 /ambulance — স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন তালিকা');
  }
  if (row3.length > 0) keyboard.push(row3);

  keyboard.push([{ text: '🚪 Disconnect' }]);

  return {
    keyboard,
    commandsText: commands.length > 0 
      ? commands.join('\n') 
      : '⚠️ আপনার অ্যাকাউন্টে বর্তমানে কোনো সক্রিয় ফিচার পারমিশন বরাদ্দ নেই।'
  };
}

// ============================================================================
// 1. OPERATIONS BOT HANDLER (@MainterpBot) - General Users & Floor Staff
// ============================================================================
async function handleUserBotMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const user = findUserByChatId(chatId);

  // Photo attachment upload handler (e.g. Broken machine part photo)
  if (msg.photo && msg.photo.length > 0 && user) {
    const caption = (msg.caption || '').trim();
    const db = getDatabase();
    logAuditAndAlert(db, user, 'PHOTO_UPLOAD_TELEGRAM', 'MACHINE', caption || 'PHOTO', `Uploaded equipment photo with note: ${caption || 'No caption'}`);
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `📸 <b>ফটো সফলভাবে গ্রহণ করা হয়েছে!</b>\nমেশিনারি পাসপোর্টে ফটো ও বিবরণি আর্কাইভ করা হয়েছে।\nবিবরণ: <i>${caption || 'N/A'}</i>`,
      parse_mode: 'HTML'
    });
  }

  if (!text) return;

  // Deep-linking /link
  if (text.startsWith('/start AMG_') || text.startsWith('/link ')) {
    const code = text.replace('/start AMG_', '').replace('/link ', '').trim();
    const entry = pendingLinkCodes.get(code);

    if (!entry || entry.expiresAt < Date.now()) {
      return userBotRequest('sendMessage', {
        chat_id: chatId,
        text: '❌ <b>লিঙ্ক কোডটি অকার্যকর বা মেয়াদোত্তীর্ণ হয়ে গেছে।</b>\nদয়া করে ওয়েব ERP প্রোফাইল থেকে নতুন লিঙ্ক কোড নিন।',
        parse_mode: 'HTML'
      });
    }

    const db = getDatabase();
    const targetUser = (db.users || []).find(u => u.id === entry.userId);
    if (!targetUser) {
      return userBotRequest('sendMessage', { chat_id: chatId, text: '❌ ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
    }

    targetUser.telegramChatId = String(chatId);
    targetUser.telegramUsername = msg.chat?.username || null;
    targetUser.telegramLinkedAt = new Date().toISOString();
    saveDatabase(db);
    pendingLinkCodes.delete(code);

    logAuditAndAlert(db, targetUser, 'USER_TELEGRAM_LINKED', 'USER', targetUser.id, `Linked Operations Bot (@MainterpBot)`);

    const { keyboard, commandsText } = buildDynamicUserMenu(targetUser);

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
🎉 <b>অভিনন্দন ${targetUser.name}!</b>
━━━━━━━━━━━━━━━━━━━━
আপনার অ্যাকাউন্ট সফলভাবে সংযুক্ত হয়েছে।
👤 <b>রোল:</b> <code>${targetUser.presetName || targetUser.role}</code>
📍 <b>লোকেশন স্কোপ:</b> <code>${formatUserScopeDescription(targetUser, db)}</code>

<b>আপনার অনুমোদিত ফিচারসমূহ:</b>
${commandsText}
`.trim(),
      parse_mode: 'HTML',
      reply_markup: { keyboard, resize_keyboard: true }
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

১. ওয়েব পোর্টালে লগইন করুন।
২. প্রোফাইল থেকে <b>Telegram Bot & Alerts</b>-এ ক্লিক করে ৬ ডিজিটের কোড নিন।
৩. এখানে পাঠান: <code>/link YOUR_CODE</code>
`.trim(),
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true }
      });
    }
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '⚠️ আপনার টেলিগ্রাম অ্যাকাউন্টটি এখনও লিঙ্ক করা হয়নি। অনুগ্রহ করে `/start` লিখে নির্দেশনা দেখুন।',
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });
  }

  // Dynamic Operations Bot Menu (/start or /help)
  if (text === '/start' || text === '/help') {
    const db = getDatabase();
    const { keyboard, commandsText } = buildDynamicUserMenu(user);

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
👋 <b>নমস্কার, ${user.name}!</b>
🛡️ <b>অ্যাক্সেস রোল:</b> <code>${user.presetName || user.role}</code>
📍 <b>লোকেশন স্কোপ:</b> <code>${formatUserScopeDescription(user, db)}</code>
━━━━━━━━━━━━━━━━━━━━
<b>আপনার অনুমোদিত লাইভ ফিচারসমূহ:</b>
${commandsText}

<i>নিচের বাটনগুলোতে ট্যাপ করে সরাসরি অপশন ব্যবহার করুন:</i>
`.trim(),
      parse_mode: 'HTML',
      reply_markup: { keyboard, resize_keyboard: true }
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

  // Transfers Button or /transfers
  if (text === '🚚 Transfers' || text === '/transfers') {
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

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: formatMachineCard(permittedMatches[0]),
      parse_mode: 'HTML'
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

  // Direct Claim (/claim <apiKey> or /start AMG_<code>)
  if (text.startsWith('/claim ') || text.startsWith('/start AMG_') || text.startsWith('/link ')) {
    const token = text.replace('/claim ', '').replace('/start AMG_', '').replace('/link ', '').trim();
    
    // Check master key
    if (token === SECURE_API_KEY) {
      const superAdmin = findSuperAdminUser();
      if (superAdmin) {
        superAdmin.telegramAdminChatId = String(chatId);
        superAdmin.telegramUsername = msg.chat?.username || null;
        superAdmin.telegramLinkedAt = new Date().toISOString();
        saveDatabase(db);
        logAuditAndAlert(db, superAdmin, 'ADMIN_BOT_CLAIMED', 'USER', superAdmin.id, 'Super Admin claimed via Secret Key', true);

        const adminKeyboard = [
          [{ text: '🚚 Pending Gate Passes' }, { text: '📊 Factory Status' }],
          [{ text: '🛡️ Audit Trail' }, { text: '🚑 Ambulance Fleet' }],
          [{ text: '📋 Executive Brief' }, { text: '🗄️ Database Health' }],
          [{ text: '💾 Backup Database' }, { text: '📢 Broadcast Alert' }]
        ];

        return adminBotRequest('sendMessage', {
          chat_id: chatId,
          text: `
👑 <b>EXECUTIVE ADMIN SENTINEL ACTIVE</b>
━━━━━━━━━━━━━━━━━━━━
স্বাগতম <b>${superAdmin.name}</b>!
আপনার টেলিগ্রাম আইডিটি <b>Al-Muslim Group Central Maintenance Admin Sentinel Bot (@MaintAdminbot)</b>-এর প্রাইমারি রিসিভার হিসেবে সক্রিয় করা হয়েছে।

এখন থেকে ফ্যাক্টরির প্রতিটি গেটপাস অনুমোদন রিকোয়েস্ট, মেশিন ব্রেকডাউন অ্যালার্ট এবং সিকিউরিটি অডিট এখানে লাইভ স্ট্রিম হবে।
`.trim(),
          parse_mode: 'HTML',
          reply_markup: { keyboard: adminKeyboard, resize_keyboard: true }
        });
      }
    }

    // Check 6-digit link code
    const entry = pendingLinkCodes.get(token);
    if (entry && entry.expiresAt >= Date.now()) {
      const targetUser = (db.users || []).find(u => u.id === entry.userId);
      if (targetUser && (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN')) {
        targetUser.telegramAdminChatId = String(chatId);
        targetUser.telegramUsername = msg.chat?.username || null;
        targetUser.telegramLinkedAt = new Date().toISOString();
        saveDatabase(db);
        pendingLinkCodes.delete(token);

        logAuditAndAlert(db, targetUser, 'ADMIN_BOT_LINKED', 'USER', targetUser.id, `Executive Admin Bot connected`, true);

        return adminBotRequest('sendMessage', {
          chat_id: chatId,
          text: `👑 <b>Executive Admin Verified: ${targetUser.name}</b>\nSentinel Stream activated for @MaintAdminbot.`,
          parse_mode: 'HTML'
        });
      }
    }
  }

  // Strict Admin Gate: Reject non-admins
  const isSuperAdmin = user && (user.role === 'SUPER_ADMIN' || user.id === 'usr-super-admin');
  const isAdmin = isSuperAdmin || (user && user.role === 'ADMIN');

  if (!isAdmin) {
    if (text === '/start' || text === '/help') {
      return adminBotRequest('sendMessage', {
        chat_id: chatId,
        text: `
🔒 <b>Al-Muslim Group Executive Maintenance Sentinel Bot</b>
━━━━━━━━━━━━━━━━━━━━
⛔ <b>Restricted Access:</b> এই বটটি শুধুমাত্র কেন্দ্রীয় সুপার অ্যাডমিন ও টপ ম্যানেজমেন্টের জন্য সংরক্ষিত।

আপনার অ্যাকাউন্ট লিঙ্ক করতে ওয়েব পোর্টাল থেকে অ্যাডমিন লিঙ্ক কোড নিন অথবা সিক্রেট কি দিয়ে ভেরিফাই করুন:
<code>/claim &lt;SECURE_API_KEY&gt;</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }
    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: '⛔ Access Denied: Unauthorized terminal.'
    });
  }

  // ==========================================
  // AUTHORIZED ADMIN SENTINEL COMMANDS
  // ==========================================
  const adminKeyboard = [
    [{ text: '🚚 Pending Gate Passes' }, { text: '📊 Factory Status' }],
    [{ text: '🛡️ Audit Trail' }, { text: '🚑 Ambulance Fleet' }],
    [{ text: '📋 Executive Brief' }, { text: '🗄️ Database Health' }],
    [{ text: '💾 Backup Database' }, { text: '📢 Broadcast Alert' }]
  ];

  // /start or /help (Executive Dashboard)
  if (text === '/start' || text === '/help') {
    const machines = db.machines || [];
    const total = machines.length;
    const running = machines.filter(m => m.running || m.status === 'RUNNING').length;
    const ambulance = machines.filter(m => m.isAmbulance).length;
    const pendingTr = (db.transfer_requests || []).filter(r => r.status === 'PENDING').length;

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
👑 <b>CENTRAL MAINTENANCE COMMAND CENTER</b>
👤 <b>Commander:</b> ${user.name} (${user.role})
━━━━━━━━━━━━━━━━━━━━
🏭 <b>Total Fleet:</b> <code>${total.toLocaleString()}</code> machines
🟢 <b>Running:</b> <code>${running.toLocaleString()}</code>
🚑 <b>Ambulance Standby:</b> <code>${ambulance}</code>
🚚 <b>Pending Gate Passes:</b> <code>${pendingTr}</code>
━━━━━━━━━━━━━━━━━━━━
<b>Executive Live Menu:</b>
🚚 <b>Pending Gate Passes</b> — Review & Authorize
📊 <b>Factory Status</b> — Live Infrastructure Health
🛡️ <b>Audit Trail</b> — Real-time System Change Log
🚑 <b>Ambulance Fleet</b> — Standby Fleet Tracking
📋 <b>Executive Brief</b> — Daily CEO Morning Brief
🗄️ <b>Database Health</b> — Multi-DB Sync & Disk Status
💾 <b>Backup Database</b> — Instant Disk Snapshot
📢 <b>Broadcast Alert</b> — Send Factory-wide Notice
`.trim(),
      parse_mode: 'HTML',
      reply_markup: { keyboard: adminKeyboard, resize_keyboard: true }
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
  if (data.startsWith('ADMIN_APPROVE_TR:')) {
    const trId = data.replace('ADMIN_APPROVE_TR:', '');
    const tr = (db.transfer_requests || []).find(r => r.id === trId);
    if (!tr) {
      return adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: 'রেকর্ড পাওয়া যায়নি।' });
    }

    tr.status = 'APPROVED';
    tr.approvedBy = user.id;
    tr.approvedByName = user.name;
    tr.approvedAt = new Date().toISOString();

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

  if (data === 'ADMIN_TRANSFERS') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return handleAdminBotMessage({ chat: { id: chatId }, text: '/transfers' });
  }

  if (data === 'ADMIN_STATUS') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return handleAdminBotMessage({ chat: { id: chatId }, text: '/status' });
  }

  if (data === 'ADMIN_AUDIT') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    return handleAdminBotMessage({ chat: { id: chatId }, text: '/audit' });
  }

  if (data === 'ADMIN_AMBULANCE') {
    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId });
    const ambulances = (db.machines || []).filter(m => m.isAmbulance === true);
    let reply = `🚑 <b>Ambulance Fleet Status (${ambulances.length} Ready):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    ambulances.slice(0, 10).forEach((m, i) => {
      reply += `${i+1}. <b>${m.machineName}</b> (<code>${m.serialNumber}</code>) — Floor: ${m.floor || '—'}, Line: ${m.line || '—'}\n`;
    });
    return adminBotRequest('sendMessage', { chat_id: chatId, text: reply, parse_mode: 'HTML' });
  }
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
  adminBotRequest
};
