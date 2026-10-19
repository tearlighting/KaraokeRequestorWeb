<?php
// Scope-limited bridge from the *existing* browser identity. Does not load business/DB code.
chdir(dirname(__DIR__));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function ticket_fail($status, $reason) { http_response_code($status); echo json_encode(['ok' => false, 'error' => $reason]); exit; }
$allowed = explode(',', getenv('LEGACY_QUEUE_ORIGINS') ?: 'http://127.0.0.1:8080,http://localhost:8080');
$site = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');
if (!in_array($site, $allowed, true)) ticket_fail(403, '旧页面来源不在队列授权范围内');
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_YUKARI_CLIENT'] ?? '') !== '1'
    || stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) ticket_fail(403, '需要同源 JSON 客户端请求');
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $origin = parse_url($_SERVER['HTTP_ORIGIN']);
    $authority = ($origin['host'] ?? '') . (isset($origin['port']) ? ':' . $origin['port'] : '');
    if ($authority !== ($_SERVER['HTTP_HOST'] ?? '')) ticket_fail(403, '不允许跨站队列授权');
}
require_once 'func_readconfig.php';
$config_ini = (new ReadConfig())->read_config();
if (!is_array($config_ini)) ticket_fail(503, '配置不可读取');
require_once __DIR__ . '/_queue_ticket.php';
require_once 'easyauth_class.php';
if (($config_ini['useeasyauth'] ?? 0) == 1 && !(new EasyAuth())->check_auth()) ticket_fail(401, '需要原访问口令');
$role = 'user';
if (($_SERVER['PHP_AUTH_USER'] ?? '') === 'admin') {
    if (!node_admin_credentials_valid('admin', $_SERVER['PHP_AUTH_PW'] ?? null)) ticket_fail(401, '需要有效的非空管理认证');
    $role = 'admin';
}
$secret = trim(@file_get_contents(getenv('LEGACY_BRIDGE_TOKEN_FILE') ?: '/run/yukari/bridge-token') ?: '');
if (strlen($secret) < 32) ticket_fail(503, '内部队列授权不可用');
echo json_encode(['ok' => true, 'data' => ['ticket' => queue_ticket_issue($config_ini, $secret, $role, $_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_USER_AGENT'] ?? '')]]);
