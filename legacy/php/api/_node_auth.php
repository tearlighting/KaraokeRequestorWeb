<?php
require_once __DIR__ . '/_admin_auth.php';
function node_admin_configured($config) {
    // PHP's original policy also treats "0" as empty: never allow that open policy here.
    return is_string($config['configpass'] ?? null) && !empty($config['configpass']);
}
function node_access_version($config) {
    return ($config['useeasyauth'] ?? 0) . ':' . ($config['useeasyauth_word'] ?? '');
}
function node_admin_proof($config, $secret, $userid) {
    if (!node_admin_configured($config)) return null;
    return hash_hmac('sha256', 'admin:' . $userid . ':' . $config['configpass'] . ':' . node_access_version($config), $secret);
}
function node_admin_credentials_valid($username, $password) {
    global $config_ini;
    return node_admin_configured($config_ini) && is_string($password) && $password !== ''
        && admin_credentials_valid($username, $password);
}
