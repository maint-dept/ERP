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

@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '300');
@ini_set('post_max_size', '64M');
@ini_set('upload_max_filesize', '64M');

// --- 1. CONFIGURATION (PRE-CONFIGURED FOR YOUR CPANEL HOSTING) ---
$DB_HOST = 'localhost';          // Standard localhost on cPanel / Paid Hosting
$DB_PORT = 3306;                 // Default MySQL port
$DB_NAME = 'motaherh_maint-erp'; // From your cPanel phpMyAdmin: motaherh_maint-erp
$DB_USER = 'motaherh_mainterp';  // In cPanel, user is usually motaherh_mainterp
$DB_PASS = 'Maint@456';          // User Database Password
$API_KEY = '';                   // Optional: Set a secret key if desired

// --- 2. CORS & ANTI-CACHE HEADERS (Allows GitHub Pages & frontend to connect without stale proxy caching) ---
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-DB-Host, X-DB-Port, X-DB-Name, X-DB-User, X-DB-Pass, X-DB-SSL, X-User-Role, X-User-Id');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-LiteSpeed-Cache-Control: no-cache');
header('X-Accel-Buffering: no');

// --- OPTION A: HTTP GZIP OUTPUT COMPRESSION BUFFER (Cuts API payload size by up to 80%) ---
if (!in_array('ob_gzhandler', ob_list_handlers()) && extension_loaded('zlib') && !ini_get('zlib.output_compression')) {
    @ob_start('ob_gzhandler');
}

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

// --- 4. DYNAMIC CREDENTIAL OVERRIDE (Optional from client request) ---
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
$dbCandidates = array_unique([$DB_NAME, 'motaherh_maint-erp', 'motaherh_maint_erp', 'maint_erp']);
$userCandidates = array_unique([$DB_USER, 'motaherh_mainterp', 'mainterp']);
$pdo = null;
$lastError = '';

foreach ($dbCandidates as $candidateDb) {
    foreach ($userCandidates as $candidateUser) {
        try {
            $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$candidateDb};charset=utf8mb4";
            $pdo = new PDO($dsn, $candidateUser, $DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ]);
            $DB_NAME = $candidateDb;
            $DB_USER = $candidateUser;
            try {
                $pdo->exec("SET SESSION wait_timeout = 300;");
                $pdo->exec("SET SESSION net_read_timeout = 300;");
                $pdo->exec("SET SESSION net_write_timeout = 300;");
            } catch (Exception $e) {}
            break 2;
        } catch (PDOException $e) {
            $lastError = $e->getMessage();
        }
    }
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed: ' . $lastError,
        'tip' => 'Please check your MySQL database name and user in cPanel'
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
    ensureRelationalTablesExist($pdo);
}

// --- 5.1 OPTION B: STRUCTURED RELATIONAL TABLE WITH DEDICATED INDEXES ---
function ensureRelationalTablesExist($pdo) {
    $sql = "CREATE TABLE IF NOT EXISTS `erp_machines` (
        `id` VARCHAR(120) NOT NULL PRIMARY KEY,
        `serial_number` VARCHAR(120) NOT NULL DEFAULT '',
        `machine_name` VARCHAR(191) NOT NULL DEFAULT '',
        `brand` VARCHAR(120) NOT NULL DEFAULT '',
        `model` VARCHAR(120) NOT NULL DEFAULT '',
        `group_id` VARCHAR(120) NOT NULL DEFAULT '',
        `unit_id` VARCHAR(120) NOT NULL DEFAULT '',
        `floor_id` VARCHAR(120) NOT NULL DEFAULT '',
        `line_id` VARCHAR(120) NOT NULL DEFAULT '',
        `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        `quantity` INT NOT NULL DEFAULT 1,
        `running` INT NOT NULL DEFAULT 0,
        `usable_idle` INT NOT NULL DEFAULT 0,
        `repairable_idle` INT NOT NULL DEFAULT 0,
        `system_asset_id` VARCHAR(120) NOT NULL DEFAULT '',
        `raw_data` LONGTEXT NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_serial_number` (`serial_number`),
        INDEX `idx_status` (`status`),
        INDEX `idx_unit_floor_line` (`unit_id`, `floor_id`, `line_id`),
        INDEX `idx_brand_model` (`brand`, `model`),
        INDEX `idx_machine_name` (`machine_name`),
        INDEX `idx_asset_id` (`system_asset_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    $pdo->exec($sql);

    // Initial Auto-Migration: If erp_machines is empty and erp_tables has machines, populate erp_machines
    try {
        $chk = $pdo->query("SELECT COUNT(*) as cnt FROM `erp_machines`")->fetch();
        if (intval($chk['cnt'] ?? 0) === 0) {
            $stmt = $pdo->prepare("SELECT `raw_json` FROM `erp_tables` WHERE `table_name` = 'machines'");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && !empty($row['raw_json'])) {
                $machines = json_decode($row['raw_json'], true);
                if (is_array($machines) && count($machines) > 0) {
                    syncMachinesToRelationalTable($pdo, $machines, true);
                }
            }
        }
    } catch (Exception $e) {}
}

function syncMachinesToRelationalTable($pdo, $machines, $cleanBefore = false) {
    if (!is_array($machines) || empty($machines)) return;

    if ($cleanBefore) {
        $pdo->exec("DELETE FROM `erp_machines`");
    }

    $stmt = $pdo->prepare("
        INSERT INTO `erp_machines` (
            `id`, `serial_number`, `machine_name`, `brand`, `model`,
            `group_id`, `unit_id`, `floor_id`, `line_id`, `status`,
            `quantity`, `running`, `usable_idle`, `repairable_idle`,
            `system_asset_id`, `raw_data`, `updated_at`
        ) VALUES (
            :id, :serial_number, :machine_name, :brand, :model,
            :group_id, :unit_id, :floor_id, :line_id, :status,
            :quantity, :running, :usable_idle, :repairable_idle,
            :system_asset_id, :raw_data, NOW()
        ) ON DUPLICATE KEY UPDATE
            `serial_number` = VALUES(`serial_number`),
            `machine_name` = VALUES(`machine_name`),
            `brand` = VALUES(`brand`),
            `model` = VALUES(`model`),
            `group_id` = VALUES(`group_id`),
            `unit_id` = VALUES(`unit_id`),
            `floor_id` = VALUES(`floor_id`),
            `line_id` = VALUES(`line_id`),
            `status` = VALUES(`status`),
            `quantity` = VALUES(`quantity`),
            `running` = VALUES(`running`),
            `usable_idle` = VALUES(`usable_idle`),
            `repairable_idle` = VALUES(`repairable_idle`),
            `system_asset_id` = VALUES(`system_asset_id`),
            `raw_data` = VALUES(`raw_data`),
            `updated_at` = NOW()
    ");

    foreach ($machines as $m) {
        if (!is_array($m) || empty($m['id'])) continue;
        $id = strval($m['id']);
        $sn = strval($m['serialNumber'] ?? $m['serial_number'] ?? '');
        $mn = strval($m['machineName'] ?? $m['name'] ?? '');
        $brd = strval($m['brand'] ?? '');
        $mdl = strval($m['model'] ?? '');
        $grp = strval($m['groupId'] ?? $m['group'] ?? '');
        $unt = strval($m['unitId'] ?? $m['unit'] ?? '');
        $flr = strval($m['floorId'] ?? $m['floor'] ?? '');
        $lin = strval($m['lineId'] ?? $m['line'] ?? '');
        $st = strval($m['status'] ?? 'ACTIVE');
        $qty = intval($m['quantity'] ?? 1);
        $rn = intval($m['running'] ?? $m['qty_running'] ?? 0);
        $us = intval($m['usable_idle'] ?? $m['usableIdle'] ?? 0);
        $rp = intval($m['repairable_idle'] ?? $m['repairableIdle'] ?? 0);
        $ast = strval($m['systemAssetId'] ?? $m['permanentMachineId'] ?? '');
        $raw = json_encode($m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $stmt->execute([
            ':id' => $id,
            ':serial_number' => $sn,
            ':machine_name' => $mn,
            ':brand' => $brd,
            ':model' => $mdl,
            ':group_id' => $grp,
            ':unit_id' => $unt,
            ':floor_id' => $flr,
            ':line_id' => $lin,
            ':status' => $st,
            ':quantity' => $qty,
            ':running' => $rn,
            ':usable_idle' => $us,
            ':repairable_idle' => $rp,
            ':system_asset_id' => $ast,
            ':raw_data' => $raw
        ]);
    }
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

function verifyErpPassword($rawPassword, $storedHash) {
    if (empty($rawPassword) || empty($storedHash)) return false;
    if (strpos($storedHash, '$sha256$') === 0) {
        $parts = explode('$', $storedHash);
        if (count($parts) === 4) {
            $salt = $parts[2];
            $expected = strtolower($parts[3]);
            $computed = strtolower(hash('sha256', "{$salt}:{$rawPassword}"));
            return hash_equals($expected, $computed);
        }
    }
    return hash_equals((string)$storedHash, (string)$rawPassword);
}

// --- 6. ROUTE ACTIONS ---
try {
    ensureTableExists($pdo);

    if (in_array($action, ['save_table', 'save-table', 'save_multiple_tables', 'upsert', 'save_record', 'delete', 'delete_record', 'drop_table', 'delete_table'])) {
        $pdo->beginTransaction();
    }

    switch ($action) {
        // --- TEST CONNECTION ---
        case 'ping':
            $start = microtime(true);
            $stmt = $pdo->query("SELECT VERSION() AS ver, DATABASE() AS db");
            $info = $stmt->fetch();
            $latency = round((microtime(true) - $start) * 1000);

            // Count tables stored (filtering test and probe tables)
            $countStmt = $pdo->query("SELECT COUNT(*) AS total_tables, COALESCE(SUM(item_count), 0) AS total_items FROM erp_tables WHERE table_name NOT LIKE 'test_%' AND table_name NOT LIKE '\\_%'");
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

        // --- AUTHENTICATION & ROLE-GATED LOGIN VERIFICATION ---
        case 'verify_login':
        case 'authenticate':
            $identifier = trim($body['identifier'] ?? $_POST['identifier'] ?? $_GET['identifier'] ?? '');
            $password = (string)($body['password'] ?? $_POST['password'] ?? $_GET['password'] ?? '');
            $isAdminGateway = !empty($body['is_admin_gateway'] ?? $_POST['is_admin_gateway'] ?? $_GET['is_admin_gateway'] ?? false);

            if (empty($identifier) || empty($password)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'Username or email and password are required.'
                ]);
                break;
            }

            // Retrieve authoritative users table from MySQL
            $uStmt = $pdo->prepare("SELECT `raw_json` FROM `erp_tables` WHERE `table_name` = 'users' LIMIT 1");
            $uStmt->execute();
            $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);

            if (!$uRow || empty($uRow['raw_json'])) {
                echo json_encode([
                    'success' => false,
                    'error' => 'User directory not found in database.'
                ]);
                break;
            }

            $userList = json_decode($uRow['raw_json'], true);
            if (!is_array($userList)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'Corrupted user directory dataset.'
                ]);
                break;
            }

            $cleanId = strtolower($identifier);
            $foundUser = null;
            foreach ($userList as $u) {
                if (!is_array($u)) continue;
                $uname = strtolower(trim($u['username'] ?? ''));
                $uemail = strtolower(trim($u['email'] ?? ''));
                $uempid = strtolower(trim($u['employeeId'] ?? ''));
                if ($uname === $cleanId || $uemail === $cleanId || $uempid === $cleanId) {
                    $foundUser = $u;
                    break;
                }
            }

            if (!$foundUser) {
                echo json_encode([
                    'success' => false,
                    'error' => "Invalid credentials. No account found for '{$identifier}'."
                ]);
                break;
            }

            if (($foundUser['status'] ?? 'ACTIVE') !== 'ACTIVE') {
                echo json_encode([
                    'success' => false,
                    'error' => "Account '{$foundUser['name']}' ({$foundUser['username']}) is currently INACTIVE. Please contact the administrator."
                ]);
                break;
            }

            // Verify Password Hash
            $storedHash = $foundUser['password'] ?? $foundUser['passwordHash'] ?? '';
            if (!verifyErpPassword($password, $storedHash)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'Incorrect password. Please verify your credentials.'
                ]);
                break;
            }

            // Strict Role & Gateway Isolation Check:
            $uRole = strtoupper(trim($foundUser['role'] ?? 'USER'));
            $isUserAdmin = in_array($uRole, ['ADMIN', 'SUPER_ADMIN']);

            if ($isAdminGateway) {
                if (!$isUserAdmin) {
                    echo json_encode([
                        'success' => false,
                        'error' => '⛔ প্রবেশাধিকার সংরক্ষিত: এটি শুধুমাত্র সিস্টেম এডমিনিস্ট্রেটরদের জন্য নির্ধারিত অ্যাডমিন গেটওয়ে। সাধারণ ব্যবহারকারী বা অপারেটরগণ অনুগ্রহ করে সাধারণ User Login পোর্টাল ব্যবহার করুন। (General users must sign in via User Login portal.)'
                    ]);
                    break;
                }
            } else {
                if ($isUserAdmin) {
                    echo json_encode([
                        'success' => false,
                        'error' => '🔒 প্রবেশাধিকার সংরক্ষিত: এটি সাধারণ ইউজার পোর্টাল। এডমিনিস্ট্রেটর এবং সুপার এডমিন অ্যাকাউন্ট এখানে অনুমোদিত নয়। অনুগ্রহ করে আপনার ডেডিকেটেড Admin Login Gateway ব্যবহার করুন। (Administrative accounts are restricted to the Admin Gateway.)'
                    ]);
                    break;
                }
            }

            echo json_encode([
                'success' => true,
                'user' => [
                    'id' => $foundUser['id'],
                    'username' => $foundUser['username'],
                    'name' => $foundUser['name'] ?? $foundUser['username'],
                    'email' => $foundUser['email'] ?? '',
                    'role' => $foundUser['role'],
                    'roleId' => $foundUser['roleId'] ?? '',
                    'presetId' => $foundUser['presetId'] ?? '',
                    'status' => $foundUser['status'] ?? 'ACTIVE',
                    'mustChangePassword' => !empty($foundUser['mustChangePassword'])
                ]
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
            }
            if (isset($tablesData['machines']) && is_array($tablesData['machines'])) {
                syncMachinesToRelationalTable($pdo, $tablesData['machines'], true);
            }
            $pdo->commit();

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
            if ($collection === 'machines') {
                $mList = is_array($data) ? $data : json_decode($data, true);
                if (is_array($mList)) {
                    syncMachinesToRelationalTable($pdo, $mList, true);
                }
            }
            $pdo->commit();

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
            $stmt = $pdo->query("SELECT `table_name`, `raw_json`, `item_count`, `updated_at` FROM `erp_tables` WHERE `table_name` NOT LIKE 'test_%' AND `table_name` NOT LIKE '\\_%'");
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
            if ($collection === 'machines' && is_array($recordData)) {
                syncMachinesToRelationalTable($pdo, [$recordData], false);
            }
            $pdo->commit();

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
            if ($collection === 'machines') {
                $delMStmt = $pdo->prepare("DELETE FROM `erp_machines` WHERE `id` = :id");
                $delMStmt->execute([':id' => $docId]);
            }
            $pdo->commit();

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
            $stmt = $pdo->prepare("DELETE FROM `erp_tables` WHERE `table_name` = :name");
            $stmt->execute([':name' => $collection]);
            $pdo->commit();

            echo json_encode([
                'success' => true,
                'table' => $collection,
                'dropped' => true
            ]);
            break;

        // --- STATS / SUMMARY ---
        case 'stats':
            $stmt = $pdo->query("SELECT `table_name`, `item_count`, LENGTH(`raw_json`) AS size_bytes, `updated_at` FROM `erp_tables` WHERE `table_name` NOT LIKE 'test_%' AND `table_name` NOT LIKE '\\_%' ORDER BY `item_count` DESC");
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

        // --- HIGH-PERFORMANCE STRUCTURED & INDEXED MACHINE QUERY (OPTION B) ---
        case 'query_machines':
            $start = microtime(true);
            $search = trim($_GET['search'] ?? $body['search'] ?? '');
            $unitId = trim($_GET['unit_id'] ?? $body['unit_id'] ?? '');
            $floorId = trim($_GET['floor_id'] ?? $body['floor_id'] ?? '');
            $lineId = trim($_GET['line_id'] ?? $body['line_id'] ?? '');
            $status = strtoupper(trim($_GET['status'] ?? $body['status'] ?? ''));
            $page = max(1, intval($_GET['page'] ?? $body['page'] ?? 1));
            $limit = max(1, min(250, intval($_GET['limit'] ?? $body['limit'] ?? 50)));
            $offset = ($page - 1) * $limit;
            $sortField = trim($_GET['sort_field'] ?? $body['sort_field'] ?? 'updated_at');
            $sortOrder = strtoupper(trim($_GET['sort_order'] ?? $body['sort_order'] ?? 'DESC')) === 'ASC' ? 'ASC' : 'DESC';

            $allowedSorts = [
                'serial_number' => 'serial_number',
                'machine_name' => 'machine_name',
                'brand' => 'brand',
                'model' => 'model',
                'status' => 'status',
                'unit_id' => 'unit_id',
                'floor_id' => 'floor_id',
                'line_id' => 'line_id',
                'updated_at' => 'updated_at',
                'created_at' => 'created_at',
                'id' => 'id'
            ];
            $orderCol = $allowedSorts[$sortField] ?? 'updated_at';

            $whereParts = ["1=1"];
            $params = [];

            if (!empty($unitId)) {
                $whereParts[] = "`unit_id` = :unit_id";
                $params[':unit_id'] = $unitId;
            }
            if (!empty($floorId)) {
                $whereParts[] = "`floor_id` = :floor_id";
                $params[':floor_id'] = $floorId;
            }
            if (!empty($lineId)) {
                $whereParts[] = "`line_id` = :line_id";
                $params[':line_id'] = $lineId;
            }
            if (!empty($status) && $status !== 'ALL') {
                if ($status === 'RUNNING' || $status === 'ACTIVE') {
                    $whereParts[] = "(`status` = 'ACTIVE' OR `running` > 0)";
                } else if ($status === 'USABLE' || $status === 'IDLE' || $status === 'USABLE_IDLE') {
                    $whereParts[] = "(`status` IN ('IDLE', 'USABLE', 'USABLE_IDLE') OR `usable_idle` > 0)";
                } else if ($status === 'REPAIRABLE' || $status === 'REPAIRABLE_IDLE') {
                    $whereParts[] = "(`status` IN ('REPAIRABLE', 'REPAIRABLE_IDLE') OR `repairable_idle` > 0)";
                } else {
                    $whereParts[] = "`status` = :status";
                    $params[':status'] = $status;
                }
            }
            if (!empty($search)) {
                $whereParts[] = "(`serial_number` LIKE :s_exact OR `system_asset_id` LIKE :s_exact OR `machine_name` LIKE :s_like OR `brand` LIKE :s_like OR `model` LIKE :s_like)";
                $params[':s_exact'] = "%{$search}%";
                $params[':s_like'] = "%{$search}%";
            }

            $whereSql = implode(' AND ', $whereParts);

            // Fast Indexed Count
            $countStmt = $pdo->prepare("SELECT COUNT(*) AS total_count FROM `erp_machines` WHERE {$whereSql}");
            $countStmt->execute($params);
            $totalCount = intval($countStmt->fetch()['total_count'] ?? 0);

            // Fast Indexed Fetch with Limit & Offset
            $querySql = "SELECT `raw_data` FROM `erp_machines` WHERE {$whereSql} ORDER BY `{$orderCol}` {$sortOrder} LIMIT {$limit} OFFSET {$offset}";
            $queryStmt = $pdo->prepare($querySql);
            $queryStmt->execute($params);
            $rows = $queryStmt->fetchAll();

            $items = [];
            foreach ($rows as $r) {
                if (!empty($r['raw_data'])) {
                    $decoded = json_decode($r['raw_data'], true);
                    if ($decoded) $items[] = $decoded;
                }
            }

            $latency = round((microtime(true) - $start) * 1000, 2);

            echo json_encode([
                'success' => true,
                'items' => $items,
                'total' => $totalCount,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => ceil($totalCount / $limit) ?: 1,
                'latencyMs' => $latency
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            break;

        // --- 0ms CACHE CHECK & STALE-WHILE-REVALIDATE (OPTION A) ---
        case 'check_version':
            $clientTimestamp = $_GET['since'] ?? $body['since'] ?? '';
            $stmt = $pdo->query("SELECT `table_name`, `item_count`, UNIX_TIMESTAMP(`updated_at`) as ts, `updated_at` FROM `erp_tables` WHERE `table_name` NOT LIKE 'test_%' AND `table_name` NOT LIKE '\\_%'");
            $tables = $stmt->fetchAll();

            $maxTs = 0;
            $tableSummaries = [];
            foreach ($tables as $t) {
                $ts = intval($t['ts']);
                if ($ts > $maxTs) $maxTs = $ts;
                $tableSummaries[$t['table_name']] = [
                    'updatedAt' => $t['updated_at'],
                    'timestamp' => $ts,
                    'count' => intval($t['item_count'])
                ];
            }

            $modified = true;
            if (!empty($clientTimestamp)) {
                $clientTs = is_numeric($clientTimestamp) ? intval($clientTimestamp) : strtotime($clientTimestamp);
                if ($clientTs >= $maxTs) {
                    $modified = false;
                }
            }

            echo json_encode([
                'success' => true,
                'modified' => $modified,
                'latestTimestamp' => $maxTs,
                'latestDate' => date('c', $maxTs),
                'tables' => $tableSummaries
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => "Unknown action '{$action}'. Valid actions: ping, save_table, get_table, get_all, upsert, delete, stats, drop_table, query_machines, check_version."
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
