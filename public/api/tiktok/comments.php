<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/_lib/bootstrap.php';
require_once dirname(__DIR__) . '/_lib/auth.php';
require_once dirname(__DIR__) . '/_lib/social_listening.php';

auth_require_permission('social_listening.access');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$services = social_listening_services();
/** @var TikTokCommentController $controller */
$controller = $services['tiktokCommentController'];

if ($method === 'GET') {
    $searchId = trim((string) ($_GET['search_id'] ?? $_GET['searchId'] ?? ''));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = max(1, min(100, (int) ($_GET['per_page'] ?? $_GET['perPage'] ?? 10)));

    if ($searchId === '') {
        respond_error('search_id là bắt buộc.', 422);
    }

    try {
        respond_ok($controller->index($searchId, $page, $perPage));
    } catch (RuntimeException $exception) {
        respond_error($exception->getMessage(), 404);
    }
}

respond_error('Method not allowed', 405);
