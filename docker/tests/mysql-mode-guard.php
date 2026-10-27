<?php
putenv('YUKARI_MYSQL_MODE=1');
require __DIR__ . '/../../legacy/php/mysql-mode-guard.php';

$allowed = [
    ['/search.php', ''], ['/search_bs5.php', ''], ['/api/search.php', ''],
    ['/api/capabilities.php', ''], ['/api/lister_index.php', ''], ['/exec.php', ''],
    ['/init.php', '', 'GET'],
    ['/api/node_bridge.php', 'user-auth'], ['/api/node_bridge.php', 'request-context'],
    ['/api/node_bridge.php', 'search'], ['/api/admin.php', 'session'],
];
foreach ($allowed as $route) {
    if (!yukari_mysql_php_path_allowed(...$route)) {
        [$path] = $route;
        fwrite(STDERR, "unexpectedly denied supported path: {$path}\n"); exit(1);
    }
}
$denied = [
    ['/api/mypage.php', ''], ['/api/requests.php', ''], ['/api/admin.php', 'queue'],
    ['/init.php', '', 'POST'], ['/requestlist_top.php', ''], ['/notfoundrequest/add.php', ''],
    ['/api/node_bridge.php', 'queue-notify'], ['/api/node_bridge.php', 'admin-queue'],
];
foreach ($denied as $route) {
    if (yukari_mysql_php_path_allowed(...$route)) {
        [$path] = $route;
        fwrite(STDERR, "unexpectedly allowed disabled path: {$path}\n"); exit(1);
    }
}
echo "MySQL Legacy route guard: ".count($allowed)." allowed, ".count($denied)." disabled checks passed\n";
