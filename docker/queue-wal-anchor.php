<?php
// PHP lifecycle owner for SQLite WAL/SHM availability. No queue/data/schema writes.
// Read-only Node cannot create missing side files on its kernel read-only mount.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
chdir('/var/www/html');
while (true) {
    $config = @parse_ini_file('config.ini');
    $path = is_array($config) ? realpath(urldecode($config['dbname'] ?? 'request.db')) : false;
    $root = realpath('runtime/queue');
    if ($path && $root && str_starts_with($path, $root . DIRECTORY_SEPARATOR) && is_file($path)) {
        try {
            // mode=rw never creates a database. Merely accessing an existing WAL DB
            // from the PHP writer mount lets SQLite initialize its own side files.
            $uri = implode('/', array_map('rawurlencode', explode('/', $path)));
            $db = new PDO('sqlite:file:' . $uri . '?mode=rw');
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $db->query('SELECT COUNT(*) FROM sqlite_schema')->fetchColumn();
            // No active transaction/read cursor: checkpointing is not pinned.
            while (true) {
                sleep(2);
                $current = @parse_ini_file('config.ini');
                if (!is_array($current) || realpath(urldecode($current['dbname'] ?? 'request.db')) !== $path) break;
            }
            $db = null;
        } catch (Throwable $error) { error_log('Queue WAL lifecycle connection unavailable; retrying'); }
    }
    sleep(2);
}
