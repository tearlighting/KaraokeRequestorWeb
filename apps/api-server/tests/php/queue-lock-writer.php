<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (($argv[2] ?? '') === 'init') {
    if (@file_get_contents('/var/www/html/.isolated-test-fixture') !== 'synthetic only'
        || !preg_match('#^/var/www/html/runtime/queue/yukari-mutation-[a-f0-9-]+/request\.db$#D', $argv[1])) throw new RuntimeException('Synthetic fixture required');
    mkdir(dirname($argv[1]), 02770); chgrp(dirname($argv[1]), 33); chmod(dirname($argv[1]), 02770);
    $fixture = new PDO('sqlite:' . $argv[1]);
    $fixture->exec("PRAGMA journal_mode=WAL; CREATE TABLE requesttable(id INTEGER PRIMARY KEY,reqorder INTEGER,nowplaying TEXT);
        INSERT INTO requesttable VALUES(1,1,'未再生'),(2,2,'未再生')");
    $fixture = null; chgrp($argv[1], 33); chmod($argv[1], 0660); exit;
}
$path = realpath($argv[1] ?? '');
$root = realpath('/var/www/html/runtime/queue');
if (!$path || !$root || strpos($path, $root . '/yukari-mutation-') !== 0) throw new RuntimeException('Isolated fixture only');
$db = new PDO('sqlite:file:' . $path . '?mode=rw');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('BEGIN IMMEDIATE');
echo "locked\n"; flush();
// Test orchestrator releases only AFTER the Node process starts its competing write.
if (trim(fgets(STDIN) ?: '') !== 'commit') throw new RuntimeException('Missing release');
$db->exec('UPDATE requesttable SET reqorder=5 WHERE id=2; COMMIT');
echo "committed\n";
