<?php
/**
 * =========================================================================================
 * Al-Muslim Group ERP — PostgreSQL REST API Backend Engine
 * For Paid Hosting (cPanel / Hostinger / Namecheap / Plesk / Apache / Nginx / LiteSpeed)
 * =========================================================================================
 * 
 * Deployment Guide:
 * 1. Upload this file to your hosting in `public_html/pg_api.php` or `public_html/api/pg_api.php`.
 * 2. Ensure PHP PDO PostgreSQL extension (`pdo_pgsql`) is enabled in cPanel -> Select PHP Version.
 * 3. Edit default credentials below or provide them dynamically via the ERP Database Connection Hub.
 * 4. Enter the full URL (e.g. https://moviezonex.com/pg_api.php) into the ERP Settings!
 * =========================================================================================
 */

// --- 1. DEFAULT CONFIGURATION (Can be overridden by headers or request body) ---
$DB_HOST = '127.0.0.1';             // '127.0.0.1' or 'localhost' for cPanel PostgreSQL
$DB_PORT = 5432;                    // Standard PostgreSQL port
$DB_NAME = 'motaherh_Maintenance';  // PostgreSQL Database Name
$DB_USER = 'motaherh_AMG-maint';    // PostgreSQL Username
$DB_PASS = 'ol(5_MK8mF{~7cdG';      // PostgreSQL Password
$DB_SSL  = false;                   // Set to true for remote cloud PostgreSQL (require SSL)
$API_KEY = '';                      // Optional: Set a secret key if desired

// --- 2. CORS & ANTI-CACHE HEADERS (Allows GitHub Pages & frontend to connect securely) ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-DB-Host, X-DB-Port, X-DB-Name, X-DB-User, X-DB-Pass, X-DB-SSL, X-User-Role, X-User-Id');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-LiteSpeed-Cache-Control: no-cache');
header('X-Accel-Buffering: no');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- 3. SECURITY GATE: REJECT CALLS FROM NO_ACCESS ZERO PERMISSIONS ACCOUNTS ---
$headers = function_exists('getallheaders') ? getallheaders() : [];
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? '';
if ($userRole === 'NO_ACCESS') {
    http_response_code(403);
    echo json_encode([
        'status' => 'error',
        'code' => 'ACCESS_DENIED',
        'message' => 'Security Policy: Zero-Access accounts are prohibited from executing database operations until permissions are assigned by an Administrator.'
    ]);
    exit;
}

// Read JSON input
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

// --- 4. DYNAMIC CREDENTIAL OVERRIDE (From request payload or headers) ---
$headerKey = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? '';
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
if (strpos($authHeader, 'Bearer ') === 0) {
    $headerKey = substr($authHeader, 7);
}

$inputHost = $body['dbHost'] ?? $body['host'] ?? null;
if (!empty($inputHost)) {
    $DB_HOST = $inputHost;
} elseif (!empty($headers['X-DB-Host']) || !empty($headers['x-db-host'])) {
    $DB_HOST = $headers['X-DB-Host'] ?? $headers['x-db-host'];
}

$inputPort = $body['dbPort'] ?? $body['port'] ?? null;
if (!empty($inputPort)) {
    $DB_PORT = intval($inputPort);
} elseif (!empty($headers['X-DB-Port']) || !empty($headers['x-db-port'])) {
    $DB_PORT = intval($headers['X-DB-Port'] ?? $headers['x-db-port']);
}

$inputName = $body['dbName'] ?? $body['database'] ?? null;
if (!empty($inputName)) {
    $DB_NAME = $inputName;
} elseif (!empty($headers['X-DB-Name']) || !empty($headers['x-db-name'])) {
    $DB_NAME = $headers['X-DB-Name'] ?? $headers['x-db-name'];
}

$inputUser = $body['dbUser'] ?? $body['username'] ?? null;
if (!empty($inputUser)) {
    $DB_USER = $inputUser;
} elseif (!empty($headers['X-DB-User']) || !empty($headers['x-db-user'])) {
    $DB_USER = $headers['X-DB-User'] ?? $headers['x-db-user'];
}

$inputPass = $body['dbPass'] ?? $body['password'] ?? null;
if ($inputPass !== null) {
    $DB_PASS = $inputPass;
} elseif (isset($headers['X-DB-Pass']) || isset($headers['x-db-pass'])) {
    $DB_PASS = $headers['X-DB-Pass'] ?? $headers['x-db-pass'];
}

$inputSsl = $body['dbSsl'] ?? $body['ssl'] ?? null;
if ($inputSsl !== null) {
    $DB_SSL = ($inputSsl === true || $inputSsl === '1' || $inputSsl === 1);
} elseif (isset($headers['X-DB-SSL']) || isset($headers['x-db-ssl'])) {
    $sslVal = $headers['X-DB-SSL'] ?? $headers['x-db-ssl'];
    $DB_SSL = ($sslVal === '1' || $sslVal === 'true' || $sslVal === true);
}

// Check API Key if configured
if (!empty($API_KEY)) {
    $clientKey = $headerKey ?: ($body['apiKey'] ?? $_GET['apiKey'] ?? '');
    if ($clientKey !== $API_KEY) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid API Key']);
        exit;
    }
}

// Check PHP PDO PostgreSQL driver extension
if (!extension_loaded('pdo_pgsql')) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PHP extension "pdo_pgsql" is not enabled on this hosting server.',
        'tip' => 'In cPanel, go to "Select PHP Version" -> "Extensions", and check the box for "pdo_pgsql".'
    ]);
    exit;
}

// --- 5. CONNECT TO POSTGRESQL ---
$pdo = null;
$lastError = '';

// Force IPv4 127.0.0.1 when localhost is supplied to avoid IPv6 (::1) pg_hba.conf rejection on cPanel/Linux
if ($DB_HOST === 'localhost') {
    $DB_HOST = '127.0.0.1';
}

$sslMode = $DB_SSL ? 'require' : ($DB_HOST === '127.0.0.1' ? 'disable' : 'prefer');

$dsn = "pgsql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};sslmode={$sslMode}";

try {
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false
    ]);
} catch (PDOException $e) {
    $lastError = $e->getMessage();
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PostgreSQL connection failed: ' . $lastError,
        'host' => $DB_HOST,
        'database' => $DB_NAME,
        'user' => $DB_USER,
        'tip' => 'Please verify host, database name, user, password, and SSL mode settings.'
    ]);
    exit;
}

// --- 6. ENSURE MAIN ERP STORAGE TABLE EXISTS IN POSTGRESQL ---
function ensureTableExists($pdo) {
    $sql = "CREATE TABLE IF NOT EXISTS erp_tables (
        table_name VARCHAR(120) NOT NULL PRIMARY KEY,
        raw_json TEXT NOT NULL,
        item_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );";
    $pdo->exec($sql);
}

// Determine action
$action = $_GET['action'] ?? $body['action'] ?? '';
$pathInfo = $_SERVER['PATH_INFO'] ?? '';
if (empty($action) && !empty($pathInfo)) {
    $parts = explode('/', trim($pathInfo, '/'));
    $action = end($parts);
}
if (empty($action)) {
    $action = 'ping';
}

function validateMachinesDataset($machines) {
    if (!is_array($machines)) {
        throw new Exception("Machines payload must be an array.");
    }
    // Allow saving machine datasets of any non-negative size (e.g. clean/replace, filtered updates, or new uploads)
}

// --- 7. ROUTE ACTIONS ---
try {
    ensureTableExists($pdo);

    if (in_array($action, ['save_table', 'save-table', 'save_multiple_tables', 'upsert', 'save_record', 'delete', 'delete_record', 'drop_table', 'delete_table'])) {
        $pdo->beginTransaction();
    }

    switch ($action) {
        // --- TEST CONNECTION ---
        case 'ping':
            $start = microtime(true);
            $stmt = $pdo->query("SELECT version() AS ver, current_database() AS db");
            $info = $stmt->fetch();
            $latency = round((microtime(true) - $start) * 1000);

            // Count tables stored (filtering test and probe tables)
            $countStmt = $pdo->query("SELECT COUNT(*) AS total_tables, COALESCE(SUM(item_count), 0) AS total_items FROM erp_tables WHERE table_name NOT LIKE 'test_%' AND table_name NOT LIKE '\\_%'");
            $summary = $countStmt->fetch();

            echo json_encode([
                'success' => true,
                'message' => 'Connected to PostgreSQL Backup Database successfully!',
                'version' => $info['ver'] ?? 'PostgreSQL',
                'database' => $info['db'] ?? $DB_NAME,
                'latency' => $latency,
                'tablesCount' => intval($summary['total_tables'] ?? 0),
                'totalItems' => intval($summary['total_items'] ?? 0),
                'timestamp' => date('c')
            ]);
            break;

        // --- SAVE MULTIPLE TABLES (Atomic Transaction) ---
        case 'save_multiple_tables':
            $tablesData = $body['tables'] ?? [];
            if (empty($tablesData)) {
                throw new Exception('Missing "tables" data.');
            }
            if (isset($tablesData['machines'])) {
                validateMachinesDataset($tablesData['machines']);
            }
            foreach ($tablesData as $collection => $data) {
                $jsonStr = is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $itemCount = is_array($data) ? count($data) : 1;
                $stmt = $pdo->prepare("
                    INSERT INTO erp_tables (table_name, raw_json, item_count, updated_at)
                    VALUES (:table_name, :raw_json, :item_count, NOW())
                    ON CONFLICT (table_name) DO UPDATE SET
                        raw_json = EXCLUDED.raw_json,
                        item_count = EXCLUDED.item_count,
                        updated_at = NOW()
                ");
                $stmt->execute([
                    ':table_name' => $collection,
                    ':raw_json'   => $jsonStr,
                    ':item_count' => $itemCount
                ]);
            }
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            echo json_encode([
                'success' => true,
                'updatedAt' => date('c')
            ]);
            break;

        // --- SAVE ENTIRE TABLE (Bulk Upsert) ---
        case 'save_table':
        case 'save-table':
            $collection = $body['collection'] ?? '';
            $data = $body['data'] ?? null;

            if (empty($collection)) {
                throw new Exception('Missing "collection" parameter.');
            }
            if ($data === null) {
                throw new Exception('Missing "data" payload.');
            }

            if ($collection === 'machines') {
                validateMachinesDataset($data);
            }

            $jsonStr = is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $itemCount = is_array($data) ? count($data) : 1;

            $stmt = $pdo->prepare("
                INSERT INTO erp_tables (table_name, raw_json, item_count, updated_at)
                VALUES (:table_name, :raw_json, :item_count, NOW())
                ON CONFLICT (table_name) DO UPDATE SET
                    raw_json = EXCLUDED.raw_json,
                    item_count = EXCLUDED.item_count,
                    updated_at = NOW()
            ");
            $stmt->execute([
                ':table_name' => $collection,
                ':raw_json'   => $jsonStr,
                ':item_count' => $itemCount
            ]);
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            echo json_encode([
                'success' => true,
                'collection' => $collection,
                'itemCount' => $itemCount,
                'updatedAt' => date('c')
            ]);
            break;

        // --- GET A SINGLE TABLE ---
        case 'get_table':
        case 'get-table':
            $collection = $_GET['table'] ?? $body['collection'] ?? '';
            if (empty($collection)) {
                throw new Exception('Missing "table" or "collection" parameter.');
            }

            $stmt = $pdo->prepare("SELECT raw_json, item_count, updated_at FROM erp_tables WHERE table_name = :name");
            $stmt->execute([':name' => $collection]);
            $row = $stmt->fetch();

            if ($row) {
                $decoded = json_decode($row['raw_json'], true);
                echo json_encode([
                    'success' => true,
                    'collection' => $collection,
                    'itemCount' => intval($row['item_count']),
                    'updatedAt' => $row['updated_at'],
                    'data' => $decoded
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'collection' => $collection,
                    'itemCount' => 0,
                    'data' => []
                ]);
            }
            break;

        // --- GET ALL TABLES ---
        case 'get_all':
        case 'get-all':
            $stmt = $pdo->query("SELECT table_name, raw_json, item_count, updated_at FROM erp_tables WHERE table_name NOT LIKE 'test_%' AND table_name NOT LIKE '\\_%'");
            $rows = $stmt->fetchAll();

            $allData = [];
            foreach ($rows as $row) {
                $tName = $row['table_name'];
                $allData[$tName] = json_decode($row['raw_json'], true);
            }

            echo json_encode([
                'success' => true,
                'tables' => $allData,
                'tableCount' => count($allData),
                'timestamp' => date('c')
            ]);
            break;

        // --- UPSERT SINGLE RECORD ---
        case 'upsert':
        case 'save_record':
            $collection = $body['collection'] ?? '';
            $docId = strval($body['docId'] ?? $body['id'] ?? '');
            $recordData = $body['data'] ?? null;

            if (empty($collection) || empty($docId) || $recordData === null) {
                throw new Exception('Missing "collection", "docId", or "data".');
            }

            // Fetch current table JSON
            $stmt = $pdo->prepare("SELECT raw_json FROM erp_tables WHERE table_name = :name");
            $stmt->execute([':name' => $collection]);
            $row = $stmt->fetch();

            $tableArray = [];
            if ($row && !empty($row['raw_json'])) {
                $tableArray = json_decode($row['raw_json'], true) ?: [];
            }

            // Update or append
            if (is_array($tableArray)) {
                $found = false;
                foreach ($tableArray as $idx => $item) {
                    if (is_array($item) && (($item['id'] ?? '') === $docId || ($item['_id'] ?? '') === $docId)) {
                        $tableArray[$idx] = array_merge($item, $recordData);
                        $found = true;
                        break;
                    }
                }
                if (!$found) {
                    if (!isset($recordData['id'])) {
                        $recordData['id'] = $docId;
                    }
                    $tableArray[] = $recordData;
                }
            } else {
                $tableArray = [$recordData];
            }

            $newJson = json_encode($tableArray, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $newCount = count($tableArray);

            $upStmt = $pdo->prepare("
                INSERT INTO erp_tables (table_name, raw_json, item_count, updated_at)
                VALUES (:table_name, :raw_json, :item_count, NOW())
                ON CONFLICT (table_name) DO UPDATE SET
                    raw_json = EXCLUDED.raw_json,
                    item_count = EXCLUDED.item_count,
                    updated_at = NOW()
            ");
            $upStmt->execute([
                ':table_name' => $collection,
                ':raw_json'   => $newJson,
                ':item_count' => $newCount
            ]);
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            echo json_encode([
                'success' => true,
                'collection' => $collection,
                'docId' => $docId,
                'updatedAt' => date('c')
            ]);
            break;

        // --- DELETE SINGLE RECORD ---
        case 'delete':
        case 'delete_record':
            $collection = $body['collection'] ?? '';
            $docId = strval($body['docId'] ?? $body['id'] ?? '');

            if (empty($collection) || empty($docId)) {
                throw new Exception('Missing "collection" or "docId".');
            }

            $stmt = $pdo->prepare("SELECT raw_json FROM erp_tables WHERE table_name = :name");
            $stmt->execute([':name' => $collection]);
            $row = $stmt->fetch();

            if ($row && !empty($row['raw_json'])) {
                $tableArray = json_decode($row['raw_json'], true) ?: [];
                if (is_array($tableArray)) {
                    $filtered = array_values(array_filter($tableArray, function($item) use ($docId) {
                        return is_array($item) && ($item['id'] ?? '') !== $docId && ($item['_id'] ?? '') !== $docId;
                    }));
                    $newJson = json_encode($filtered, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                    $newCount = count($filtered);

                    $upStmt = $pdo->prepare("
                        UPDATE erp_tables
                        SET raw_json = :raw_json, item_count = :item_count, updated_at = NOW()
                        WHERE table_name = :table_name
                    ");
                    $upStmt->execute([
                        ':raw_json'   => $newJson,
                        ':item_count' => $newCount,
                        ':table_name' => $collection
                    ]);
                }
            }
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            echo json_encode([
                'success' => true,
                'collection' => $collection,
                'docId' => $docId,
                'deleted' => true
            ]);
            break;

        // --- DROP / PURGE JUNK TABLE ---
        case 'drop_table':
        case 'delete_table':
            $collection = $body['collection'] ?? $_GET['table'] ?? '';
            if (empty($collection)) {
                throw new Exception('Missing "collection" or "table" parameter.');
            }
            if (in_array($collection, ['machines', 'users', 'employees', 'lines', 'floors', 'units', 'groups'])) {
                throw new Exception("Security Policy: Cannot drop core ERP table '{$collection}'.");
            }
            $stmt = $pdo->prepare("DELETE FROM erp_tables WHERE table_name = :name");
            $stmt->execute([':name' => $collection]);
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }

            echo json_encode([
                'success' => true,
                'table' => $collection,
                'dropped' => true
            ]);
            break;

        // --- STATS / SUMMARY ---
        case 'stats':
            $stmt = $pdo->query("SELECT table_name, item_count, octet_length(raw_json) AS size_bytes, updated_at FROM erp_tables WHERE table_name NOT LIKE 'test_%' AND table_name NOT LIKE '\\_%' ORDER BY item_count DESC");
            $tables = $stmt->fetchAll();

            $totalBytes = 0;
            $totalRecords = 0;
            foreach ($tables as $t) {
                $totalBytes += intval($t['size_bytes']);
                $totalRecords += intval($t['item_count']);
            }

            echo json_encode([
                'success' => true,
                'totalTables' => count($tables),
                'totalRecords' => $totalRecords,
                'totalSizeBytes' => $totalBytes,
                'tables' => $tables
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => "Unknown action '{$action}'. Valid actions: ping, save_table, get_table, get_all, upsert, delete, stats, drop_table."
            ]);
            break;
    }
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
