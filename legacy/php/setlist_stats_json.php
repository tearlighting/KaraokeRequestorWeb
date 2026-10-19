<?php
require_once 'commonfunc.php';
require_once 'easyauth_class.php';
require_once 'function_setlist_stats.php';

$easyauth = new EasyAuth();
$easyauth->do_eashauthcheck();

if (!configbool("use_setlist_cool", false)) {
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code(404);
    echo json_encode(['error' => 'setlist_cool_disabled'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$data = setlist_stats_get_data(false);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
