<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/social_listening.php';

auth_require(['admin']);

$services = social_listening_services();
$repository = $services['repository'];
$analyticsService = $services['analyticsService'];
$ingestionService = $services['ingestionService'];
$monthlyReportService = $services['monthlyReportService'];
$mockFactory = $services['mockFactory'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = trim((string) ($_GET['action'] ?? ($_POST['action'] ?? 'dashboard')));

function social_listening_request_filters(): array
{
    $month = trim((string) ($_GET['month'] ?? ''));
    $startDate = trim((string) ($_GET['startDate'] ?? ''));
    $endDate = trim((string) ($_GET['endDate'] ?? ''));

    if ($month !== '' && ($startDate === '' || $endDate === '')) {
        $start = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $month . '-01 00:00:00');
        if ($start) {
            $end = $start->modify('last day of this month');
            $startDate = $start->format('Y-m-d');
            $endDate = $end->format('Y-m-d');
        }
    }

    return array_filter([
        'month' => $month !== '' ? $month : null,
        'startDate' => $startDate !== '' ? $startDate : null,
        'endDate' => $endDate !== '' ? $endDate : null,
        'brandGroup' => trim((string) ($_GET['brandGroup'] ?? '')) ?: null,
        'sentiment' => trim((string) ($_GET['sentiment'] ?? '')) ?: null,
        'topicTag' => trim((string) ($_GET['topicTag'] ?? '')) ?: null,
        'limit' => (int) ($_GET['limit'] ?? 50),
    ], static function ($value): bool {
        return $value !== null && $value !== '';
    });
}

if ($method === 'GET' && $action === 'dashboard') {
    $filters = social_listening_request_filters();
    $granularity = trim((string) ($_GET['granularity'] ?? 'day')) ?: 'day';

    respond_ok([
        'dashboard' => $analyticsService->buildDashboard($filters, $granularity),
        'savedReport' => !empty($filters['month']) ? $repository->getReportByMonth((string) $filters['month']) : null,
    ]);
}

if ($method === 'GET' && $action === 'comments') {
    respond_ok([
        'items' => $repository->fetchComments(social_listening_request_filters()),
    ]);
}

if ($method === 'GET' && $action === 'reports') {
    $month = trim((string) ($_GET['month'] ?? ''));
    if ($month !== '') {
        respond_ok([
            'item' => $repository->getReportByMonth($month),
        ]);
    }

    respond_ok([
        'items' => $repository->listReports((int) ($_GET['limit'] ?? 12)),
    ]);
}

if ($method === 'POST' && $action === 'ingest') {
    $body = read_json_body();
    $items = is_array($body['items'] ?? null) ? $body['items'] : [];

    respond_ok([
        'result' => $ingestionService->ingest($items, [
            'collectedAt' => trim((string) ($body['collectedAt'] ?? '')) ?: null,
        ]),
    ], 201);
}

if ($method === 'POST' && $action === 'seed') {
    $body = read_json_body();
    $month = trim((string) ($body['month'] ?? date('Y-m')));
    $count = max(6, min(120, (int) ($body['count'] ?? 24)));
    $items = $mockFactory->makeMonthSeed($month, $count);

    respond_ok([
        'seededMonth' => $month,
        'result' => $ingestionService->ingest($items),
    ], 201);
}

if ($method === 'POST' && $action === 'generate-report') {
    $body = read_json_body();
    $month = trim((string) ($body['month'] ?? date('Y-m', strtotime('first day of last month'))));
    $persist = !array_key_exists('persist', $body) || !empty($body['persist']);

    respond_ok($monthlyReportService->generate($month, $persist));
}

respond_error('Not found', 404);
