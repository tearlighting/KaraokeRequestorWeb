<?php
// Apache auto-prepend guard for the MySQL deployment. The historical PHP tree
// contains many independent SQLite entry points; only explicit search and
// authenticated bridge compatibility routes remain available.
function yukari_mysql_php_path_allowed($path, $operation = '', $method = 'GET')
{
    $allowed = in_array($path, [
        '/search.php', '/search_bs5.php', '/exec.php',
        '/searchfilefromkeyword_json.php', '/searchfilefromkeyword_json_part.php',
        '/api/search.php', '/api/capabilities.php', '/api/lister_index.php',
    ], true);
    if (preg_match('#^/search_listerdb_[A-Za-z0-9_-]+\.php$#', $path)) $allowed = true;
    if ($path === '/api/node_bridge.php') {
        $allowed = in_array($operation, [
        'admin-auth', 'admin-session', 'user-auth', 'request-context', 'queue-context',
        'legacy-queue-context', 'capabilities', 'search', 'lister',
        ], true);
    }
    if ($path === '/api/admin.php' && $operation === 'session') $allowed = true;
    // Keep the historical settings UI inspectable, but only through its
    // explicitly read-only GET mode. init.php itself rejects all writes.
    if ($path === '/init.php') $allowed = strtoupper($method) === 'GET';
    return $allowed;
}

if (getenv('YUKARI_MYSQL_MODE') !== '1' || PHP_SAPI === 'cli') return;

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$operation = $_GET['operation'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$allowed = yukari_mysql_php_path_allowed($path, is_string($operation) ? $operation : '', $method);

if (!$allowed) {
    http_response_code(410);
    header('Cache-Control: no-store');
    if (str_starts_with($path, '/api/')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => ['code' => 'LEGACY_FEATURE_DISABLED',
            'message' => 'This Legacy PHP feature is disabled in MySQL mode. Use the React application or a supported search endpoint.']], JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/plain; charset=utf-8');
        echo 'This Legacy PHP feature is disabled in MySQL mode. Use the React application or a supported search endpoint.';
    }
    exit;
}
