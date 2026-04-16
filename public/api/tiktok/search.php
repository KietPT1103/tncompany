<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/_lib/bootstrap.php';
require_once dirname(__DIR__) . '/_lib/auth.php';
require_once dirname(__DIR__) . '/_lib/social_listening.php';

$user = auth_require(['admin']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$services = social_listening_services();
/** @var TikTokSearchController $controller */
$controller = $services['tiktokSearchController'];

if ($method === 'POST') {
    $body = read_json_body();
    $requestedBy = trim((string) ($user['username'] ?? $user['email'] ?? '')) ?: null;
    respond_ok($controller->store($body, $requestedBy), 201);
}

respond_error('Method not allowed', 405);
