<?php
// Phase 7: fail before loading PHP business/bootstrap code. No forwarding or replay.
if (getenv('YUKARI_NODE_QUEUE_MUTATIONS') === '1') {
    http_response_code(410);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['ok' => false, 'error' => 'Queue deletion/reordering is owned by Node. Sign in at the independent admin-web (http://127.0.0.1:5174/). Legacy read tickets cannot authorize writes.']);
    exit;
}
