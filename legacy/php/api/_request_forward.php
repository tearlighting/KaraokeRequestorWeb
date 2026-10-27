<?php
chdir(dirname(__DIR__));
header('Cache-Control: no-store');
require_once __DIR__.'/_request_compat.php';
try {
    request_compat_origin();
    if ($_SERVER['REQUEST_METHOD']!=='POST') throw new RuntimeException('POST required');
    $secret=request_compat_secret();$uid=request_compat_identity();
    $receipt=$_POST['submission_receipt']??'';$csrf=$_POST['submission_csrf']??'';
    if(!is_string($receipt)||!is_string($csrf)||!hash_equals(hash_hmac('sha256',"legacy-form-v1\0".$receipt."\0".$uid,$secret),$csrf)) throw new RuntimeException('Submission CSRF validation failed; reload confirmation');
    require_once 'func_readconfig.php';$config_ini=(new ReadConfig())->read_config();
    require_once 'easyauth_class.php';
    if (($config_ini['useeasyauth']??0)==1 && !(new EasyAuth())->check_auth()) throw new RuntimeException('Access password required');
    require_once __DIR__.'/_node_auth.php';
    $input=[];
    foreach(['filename','singer','freesinger','comment','kind','fullpath','secret','loop','otherplayer','urlreq','keychange','track','pause','audiodelay','volume','duration','selectid'] as $key)
        if(isset($_POST[$key]) && is_string($_POST[$key]))$input[$key]=$_POST[$key];
    $value=['v'=>1,'aud'=>'legacy-request','iat'=>time(),'exp'=>time()+30,'userid'=>$uid,
        'proof'=>hash_hmac('sha256','user:'.$uid.':'.node_access_version($config_ini),$secret),
        'ip'=>$_SERVER['REMOTE_ADDR']??'','ua'=>$_SERVER['HTTP_USER_AGENT']??'',
        'username'=>mb_substr((string)($_COOKIE['YkariUsername']??''),0,64),
        'receipt'=>$receipt,'input'=>$input,'mode'=>($_POST['submission_action']??'')==='result'?'result':'submit'];
    $payload=rtrim(strtr(base64_encode(json_encode($value,JSON_THROW_ON_ERROR)),'+/','-_'),'=');
    $envelope=$payload.'.'.hash_hmac('sha256',"legacy-request-v1\0".$payload,$secret);
    // Fixed internal service, bounded timeout, no redirect, no browser Basic/Cookie forwarding.
    $context=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\nX-Yukari-Client: 1\r\n",
        'content'=>json_encode(['envelope'=>$envelope]),'timeout'=>15,'ignore_errors'=>true,'follow_location'=>0]]);
    $raw=@file_get_contents('http://api-server:3000/api/v1/internal/legacy-request',false,$context);
    $response=is_string($raw)?json_decode($raw,true):null;
    if(!is_array($response)||($response['ok']??false)!==true) {
        preg_match('/^HTTP\/\S+ (\d+)/', $http_response_header[0] ?? '', $status);
        http_response_code(isset($status[1]) && (int)$status[1]>=400 ? (int)$status[1] : 502);header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'error'=>$response['error']['message']??'结果未知；请保留原提交凭据查询或重试，不要重新建立预约']);exit;
    }
    $data=$response['data'];header('X-Yukari-Owner: node-request-create');
    if($value['mode']==='result') {header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>true,'data'=>$data]);exit;}
    $id=(int)$data['id'];
    if(!empty($input['freesinger']))$input['singer']=$input['freesinger'];
    if(!empty($input['singer']) && ($input['kind']??'')!=='小休止') setcookie('YkariUsername',$input['singer'],time()+5184000,'/');
    if(strtolower($_SERVER['HTTP_X_REQUESTED_WITH']??'')==='xmlhttprequest') {
        header('Content-Type: application/json; charset=utf-8');echo json_encode(['newid'=>$id,'committed'=>true,'warnings'=>$data['warnings']??[]]);
    } else if (getenv('YUKARI_MYSQL_MODE') === '1') { header('Location: /user/',true,303); }
    else { header('Location: /requestlist_top.php?showid='.$id,true,303); }
} catch(Throwable $error) { http_response_code(403);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'error'=>$error->getMessage()]); }
exit;
