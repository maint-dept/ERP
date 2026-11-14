/**
 * Al-Muslim Group Maintenance ERP
 * Telegram Bot Control & Interactive Notification Service
 * 
 * Powered by Telegram Bot API (@MainterpBot)
 * Enforces strict Role-Based Access Control (RBAC) matching Web ERP permissions.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9262458473:AAG4epyvoUizmJfEfdo5C-sJhgtywPidIGU';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'erp_database.json');
const PUBLIC_DB_FILE = path.join(__dirname, 'public', 'data', 'erp_database.json');
const SECURE_API_KEY = 'AMG_MNT_SECURE_API_v4_89f2a7';

// In-memory store for pending 6-digit Telegram link codes: { code: { userId, expiresAt } }
const pendingLinkCodes = new Map();

// Helper: Make Telegram Bot API Request
function telegramRequest(method, data = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(`${API_BASE}/${method}`);
    
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

// Database Helpers
function getDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
    }
  } catch (err) {
    console.error('[TelegramBot] Error reading DB_FILE:', err.message);
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
    console.error('[TelegramBot] Error saving DB_FILE:', err.message);
    return false;
  }
}

// User & Permission Helpers
function findUserByChatId(chatId) {
  const db = getDatabase();
  const cid = String(chatId);
  return (db.users || []).find(u => String(u.telegramChatId) === cid && u.status === 'ACTIVE');
}

function hasPermission(user, moduleKey, actionKey) {
  if (!user || user.status !== 'ACTIVE') return false;
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
  if (!user.permissions || !user.permissions[moduleKey]) return false;
  const modPerms = user.permissions[moduleKey];
  return Array.isArray(modPerms) && (modPerms.includes(actionKey) || modPerms.includes('ALL'));
}

// Audit logger
function logAudit(db, user, action, entity, entityId, details) {
  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.unshift({
    id: `aud-tg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: user.id,
    username: user.username,
    action: action,
    entity: entity,
    entityId: entityId,
    details: `[Telegram Bot] ${details}`,
    oldData: null,
    newData: null,
    ip: '127.0.0.1 (Telegram Bot)',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  if (db.audit_logs.length > 500) db.audit_logs = db.audit_logs.slice(0, 500);
}

// Real-time Event Broadcaster Hook (Provided by server.js)
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

// Public linking API for Web UI
function generateLinkCodeForUser(userId) {
  const db = getDatabase();
  const user = (db.users || []).find(u => u.id === userId);
  if (!user) return null;

  // Clean expired codes
  const now = Date.now();
  for (const [code, val] of pendingLinkCodes.entries()) {
    if (val.expiresAt < now) pendingLinkCodes.delete(code);
  }

  // 6-digit random alphanumeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingLinkCodes.set(code, {
    userId: user.id,
    username: user.username,
    expiresAt: now + (15 * 60 * 1000) // 15 mins expiry
  });

  return {
    code,
    expiresInSeconds: 900,
    botUsername: 'MainterpBot',
    deepLink: `https://t.me/MainterpBot?start=AMG_${code}`
  };
}

function unlinkUserTelegram(userId) {
  const db = getDatabase();
  const user = (db.users || []).find(u => u.id === userId);
  if (!user) return false;

  user.telegramChatId = null;
  user.telegramUsername = null;
  user.telegramLinkedAt = null;
  saveDatabase(db);
  return true;
}

// Helper: Format machine summary card
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

// Helper: Format Transfer Request Card
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
📝 <b>Reason:</b> ${tr.reason || 'Floor balancing'}
🚦 <b>Status:</b> <b>${tr.status || 'PENDING'}</b>
`.trim();
}

// Command & Message Router
async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim();
  const user = findUserByChatId(chatId);

  if (!text) return;

  // 1. Deep-Linking or Direct Code Linking (/start AMG_123456 or /link 123456)
  if (text.startsWith('/start AMG_') || text.startsWith('/link ')) {
    const code = text.replace('/start AMG_', '').replace('/link ', '').trim();
    const entry = pendingLinkCodes.get(code);

    if (!entry || entry.expiresAt < Date.now()) {
      return telegramRequest('sendMessage', {
        chat_id: chatId,
        text: '❌ <b>লিঙ্ক কোডটি অকার্যকর বা মেয়াদোত্তীর্ণ হয়ে গেছে।</b>\n\nদয়া করে আপনার ওয়েব ERP পোর্টালের প্রোফাইল মেনু থেকে নতুন লিঙ্ক কোড তৈরি করুন।',
        parse_mode: 'HTML'
      });
    }

    const db = getDatabase();
    const targetUser = (db.users || []).find(u => u.id === entry.userId);
    if (!targetUser) {
      return telegramRequest('sendMessage', {
        chat_id: chatId,
        text: '❌ ব্যবহারকারী খুঁজে পাওয়া যায়নি।',
        parse_mode: 'HTML'
      });
    }

    targetUser.telegramChatId = String(chatId);
    targetUser.telegramUsername = msg.chat?.username || null;
    targetUser.telegramLinkedAt = new Date().toISOString();
    saveDatabase(db);
    pendingLinkCodes.delete(code);

    logAudit(db, targetUser, 'TELEGRAM_LINK', 'USER', targetUser.id, `Linked Telegram Chat ID: ${chatId}`);

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: `
🎉 <b>অভিনন্দন ${targetUser.name}!</b>
━━━━━━━━━━━━━━━━━━━━
আপনার আল-মুসলিম গ্রুপ ERP অ্যাকাউন্ট সফলভাবে টেলিগ্রামের সাথে সংযুক্ত হয়েছে।

👤 <b>রোল:</b> ${targetUser.presetName || targetUser.role}
📧 <b>ইমেইল:</b> ${targetUser.email || '—'}
🏢 <b>বিভাগ:</b> ${targetUser.department || 'Maintenance'}

আপনার অ্যাক্সেস অনুমতি অনুযায়ী কমান্ড দেখতে নিচের মেনু ব্যবহার করুন:
/find &lt;serial&gt; - মেশিন সার্চ
/transfers - ট্রান্সফার রিকোয়েস্ট ও অনুমোদন
/pm - আজকের প্রিভেন্টিভ মেইনটেন্যান্স
/ambulance - স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন
/status - সিস্টেম স্বাস্থ্য ও স্ট্যাটাস
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // 2. Direct Admin Claim (/claim_admin <apiKey>)
  if (text.startsWith('/claim_admin ')) {
    const key = text.replace('/claim_admin ', '').trim();
    if (key === SECURE_API_KEY) {
      const db = getDatabase();
      const superAdmin = (db.users || []).find(u => u.id === 'usr-super-admin');
      if (superAdmin) {
        superAdmin.telegramChatId = String(chatId);
        superAdmin.telegramUsername = msg.chat?.username || null;
        superAdmin.telegramLinkedAt = new Date().toISOString();
        saveDatabase(db);
        logAudit(db, superAdmin, 'TELEGRAM_CLAIM_ADMIN', 'USER', superAdmin.id, `Super Admin claimed via Secret Key`);

        return telegramRequest('sendMessage', {
          chat_id: chatId,
          text: `👑 <b>Super Administrator Verified!</b>\n\nস্বাগতম <b>${superAdmin.name}</b>। আপনার টেলিগ্রাম অ্যাকাউন্টটি কেন্দ্রীয় সুপার অ্যাডমিন হিসেবে কনফিগার করা হয়েছে।`,
          parse_mode: 'HTML'
        });
      }
    }
  }

  // 3. Unauthenticated / Unlinked User Guard
  if (!user) {
    if (text === '/start' || text === '/help') {
      return telegramRequest('sendMessage', {
        chat_id: chatId,
        text: `
👋 <b>স্বাগতম Al-Muslim Group Maintenance ERP বট-এ!</b>
━━━━━━━━━━━━━━━━━━━━
এই বটের মাধ্যমে ফ্যাক্টরির মেশিনারি ট্র্যাকিং, ট্রান্সফার গেটপাস অনুমোদন এবং ইমার্জেন্সি ব্রেকডাউন নোটিফিকেশন নিয়ন্ত্রণ করা যায়।

🔒 <b>আপনার অ্যাকাউন্ট লিঙ্ক করুন:</b>
১. ওয়েব ERP পোর্টালে লগইন করুন।
২. ডানপাশের প্রোফাইল মেনু থেকে <b>Telegram Connect</b> বাটনে ক্লিক করে ৬ ডিজিটের লিঙ্ক কোড নিন।
৩. এরপর এখানে রিপ্লাই দিন:
<code>/link YOUR_CODE</code>

<i>অথবা সুপার অ্যাডমিন সরাসরি সিক্রেট কি দিয়ে সক্রিয় করতে পারেন:</i>
<code>/claim_admin &lt;SECURE_API_KEY&gt;</code>
`.trim(),
        parse_mode: 'HTML'
      });
    }

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: '⚠️ আপনার টেলিগ্রাম অ্যাকাউন্টটি এখনও ERP অ্যাকাউন্টের সাথে লিঙ্ক করা হয়নি। অনুগ্রহ করে `/start` লিখে নির্দেশনা দেখুন।',
      parse_mode: 'HTML'
    });
  }

  // ==========================================
  // AUTHENTICATED USER COMMANDS (STRICT RBAC)
  // ==========================================

  // /start or /help (Authorized User Dashboard)
  if (text === '/start' || text === '/help') {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const isAdmin = user.role === 'ADMIN' || isSuperAdmin;
    const canTransfers = hasPermission(user, 'transfers', 'VIEW');
    const canPM = hasPermission(user, 'preventive_maintenance', 'VIEW');
    const canTools = hasPermission(user, 'tools_management', 'VIEW');

    let menu = `
👋 <b>নমস্কার, ${user.name}!</b>
🛡️ <b>অ্যাক্সেস রোল:</b> <code>${user.presetName || user.role}</code>
━━━━━━━━━━━━━━━━━━━━
<b>অনুমোদিত কমান্ডসমূহ:</b>
🔍 /find &lt;serial&gt; — মেশিন সার্চ ও অবস্থা পর্যবেক্ষণ
`.trim();

    if (canTransfers) menu += `\n🚚 /transfers — ট্রান্সফার রিকোয়েস্ট ও গেটপাস${isAdmin ? ' (অনুমোদন সহ)' : ''}`;
    if (canPM) menu += `\n🛠️ /pm — আজকের প্রিভেন্টিভ মেইনটেন্যান্স চেকলিস্ট`;
    menu += `\n🚑 /ambulance — স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন তালিকা`;
    if (canTools) menu += `\n🔧 /tools — আপনার নামে ইস্যুকৃত টুলস ও ইকুইপমেন্ট`;
    if (isAdmin) menu += `\n📊 /status — লাইভ সিস্টেম স্বাস্থ্য ও ডেটাবেস সিঙ্ক`;
    menu += `\n🚪 /unlink — টেলিগ্রাম সংযোগ বিচ্ছিন্ন করুন`;

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: menu,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 মেশিন সার্চ', callback_data: 'ACTION_MENU_SEARCH' },
            { text: '🚑 অ্যাম্বুলেন্স মেশিন', callback_data: 'ACTION_AMBULANCE_LIST' }
          ],
          [
            { text: '🚚 ট্রান্সফার তালিকা', callback_data: 'ACTION_TRANSFERS_LIST' },
            { text: '🛠️ আজকের PM', callback_data: 'ACTION_PM_LIST' }
          ]
        ]
      }
    });
  }

  // /find <query> or typing a machine serial directly
  if (text.startsWith('/find ') || (!text.startsWith('/') && text.length >= 2)) {
    const query = text.startsWith('/find ') ? text.replace('/find ', '').trim() : text;
    if (!hasPermission(user, 'machines', 'VIEW')) {
      return telegramRequest('sendMessage', { chat_id: chatId, text: '⛔ আপনার মেশিনারি ইনভেন্টরি দেখার অনুমতি নেই।' });
    }

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
      return telegramRequest('sendMessage', {
        chat_id: chatId,
        text: `🔍 '<code>${query}</code>' দিয়ে কোনো মেশিন পাওয়া যায়নি। সঠিক সিরিয়াল নম্বর বা মডেল দিয়ে চেষ্টা করুন।`,
        parse_mode: 'HTML'
      });
    }

    // Return the top exact/first match
    const m = matches[0];
    const canOperate = hasPermission(user, 'machines', 'EDIT') || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    const buttons = [];
    const row1 = [];
    if (canOperate) {
      row1.push({ text: m.isAmbulance ? '🚑 Remove Ambulance' : '🚑 Set Ambulance', callback_data: `TOGGLE_AMB:${m.id || m.serialNumber}` });
    }
    if (hasPermission(user, 'transfers', 'ADD') || canOperate) {
      row1.push({ text: '🚚 Request Transfer', callback_data: `REQ_TR:${m.id || m.serialNumber}` });
    }
    if (row1.length > 0) buttons.push(row1);

    if (matches.length > 1) {
      buttons.push([{ text: `📋 আরও ${matches.length - 1} টি ফলাফল দেখুন`, callback_data: `SEARCH_MORE:${query}` }]);
    }

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: formatMachineCard(m),
      parse_mode: 'HTML',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
    });
  }

  // /transfers (View Pending Transfers & Approvals)
  if (text === '/transfers') {
    if (!hasPermission(user, 'transfers', 'VIEW')) {
      return telegramRequest('sendMessage', { chat_id: chatId, text: '⛔ আপনার ট্রান্সফার রেকর্ড দেখার অনুমতি নেই।' });
    }

    const db = getDatabase();
    const canApprove = hasPermission(user, 'transfers', 'APPROVE') || user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    // Look for pending requests
    const pendingRequests = (db.transfer_requests || []).filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS');

    if (pendingRequests.length === 0) {
      return telegramRequest('sendMessage', {
        chat_id: chatId,
        text: '✅ <b>বর্তমানে কোনো পেন্ডিং ট্রান্সফার রিকোয়েস্ট নেই।</b>\nসবগুলো ট্রান্সফার গেটপাস প্রসেস করা হয়েছে।',
        parse_mode: 'HTML'
      });
    }

    for (const tr of pendingRequests.slice(0, 3)) {
      const card = formatTransferCard(tr);
      const buttons = [];

      if (canApprove) {
        buttons.push([
          { text: '✅ Approve Gate Pass', callback_data: `APPROVE_TR:${tr.id}` },
          { text: '❌ Reject', callback_data: `REJECT_TR:${tr.id}` }
        ]);
      }

      await telegramRequest('sendMessage', {
        chat_id: chatId,
        text: card,
        parse_mode: 'HTML',
        reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
      });
    }
    return;
  }

  // /ambulance (Standby Emergency Breakdown Machines)
  if (text === '/ambulance') {
    const db = getDatabase();
    const ambulances = (db.machines || []).filter(m => m.isAmbulance === true);

    if (ambulances.length === 0) {
      return telegramRequest('sendMessage', {
        chat_id: chatId,
        text: 'ℹ️ বর্তমানে কোনো মেশিনকে 🚑 <b>Ambulance Standby</b> হিসেবে নির্দিষ্ট করা নেই।',
        parse_mode: 'HTML'
      });
    }

    let reply = `🚑 <b>স্ট্যান্ডবাই অ্যাম্বুলেন্স মেশিন তালিকা (${ambulances.length} টি)</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    ambulances.slice(0, 8).forEach((m, idx) => {
      reply += `<b>${idx + 1}. ${m.machineName}</b> (<code>${m.serialNumber}</code>)\n   📍 ${m.floor || '—'}, Line: ${m.line || '—'} | Model: ${m.model || '—'}\n`;
    });

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: reply,
      parse_mode: 'HTML'
    });
  }

  // /status (Super Admin & System Status)
  if (text === '/status') {
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return telegramRequest('sendMessage', { chat_id: chatId, text: '⛔ শুধুমাত্র সিস্টেম অ্যাডমিনিস্ট্রেটর এই স্ট্যাটাস দেখতে পারেন।' });
    }

    const db = getDatabase();
    const machines = db.machines || [];
    const total = machines.length;
    const running = machines.filter(m => m.running || m.status === 'RUNNING').length;
    const ambulance = machines.filter(m => m.isAmbulance).length;
    const pendingTr = (db.transfer_requests || []).filter(r => r.status === 'PENDING').length;
    const users = db.users || [];
    const tgLinkedCount = users.filter(u => u.telegramChatId).length;

    const reply = `
📊 <b>Al-Muslim Group Maintenance ERP Status</b>
━━━━━━━━━━━━━━━━━━━━
🏭 <b>মোট মেশিন:</b> <code>${total.toLocaleString()}</code>
🟢 <b>সচল (Running):</b> <code>${running.toLocaleString()}</code>
🚑 <b>অ্যাম্বুলেন্স স্ট্যান্ডবাই:</b> <code>${ambulance}</code>
🚚 <b>পেন্ডিং ট্রান্সফার:</b> <code>${pendingTr}</code>
👥 <b>নিবন্ধিত ইউজার:</b> <code>${users.length}</code> (${tgLinkedCount} Telegram Linked)
🗄️ <b>ডেটা ইঞ্জিন:</b> JSON Primary + MySQL Multi-DB Sync
⚡ <b>রিয়েল-টাইম ইভেন্ট হাব:</b> সক্রিয় (SSE Active)
⏱️ <b>সার্ভার টাইম:</b> <code>${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</code> (Dhaka)
`.trim();

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: reply,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Status', callback_data: 'REFRESH_STATUS' }]
        ]
      }
    });
  }

  // /unlink (Disconnect Telegram)
  if (text === '/unlink') {
    const db = getDatabase();
    const targetUser = (db.users || []).find(u => u.id === user.id);
    if (targetUser) {
      targetUser.telegramChatId = null;
      targetUser.telegramUsername = null;
      targetUser.telegramLinkedAt = null;
      saveDatabase(db);
      logAudit(db, targetUser, 'TELEGRAM_UNLINK', 'USER', targetUser.id, 'Disconnected Telegram session');
    }

    return telegramRequest('sendMessage', {
      chat_id: chatId,
      text: '👋 আপনার টেলিগ্রাম সংযোগ সফলভাবে বিচ্ছিন্ন করা হয়েছে। পুনরায় সংযোগ করতে `/start` চাপুন।',
      parse_mode: 'HTML'
    });
  }
}

// Callback Query Handler (Inline Buttons)
async function handleCallbackQuery(cbQuery) {
  const queryId = cbQuery.id;
  const data = cbQuery.data || '';
  const chatId = cbQuery.message?.chat?.id;
  const messageId = cbQuery.message?.message_id;
  const user = findUserByChatId(chatId);

  if (!user) {
    return telegramRequest('answerCallbackQuery', {
      callback_query_id: queryId,
      text: '⛔ আপনার কোনো সক্রিয় ERP অ্যাকাউন্ট লিংক করা নেই।',
      show_alert: true
    });
  }

  // 1. Approve Transfer
  if (data.startsWith('APPROVE_TR:')) {
    const trId = data.replace('APPROVE_TR:', '');
    if (!hasPermission(user, 'transfers', 'APPROVE') && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return telegramRequest('answerCallbackQuery', {
        callback_query_id: queryId,
        text: '⚠️ গেটপাস অনুমোদন করার অনুমতি আপনার অ্যাকাউন্টে নেই।',
        show_alert: true
      });
    }

    const db = getDatabase();
    const tr = (db.transfer_requests || []).find(r => r.id === trId);
    if (!tr) {
      return telegramRequest('answerCallbackQuery', {
        callback_query_id: queryId,
        text: '❌ ট্রান্সফার রেকর্ডটি পাওয়া যায়নি।',
        show_alert: true
      });
    }

    tr.status = 'APPROVED';
    tr.approvedBy = user.id;
    tr.approvedByName = user.name;
    tr.approvedAt = new Date().toISOString();

    saveDatabase(db);
    logAudit(db, user, 'APPROVE_TRANSFER', 'TRANSFER', tr.id, `Approved transfer #${tr.requestNumber || tr.id}`);
    broadcastEvent('transfer:approved', { transferId: tr.id, approver: user.name });

    await telegramRequest('answerCallbackQuery', {
      callback_query_id: queryId,
      text: `✅ গেটপাস #${tr.requestNumber || tr.id} সফলভাবে অনুমোদিত হয়েছে!`
    });

    return telegramRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `
${formatTransferCard(tr)}

━━━━━━━━━━━━━━━━━━━━
✅ <b>GATE PASS AUTHORIZED!</b>
👤 <b>অনুমোদনকারী:</b> ${user.name} (${user.presetName || user.role})
⏱️ <b>সময়:</b> ${new Date().toLocaleTimeString()}
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // 2. Reject Transfer
  if (data.startsWith('REJECT_TR:')) {
    const trId = data.replace('REJECT_TR:', '');
    if (!hasPermission(user, 'transfers', 'APPROVE') && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return telegramRequest('answerCallbackQuery', {
        callback_query_id: queryId,
        text: '⚠️ ট্রান্সফার বাতিল করার অনুমতি নেই।',
        show_alert: true
      });
    }

    const db = getDatabase();
    const tr = (db.transfer_requests || []).find(r => r.id === trId);
    if (tr) {
      tr.status = 'REJECTED';
      tr.rejectedBy = user.id;
      tr.rejectedByName = user.name;
      tr.rejectedAt = new Date().toISOString();
      saveDatabase(db);
      logAudit(db, user, 'REJECT_TRANSFER', 'TRANSFER', tr.id, `Rejected transfer #${tr.requestNumber || tr.id}`);
      broadcastEvent('transfer:rejected', { transferId: tr.id, rejector: user.name });
    }

    await telegramRequest('answerCallbackQuery', {
      callback_query_id: queryId,
      text: `❌ ট্রান্সফার #${tr?.requestNumber || trId} বাতিল করা হয়েছে।`
    });

    return telegramRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: `
${formatTransferCard(tr || { id: trId, status: 'REJECTED' })}

━━━━━━━━━━━━━━━━━━━━
❌ <b>TRANSFER REQUEST REJECTED</b>
👤 <b>বাতিলকারী:</b> ${user.name}
`.trim(),
      parse_mode: 'HTML'
    });
  }

  // 3. Toggle Ambulance Status
  if (data.startsWith('TOGGLE_AMB:')) {
    const idOrSerial = data.replace('TOGGLE_AMB:', '');
    const db = getDatabase();
    const machine = (db.machines || []).find(m => m.id === idOrSerial || m.serialNumber === idOrSerial);

    if (!machine) {
      return telegramRequest('answerCallbackQuery', { callback_query_id: queryId, text: 'মেশিন পাওয়া যায়নি।' });
    }

    machine.isAmbulance = !machine.isAmbulance;
    saveDatabase(db);
    logAudit(db, user, 'UPDATE_AMBULANCE', 'MACHINE', machine.serialNumber, `Set isAmbulance=${machine.isAmbulance}`);
    broadcastEvent('machine:updated', { machineId: machine.id, serialNumber: machine.serialNumber, isAmbulance: machine.isAmbulance });

    await telegramRequest('answerCallbackQuery', {
      callback_query_id: queryId,
      text: machine.isAmbulance ? '🚑 Designated as Standby Ambulance Machine' : 'Removed from Ambulance Status'
    });

    return telegramRequest('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: formatMachineCard(machine),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: machine.isAmbulance ? '🚑 Remove Ambulance' : '🚑 Set Ambulance', callback_data: `TOGGLE_AMB:${machine.id || machine.serialNumber}` }
        ]]
      }
    });
  }

  // Default fallback
  return telegramRequest('answerCallbackQuery', {
    callback_query_id: queryId,
    text: 'অনুরোধ প্রক্রিয়া সম্পন্ন হয়েছে।'
  });
}

// Background Long-Polling Worker
let pollingActive = false;
let updateOffset = 0;

async function startPollingLoop() {
  if (pollingActive) return;
  pollingActive = true;
  console.log('[TelegramBot] 🤖 Telegram Bot Long-Polling Daemon Started (@MainterpBot)...');

  while (pollingActive) {
    try {
      const updates = await telegramRequest('getUpdates', {
        offset: updateOffset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });

      if (Array.isArray(updates) && updates.length > 0) {
        for (const update of updates) {
          updateOffset = update.update_id + 1;

          if (update.message) {
            handleMessage(update.message).catch(err => {
              console.error('[TelegramBot] Error handling message:', err);
            });
          } else if (update.callback_query) {
            handleCallbackQuery(update.callback_query).catch(err => {
              console.error('[TelegramBot] Error handling callback_query:', err);
            });
          }
        }
      }
    } catch (pollErr) {
      console.warn('[TelegramBot] Polling network warning (retrying in 5s):', pollErr.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Push notification to relevant Telegram users when an event happens
async function notifyApproversOfTransfer(transfer) {
  const db = getDatabase();
  const approvers = (db.users || []).filter(u => 
    u.telegramChatId && u.status === 'ACTIVE' && (hasPermission(u, 'transfers', 'APPROVE') || u.role === 'SUPER_ADMIN' || u.role === 'ADMIN')
  );

  const card = formatTransferCard(transfer);
  for (const approver of approvers) {
    telegramRequest('sendMessage', {
      chat_id: approver.telegramChatId,
      text: `🚨 <b>নতুন মেশিন ট্রান্সফার রিকোয়েস্ট!</b>\n━━━━━━━━━━━━━━━━━━━━\n${card}`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Approve Gate Pass', callback_data: `APPROVE_TR:${transfer.id}` },
            { text: '❌ Reject', callback_data: `REJECT_TR:${transfer.id}` }
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
  telegramRequest
};
