<?php
// Exercise the real guard with an in-memory configured password, no config or DB writes.
require dirname(__DIR__, 4) . '/legacy/php/api/_admin_auth.php';
$config_ini = ['configpass' => 'isolated-auth-test-secret'];
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$checks = [
    'correct credentials' => admin_credentials_valid('admin', 'isolated-auth-test-secret'),
    'wrong password' => !admin_credentials_valid('admin', 'wrong'),
    'wrong user' => !admin_credentials_valid('normal', 'isolated-auth-test-secret'),
    'no password' => !admin_credentials_valid('admin', null),
    'no user' => !admin_credentials_valid(null, 'isolated-auth-test-secret'),
];
foreach ($checks as $label => $passed) {
    echo $label . ': ' . ($passed ? 'PASS' : 'FAIL') . "\n";
    if (!$passed) exit(1);
}
