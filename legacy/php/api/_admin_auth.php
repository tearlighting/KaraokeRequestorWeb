<?php
require_once dirname(__DIR__) . '/configauth_class.php';

// Same password policy as init.php, but never uses the localhost check_auth bypass.
// The original empty-password and master-password policies are deliberately retained.
function admin_credentials_valid($username, $password)
{
    return $username === 'admin' && is_string($password)
        && (new ConfigAuth())->check_configpassword($password);
}
