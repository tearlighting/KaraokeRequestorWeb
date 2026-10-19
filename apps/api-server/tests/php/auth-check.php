<?php
require dirname(__DIR__, 4) . '/legacy/php/api/_node_auth.php';
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$secret = str_repeat('test-service-key', 4);
$uid = '00000000-0000-4000-8000-000000000001';
$checks = [];
foreach ([[], ['configpass' => ''], ['configpass' => '0']] as $config_ini) {
    $checks[] = !node_admin_credentials_valid('admin', 'nonempty');
    $checks[] = node_admin_proof($config_ini, $secret, $uid) === null;
}
$config_ini = ['configpass' => 'isolated-password'];
$checks[] = node_admin_credentials_valid('admin', 'isolated-password');
$checks[] = !node_admin_credentials_valid('admin', 'wrong');
$checks[] = !node_admin_credentials_valid('admin', '');
$checks[] = !node_admin_credentials_valid('normal', 'isolated-password');
$proof = node_admin_proof($config_ini, $secret, $uid);
$checks[] = $proof !== node_admin_proof(['configpass' => 'changed-password'], $secret, $uid);
$checks[] = $proof !== node_admin_proof($config_ini, $secret, '00000000-0000-4000-8000-000000000002');
$checks[] = $proof !== node_admin_proof($config_ini + ['useeasyauth' => 1], $secret, $uid);
foreach ($checks as $index => $passed) {
    if (!$passed) { echo 'Node auth invariant ' . ($index + 1) . " FAIL\n"; exit(1); }
}
echo count($checks) . " Node authentication and revocation invariants PASS (memory only)\n";
