<?php
chdir(dirname(__DIR__));
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
require_once __DIR__.'/_request_compat.php';
try {
    request_compat_origin();
    if ($_SERVER['REQUEST_METHOD']!=='POST' || ($_SERVER['HTTP_X_YUKARI_CLIENT']??'')!=='1'
        || stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0) throw new RuntimeException('Same-origin JSON client required');
    if (getenv('YUKARI_NODE_REQUESTS')!=='1') { echo json_encode(['ok'=>true,'data'=>['nodeRequests'=>false]]); exit; }
    require_once 'func_readconfig.php'; $config_ini=(new ReadConfig())->read_config();
    require_once 'easyauth_class.php';
    if (($config_ini['useeasyauth']??0)==1 && !(new EasyAuth())->check_auth()) throw new RuntimeException('Access password required');
    echo json_encode(['ok'=>true,'data'=>['nodeRequests'=>true]+request_compat_intent()]);
} catch(Throwable $error) { http_response_code(403); echo json_encode(['ok'=>false,'error'=>$error->getMessage()]); }
