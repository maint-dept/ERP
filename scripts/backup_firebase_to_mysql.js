/**
 * Backup Firebase Firestore Data and Generate Complete MySQL Dump for maint_erp
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const https = require('https');
const sf = require('../serverFirebase');

const OUTPUT_SQL = path.join(__dirname, '..', 'public', 'data', 'erp_mysql_dump.sql');
const BACKUP_SQL = path.join(__dirname, '..', 'data', 'erp_mysql_dump.sql');
const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'erp_database.json');

function escapeSqlString(str) {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
    switch (char) {
      case "\0": return "\\0";
      case "\x08": return "\\b";
      case "\x09": return "\\t";
      case "\x1a": return "\\z";
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\"":
      case "'":
      case "\\":
      case "%":
        return "\\" + char;
      default:
        return char;
    }
  });
}

async function fetchAllFirestoreTables() {
  const token = await sf.getAdminAccessToken();
  const sa = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'serviceAccountKey.json'), 'utf8'));

  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/erp_tables?pageSize=300`;
    https.get(url, { headers: { Authorization: `Bearer ${token}` }, rejectUnauthorized: false }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.documents || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('🔄 Fetching latest data from Firebase Firestore (maint-dept-erp)...');
  let firestoreDocs = [];
  try {
    firestoreDocs = await fetchAllFirestoreTables();
    console.log(`✅ Retrieved ${firestoreDocs.length} documents from Firebase Firestore.`);
  } catch (err) {
    console.warn('⚠️ Could not connect to Firebase Firestore REST API, using local verified database:', err.message);
  }

  // Load existing local database as foundation
  let finalDatabase = {};
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      finalDatabase = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
    } catch (_) {}
  }

  // Merge data from Firestore
  let firebaseUpdatedCount = 0;
  for (const doc of firestoreDocs) {
    const docId = doc.name.split('/').pop();
    if (docId.includes('__chunk_') || docId === 'device_sync_test') continue;

    const fields = doc.fields || {};
    if (fields.rawJson && fields.rawJson.stringValue) {
      try {
        const parsedTable = JSON.parse(fields.rawJson.stringValue);
        finalDatabase[docId] = parsedTable;
        firebaseUpdatedCount++;
      } catch (e) {
        console.warn(`Failed to parse json for ${docId}:`, e.message);
      }
    }
  }

  console.log(`📊 Total tables ready for MySQL: ${Object.keys(finalDatabase).length} (including ${firebaseUpdatedCount} synced fresh from Firebase).`);

  // Build MySQL Complete Dump
  let sql = `-- =============================================================================
-- Al-Muslim Group ERP — MySQL Complete Database Backup & Migration Script
-- Database Name: maint_erp
-- Database User: mainterp
-- Target Engine: InnoDB / utf8mb4
-- Backed up from: Firebase Cloud Firestore + ERP Data Engine
-- Date: ${new Date().toISOString()}
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create and Select Database: maint_erp
CREATE DATABASE IF NOT EXISTS \`maint_erp\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`maint_erp\`;

-- 2. Create Core ERP Storage Table
CREATE TABLE IF NOT EXISTS \`erp_tables\` (
  \`table_name\` VARCHAR(120) NOT NULL PRIMARY KEY,
  \`raw_json\` LONGTEXT NOT NULL,
  \`item_count\` INT NOT NULL DEFAULT 0,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

  let totalRecordsCount = 0;
  for (const [collection, tableData] of Object.entries(finalDatabase)) {
    const count = Array.isArray(tableData) ? tableData.length : (tableData ? 1 : 0);
    totalRecordsCount += count;
    const jsonStr = JSON.stringify(tableData);
    const escaped = escapeSqlString(jsonStr);

    sql += `-- -------------------------------------------------------------\n`;
    sql += `-- Table: ${collection} (${count} records)\n`;
    sql += `-- -------------------------------------------------------------\n`;
    sql += `INSERT INTO \`erp_tables\` (\`table_name\`, \`raw_json\`, \`item_count\`, \`updated_at\`) 
VALUES ('${collection}', '${escaped}', ${count}, NOW()) 
ON DUPLICATE KEY UPDATE \`raw_json\` = VALUES(\`raw_json\`), \`item_count\` = VALUES(\`item_count\`), \`updated_at\` = NOW();\n\n`;
  }

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n-- ==================== END OF MYSQL DUMP ====================\n`;

  fs.writeFileSync(OUTPUT_SQL, sql, 'utf8');
  fs.writeFileSync(BACKUP_SQL, sql, 'utf8');

  // Also update data/erp_database.json with the merged fresh data
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(finalDatabase, null, 2), 'utf8');

  const mbSize = (Buffer.byteLength(sql) / 1024 / 1024).toFixed(2);
  console.log(`✅ Success! Generated erp_mysql_dump.sql (${mbSize} MB) with ${totalRecordsCount} records across ${Object.keys(finalDatabase).length} tables.`);
})();
