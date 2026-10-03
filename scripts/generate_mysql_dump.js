const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'erp_database.json');
const outputPath = path.join(__dirname, '..', 'public', 'data', 'erp_mysql_dump.sql');
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const rawData = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(rawData);

let sql = `-- =============================================================================
-- Al-Muslim Group ERP — MySQL Complete Database Schema & Seed Data
-- Compatible with: MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Generated on: ${new Date().toISOString()}
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Unified Core ERP Storage Table (High-Speed JSON Store)
CREATE TABLE IF NOT EXISTS \`erp_tables\` (
  \`table_name\` VARCHAR(120) NOT NULL PRIMARY KEY,
  \`raw_json\` LONGTEXT NOT NULL,
  \`item_count\` INT NOT NULL DEFAULT 0,
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

`;

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

// Populate erp_tables with each collection
for (const [collection, tableData] of Object.entries(data)) {
  const count = Array.isArray(tableData) ? tableData.length : (tableData ? 1 : 0);
  const jsonStr = JSON.stringify(tableData);
  const escaped = escapeSqlString(jsonStr);

  sql += `-- Table: ${collection} (${count} records)\n`;
  sql += `INSERT INTO \`erp_tables\` (\`table_name\`, \`raw_json\`, \`item_count\`, \`updated_at\`) VALUES ('${collection}', '${escaped}', ${count}, NOW()) ON DUPLICATE KEY UPDATE \`raw_json\` = VALUES(\`raw_json\`), \`item_count\` = VALUES(\`item_count\`), \`updated_at\` = NOW();\n\n`;
}

sql += `SET FOREIGN_KEY_CHECKS = 1;\n-- ==================== END OF DUMP ====================\n`;

fs.writeFileSync(outputPath, sql, 'utf8');
// Also write to data/ directory
fs.writeFileSync(path.join(__dirname, '..', 'data', 'erp_mysql_dump.sql'), sql, 'utf8');

console.log(`✅ MySQL complete dump created successfully at ${outputPath} (${(Buffer.byteLength(sql) / 1024 / 1024).toFixed(2)} MB)`);
