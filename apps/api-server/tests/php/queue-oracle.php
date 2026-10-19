<?php
// Isolated in-memory SQLite only. Execute the actual Legacy builder and username helpers.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
require dirname(__DIR__, 4) . '/legacy/php/function_requestlist_json.php';
$source = file_get_contents(dirname(__DIR__, 4) . '/legacy/php/commonfunc.php');
$start = strpos($source, 'function getallrequest_array(){');
$end = strpos($source, 'function shownavigatioinbar(', $start);
if ($start === false || $end === false) throw new RuntimeException('Legacy helpers changed; review oracle');
eval(substr($source, $start, $end - $start));
$db = new PDO('sqlite::memory:');
$db->exec($input['schema']);
foreach ($input['rows'] as $row) {
    $columns = array_keys($row);
    $stmt = $db->prepare('INSERT INTO requesttable (' . implode(',', $columns) . ') VALUES (' . implode(',', array_fill(0, count($columns), '?')) . ')');
    $stmt->execute(array_values($row));
}
$results = [];
foreach ($input['contexts'] as $context) {
    $user = $context['role'] === 'admin' ? 'admin' : 'normal';
    $_SERVER['REMOTE_ADDR'] = $context['ip'];
    $_SERVER['HTTP_USER_AGENT'] = $context['ua'];
    $config_ini = ['secret_display_text' => urlencode($context['secret_text'])];
    $results[] = build_requestlist_data($db, $config_ini, $context['limit'] ?? 0, $context['offset'] ?? 0);
}
echo json_encode($results, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
