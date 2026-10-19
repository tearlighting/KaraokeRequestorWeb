<?php
require_once __DIR__ . '/_node_auth.php';
require_once __DIR__ . '/_queue_context.php';
function queue_ticket_proof($config, $secret, $role, $userid) {
    return $role === 'admin' ? node_admin_proof($config, $secret, $userid)
        : hash_hmac('sha256', 'user:' . $userid . ':' . node_access_version($config), $secret);
}
function queue_ticket_issue($config, $secret, $role, $ip, $ua) {
    $random = bin2hex(random_bytes(16));
    $userid = substr($random, 0, 8) . '-' . substr($random, 8, 4) . '-' . substr($random, 12, 4) . '-' . substr($random, 16, 4) . '-' . substr($random, 20);
    $value = ['v' => 1, 'aud' => 'legacy-queue', 'iat' => time(), 'exp' => time() + 30, 'userid' => $userid, 'role' => $role,
        'ip' => $ip, 'ua' => $ua, 'proof' => queue_ticket_proof($config, $secret, $role, $userid)];
    $payload = rtrim(strtr(base64_encode(json_encode($value, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    return $payload . '.' . hash_hmac('sha256', "legacy-queue-v1\0" . $payload, $secret);
}
function queue_ticket_verify($ticket, $secret, $config) {
    if (!is_string($ticket) || strlen($ticket) > 4096) return null;
    $parts = explode('.', $ticket);
    if (count($parts) !== 2 || !preg_match('/^[A-Za-z0-9_-]+$/D', $parts[0])) return null;
    if (!hash_equals(hash_hmac('sha256', "legacy-queue-v1\0" . $parts[0], $secret), $parts[1])) return null;
    $value = json_decode(base64_decode(strtr($parts[0], '-_', '+/'), true), true);
    if (!is_array($value) || ($value['aud'] ?? '') !== 'legacy-queue' || ($value['v'] ?? 0) !== 1
        || !in_array($value['role'] ?? '', ['user', 'admin'], true)
        || !is_int($value['exp'] ?? null) || !is_int($value['iat'] ?? null)
        || $value['exp'] <= time() || $value['iat'] > time() + 5 || $value['iat'] < time() - 45
        || $value['exp'] - $value['iat'] > 45 || !preg_match('/^[a-f0-9-]{36}$/D', $value['userid'] ?? '')
        || !is_string($value['ip'] ?? null) || !is_string($value['ua'] ?? null)) return null;
    $proof = queue_ticket_proof($config, $secret, $value['role'], $value['userid']);
    return is_string($proof) && hash_equals($proof, $value['proof'] ?? '') ? $value : null;
}
