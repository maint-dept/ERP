<?php
/**
 * =========================================================================================
 * Al-Muslim Group ERP — MySQL REST API Backend Engine
 * For Paid Hosting (cPanel / Hostinger / Namecheap / Plesk / Apache / Nginx / LiteSpeed)
 * =========================================================================================
 * 
 * Deployment Guide:
 * 1. Upload this file to your hosting in `public_html/api/mysql_api.php` (or any web path).
 * 2. Edit the database credentials below ($DB_HOST, $DB_NAME, $DB_USER, $DB_PASS).
 * 3. Set a secure $API_KEY for authorization (or leave blank for open internal network).
 * 4. Enter the full URL (e.g. https://yourdomain.com/api/mysql_api.php) in the ERP Settings!
 * =========================================================================================
 */

// --- 1. CONFIGURATION (PRE-CONFIGURED FOR YOUR PAID HOSTING) ---
$DB_HOST = 'localhost';          // Standard localhost on cPanel / Paid Hosting
$DB_PORT = 3306;                 // Default MySQL port
$DB_NAME = 'maint_erp';          // User Database Name
$DB_USER = 'mainterp';           // User Database Username
$DB_PASS = 'Maint@456';          // User Database Password
$API_KEY = '';                   // Optional: Set a secret key if desired

// --- 2. CORS HEADERS (Allows GitHub Pages & any frontend domain to connect) ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-DB-Host, X-DB-Port, X-DB-Name, X-DB-User, X-DB-Pass, X-DB-SSL');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- 3. DYNAMIC CREDENTIAL OVERRIDE (Optional from client request) ---
$headers = getallheaders();
$headerKey = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? '';
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
if (strpos($authHeader, 'Bearer ') === 0) {
    $headerKey = substr($authHeader, 7);
}

if (!empty($headers['X-DB-Host']) || !empty($headers['x-db-host'])) {
    $DB_HOST = $headers['X-DB-Host'] ?? $headers['x-db-host'];
}
if (!empty($headers['X-DB-Port']) || !empty($headers['x-db-port'])) {
    $DB_PORT = intval($headers['X-DB-Port'] ?? $headers['x-db-port']);
}
if (!empty($headers['X-DB-Name']) || !empty($headers['x-db-name'])) {
    $DB_NAME = $headers['X-DB-Name'] ?? $headers['x-db-name'];
}
if (!empty($headers['X-DB-User']) || !empty($headers['x-db-user'])) {
    $DB_USER = $headers['X-DB-User'] ?? $headers['x-db-user'];
}
if (isset($headers['X-DB-Pass']) || isset($headers['x-db-pass'])) {
    $DB_PASS = $headers['X-DB-Pass'] ?? $headers['x-db-pass'];
}

// Read JSON input
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

// Check API Key if configured
if (!empty($API_KEY)) {
    $clientKey = $headerKey ?: ($body['apiKey'] ?? $_GET['apiKey'] ?? '');
    if ($clientKey !== $API_KEY) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized: Invalid API Key']);
        exit;
    }
}

// --- 4. DATABASE CONNECTION ---
try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed: ' . $e->getMessage(),
        'tip' => 'Please check your MySQL host, database name, username and password in mysql_api.php'
    ]);
    exit;
}

// --- 5. ENSURE MAIN ERP STORAGE TABLE EXISTS ---
function ensureTableExists($pdo) {
    $sql = "CREATE TABLE IF NOT EXISTS `erp_tables` (
        `table_name` VARCHAR(120) NOT NULL PRIMARY KEY,
        `raw_json` LONGTEXT NOT NULL,
        `item_count` INT NOT NULL DEFAULT 0,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
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

// --- 6. ROUTE ACTIONS ---
try {
    ensureTableExists($pdo);

    switch ($action) {
        // --- TEST CONNECTION ---
        case 'ping':
            $start = microtime(true);
            $stmt = $pdo->query("SELECT VERSION() AS ver, DATABASE() AS db");
            $info = $stmt->fetch();
            $latency = round((microtime(true) - $start) * 1000);

            // Count tables stored
            $countStmt = $pdo->query("SELECT COUNT(*) AS total_tables, COALESCE(SUM(item_count), 0) AS total_items FROM erp_tables");
            $summary = $countStmt->fetch();

            echo json_encode([
                'success' => true,
                'message' => 'Connected to MySQL successfully!',
                'version' => $info['ver'] ?? 'Unknown',
                'database' => $info['db'] ?? $DB_NAME,
                'latency' => $latency,
                'tablesCount' => intval($summary['total_tables'] ?? 0),
                'totalItems' => intval($summary['total_items'] ?? 0),
                'timestamp' => date('c')
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

            $jsonStr = is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $itemCount = is_array($data) ? count($data) : 1;

            $stmt = $pdo->prepare("
                INSERT INTO `erp_tables` (`table_name`, `raw_json`, `item_count`, `updated_at`)
                VALUES (:table_name, :raw_json, :item_count, NOW())
                ON DUPLICATE KEY UPDATE
                    `raw_json` = VALUES(`raw_json`),
                    `item_count` = VALUES(`item_count`),
                    `updated_at` = NOW()
            ");
            $stmt->execute([
                ':table_name' => $collection,
                ':raw_json'   => $jsonStr,
                ':item_count' => $itemCount
            ]);

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

            $stmt = $pdo->prepare("SELECT `raw_json`, `item_count`, `updated_at` FROM `erp_tables` WHERE `table_name` = :name");
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

        // --- GET ALL TABLES (For Initial Load / App Start) ---
        case 'get_all':
        case 'get-all':
            $stmt = $pdo->query("SELECT `table_name`, `raw_json`, `item_count`, `updated_at` FROM `erp_tables`");
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
            $stmt = $pdo->prepare("SELECT `raw_json` FROM `erp_tables` WHERE `table_name` = :name");
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
                INSERT INTO `erp_tables` (`table_name`, `raw_json`, `item_count`, `updated_at`)
                VALUES (:table_name, :raw_json, :item_count, NOW())
                ON DUPLICATE KEY UPDATE
                    `raw_json` = VALUES(`raw_json`),
                    `item_count` = VALUES(`item_count`),
                    `updated_at` = NOW()
            ");
            $upStmt->execute([
                ':table_name' => $collection,
                ':raw_json'   => $newJson,
                ':item_count' => $newCount
            ]);

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

            $stmt = $pdo->prepare("SELECT `raw_json` FROM `erp_tables` WHERE `table_name` = :name");
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
                        UPDATE `erp_tables`
                        SET `raw_json` = :raw_json, `item_count` = :item_count, `updated_at` = NOW()
                        WHERE `table_name` = :table_name
                    ");
                    $upStmt->execute([
                        ':raw_json'   => $newJson,
                        ':item_count' => $newCount,
                        ':table_name' => $collection
                    ]);
                }
            }

            echo json_encode([
                'success' => true,
                'collection' => $collection,
                'docId' => $docId,
                'deleted' => true
            ]);
            break;

        // --- STATS / SUMMARY ---
        case 'stats':
            $stmt = $pdo->query("SELECT `table_name`, `item_count`, LENGTH(`raw_json`) AS size_bytes, `updated_at` FROM `erp_tables` ORDER BY `item_count` DESC");
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
                'error' => "Unknown action '{$action}'. Valid actions: ping, save_table, get_table, get_all, upsert, delete, stats."
            ]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
