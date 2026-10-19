<?php
// CLI-only syntax validation. Does not include application files or open databases.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = $argv[1] ?? '/var/www/html';
$count = 0;
$failed = false;
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $file) {
    if (!$file->isFile() || $file->getExtension() !== 'php') continue;
    $process = proc_open([PHP_BINARY, '-l', $file->getPathname()], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) { fwrite(STDERR, "Cannot start PHP lint\n"); exit(1); }
    $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    if (proc_close($process) !== 0) { fwrite(STDERR, $output); $failed = true; }
    $count++;
}
echo "PHP syntax: $count files, " . ($failed ? 'FAILED' : 'PASS') . "\n";
exit($failed ? 1 : 0);
