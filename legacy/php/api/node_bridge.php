<?php
/** Internal service boundary. Never trusts a browser role, cookie, IP or Basic password. */
chdir(dirname(__DIR__));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function bridge_reply($value, $status = 200) {
    while (ob_get_level()) ob_end_clean();
    http_response_code($status);
    echo json_encode($value, JSON_UNESCAPED_UNICODE);
    exit;
}
function bridge_fail($reason, $status) { bridge_reply(['ok' => false, 'error' => $reason], $status); }
$secret = @file_get_contents(getenv('LEGACY_BRIDGE_TOKEN_FILE') ?: '/run/yukari/bridge-token');
$provided = $_SERVER['HTTP_X_YUKARI_BRIDGE'] ?? '';
if (!$secret || strlen(trim($secret)) < 32 || !hash_equals(trim($secret), $provided)) bridge_fail('内部 PHP Bridge 认证失败', 403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') bridge_fail('Bridge 只接受 POST', 405);
$role = $_SERVER['HTTP_X_YUKARI_ROLE'] ?? '';
$userid = $_SERVER['HTTP_X_YUKARI_USER_ID'] ?? '';
require_once 'func_readconfig.php';
$config_ini = (new ReadConfig())->read_config();
if (!is_array($config_ini)) bridge_fail('配置不可读取', 503);
$operation = $_GET['operation'] ?? '';
if (!is_string($operation)) bridge_fail('operation 无效', 400);

// Narrow service-token capability for queue invalidation after native playback
// transitions. It cannot invoke admin APIs or mutate requesttable.
if ($operation === 'queue-notify-service') {
    if (getenv('YUKARI_MYSQL_MODE') === '1') bridge_fail('Legacy SQLite notifications are disabled in MySQL mode', 410);
    require_once 'function_updatenotice.php';
    ob_start();
    try {
        $notice = new UpdateNotice();
        $notice->initdb();
        if ($notice->db === null) throw new RuntimeException('Notification unavailable');
        $notice->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $notice->updaterequestlist();
        $notice->closedb();
        $output = ob_get_clean();
        if ($output !== '') bridge_fail('Notification helper failed', 503);
        bridge_reply(['ok' => true, 'data' => ['notified' => true]]);
    } catch (Throwable $error) { bridge_fail('Notification failed after queue commit', 503); }
}

if (!in_array($role, ['user', 'admin'], true) || !preg_match('/^[a-f0-9-]{36}$/D', $userid)) bridge_fail('服务身份无效', 403);

// Only queue-scoped signed legacy identity is accepted here, never raw role/IP headers.
if ($operation === 'legacy-queue-context') {
    require_once __DIR__ . '/_queue_ticket.php';
    $value = queue_ticket_verify($_POST['ticket'] ?? '', trim($secret), $config_ini);
    if ($value === null) bridge_fail('Legacy queue authorization expired or revoked', 401);
    $context = node_queue_context($config_ini, $value['role'], $value['ip'], $value['ua']);
    if ($context === null) bridge_fail('Queue database path unavailable', 503);
    bridge_reply(['ok' => true, 'data' => $context]);
}

// An admin proof is minted only after verifying a nonempty current legacy password.
// Recomputed for every admin operation so changing the legacy password revokes sessions.
require_once __DIR__ . '/_node_auth.php';
$configured = node_admin_configured($config_ini);
$access_version = node_access_version($config_ini);
$proof = node_admin_proof($config_ini, trim($secret), $userid) ?? '';
$user_proof = hash_hmac('sha256', 'user:' . $userid . ':' . $access_version, trim($secret));
if ($operation === 'admin-auth') {
    if (!$configured) bridge_fail('原 PHP 管理密码尚未配置为非空；新 API 禁止空密码管理登录', 503);
    if (!node_admin_credentials_valid($_POST['username'] ?? '', $_POST['password'] ?? null)) bridge_fail('管理员账号或密码错误', 401);
    require_once 'easyauth_class.php';
    $_COOKIE = [];
    $_REQUEST = ['easypass' => $_POST['easypass'] ?? ''];
    if (($config_ini['useeasyauth'] ?? 0) == 1 && !(new EasyAuth())->check_auth()) bridge_fail('原访问口令验证失败', 401);
    bridge_reply(['ok' => true, 'data' => ['username' => 'admin', 'proof' => $proof]]);
}
if ($operation === 'user-auth') {
    require_once 'easyauth_class.php';
    $_COOKIE = [];
    $_REQUEST = ['easypass' => $_POST['easypass'] ?? ''];
    if (($config_ini['useeasyauth'] ?? 0) == 1 && !(new EasyAuth())->check_auth()) bridge_fail('原访问口令验证失败', 401);
    bridge_reply(['ok' => true, 'data' => ['authenticated' => true, 'proof' => $user_proof]]);
}

$public = ['queue' => 'api/requests.php', 'playback' => 'api/nowplaying.php',
    'capabilities' => 'api/capabilities.php', 'search' => 'api/search.php', 'lister' => 'api/lister_index.php'];
$admin = ['admin-session' => 'session', 'admin-queue' => 'queue', 'admin-status' => 'status', 'admin-settings' => 'settings',
    'admin-delete' => 'delete', 'admin-move' => 'move', 'admin-settings-save' => 'settings-save', 'admin-player' => 'player'];
if ($role === 'admin') {
    if (!$configured || !hash_equals($proof, $_SERVER['HTTP_X_YUKARI_ADMIN_PROOF'] ?? '')) bridge_fail('管理会话已失效，请重新登录', 401);
} elseif (isset($admin[$operation])) bridge_fail('需要管理身份', 403);
elseif (!hash_equals($user_proof, $_SERVER['HTTP_X_YUKARI_ADMIN_PROOF'] ?? '')) bridge_fail('用户会话已失效', 401);
if ($operation === 'queue-notify') {
    if (getenv('YUKARI_MYSQL_MODE') === '1') bridge_fail('Legacy SQLite notifications are disabled in MySQL mode', 410);
    // User proof is sufficient for reservation notification; role was validated above.
    // Notification-only reuse. Never load commonfunc/initdb or execute queue SQL.
    require_once 'function_updatenotice.php';
    ob_start();
    try {
        $notice = new UpdateNotice();
        $notice->initdb();
        if ($notice->db === null) throw new RuntimeException('Notification unavailable');
        $notice->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $notice->updaterequestlist();
        $notice->closedb();
        $output = ob_get_clean();
        if ($output !== '') bridge_fail('Notification helper failed', 503);
        bridge_reply(['ok' => true, 'data' => ['notified' => true]]);
    } catch (Throwable $error) { bridge_fail('Notification failed after queue commit', 503); }
}
if ($operation === 'request-context') {
    require_once __DIR__ . '/_queue_context.php';
    $context = node_queue_context($config_ini, $role, $_SERVER['REMOTE_ADDR'] ?? '', 'YukariNode/' . $userid);
    if ($context === null) bridge_fail('Queue path unavailable', 503);
    $data = ['database' => $context['database'], 'ip' => $context['ip'], 'ua' => $context['ua'], 'userid' => $userid,
        'automove' => ($config_ini['request_automove'] ?? 0) == 1,
        'reset' => ($config_ini['request_automove_reset'] ?? 0) == 1,
        'midjoin' => ($config_ini['request_automove_midjoin_first'] ?? 0) == 1,
        'history' => ($config_ini['usemypage'] ?? 1) == 1, 'metadata' => null,
        'nonameusername' => urldecode($config_ini['nonameusername'] ?? urlencode('名無しさん')),
        'displayname' => mb_substr((string)($_POST['username'] ?? ''), 0, 64)];
    $path = getenv('YUKARI_MYSQL_MODE') === '1' && trim((string)getenv('YUKARI_LISTER_DB_PATH')) !== ''
        ? trim((string)getenv('YUKARI_LISTER_DB_PATH')) : urldecode($config_ini['listerDBPATH'] ?? '');
    if (!empty($_POST['fullpath']) && $path !== '' && is_file($path)) {
        require_once 'function_search_listerdb.php';
        ob_start();
        try { $data['metadata'] = listerdb_lookup_songinfo($_POST['fullpath'], realpath($path), false, true) ?: null; }
        catch (Throwable $error) { $data['metadata_warning'] = '曲库元数据不可用；预约将保留，但不补充该元数据'; }
        $output = ob_get_clean();
        if ($output !== '') $data['metadata_warning'] = '曲库元数据读取失败';
    }
    bridge_reply(['ok' => true, 'data' => $data]);
}
if ($operation === 'queue-context') {
    require_once __DIR__ . '/_queue_context.php';
    $context = node_queue_context($config_ini, $role, $_SERVER['REMOTE_ADDR'] ?? '', 'YukariNode/' . $userid);
    if ($context === null) bridge_fail('Queue database path is unavailable or outside the mounted application', 503);
    bridge_reply(['ok' => true, 'data' => $context]);
}
if (!isset($public[$operation]) && !isset($admin[$operation]) && $operation !== 'request') bridge_fail('Bridge 操作不允许', 404);

// Only a validated service grant can set this PHP constant. It is not an HTTP header.
define('YUKARI_NODE_VERIFIED', true);
define('YUKARI_NODE_ROLE', $role);
$_COOKIE = ['YkariUserID' => $userid];
unset($_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW'], $_SERVER['HTTP_AUTHORIZATION'], $_SERVER['HTTP_ORIGIN']);
$_SERVER['HTTP_USER_AGENT'] = 'YukariNode/' . $userid;
$_SERVER['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest';
$_REQUEST = $_POST;
$_GET = [];
ob_start();
try {
    if (isset($admin[$operation])) {
        $_GET['operation'] = $admin[$operation];
        $_SERVER['REQUEST_METHOD'] = in_array($admin[$operation], ['session', 'queue', 'status', 'settings'], true) ? 'GET' : 'POST';
        $_SERVER['HTTP_X_YUKARI_ADMIN'] = '1';
        require __DIR__ . '/admin.php';
    } elseif ($operation === 'request') {
        if (getenv('YUKARI_NODE_REQUESTS') === '1') bridge_fail('Reservation Owner is Node; PHP request Bridge disabled', 410);
        // exec.php remains the sole owner of transaction, ordering, history and notification.
        require 'exec.php';
        $raw = trim(ob_get_clean());
        $created = json_decode($raw, true);
        if (!is_int($created['newid'] ?? null) || $created['newid'] <= 0) bridge_fail('原预约接口未返回有效 newid：' . strip_tags($raw), 502);
        bridge_reply(['ok' => true, 'data' => ['id' => $created['newid']]]);
    } else {
        if ($operation === 'lister') { $_REQUEST['mode'] = 'songs'; $_REQUEST['flat'] = '1'; }
        require $public[$operation];
    }
} catch (Throwable $error) {
    bridge_fail($error->getMessage(), 500);
}
