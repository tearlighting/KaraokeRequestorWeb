<?php
// Authentication/configuration context only. No commonfunc, queue query or DB initialization.
function node_queue_context($config, $role, $ip, $ua) {
    $root = realpath(dirname(__DIR__) . '/runtime/queue');
    $path = realpath(urldecode($config['dbname'] ?? 'request.db'));
    if ($root === false || $path === false || strpos($path, $root . DIRECTORY_SEPARATOR) !== 0) return null;
    return ['database' => str_replace(DIRECTORY_SEPARATOR, '/', substr($path, strlen($root) + 1)),
        'secret_text' => urldecode($config['secret_display_text'] ?? urlencode('ヒ・ミ・ツ♪(シークレットリクエスト)')),
        'ip' => $ip, 'ua' => $ua, 'role' => $role];
}
