<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__, 4) . '/legacy/php/api/_queue_ticket.php';
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
if ($input['operation'] === 'issue') {
    echo json_encode(['ticket' => queue_ticket_issue($input['config'], $input['secret'], $input['role'], 'test-ip', 'test-UA')]);
} else {
    echo json_encode(['valid' => queue_ticket_verify($input['ticket'], $input['secret'], $input['config']) !== null]);
}
