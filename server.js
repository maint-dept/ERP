const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3030;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'erp_database.json');
const SECURE_API_KEY = 'AMG_MNT_SECURE_API_v4_89f2a7';

// --- REAL-TIME SERVER-SENT EVENTS (SSE) HUB ---
const sseClients = new Set();

function broadcastRealtimeEvent(eventData) {
  if (sseClients.size === 0) return 0;
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  let sentCount = 0;
  for (const client of sseClients) {
    try {
      client.write(payload);
      sentCount++;
    } catch (_) {
      sseClients.delete(client);
    }
  }
  return sentCount;
}

// Keep-alive heartbeat every 20 seconds to prevent proxy / firewall timeout
setInterval(() => {
  if (sseClients.size > 0) {
    const pingMsg = `: keep-alive\n\n`;
    for (const client of sseClients) {
      try {
        client.write(pingMsg);
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }
}, 20000);

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  try {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  } catch (_) {}
}

/**
 * Creates automated daily rolling backup snapshots with 30-day retention
 */
function createRollingSnapshot() {
  if (!fs.existsSync(DB_FILE)) return null;
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const snapshotName = `erp_backup_${todayStr}.json`;
    const snapshotPath = path.join(BACKUPS_DIR, snapshotName);
    fs.copyFileSync(DB_FILE, snapshotPath);

    // Prune snapshots older than 30 days
    const files = fs.readdirSync(BACKUPS_DIR);
    const now = Date.now();
    const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
    files.forEach(f => {
      if (f.startsWith('erp_backup_') && f.endsWith('.json')) {
        const filePath = path.join(BACKUPS_DIR, f);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > MAX_AGE_MS) {
            fs.unlinkSync(filePath);
            console.log(`[SERVER BACKUP] Pruned expired snapshot: ${f}`);
          }
        } catch (_) {}
      }
    });

    const stats = fs.statSync(snapshotPath);
    return { name: snapshotName, path: snapshotPath, date: todayStr, bytes: stats.size };
  } catch (err) {
    console.error('[SERVER BACKUP ERROR]:', err.message);
    return null;
  }
}

// Initial snapshot on boot
setTimeout(() => {
  try {
    createRollingSnapshot();
  } catch (_) {}
}, 2000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.bin': 'application/octet-stream',
  '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
  // CORS & Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Role, X-User-Id, X-Location-Scope, X-API-Key');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = req.url ? req.url.split('?')[0] : '/';

  // Helper for backend location-based access control evaluation
  function isLocationAllowedBackend(scope, unitId, floorId, lineId) {
    if (!scope) return false;
    if (scope.allGroups && (scope.allUnits || (!scope.unitIds?.length && !scope.floorIds?.length && !scope.lineIds?.length))) {
      return true;
    }
    if (!scope.allUnits) {
      if (Array.isArray(scope.unitIds) && scope.unitIds.length > 0) {
        if (!unitId || !scope.unitIds.includes(unitId)) return false;
      } else if (!scope.allGroups) {
        return false;
      }
    }
    if (!scope.allFloors) {
      if (Array.isArray(scope.floorIds) && scope.floorIds.length > 0) {
        if (floorId && !scope.floorIds.includes(floorId)) return false;
      } else if (!scope.allUnits && !scope.allGroups && floorId) {
        return false;
      }
    }
    if (!scope.allLines) {
      if (Array.isArray(scope.lineIds) && scope.lineIds.length > 0) {
        if (lineId && !scope.lineIds.includes(lineId)) return false;
      } else if (!scope.allFloors && !scope.allUnits && !scope.allGroups && lineId) {
        return false;
      }
    }
    return true;
  }

  // Security Gate: Reject API requests from unassigned Zero-Access accounts
  const userRoleHeader = req.headers['x-user-role'] || '';
  const userIdHeader = req.headers['x-user-id'] || '';
  const userScopeHeader = req.headers['x-location-scope'] || '';

  if (urlPath.startsWith('/api/') && urlPath !== '/api/health' && urlPath !== '/api/client-log') {
    if (userRoleHeader === 'NO_ACCESS') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ 
        status: 'error', 
        code: 'ACCESS_DENIED', 
        message: 'Security Policy: Zero-Access accounts are prohibited from executing API operations until permissions are assigned by an Administrator.' 
      }));
    }
  }

  // Backend Location & Permissions Verification Endpoint
  if (urlPath === '/api/access/verify-location') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const role = req.headers['x-user-role'] || payload.role || '';
        if (role === 'NO_ACCESS') {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ status: 'error', code: 'ACCESS_DENIED', message: 'User has ZERO access permissions.' }));
        }

        let scope = null;
        if (userScopeHeader) {
          try { scope = JSON.parse(userScopeHeader); } catch (_) {}
        }
        if (!scope && payload.assignedScope) {
          scope = payload.assignedScope;
        }

        // If no scope provided and not global, look up user from database
        if (!scope && (userIdHeader || payload.userId) && fs.existsSync(DB_FILE)) {
          try {
            const dbContent = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
            const user = (dbContent.users || []).find(u => u.id === (userIdHeader || payload.userId));
            if (user) {
              if (user.role === 'NO_ACCESS') {
                res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify({ status: 'error', code: 'ACCESS_DENIED', message: 'Zero-access user account.' }));
              }
              scope = user.assignedScope;
            }
          } catch (_) {}
        }

        const unitId = payload.unitId;
        const floorId = payload.floorId;
        const lineId = payload.lineId;

        const isAllowed = isLocationAllowedBackend(scope, unitId, floorId, lineId);
        if (!isAllowed) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({
            status: 'error',
            code: 'LOCATION_ACCESS_DENIED',
            message: `Location Access Denied: User is not authorized to access or operate on Unit '${unitId || '—'}', Floor '${floorId || '—'}', Line '${lineId || '—'}'.`
          }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'ok', allowed: true, unitId, floorId, lineId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
    return;
  }

  // Health check endpoint
  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok', system: 'Al-Muslim Group - Maintenance Department ERP' }));
  }

  // Server-Sent Events (SSE) Real-Time Stream Endpoint
  if (urlPath === '/api/realtime/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });

    const initEvent = {
      type: 'CONNECTED',
      message: 'Real-Time SSE Hub connected successfully',
      activeClients: sseClients.size + 1,
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(initEvent)}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Real-Time Event Broadcast Endpoint (Internal & Client Dispatch)
  if (urlPath === '/api/realtime/broadcast') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      });
      return res.end();
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const broadcastPayload = {
          type: payload.type || 'DATA_CHANGED',
          table: payload.table || '',
          id: payload.id || null,
          action: payload.action || 'RECORD_SAVED',
          data: payload.data || null,
          senderId: payload.senderId || null,
          timestamp: payload.timestamp || new Date().toISOString()
        };
        const sentCount = broadcastRealtimeEvent(broadcastPayload);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          status: 'ok',
          sentCount,
          activeClients: sseClients.size,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
    return;
  }

  // Real-Time Stats Endpoint
  if (urlPath === '/api/realtime/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      activeClients: sseClients.size,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
  }



  // SMTP Email Helper with auto-sanitization
  function createSmtpTransporter(cfg) {
    const nodemailer = require('nodemailer');
    let host = (cfg.smtpHost || '').trim();
    if (!host || host.toLowerCase() === 'gmail.com') host = 'smtp.gmail.com';
    if (host.toLowerCase() === 'outlook.com' || host.toLowerCase() === 'hotmail.com') host = 'smtp.office365.com';
    if (host.toLowerCase() === 'yahoo.com') host = 'smtp.mail.yahoo.com';

    let portNum = parseInt(cfg.smtpPort, 10) || 587;
    // Port 465 is always SSL (secure: true). Port 587 or 25 is STARTTLS (secure: false).
    let isSecure = portNum === 465;
    if (cfg.encryption && cfg.encryption.toUpperCase() === 'SSL' && portNum !== 587) {
      isSecure = true;
    }

    // Remove any accidental spaces in app password (Google displays app passwords as "abcd efgh ijkl mnop")
    let pass = (cfg.smtpPass || '').trim();
    if (pass.includes(' ')) {
      pass = pass.replace(/\s+/g, '');
    }

    return nodemailer.createTransport({
      host,
      port: portNum,
      secure: isSecure,
      auth: {
        user: (cfg.smtpUser || '').trim(),
        pass
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      tls: { rejectUnauthorized: false }
    });
  }

  function formatSmtpError(err) {
    let userMsg = err.message || 'SMTP Error';
    if (err.code === 'EAUTH' || (err.response && (err.response.includes('BadCredentials') || err.response.includes('535')))) {
      userMsg = 'Gmail Authentication Failed (535 BadCredentials): Google requires a 16-character App Password generated from this matching Google account (myaccount.google.com/apppasswords). Please ensure 2-Step Verification is active and the 16-char App Password was generated for this exact account.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT' || (err.message && err.message.includes('timed out'))) {
      userMsg = 'Connection Timeout (8s): Unable to reach the SMTP server. Please verify your host, port (587 TLS or 465 SSL), and network connection.';
    } else if (err.code === 'ENOTFOUND') {
      userMsg = 'Host Not Found: The SMTP host address could not be resolved. For Gmail use smtp.gmail.com, for Outlook use smtp.office365.com.';
    } else if (err.code === 'ECONNREFUSED') {
      userMsg = 'Connection Refused: The SMTP port rejected the connection. Please check port 587 (TLS) or 465 (SSL).';
    }
    return userMsg;
  }

  // SMTP Email Verification Endpoint
  if (urlPath === '/api/email/verify') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const transporter = createSmtpTransporter(payload);
        
        // 8.5s timeout promise wrapper
        const verifyPromise = transporter.verify();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timed out after 8 seconds.')), 8500)
        );

        await Promise.race([verifyPromise, timeoutPromise]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', message: 'SMTP credentials verified successfully! Handshake completed with mail server.' }));
      } catch (err) {
        const userMsg = formatSmtpError(err);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', code: err.code || 'FAIL', message: userMsg }));
      }
    });
    return;
  }

  // SMTP Email Send Endpoint
  if (urlPath === '/api/email/send') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { config, to, subject, text, html } = payload;
        if (!config || !to || !subject) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ status: 'error', message: 'Missing parameters: config, to, and subject are required.' }));
        }

        const transporter = createSmtpTransporter(config);
        const sendPromise = transporter.sendMail({
          from: `"${config.fromName || 'Al-Muslim ERP'}" <${config.fromEmail || config.smtpUser}>`,
          to,
          subject,
          text: text || '',
          html: html || undefined
        });

        // 8.5s timeout promise wrapper
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Mail dispatch timed out after 8 seconds.')), 8500)
        );

        const info = await Promise.race([sendPromise, timeoutPromise]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', messageId: info.messageId, message: 'Email sent successfully via SMTP!' }));
      } catch (err) {
        const userMsg = formatSmtpError(err);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', code: err.code || 'FAIL', message: userMsg }));
      }
    });
    return;
  }

  // Persistent Database Records Store API Endpoints
  if (urlPath === '/api/db/records') {
    if (req.method === 'GET') {
      if (fs.existsSync(DB_FILE)) {
        fs.readFile(DB_FILE, 'utf8', (err, content) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'error', message: 'Failed to read database file' }));
          }
          try {
            const records = JSON.parse(content || '{}');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'ok', records }));
          } catch (parseErr) {
            console.error('[Server DB Read Error]:', parseErr.message);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'error', message: parseErr.message, records: null }));
          }
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'empty', records: null }));
      }
      return;
    }

    if (req.method === 'POST') {
      // Security Gate: Restrict persistent write operations to authenticated sessions or verified API key
      const reqApiKey = req.headers['x-api-key'] || (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '');
      const userRole = req.headers['x-user-role'] || '';
      const isKeyValid = reqApiKey === SECURE_API_KEY;
      const isAuthorizedRole = ['SUPER_ADMIN', 'ADMIN', 'MAINTENANCE_HEAD', 'MAINTENANCE_SUPERVISOR', 'MAINTENANCE_USER', 'DATA_ENTRY'].includes(userRole);

      if (!isKeyValid && !isAuthorizedRole) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ 
          status: 'error', 
          code: 'UNAUTHORIZED', 
          message: 'Security Policy: Valid API Key or authenticated session required to persist database records.' 
        }));
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) req.destroy();
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed || typeof parsed !== 'object') {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'error', message: 'Payload must be a valid JSON object' }));
          }

          // Safety check: ensure crucial tables are not missing, empty, or corrupted
          if (!Array.isArray(parsed.machines) || parsed.machines.length === 0 || !Array.isArray(parsed.lines) || parsed.lines.length === 0 || !Array.isArray(parsed.floors) || parsed.floors.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ 
              status: 'error', 
              message: 'Invalid database payload: "machines", "lines", and "floors" arrays must be non-empty' 
            }));
          }

          // Guarantee crucial factory seed items are never lost during client sync
          if (Array.isArray(parsed.employees)) {
            const ESSENTIAL_EMPS = [
              { id: 'emp-109', name: 'Ashraful Alam Shahed', cardNumber: 'AMG-0147075', designation: 'Senior Mechanic', department: 'Mechanical Maintenance', workingArea: 'Sewing - Jamuna', status: 'ACTIVE' },
              { id: 'emp-120', name: 'Madhob Chandra', cardNumber: 'AMG-0147291', designation: 'Senior Mechanic', department: 'Mechanical Maintenance', workingArea: 'Sewing - Jamuna', status: 'ACTIVE' },
              { id: 'emp-121', name: 'Md. Shojib', cardNumber: 'AMG-0132694', designation: 'Senior Mechanic', department: 'Mechanical Maintenance', workingArea: 'Sewing - Jamuna', status: 'ACTIVE' },
              { id: 'emp-122', name: 'Md. Najmul Hossain', cardNumber: 'AMG-0142472', designation: 'Senior Mechanic', department: 'Mechanical Maintenance', workingArea: 'Sewing - Jamuna', status: 'ACTIVE' },
              { id: 'emp-123', name: 'Dipok Roy', cardNumber: 'AMG-0143446', designation: 'Senior Mechanic', department: 'Mechanical Maintenance', workingArea: 'Sample Floor', status: 'ACTIVE' }
            ];
            ESSENTIAL_EMPS.forEach(e => {
              if (!parsed.employees.some(x => x.id === e.id || x.cardNumber === e.cardNumber)) {
                parsed.employees.push(e);
              }
            });
          }

          if (Array.isArray(parsed.tools_master)) {
            const spanner1417 = { id: 'tool-071', code: '071', name: 'Open End Spanner (14-17mm)', category: 'TOOLS', totalStock: 120, unit: 'Pcs', minStock: 20, status: 'ACTIVE' };
            if (!parsed.tools_master.some(t => t.id === 'tool-071' || t.name.includes('14-17mm'))) {
              parsed.tools_master.push(spanner1417);
            }
          }

          if (Array.isArray(parsed.accessories_master)) {
            const bag = { id: 'acc-011', code: 'ACC-11', name: 'Tools Bag (Canvas / Leather)', category: 'ACCESSORIES', defaultQty: '01 Pcs', defaultRemarks: 'Standard Mechanic Kit Bag', unit: 'Pcs', totalStock: 350, status: 'ACTIVE' };
            if (!parsed.accessories_master.some(a => a.id === 'acc-011' || a.name.toLowerCase().includes('tools bag'))) {
              parsed.accessories_master.push(bag);
            }
          }

          // Protect settings from accidental revert: preserve authoritative homepageVisibilityMode and adminLoginSlug
          if (fs.existsSync(DB_FILE)) {
            try {
              const existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
              if (existing.settings && parsed.settings) {
                if (existing.settings.homepageVisibilityMode && (parsed.settings.homepageVisibilityMode === 'public' || !parsed.settings.homepageVisibilityMode)) {
                  const currTs = existing.settings.homepageVisibilityUpdatedAt ? new Date(existing.settings.homepageVisibilityUpdatedAt).getTime() : 0;
                  const inTs = parsed.settings.homepageVisibilityUpdatedAt ? new Date(parsed.settings.homepageVisibilityUpdatedAt).getTime() : 0;
                  if (currTs >= inTs) {
                    parsed.settings.homepageVisibilityMode = existing.settings.homepageVisibilityMode;
                    parsed.settings.homepageVisibilityUpdatedAt = existing.settings.homepageVisibilityUpdatedAt;
                    parsed.settings.homepageVisibilityUpdatedBy = existing.settings.homepageVisibilityUpdatedBy;
                  }
                }
                if (existing.settings.adminLoginSlug && (!parsed.settings.adminLoginSlug || parsed.settings.adminLoginSlug === 'secure-admin-gateway')) {
                  const currSlugTs = existing.settings.adminLoginSlugUpdatedAt ? new Date(existing.settings.adminLoginSlugUpdatedAt).getTime() : 0;
                  const inSlugTs = parsed.settings.adminLoginSlugUpdatedAt ? new Date(parsed.settings.adminLoginSlugUpdatedAt).getTime() : 0;
                  if (currSlugTs >= inSlugTs) {
                    parsed.settings.adminLoginSlug = existing.settings.adminLoginSlug;
                    parsed.settings.adminLoginSlugUpdatedAt = existing.settings.adminLoginSlugUpdatedAt;
                  }
                }
              }
            } catch (_) {}
          }

          // Create backup before overwrite if existing file exists
          const backupFile = path.join(DATA_DIR, 'erp_database.backup.json');
          if (fs.existsSync(DB_FILE)) {
            try {
              fs.copyFileSync(DB_FILE, backupFile);
            } catch (_) {}
          }

          const serialized = JSON.stringify(parsed, null, 2);
          fs.writeFile(DB_FILE, serialized, 'utf8', err => {
            if (err) {
              console.error('[SERVER DB ERROR] Failed to write database file:', err);
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify({ status: 'error', message: 'Failed to write database file to disk' }));
            }

            try {
              const publicDbFile = path.join(PUBLIC_DIR, 'data', 'erp_database.json');
              fs.writeFileSync(publicDbFile, serialized, 'utf8');
            } catch (_) {}

            try {
              createRollingSnapshot();
            } catch (_) {}

            const byteCount = Buffer.byteLength(serialized);
            console.log(`[SERVER DB] ✅ Stored ${parsed.machines.length} machines, ${parsed.lines.length} lines, ${parsed.floors.length} floors to data/erp_database.json (${byteCount} bytes) at ${new Date().toLocaleTimeString()}`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
              status: 'ok',
              message: 'Database records stored successfully to persistent disk store',
              machinesCount: parsed.machines.length,
              linesCount: parsed.lines.length,
              bytes: byteCount,
              timestamp: new Date().toISOString()
            }));
          });
        } catch (parseErr) {
          console.error('[SERVER DB ERROR] JSON parse failed:', parseErr.message);
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON payload' }));
        }
      });
      return;
    }
  }

  // Real-time Client Diagnostic Logger Endpoint
  if (urlPath === '/api/client-log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const logLine = `[${new Date().toISOString()}] ${parsed.type}: ${parsed.message || JSON.stringify(parsed)}\n`;
        console.log('[CLIENT LOG]', logLine.trim());
        fs.appendFileSync(path.join(__dirname, 'client_errors.log'), logLine, 'utf8');
      } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    return;
  }

  if (urlPath === '/api/db/stats') {
    const exists = fs.existsSync(DB_FILE);
    let size = 0;
    let mtime = null;
    if (exists) {
      const st = fs.statSync(DB_FILE);
      size = st.size;
      mtime = st.mtime;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      databaseFile: 'data/erp_database.json',
      exists,
      sizeBytes: size,
      lastModified: mtime
    }));
  }

  // --- AUTOMATED DAILY ROLLING BACKUPS & SNAPSHOTS API ---

  // 1. List daily database snapshots
  if (urlPath === '/api/backup/list') {
    if (!fs.existsSync(BACKUPS_DIR)) {
      try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch (_) {}
    }
    try {
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('erp_backup_') && f.endsWith('.json'));
      const list = files.map(f => {
        const p = path.join(BACKUPS_DIR, f);
        const st = fs.statSync(p);
        const dateMatch = f.match(/erp_backup_(\d{4}-\d{2}-\d{2})\.json/);
        return {
          filename: f,
          date: dateMatch ? dateMatch[1] : '',
          sizeBytes: st.size,
          sizeFormatted: (st.size / (1024 * 1024)).toFixed(2) + ' MB',
          lastModified: st.mtime
        };
      }).sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ 
        status: 'ok', 
        backups: list, 
        total: list.length,
        retentionPolicy: '30-Day Rolling Daily Snapshots'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
  }

  // 2. Create immediate manual snapshot
  if (urlPath === '/api/backup/create') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: 'Method Not Allowed' }));
    }
    const snap = createRollingSnapshot();
    if (snap) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ 
        status: 'ok', 
        message: 'Daily backup snapshot created successfully', 
        backup: snap 
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: 'Failed to create backup snapshot' }));
    }
  }

  // 3. Download complete live database or specific snapshot
  if (urlPath === '/api/backup/download') {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const fileParam = parsedUrl.searchParams.get('file');
    let targetFile = DB_FILE;
    let downloadName = `AMG_ERP_Database_Backup_${new Date().toISOString().split('T')[0]}.json`;

    if (fileParam) {
      // Prevent directory traversal
      const safeName = path.basename(fileParam);
      const requestedPath = path.join(BACKUPS_DIR, safeName);
      if (fs.existsSync(requestedPath)) {
        targetFile = requestedPath;
        downloadName = safeName;
      }
    }

    if (!fs.existsSync(targetFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ status: 'error', message: 'Backup file not found' }));
    }

    const st = fs.statSync(targetFile);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': st.size,
      'Content-Disposition': `attachment; filename="${downloadName}"`
    });
    const readStream = fs.createReadStream(targetFile);
    readStream.pipe(res);
    return;
  }

  // Tools & Equipment Management API Endpoints
  if (urlPath === '/api/tools/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok', module: 'Tools, Equipment & Accessories Management System' }));
  }

  if (urlPath === '/api/tools/master') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      status: 'ok',
      totalTools: 28,
      totalAccessories: 10,
      standardKitAvailable: true
    }));
  }

  let cleanUrl = urlPath;
  if (cleanUrl.toLowerCase().startsWith('/erp/')) {
    cleanUrl = cleanUrl.slice(4);
  } else if (cleanUrl.toLowerCase() === '/erp') {
    cleanUrl = '/';
  }
  let safePath = cleanUrl === '/' ? '/index.html' : cleanUrl;
  let filePath = path.join(PUBLIC_DIR, path.normalize(safePath).replace(/^(\.\.[\/\\])+/, ''));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (idxErr, content) => {
        if (idxErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('500 Internal Server Error');
      }
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('=========================================================================');
  console.log('  AL-MUSLIM GROUP - GARMENTS FACTORY MAINTENANCE MACHINE INVENTORY ERP');
  console.log('=========================================================================');
  console.log(`  Server running successfully at: http://localhost:${PORT}`);
  console.log(`  Document Root: ${PUBLIC_DIR}`);
  console.log('  Press Ctrl+C to stop the server.');
  console.log('=========================================================================');
});
