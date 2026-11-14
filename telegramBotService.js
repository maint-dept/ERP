/**
 * Al-Muslim Group Maintenance ERP
 * Dual-Bot Enterprise Architecture:
 * 
 * 1. Operations Bot (@MainterpBot):
 *    - Designed for factory floor mechanics, supervisors, and line staff.
 *    - Machine lookup, PM checklists, tool allocations, breakdown reports.
 * 
 * 2. Executive Admin Sentinel Bot (@MaintAdminbot):
 *    - Strictly for Super Admin (Engr. Motaher Hossain) & Top Management.
 *    - Real-time audit trail feed (Sentinel Stream), instant gate pass authorization,
 *      emergency sirens, database engine health, and system snapshots.
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
  return { users: [], machines: [], transfers: [], transfer_requests: [], preventive_maintenance: [], audit_logs: [] };
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

  const siren = isUrgent ? '🚨 <b>[URGENT ACTION REQUIRED]</b>' : '🛡️ <b>[AUDIT SENTINEL]</b>';
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

// ============================================================================
// 1. OPERATIONS BOT HANDLER (@MainterpBot) - General Users & Floor Staff
// ============================================================================
async function handleUserBotMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const user = findUserByChatId(chatId);

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

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `🎉 <b>অভিনন্দন ${targetUser.name}!</b>\nঅ্যাকাউন্ট সফলভাবে সংযুক্ত হয়েছে।\nরোল: <code>${targetUser.presetName || targetUser.role}</code>\n\nকমান্ড দেখতে /start লিখুন।`,
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

১. ওয়েব পোর্টালে লগইন করুন।
২. প্রোফাইল থেকে <b>Telegram Bot & Alerts</b>-এ ক্লিক করে ৬ ডিজিটের কোড নিন।
৩. এখানে পাঠান: <code>/link YOUR_CODE</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: '⚠️ আপনার টেলিগ্রাম অ্যাকাউন্টটি এখনও লিঙ্ক করা হয়নি। অনুগ্রহ করে `/start` লিখে নির্দেশনা দেখুন।',
      parse_mode: 'HTML'
    });
  }

  // Operations Bot Menu
  if (text === '/start' || text === '/help') {
    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: `
👋 <b>নমস্কার, ${user.name}!</b>
🛡️ <b>অ্যাক্সেস রোল:</b> <code>${user.presetName || user.role}</code>
━━━━━━━━━━━━━━━━━━━━
🔍 /find &lt;serial&gt; — মেশিন সার্চ ও অবস্থা পর্যবেক্ষণ
🛠️ /pm — আজকের প্রিভেন্টিভ মেইনটেন্যান্স তালিকা
🚑 /ambulance — স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন
🔧 /tools — আপনার নামে বরাদ্দকৃত টুলস
🚪 /unlink — টেলিগ্রাম সংযোগ বিচ্ছিন্ন করুন
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // Machine Search
  if (text.startsWith('/find ') || (!text.startsWith('/') && text.length >= 2)) {
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

    return userBotRequest('sendMessage', {
      chat_id: chatId,
      text: formatMachineCard(matches[0]),
      parse_mode: 'HTML'
    });
  }

  // Standby Ambulance
  if (text === '/ambulance') {
    const db = getDatabase();
    const ambulances = (db.machines || []).filter(m => m.isAmbulance === true);
    if (ambulances.length === 0) {
      return userBotRequest('sendMessage', { chat_id: chatId, text: 'ℹ️ বর্তমানে কোনো মেশিন অ্যাম্বুলেন্স হিসেবে মার্ক করা নেই।' });
    }
    let reply = `🚑 <b>স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন (${ambulances.length} টি)</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    ambulances.slice(0, 8).forEach((m, idx) => {
      reply += `<b>${idx + 1}. ${m.machineName}</b> (<code>${m.serialNumber}</code>)\n   📍 ${m.floor || '—'}, Line: ${m.line || '—'}\n`;
    });
    return userBotRequest('sendMessage', { chat_id: chatId, text: reply, parse_mode: 'HTML' });
  }

  // Unlink
  if (text === '/unlink') {
    unlinkUserTelegram(user.id);
    return userBotRequest('sendMessage', { chat_id: chatId, text: '👋 টেলিগ্রাম সংযোগ বিচ্ছিন্ন করা হয়েছে।' });
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

        return adminBotRequest('sendMessage', {
          chat_id: chatId,
          text: `
👑 <b>EXECUTIVE ADMIN SENTINEL ACTIVE</b>
━━━━━━━━━━━━━━━━━━━━
স্বাগতম <b>${superAdmin.name}</b>!
আপনার টেলিগ্রাম আইডিটি <b>Al-Muslim Group Central Maintenance Admin Sentinel Bot (@MaintAdminbot)</b>-এর প্রাইমারি রিসিভার হিসেবে সক্রিয় করা হয়েছে।

এখন থেকে ফ্যাক্টরির প্রতিটি গেটপাস অনুমোদন রিকোয়েস্ট, মেশিন ব্রেকডাউন অ্যালার্ট এবং সিকিউরিটি অডিট এখানে লাইভ স্ট্রিম হবে।
`.trim(),
          parse_mode: 'HTML'
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
<b>Executive Commands:</b>
🚚 /transfers — Review & Authorize Gate Passes
📊 /status — Live Factory Infrastructure Health
🛡️ /audit — Stream Recent System Audit Logs
🚑 /ambulance — Emergency Standby Fleet Tracking
💾 /backup — Trigger Instant Database Snapshot
📢 /broadcast &lt;text&gt; — Send Factory-wide Notice
`.trim(),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `🚚 Pending Gate Passes (${pendingTr})`, callback_data: 'ADMIN_TRANSFERS' },
            { text: '📊 Status & Health', callback_data: 'ADMIN_STATUS' }
          ],
          [
            { text: '🛡️ Audit Trail Stream', callback_data: 'ADMIN_AUDIT' },
            { text: '🚑 Ambulance Fleet', callback_data: 'ADMIN_AMBULANCE' }
          ]
        ]
      }
    });
  }

  // /transfers (Gate Pass Authorization)
  if (text === '/transfers') {
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

  // /audit (Audit Trail Stream)
  if (text === '/audit') {
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

  // /status (Live System Overview)
  if (text === '/status') {
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

  // /backup (Trigger Instant Snapshot)
  if (text === '/backup') {
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

  // /broadcast <text>
  if (text.startsWith('/broadcast ')) {
    const msgText = text.replace('/broadcast ', '').trim();
    if (!msgText) return;

    const users = (db.users || []).filter(u => u.telegramChatId && u.status === 'ACTIVE');
    let sentCount = 0;
    for (const u of users) {
      userBotRequest('sendMessage', {
        chat_id: u.telegramChatId,
        text: `📢 <b>CENTRAL FACTORY NOTICE</b>\nFrom: <b>${user.name}</b>\n━━━━━━━━━━━━━━━━━━━━\n${msgText}`,
        parse_mode: 'HTML'
      }).then(() => sentCount++).catch(() => {});
    }

    return adminBotRequest('sendMessage', {
      chat_id: chatId,
      text: `✅ Broadcast notice queued for ${users.length} Telegram-connected personnel.`,
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

    await adminBotRequest('answerCallbackQuery', { callback_query_id: queryId, text: `✅ Gate Pass Authorized!` });

    return adminBotRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `
${formatTransferCard(tr)}

━━━━━━━━━━━━━━━━━━━━
✅ <b>GATE PASS DIGITALLY AUTHORIZED BY EXECUTIVE</b>
👤 <b>Authorizer:</b> ${user.name} (Super Admin)
⏱️ <b>Timestamp:</b> ${new Date().toLocaleTimeString()}
`.trim(),
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
  // Push to Executive Admin Bot (@MaintAdminbot)
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
