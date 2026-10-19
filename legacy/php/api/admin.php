<?php
/** Phase 2 JSON boundary. Every operation is authorized before loading business code. */
chdir(dirname(__DIR__));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function admin_reply($data, $status = 200)
{
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function admin_fail($message, $status)
{
    admin_reply(['ok' => false, 'error' => $message], $status);
}

require_once 'func_readconfig.php';
$config_ini = (new ReadConfig())->read_config();
if (!is_array($config_ini)) admin_fail('配置文件不可读取', 503);
require_once __DIR__ . '/_admin_auth.php';

// Apache normally fills PHP_AUTH_*. Fallback supports CGI without trusting query data.
$username = $_SERVER['PHP_AUTH_USER'] ?? null;
$password = $_SERVER['PHP_AUTH_PW'] ?? ($username !== null ? '' : null);
$node_verified = defined('YUKARI_NODE_VERIFIED') && defined('YUKARI_NODE_ROLE') && YUKARI_NODE_ROLE === 'admin';
if ($username === null && preg_match('/^Basic ([A-Za-z0-9+\/=]+)$/', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $match)) {
    $decoded = base64_decode($match[1], true);
    if ($decoded !== false && strpos($decoded, ':') !== false) list($username, $password) = explode(':', $decoded, 2);
}
if (!$node_verified && !admin_credentials_valid($username, $password)) admin_fail('需要有效的 admin 管理员认证', 401);
$_SERVER['PHP_AUTH_USER'] = 'admin';

// An explicit custom header prevents browser form/ambient Basic-auth CSRF writes.
if (($_SERVER['HTTP_X_YUKARI_ADMIN'] ?? '') !== '1') admin_fail('缺少管理端请求标记', 403);
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $origin = parse_url($_SERVER['HTTP_ORIGIN']);
    $origin_authority = ($origin['host'] ?? '') . (isset($origin['port']) ? ':' . $origin['port'] : '');
    if ($origin_authority !== ($_SERVER['HTTP_HOST'] ?? '')) admin_fail('不允许跨站管理请求', 403);
}
require_once 'easyauth_class.php';
if (!$node_verified && ($config_ini['useeasyauth'] ?? 0) == 1) {
    if (isset($_SERVER['HTTP_X_YUKARI_EASY_PASS'])) $_REQUEST['easypass'] = $_SERVER['HTTP_X_YUKARI_EASY_PASS'];
    if (!(new EasyAuth())->check_auth()) admin_fail('还需要原版访问口令', 403);
}

$operation = $_GET['operation'] ?? '';
if (!is_string($operation)) admin_fail('管理操作必须为字符串', 400);
if (in_array($operation, ['delete', 'move'], true)) require __DIR__ . '/_queue_write_owner.php';
$methods = ['session' => 'GET', 'queue' => 'GET', 'status' => 'GET', 'settings' => 'GET',
    'delete' => 'POST', 'move' => 'POST', 'settings-save' => 'POST', 'player' => 'POST'];
if (!isset($methods[$operation])) admin_fail('未知管理操作', 404);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== $methods[$operation]) admin_fail('请求方法不允许', 405);
if ($methods[$operation] === 'POST' && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/x-www-form-urlencoded') !== 0) {
    admin_fail('需要 form-urlencoded 请求', 415);
}

if ($operation === 'session') admin_reply(['ok' => true, 'data' => ['username' => 'admin',
    'password_configured' => !empty($config_ini['configpass']),
    'config_revision' => hash_file('sha256', 'config.ini')]]);

// Keep accidental PHP warnings/HTML out of the JSON boundary. Original pages unchanged.
ob_start();
try {
    require_once __DIR__ . '/_common.php';
    if (in_array($operation, ['queue', 'delete', 'move'], true)) {
        // Existing endpoints already share the queue builder and request operation functions.
        $_GET = [];
        $_REQUEST = [];
        if ($operation !== 'queue') $_REQUEST['id'] = is_string($_POST['id'] ?? null) ? $_POST['id'] : '';
        if ($operation === 'move') $_REQUEST['action'] = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
        $file = ['queue' => 'requests.php', 'delete' => 'request_delete.php', 'move' => 'request_move.php'][$operation];
        require __DIR__ . '/' . $file;
        exit;
    }

    if ($operation === 'settings' || $operation === 'settings-save') {
        $raw = parse_ini_file('config.ini');
        if (!is_array($raw)) admin_fail('配置文件不可解析', 503);
        $revision = hash_file('sha256', 'config.ini');
        if ($operation === 'settings-save') {
            if (!is_string($_POST['revision'] ?? null) || !hash_equals($revision, $_POST['revision'])) admin_fail('设置已变化，请重新加载后再保存', 409);
            $limits = ['playmode' => [1, 5], 'startvolume' => [0, 100], 'requestlistactivereload' => [0, 1]];
            $patch = [];
            foreach ($limits as $key => $range) {
                if (!isset($_POST[$key]) || !is_string($_POST[$key]) || !ctype_digit($_POST[$key])) admin_fail('设置值无效：' . $key, 400);
                $number = (int)$_POST[$key];
                if ($number < $range[0] || $number > $range[1]) admin_fail('设置值超出范围：' . $key, 400);
                $patch[$key] = (string)$number;
            }
            // parse_ini_file maps off/false/0 to an empty scalar. Compare effective numbers,
            // just like the JSON read response, so a no-op does not rewrite user config.
            $effective = ['playmode' => (string)(int)($raw['playmode'] ?? 3), 'startvolume' => (string)(int)($raw['startvolume'] ?? 50),
                'requestlistactivereload' => (string)(int)($raw['requestlistactivereload'] ?? 1)];
            $changed = $patch !== $effective;
            if ($changed) {
                // Original serializer also updates ini.ini/comment room, just as init.php does.
                // Merge only whitelisted scalar values; never accept credentials, paths or commands.
                writeconfig2ini(array_merge($raw, $patch), 'config.ini');
                $saved = parse_ini_file('config.ini');
                foreach ($patch as $key => $value) if (!array_key_exists($key, $saved) || (string)(int)$saved[$key] !== $value) admin_fail('设置未完整保存，请重新读取确认', 500);
            }
            $raw = parse_ini_file('config.ini');
            $revision = hash_file('sha256', 'config.ini');
        }
        $result = ['playmode' => (int)($raw['playmode'] ?? 3), 'startvolume' => (int)($raw['startvolume'] ?? 50),
            'requestlistactivereload' => (int)($raw['requestlistactivereload'] ?? 1), 'revision' => $revision];
        if (isset($changed)) $result['changed'] = $changed;
    } elseif ($operation === 'status') {
        require_once 'function_playingstatus.php';
        $probe = function ($url) {
            return @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 0.6, 'header' => "Connection: close\r\n"]])) !== false;
        };
        $result = ['php_version' => PHP_VERSION, 'os' => PHP_OS_FAMILY,
            'detected_player' => getcurrentplayer(), 'playmode' => (int)$config_ini['playmode'],
            'mpc_reachable' => $probe('http://localhost:13579/status.html'),
            'foobar_reachable' => $probe('http://localhost:82/karaokectrl/'),
            'playback' => build_playingstatus_data($db, $config_ini),
            'password_configured' => !empty($config_ini['configpass'])];
    } elseif ($operation === 'player') {
        $player = $_POST['player'] ?? '';
        $action = $_POST['action'] ?? '';
        if (!in_array($player, ['mpc', 'foobar'], true) || !in_array($action, ['play', 'pause', 'playpause', 'stop'], true)) admin_fail('不支持的播放器操作', 400);
        if ($player === 'foobar' && in_array($action, ['pause', 'stop'], true)) admin_fail('原 foobar 接口不支持独立暂停或停止，请使用播放/暂停切换', 501);
        if ($player === 'mpc') {
            require_once 'mpcctrl_func.php';
            $sent = command_mpc(['play' => 887, 'pause' => 888, 'playpause' => 889, 'stop' => 890][$action]);
        } else {
            require_once 'foobar_func.php';
            $sent = $action === 'play' ? foobar_song_play() : foobar_song_pause();
        }
        if ($sent === false) admin_fail('播放器不可达，未确认命令执行', 502);
        $result = ['player' => $player, 'action' => $action, 'acknowledged' => true,
            'message' => '播放器接口已响应，请刷新状态确认实际播放'];
    }
    $unexpected = ob_get_clean();
    if (trim($unexpected) !== '') {
        error_log('admin adapter output: ' . $unexpected);
        admin_fail('原业务代码产生额外输出，请重新读取状态确认操作结果', 500);
    }
    admin_reply(['ok' => true, 'data' => $result]);
} catch (Throwable $error) {
    if (ob_get_level()) ob_end_clean();
    error_log('admin adapter: ' . $error->getMessage());
    admin_fail('管理操作失败，请重新查询状态；写操作不要盲目重试', 500);
}
