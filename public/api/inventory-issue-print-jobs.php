<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/inventory_issue_print_jobs.php';

inventory_issue_print_jobs_ensure_schema();
$user = auth_require_permission('inventory_issues.access');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 100)));
    respond_ok(['items' => inventory_issue_print_jobs_list($storeId, $limit)]);
}

if ($method !== 'POST') respond_error('Method not allowed', 405);
$body = read_json_body();
$storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));
$action = strtolower(trim((string) ($body['action'] ?? '')));
$id = trim((string) ($body['id'] ?? ''));

try {
    if ($action === 'claim') {
        $terminalName = mb_substr(trim((string) ($body['terminalName'] ?? '')), 0, 255);
        if ($terminalName === '') respond_error('Tên máy in là bắt buộc.', 422);
        respond_ok(inventory_issue_print_jobs_claim($storeId, $terminalName));
    }
    if (in_array($action, ['printed', 'failed', 'uncertain'], true)) {
        $claimToken = trim((string) ($body['claimToken'] ?? ''));
        if ($id === '' || $claimToken === '') respond_error('Thiếu mã lệnh in hoặc claim token.', 422);
        $item = inventory_issue_print_jobs_finish(
            $storeId,
            $id,
            $claimToken,
            $action,
            mb_substr(trim((string) ($body['terminalName'] ?? '')), 0, 255),
            mb_substr(trim((string) ($body['error'] ?? '')), 0, 500)
        );
        respond_ok(['item' => $item]);
    }
    if ($action === 'retry') {
        if ($id === '') {
            $issueId = trim((string) ($body['issueId'] ?? ''));
            $latestStatement = db()->prepare('SELECT id FROM inventory_issue_print_jobs WHERE issue_id=:issue_id AND store_id=:store_id ORDER BY attempt_number DESC LIMIT 1');
            $latestStatement->execute(['issue_id' => $issueId, 'store_id' => $storeId]);
            $id = (string) ($latestStatement->fetchColumn() ?: '');
        }
        if ($id === '') respond_error('Không tìm thấy lệnh in của phiếu xuất kho.', 422);
        respond_ok(['item' => inventory_issue_print_jobs_retry($storeId, $id)]);
    }
    if ($action === 'cancel') {
        if ($id === '') respond_error('Thiếu mã lệnh in.', 422);
        respond_ok(['item' => inventory_issue_print_jobs_cancel($storeId, $id)]);
    }
    if ($action === 'cancel-all') {
        respond_ok(['cancelled' => inventory_issue_print_jobs_cancel_all($storeId)]);
    }
    respond_error('Thao tác hàng đợi in không hợp lệ.', 422);
} catch (Throwable $exception) {
    $message = mb_substr(trim($exception->getMessage()), 0, 500);
    respond_error($message !== '' ? $message : 'Không thể cập nhật hàng đợi in.', 409);
}
