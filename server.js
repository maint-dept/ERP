const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3030;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'erp_database.json');
const CHAT_HISTORY_FILE = path.join(DATA_DIR, 'chat_history.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (_) {}
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = req.url ? req.url.split('?')[0] : '/';

  // Health check endpoint
  if (urlPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok', system: 'Al-Muslim Group - Maintenance Department ERP' }));
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

    // Remove any accidental spaces in app password (e.g. "abcd efgh ijkl mnop")
    let pass = (cfg.smtpPass || '').trim();
    if (host === 'smtp.gmail.com' && pass.length === 19 && pass.includes(' ')) {
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
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 6000,
      tls: { rejectUnauthorized: false }
    });
  }

  function formatSmtpError(err) {
    let userMsg = err.message || 'SMTP Error';
    if (err.code === 'EAUTH' || (err.response && err.response.includes('BadCredentials'))) {
      userMsg = 'Gmail Authentication Failed (535 BadCredentials): Google requires a 16-character App Password generated from this matching Google account (myaccount.google.com/apppasswords). Please ensure the App Password was created in this exact Gmail account.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT' || err.message.includes('timed out')) {
      userMsg = 'Connection Timeout (5s): Unable to reach the SMTP server. Please verify your host (smtp.gmail.com), port (587), and internet connection.';
    } else if (err.code === 'ENOTFOUND') {
      userMsg = 'Host Not Found: The SMTP host is invalid. For Gmail, use smtp.gmail.com.';
    } else if (err.code === 'ECONNREFUSED') {
      userMsg = 'Connection Refused: The SMTP port rejected the connection. Please verify port 587 (TLS) or 465 (SSL).';
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
        
        // Hard 5.5s timeout promise wrapper
        const verifyPromise = transporter.verify();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timed out after 5 seconds.')), 5500)
        );

        await Promise.race([verifyPromise, timeoutPromise]);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', message: 'SMTP credentials verified successfully! Connected to mail server.' }));
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

        // Hard 5.5s timeout promise wrapper
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Mail dispatch timed out after 5 seconds.')), 5500)
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
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ status: 'ok', records: JSON.parse(content || '{}') }));
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'empty', records: null }));
      }
      return;
    }

    if (req.method === 'POST') {
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

  // ─── Agent Chat History Persistence API ───
  if (urlPath === '/api/chat/history') {
    if (req.method === 'GET') {
      if (fs.existsSync(CHAT_HISTORY_FILE)) {
        fs.readFile(CHAT_HISTORY_FILE, 'utf8', (err, content) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'error', message: 'Failed to read chat history file' }));
          }
          try {
            const parsed = JSON.parse(content || '[]');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'ok', conversations: parsed }));
          } catch (parseErr) {
            // Corrupted file — return empty array gracefully
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'ok', conversations: [] }));
          }
        });
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ status: 'ok', conversations: [] }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 10 * 1024 * 1024) req.destroy(); // 10MB limit for chat data
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({ status: 'error', message: 'Chat history payload must be a JSON array' }));
          }

          const serialized = JSON.stringify(parsed, null, 2);
          fs.writeFile(CHAT_HISTORY_FILE, serialized, 'utf8', err => {
            if (err) {
              console.error('[SERVER CHAT ERROR] Failed to write chat history file:', err);
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify({ status: 'error', message: 'Failed to write chat history to disk' }));
            }

            const byteCount = Buffer.byteLength(serialized);
            console.log(`[SERVER CHAT] ✅ Stored ${parsed.length} conversations to data/chat_history.json (${byteCount} bytes) at ${new Date().toLocaleTimeString()}`);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(JSON.stringify({
              status: 'ok',
              message: 'Chat history saved successfully',
              conversationCount: parsed.length,
              bytes: byteCount,
              timestamp: new Date().toISOString()
            }));
          });
        } catch (parseErr) {
          console.error('[SERVER CHAT ERROR] JSON parse failed:', parseErr.message);
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

  let safePath = urlPath === '/' ? '/index.html' : urlPath;
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

server.listen(PORT, () => {
  console.log('=========================================================================');
  console.log('  AL-MUSLIM GROUP - GARMENTS FACTORY MAINTENANCE MACHINE INVENTORY ERP');
  console.log('=========================================================================');
  console.log(`  Server running successfully at: http://localhost:${PORT}`);
  console.log(`  Document Root: ${PUBLIC_DIR}`);
  console.log('  Press Ctrl+C to stop the server.');
  console.log('=========================================================================');
});
