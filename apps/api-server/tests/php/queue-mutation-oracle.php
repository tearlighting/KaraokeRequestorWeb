<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
require dirname(__DIR__, 4) . '/legacy/php/function_requestops.php';
$source = file_get_contents(dirname(__DIR__, 4) . '/legacy/php/commonfunc.php');
$start = strpos($source, 'function normalize_reqorder(');
// Token-independent boundary is the following named function's documentation.
$end = strpos($source, 'function mypage_action_script()', $start);
if ($start === false || $end === false) throw new RuntimeException('Review normalize oracle');
$slice = substr($source, $start, $end - $start);
$slice = substr($slice, 0, strrpos($slice, '/**'));
eval($slice);
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec($input['schema']);
foreach ($input['rows'] as $row) {
    $stmt = $db->prepare('INSERT INTO requesttable(id,reqorder,nowplaying,payload) VALUES(?,?,?,?)');
    $stmt->execute($row);
}
$results = [];
foreach ($input['operations'] as $op) {
    if (!$db->query('SELECT id FROM requesttable WHERE id=' . (int)$op['id'])->fetchColumn()) {
        $results[] = ['error' => 'NOT_FOUND']; continue;
    }
    ob_start();
    if ($op['action'] === 'delete') $db->exec('DELETE FROM requesttable WHERE id=' . (int)$op['id']);
    else { $function = ['up'=>'dbup','down'=>'dbdown','warikomi'=>'warikomi'][$op['action']]; $function($op['id'], $db); }
    $message = trim(strip_tags(ob_get_clean()));
    normalize_reqorder($db);
    $results[] = ['message' => $message, 'rows' => $db->query('SELECT * FROM requesttable ORDER BY id')->fetchAll(PDO::FETCH_ASSOC),
        'history' => $db->query('SELECT * FROM history')->fetchAll(PDO::FETCH_ASSOC)];
}
echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
