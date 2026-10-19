<?php
// CLI only: execute the existing projection directly from Legacy source, with
// synthetic INI input. Never load commonfunc/kara_config or open any database.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$source = file_get_contents(dirname(__DIR__, 4) . '/legacy/php/api/admin.php');
$start = strpos($source, "        \$result = ['playmode'");
$end = strpos($source, '        if (isset($changed))', $start);
if ($start === false || $end === false) throw new RuntimeException('Legacy projection changed; review oracle');
$projection = substr($source, $start, $end - $start);
$results = [];
foreach ($input as $text) {
    $raw = @parse_ini_string($text);
    if ($raw === false) { $results[] = ['error' => 'parse']; continue; }
    $revision = hash('sha256', $text);
    eval($projection);
    $results[] = $result;
}
echo json_encode($results, JSON_THROW_ON_ERROR);
