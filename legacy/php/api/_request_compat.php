<?php
// No commonfunc, DB bootstrap, queue SQL or Node session mapping in this adapter.
function request_compat_identity() {
    $uid = $_COOKIE['YkariUserID'] ?? '';
    if (!is_string($uid) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iD', $uid)) {
        $hex = bin2hex(random_bytes(16));
        $uid = substr($hex,0,8).'-'.substr($hex,8,4).'-4'.substr($hex,13,3).'-8'.substr($hex,17,3).'-'.substr($hex,20);
        setcookie('YkariUserID', $uid, ['expires'=>time()+86400*365,'path'=>'/','samesite'=>'Strict','httponly'=>true]);
        $_COOKIE['YkariUserID'] = $uid;
    }
    return $uid;
}
function request_compat_secret() {
    $secret = trim(@file_get_contents(getenv('LEGACY_BRIDGE_TOKEN_FILE') ?: '/run/yukari/bridge-token') ?: '');
    if (strlen($secret)<32) throw new RuntimeException('Submission adapter unavailable');
    return $secret;
}
function request_compat_intent() {
    $uid=request_compat_identity(); $secret=request_compat_secret();
    $nonce=rtrim(strtr(base64_encode(random_bytes(32)),'+/','-_'),'=');
    $receipt=$nonce.'.'.hash_hmac('sha256', "submission-v1\0".$nonce,$secret);
    return ['submission_receipt'=>$receipt,'submission_csrf'=>hash_hmac('sha256',"legacy-form-v1\0".$receipt."\0".$uid,$secret)];
}
function request_compat_fields() {
    if (getenv('YUKARI_NODE_REQUESTS')!=='1') return;
    foreach(($GLOBALS['node_request_intent'] ?? request_compat_intent()) as $key=>$value) echo '<input type="hidden" name="'.$key.'" value="'.htmlspecialchars($value,ENT_QUOTES,'UTF-8').'">';
}
function request_compat_origin() {
    $allowed=explode(',',getenv('LEGACY_QUEUE_ORIGINS') ?: 'http://127.0.0.1:8080,http://localhost:8080');
    $site=(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off'?'https':'http').'://'.($_SERVER['HTTP_HOST']??'');
    if(!in_array($site,$allowed,true) || (!empty($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN']!==$site)) throw new RuntimeException('Legacy origin denied');
}
