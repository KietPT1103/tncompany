<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/realtime.php';

$user = auth_require();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = strtolower(trim((string) ($_GET['action'] ?? 'config')));
$settings = realtime_settings();

if ($method === 'GET' && $action === 'config') {
    respond_ok([
        'enabled' => $settings['enabled'],
        'key' => $settings['enabled'] ? $settings['key'] : '',
        'cluster' => $settings['cluster'],
        'authEndpoint' => '/api/realtime.php?action=authorize',
    ]);
}

if ($method === 'POST' && $action === 'authorize') {
    if (!$settings['enabled']) respond_error('Realtime is not configured', 503);

    $socketId = trim((string) ($_POST['socket_id'] ?? ''));
    $channelName = trim((string) ($_POST['channel_name'] ?? ''));
    if (!preg_match('/^\d+\.\d+$/', $socketId)) respond_error('Invalid socket id', 422);
    if (!preg_match('/^private-store-([a-z0-9_-]+)$/', $channelName, $matches)) {
        respond_error('Invalid realtime channel', 403);
    }

    $requestedStoreId = $matches[1];
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    $assignedStoreId = strtolower(trim((string) ($user['storeId'] ?? '')));
    $canAccessPosRealtime = $role === 'admin'
        || auth_has_permission($user, 'bills.access')
        || auth_has_permission($user, 'bar.access')
        || auth_has_permission($user, 'bar.checkout');
    if (!$canAccessPosRealtime) respond_error('Forbidden realtime channel', 403);
    if (in_array($role, ['user', 'server', 'bartender'], true) && $assignedStoreId !== $requestedStoreId) {
        respond_error('Forbidden realtime channel', 403);
    }

    $signature = hash_hmac('sha256', $socketId . ':' . $channelName, $settings['secret']);
    bootstrap_emit_json(['auth' => $settings['key'] . ':' . $signature]);
    exit;
}

respond_error('Realtime endpoint not found', 404);
