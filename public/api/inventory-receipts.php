<?php

declare(strict_types=1);
require_once __DIR__ . '/_lib/search.php';

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';
require_once __DIR__ . '/_lib/inventory_receipt_completion.php';

ingredients_ensure_schema();

auth_ensure_column('inventory_receipt_items', 'item_type', "ENUM('ingredient','equipment') NOT NULL DEFAULT 'ingredient' AFTER ingredient_id");
auth_ensure_column('inventory_receipts', 'order_creator_name', 'VARCHAR(255) NULL AFTER supplier_id');
auth_ensure_column('inventory_receipts', 'locked_at', 'DATETIME NULL AFTER order_creator_name');
auth_ensure_column('inventory_receipts', 'locked_by', 'VARCHAR(64) NULL AFTER locked_at');
auth_ensure_column('inventory_receipts', 'unlocked_at', 'DATETIME NULL AFTER locked_by');
auth_ensure_column('inventory_receipts', 'unlocked_by', 'VARCHAR(64) NULL AFTER unlocked_at');
auth_ensure_column('inventory_receipts', 'entry_source', "ENUM('mobile_photo','web_manual') NOT NULL DEFAULT 'mobile_photo' AFTER receipt_date");
auth_ensure_column('inventory_receipts', 'shift_id', 'VARCHAR(64) NULL AFTER created_by');
auth_ensure_column('inventory_receipts', 'shift_type', 'VARCHAR(20) NULL AFTER shift_id');
auth_ensure_column('inventory_receipts', 'deleted_at', 'DATETIME NULL AFTER cancelled_at');
auth_ensure_column('inventory_receipts', 'deleted_by', 'VARCHAR(64) NULL AFTER deleted_at');
auth_ensure_column('inventory_receipts', 'previous_status', 'VARCHAR(32) NULL AFTER deleted_by');
$statusColumn = db()->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_receipts' AND COLUMN_NAME='status' LIMIT 1")->fetchColumn();
if (is_string($statusColumn) && strpos($statusColumn, "'deleted'") === false) {
    db()->exec("ALTER TABLE inventory_receipts MODIFY status ENUM('pending_explanation','draft','completed','cancelled','deleted') NOT NULL DEFAULT 'draft'");
}

function receipts_store(array $body = []): string
{
    return trim((string) ($body['areaId'] ?? $body['storeId'] ?? $_GET['areaId'] ?? $_GET['storeId'] ?? ''));
}

function receipts_full(array $user, string $id): array
{
    $row = field_inventory_require_receipt($user, $id);
    $imageReceiptId = trim((string) ($row['evidence_receipt_id'] ?? '')) ?: $id;
    if ($imageReceiptId !== $id) field_inventory_require_receipt($user, $imageReceiptId);
    $images = field_inventory_load_images($id);
    if ($imageReceiptId !== $id) $images = array_merge($images, field_inventory_load_images($imageReceiptId));
    return field_inventory_receipt_payload($row, field_inventory_load_items($id), $images, $user);
}

function receipts_recalculate(string $id): void
{
    $statement = db()->prepare(
        'UPDATE inventory_receipts r
         SET total_quantity = (SELECT COALESCE(SUM(i.quantity),0) FROM inventory_receipt_items i WHERE i.receipt_id=r.id),
             total_amount = (SELECT COALESCE(SUM(i.quantity*i.unit_cost),0) FROM inventory_receipt_items i WHERE i.receipt_id=r.id),
             updated_at = NOW()
         WHERE r.id = :id'
    );
    $statement->execute(['id' => $id]);
}

function receipts_list(): void
{
    $user = field_inventory_require_permission('inventory_receipts.view');
    field_inventory_refresh_receipt_lock();
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id !== '') {
        respond_ok(['item' => receipts_full($user, $id)]);
    }

    $allowed = array_column(field_inventory_allowed_stores($user), 'id');
    if ($allowed === []) {
        respond_ok(['items' => [], 'pagination' => ['page' => 1, 'limit' => 20, 'total' => 0, 'pages' => 0], 'counts' => []]);
    }
    $where = [];
    $view = trim((string) ($_GET['view'] ?? ''));
    if ($view === 'evidence') $where[] = 'EXISTS (SELECT 1 FROM inventory_receipt_images ev WHERE ev.receipt_id=r.id)';
    if ($view === 'ledger') $where[] = 'NOT EXISTS (SELECT 1 FROM inventory_receipts linked_target WHERE linked_target.evidence_receipt_id=r.id AND linked_target.status<>"deleted")';
    if ($view === 'ledger') $where[] = '(r.entry_source="web_manual" OR EXISTS (SELECT 1 FROM inventory_receipt_items li WHERE li.receipt_id=r.id))';
    $params = [];
    if (isset($_GET['warehouseType'])) {
        $type = (string) $_GET['warehouseType'];
        if (!in_array($type, ['ingredient', 'equipment'], true)) respond_error('Loại kho không hợp lệ.', 422);
        $where[] = 'EXISTS (SELECT 1 FROM inventory_receipt_items wi WHERE wi.receipt_id=r.id AND wi.item_type=:warehouse_type)';
        $params['warehouse_type'] = $type;
    }
    $allowedSql = [];
    foreach ($allowed as $index => $value) {
        $key = 'area_' . $index;
        $allowedSql[] = ':' . $key;
        $params[$key] = $value;
    }
    $where[] = 'r.store_id IN (' . implode(',', $allowedSql) . ')';
    $deletedOnly = strtolower(trim((string) ($_GET['status'] ?? ''))) === 'deleted';
    if ($deletedOnly && !field_inventory_is_admin($user)) respond_error('Chỉ admin được xem phiếu đã xóa.', 403);
    if (!$deletedOnly) $where[] = 'r.status <> "deleted"';

    $storeId = receipts_store();
    if ($storeId !== '') {
        field_inventory_require_store($user, $storeId);
        $where[] = 'r.store_id = :store_id';
        $params['store_id'] = $storeId;
    }
    $status = strtolower(trim((string) ($_GET['status'] ?? '')));
    if (in_array($status, FIELD_RECEIPT_STATUSES, true)) {
        $where[] = 'r.status = :status';
        $params['status'] = $status;
    }
    $dateColumn = $view === 'ledger' ? 'r.receipt_date' : ($view === 'evidence' ? 'COALESCE(r.captured_at,r.created_at)' : 'r.created_at');
    foreach (['dateFrom' => [$dateColumn . ' >= :date_from', 'date_from', $view === 'ledger' ? '' : ' 00:00:00'],
              'dateTo' => [$dateColumn . ' <= :date_to', 'date_to', $view === 'ledger' ? '' : ' 23:59:59']] as $queryKey => $definition) {
        $value = trim((string) ($_GET[$queryKey] ?? ''));
        if ($value !== '') {
            $where[] = $definition[0];
            $params[$definition[1]] = $value . $definition[2];
        }
    }
    $employee = trim((string) ($_GET['employeeId'] ?? ''));
    if ($employee !== '') {
        $where[] = 'EXISTS (
            SELECT 1 FROM inventory_receipt_images employee_image
            WHERE employee_image.receipt_id=r.id AND employee_image.uploaded_by=:employee
        )';
        $params['employee'] = $employee;
    }
    $keyword = trim((string) ($_GET['keyword'] ?? $_GET['search'] ?? ''));
    if ($keyword !== '') {
        $needle = admin_search_value($keyword);
        $where[] = '(' . admin_search_expression('r.receipt_code') . ' LIKE :keyword_code OR ' . admin_search_expression('r.note') . ' LIKE :keyword_note OR ' . admin_search_expression('r.location_address') . ' LIKE :keyword_address OR EXISTS (SELECT 1 FROM inventory_receipt_items keyword_item WHERE keyword_item.receipt_id=r.id AND ' . admin_search_expression('keyword_item.product_name') . ' LIKE :keyword_product) OR EXISTS (SELECT 1 FROM suppliers keyword_supplier WHERE keyword_supplier.id=r.supplier_id AND ' . admin_search_expression('keyword_supplier.supplier_name') . ' LIKE :keyword_supplier))';
        $params['keyword_code'] = $needle;
        $params['keyword_note'] = $needle;
        $params['keyword_address'] = $needle;
        $params['keyword_product'] = $needle;
        $params['keyword_supplier'] = $needle;
    }
    $productKeyword = trim((string) ($_GET['productKeyword'] ?? ''));
    if ($productKeyword !== '') {
        $needle = admin_search_value($productKeyword);
        $where[] = 'EXISTS (SELECT 1 FROM inventory_receipt_items si WHERE si.receipt_id=r.id AND (' . admin_search_expression('si.product_code') . ' LIKE :product_code OR ' . admin_search_expression('si.product_name') . ' LIKE :product_name))';
        $params['product_code'] = $needle;
        $params['product_name'] = $needle;
    }
    $evidenceStatus = trim((string) ($_GET['evidenceStatus'] ?? ''));
    $linkedSql = '(EXISTS (SELECT 1 FROM inventory_receipts evidence_target WHERE evidence_target.evidence_receipt_id=r.id AND evidence_target.status<>"deleted") OR (r.status="completed" AND EXISTS (SELECT 1 FROM inventory_receipt_items evidence_item WHERE evidence_item.receipt_id=r.id)))';
    if ($view === 'evidence' && $evidenceStatus === 'linked') $where[] = $linkedSql;
    if ($view === 'evidence' && in_array($evidenceStatus, ['unlinked','review'], true)) $where[] = 'NOT ' . $linkedSql;
    if ($view === 'evidence' && $evidenceStatus === 'review') $where[] = 'COALESCE(r.note, "")=""';
    $whereSql = implode(' AND ', $where);
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 20)));

    $count = db()->prepare('SELECT COUNT(*) FROM inventory_receipts r WHERE ' . $whereSql);
    $count->execute($params);
    $total = (int) $count->fetchColumn();
    $sorts = ['oldest' => 'r.created_at ASC', 'amount_desc' => 'r.total_amount DESC', 'newest' => 'r.created_at DESC'];
    $sort = $sorts[strtolower((string) ($_GET['sort'] ?? 'newest'))] ?? $sorts['newest'];
    $statement = db()->prepare(
        'SELECT r.*, s.name area_name,supplier.supplier_code,supplier.supplier_name,
                COALESCE(u.display_name,u.username,u.email,r.created_by) creator_name,
                (SELECT COUNT(*) FROM inventory_receipt_items i WHERE i.receipt_id=r.id) item_count,
                (SELECT COUNT(*) FROM inventory_receipt_images im WHERE im.receipt_id=r.id) image_count,
                (SELECT im.id FROM inventory_receipt_images im WHERE im.receipt_id=r.id ORDER BY im.created_at LIMIT 1) thumbnail_id,
                (SELECT COALESCE(photo_user.display_name,photo_user.username,photo_user.email,im.uploaded_by)
                   FROM inventory_receipt_images im
                   LEFT JOIN users photo_user
                     ON photo_user.id COLLATE utf8mb4_unicode_ci=im.uploaded_by COLLATE utf8mb4_unicode_ci
                  WHERE im.receipt_id=r.id ORDER BY im.created_at LIMIT 1) captured_by_name
         FROM inventory_receipts r INNER JOIN stores s ON s.id=r.store_id
         LEFT JOIN suppliers supplier
           ON supplier.id COLLATE utf8mb4_unicode_ci=r.supplier_id COLLATE utf8mb4_unicode_ci
         LEFT JOIN users u ON u.id COLLATE utf8mb4_unicode_ci=r.created_by WHERE ' . $whereSql . '
         ORDER BY ' . $sort . ' LIMIT :limit OFFSET :offset'
    );
    foreach ($params as $key => $value) {
        $statement->bindValue(':' . $key, $value);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->bindValue(':offset', ($page - 1) * $limit, PDO::PARAM_INT);
    $statement->execute();
    $items = array_map(static function (array $row) use ($user, $view): array {
        $item = field_inventory_receipt_payload($row, field_inventory_load_items((string) $row['id']), $view === 'evidence' ? field_inventory_load_images((string) $row['id']) : [], $user);
        $linked = db()->prepare('SELECT id,receipt_code FROM inventory_receipts WHERE evidence_receipt_id=:id AND status<>"deleted"');
        $linked->execute(['id' => $row['id']]);
        $item['linkedReceipts'] = $linked->fetchAll();
        $item['itemCount'] = (int) $row['item_count'];
        $item['imageCount'] = (int) $row['image_count'];
        $item['thumbnailUrl'] = $row['thumbnail_id'] ? '/api/inventory-receipt-images.php?id=' . rawurlencode($row['thumbnail_id']) . '&size=thumbnail' : null;
        $item['capturedByName'] = $row['captured_by_name'] ?: null;
        return $item;
    }, $statement->fetchAll());

    $summaryStatement = db()->prepare('SELECT
        SUM(r.status="pending_explanation") pending,
        SUM(r.status="draft") processing,
        SUM(r.status="completed") completed,
        SUM(r.evidence_receipt_id IS NOT NULL OR (r.status="completed" AND EXISTS (SELECT 1 FROM inventory_receipt_images own_img WHERE own_img.receipt_id=r.id))) linked,
        SUM(EXISTS (SELECT 1 FROM inventory_receipts target WHERE target.evidence_receipt_id=r.id AND target.status<>"deleted") OR (r.status="completed" AND EXISTS (SELECT 1 FROM inventory_receipt_items own_item WHERE own_item.receipt_id=r.id))) evidence_linked,
        SUM(COALESCE(r.note, "")="") needs_review
        FROM inventory_receipts r WHERE ' . $whereSql);
    $summaryStatement->execute($params);
    $summary = array_map('intval', $summaryStatement->fetch());

    $counts = array_fill_keys(FIELD_RECEIPT_STATUSES, 0);
    $allowedParams = array_filter($params, static fn(string $key): bool => strpos($key, 'area_') === 0, ARRAY_FILTER_USE_KEY);
    $countWhere = 'r.store_id IN (' . implode(',', $allowedSql) . ')';
    $countWhere .= $deletedOnly ? ' AND r.status = "deleted"' : ' AND r.status <> "deleted"';
    if ($storeId !== '') {
        $countWhere .= ' AND r.store_id = :count_store_id';
        $allowedParams['count_store_id'] = $storeId;
    }
    $countSql = db()->prepare('SELECT status,COUNT(*) total FROM inventory_receipts r WHERE ' . $countWhere . ' GROUP BY status');
    $countSql->execute($allowedParams);
    foreach ($countSql->fetchAll() as $row) {
        $counts[$row['status']] = (int) $row['total'];
    }
    $counts['all'] = array_sum($counts);
    respond_ok(['items' => $items, 'summary' => $summary, 'counts' => $counts, 'pagination' => [
        'page' => $page, 'limit' => $limit, 'total' => $total, 'pages' => (int) ceil($total / $limit),
    ]]);
}

function receipts_create(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.create');
    $storeId = field_inventory_require_store($user, receipts_store($body));
    $clientId = trim((string) ($body['clientRequestId'] ?? ''));
    if ($clientId !== '') {
        $find = db()->prepare('SELECT id FROM inventory_receipts WHERE store_id=:store_id AND client_request_id=:client_id LIMIT 1');
        $find->execute(['store_id' => $storeId, 'client_id' => $clientId]);
        if ($existingId = $find->fetchColumn()) {
            respond_ok(['item' => receipts_full($user, (string) $existingId), 'idempotent' => true]);
        }
    }
    $location = is_array($body['location'] ?? null) ? $body['location'] : [];
    $supplierId = trim((string) ($body['supplierId'] ?? '')) ?: null;
    if ($supplierId !== null) {
        $supplier = db()->prepare(
            'SELECT id FROM suppliers WHERE id=:id AND store_id=:store_id AND is_active=1 LIMIT 1'
        );
        $supplier->execute(['id' => $supplierId, 'store_id' => $storeId]);
        if (!$supplier->fetchColumn()) {
            respond_error('Nhà phân phối không tồn tại tại khu vực này.', 422);
        }
    }
    $orderCreatorName = trim((string) ($body['orderCreatorName'] ?? '')) ?: null;
    $requestedStatus = strtolower(trim((string) ($body['status'] ?? 'draft')));
    if ($requestedStatus === 'pending_explanation' && $orderCreatorName === null) {
        respond_error('Vui lòng nhập tên người chụp bill nhanh.', 422);
    }
    if ($orderCreatorName !== null && mb_strlen($orderCreatorName) > 255) {
        respond_error('Tên người tạo đơn không được vượt quá 255 ký tự.', 422);
    }
    $receiptDate = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
    if (array_key_exists('receiptDate', $body)) {
        if (!field_inventory_is_admin($user)) respond_error('Chỉ admin được chọn ngày nhập minh chứng.', 403);
        $requestedDate = trim((string) $body['receiptDate']);
        $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $requestedDate);
        if (!$parsedDate || $parsedDate->format('Y-m-d') !== $requestedDate) respond_error('Ngày nhập không hợp lệ.', 422);
        $receiptDate = $requestedDate;
    }
    $capturedAt = field_inventory_datetime($body['capturedAt'] ?? null);
    if (array_key_exists('capturedDate', $body)) {
        if (!field_inventory_is_admin($user)) respond_error('Chỉ admin được chọn ngày chụp minh chứng.', 403);
        $capturedDate = trim((string) $body['capturedDate']);
        $parsedCapture = DateTimeImmutable::createFromFormat('!Y-m-d', $capturedDate, new DateTimeZone('Asia/Ho_Chi_Minh'));
        if (!$parsedCapture || $parsedCapture->format('Y-m-d') !== $capturedDate) respond_error('Ngày chụp không hợp lệ.', 422);
        $capturedAt = $parsedCapture->setTime(12, 0)->format('Y-m-d H:i:s');
    }
    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO inventory_receipts (
          id,store_id,supplier_id,order_creator_name,receipt_code,client_request_id,receipt_date,status,note,received_at,captured_at,
          latitude,longitude,location_accuracy,location_address,total_quantity,total_amount,created_by
         ) VALUES (
          :id,:store_id,:supplier_id,:order_creator_name,:code,:client_id,:receipt_date,"draft",:note,:received_at,:captured_at,
          :latitude,:longitude,:accuracy,:address,0,0,:created_by)'
    );
    $statement->execute([
        'id' => $id, 'store_id' => $storeId,
        'supplier_id' => $supplierId,
        'order_creator_name' => $orderCreatorName,
        'code' => products_inventory_generate_receipt_code($storeId),
        'receipt_date' => $receiptDate, 'client_id' => $clientId ?: null, 'note' => trim((string) ($body['note'] ?? '')),
        'received_at' => field_inventory_datetime($body['receivedAt'] ?? null),
        'captured_at' => $capturedAt,
        'latitude' => field_inventory_nullable_decimal($location['latitude'] ?? null),
        'longitude' => field_inventory_nullable_decimal($location['longitude'] ?? null),
        'accuracy' => field_inventory_nullable_decimal($location['accuracy'] ?? null),
        'address' => trim((string) ($location['address'] ?? '')) ?: null, 'created_by' => $user['id'],
    ]);
    respond_ok(['item' => receipts_full($user, $id), 'requiresImageToBecomePending' => (($body['status'] ?? '') === 'pending_explanation')], 201);
}

function receipts_update(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.update');
    $id = trim((string) ($_GET['id'] ?? $body['id'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $id);
    field_inventory_assert_receipt_editable($user, $receipt);
    $adminCorrection = field_inventory_is_admin($user) && $receipt['status'] === 'completed';
    if (!$adminCorrection && !in_array($receipt['status'], ['pending_explanation', 'draft'], true)) {
        respond_error('Phiếu đã khóa, không thể chỉnh sửa.', 409);
    }
    $warehouseType = (string) ($body['warehouseType'] ?? $receipt['warehouse_type'] ?? 'ingredient');
    if (!in_array($warehouseType, ['ingredient', 'equipment'], true)) respond_error('Loại kho không hợp lệ.', 422);
    if ($warehouseType !== ($receipt['warehouse_type'] ?? 'ingredient')) {
        $check = db()->prepare('SELECT COUNT(*) FROM inventory_receipt_items WHERE receipt_id=:id');
        $check->execute(['id' => $id]);
        if ((int) $check->fetchColumn() > 0) respond_error('Vui lòng xóa các dòng hàng trước khi đổi kho.', 409);
    }
    $status = strtolower(trim((string) ($body['status'] ?? $receipt['status'])));
    if (($adminCorrection && $status !== 'completed') || (!$adminCorrection && !in_array($status, ['pending_explanation', 'draft'], true))) {
        respond_error('Chuyển trạng thái không hợp lệ.', 422);
    }
    if ($status === 'pending_explanation') {
        $check = db()->prepare('SELECT COUNT(*) FROM inventory_receipt_images WHERE receipt_id=:id');
        $check->execute(['id' => $id]);
        if ((int) $check->fetchColumn() < 1) {
            respond_error('Phiếu chưa giải trình phải có ít nhất một ảnh watermark.', 422);
        }
    }
    $supplierId = array_key_exists('supplierId', $body)
        ? (trim((string) $body['supplierId']) ?: null)
        : ($receipt['supplier_id'] ?: null);
    if ($supplierId !== null) {
        $supplier = db()->prepare(
            'SELECT id FROM suppliers WHERE id=:id AND store_id=:store_id AND is_active=1 LIMIT 1'
        );
        $supplier->execute(['id' => $supplierId, 'store_id' => $receipt['store_id']]);
        if (!$supplier->fetchColumn()) {
            respond_error('Nhà phân phối không tồn tại tại khu vực này.', 422);
        }
    }
    $orderCreatorName = array_key_exists('orderCreatorName', $body)
        ? trim((string) $body['orderCreatorName'])
        : trim((string) ($receipt['order_creator_name'] ?? ''));
    if (mb_strlen($orderCreatorName) > 255) {
        respond_error('Tên người tạo đơn không được vượt quá 255 ký tự.', 422);
    }
    $statement = db()->prepare('UPDATE inventory_receipts SET warehouse_type=:warehouse_type,status=:status,note=:note,supplier_id=:supplier_id,order_creator_name=:order_creator_name,updated_at=NOW() WHERE id=:id');
    $statement->execute([
        'id' => $id, 'status' => $status, 'warehouse_type' => $warehouseType,
        'note' => trim((string) ($body['note'] ?? $receipt['note'])),
        'supplier_id' => $supplierId,
        'order_creator_name' => $orderCreatorName ?: null,
    ]);
    respond_ok(['item' => receipts_full($user, $id)]);
}

function receipts_complete(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.complete');
    $id = trim((string) ($body['id'] ?? $_GET['id'] ?? ''));
    if ($id === '') respond_error('Thiếu mã phiếu.', 422);
    field_inventory_require_receipt($user, $id);
    db()->beginTransaction();
    try {
        $idempotent = inventory_complete_receipt($id, $user);
        db()->commit();
    } catch (ReceiptValidationException $exception) {
        if (db()->inTransaction()) db()->rollBack();
        respond_error($exception->getMessage(), $exception->status);
    } catch (Throwable $exception) {
        if (db()->inTransaction()) db()->rollBack();
        throw $exception;
    }
    respond_ok(['item' => receipts_full($user, $id), 'idempotent' => $idempotent]);
}

function receipts_cancel(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.cancel');
    $id = trim((string) ($body['id'] ?? $_GET['id'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $id);
    field_inventory_assert_receipt_editable($user, $receipt);
    if ($receipt['status'] === 'completed') respond_error('Không thể hủy phiếu đã hoàn thành.', 409);
    if ($receipt['status'] === 'cancelled') respond_ok(['item' => receipts_full($user, $id), 'idempotent' => true]);
    $statement = db()->prepare(
        'UPDATE inventory_receipts SET status="cancelled",cancelled_by=:actor,cancelled_at=NOW(),
         cancel_reason=:reason,updated_at=NOW() WHERE id=:id'
    );
    $statement->execute(['id' => $id, 'actor' => $user['id'], 'reason' => trim((string) ($body['reason'] ?? '')) ?: null]);
    respond_ok(['item' => receipts_full($user, $id)]);
}

function receipts_lock(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.lock');
    $id = trim((string) ($body['id'] ?? $_GET['id'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $id);
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) respond_error('Chỉ có thể khóa phiếu chưa hoàn thành.', 409);
    db()->prepare('UPDATE inventory_receipts SET locked_at=COALESCE(locked_at,NOW()),locked_by=COALESCE(locked_by,:actor),updated_at=NOW() WHERE id=:id AND status IN ("pending_explanation","draft")')->execute(['id'=>$id,'actor'=>$user['id']]);
    respond_ok(['item'=>receipts_full($user, $id)]);
}

function receipts_unlock(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.unlock');
    $id = trim((string) ($body['id'] ?? $_GET['id'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $id);
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) {
        respond_error('Chỉ có thể mở khóa phiếu chưa hoàn thành.', 409);
    }
    if (!field_inventory_receipt_is_locked($receipt)) {
        respond_ok(['item' => receipts_full($user, $id), 'idempotent' => true]);
    }
    $statement = db()->prepare(
        'UPDATE inventory_receipts
         SET locked_at=NULL,locked_by=NULL,unlocked_at=NOW(),unlocked_by=:actor,updated_at=NOW()
         WHERE id=:id'
    );
    $statement->execute(['id' => $id, 'actor' => $user['id']]);
    respond_ok(['item' => receipts_full($user, $id)]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = strtolower(trim((string) ($_GET['action'] ?? '')));
if ($method === 'GET') receipts_list();
$body = read_json_body();
if ($method === 'POST' && $action === 'complete') receipts_complete($body);
if ($method === 'POST' && $action === 'cancel') receipts_cancel($body);
if ($method === 'POST' && $action === 'lock') receipts_lock($body);
if ($method === 'POST' && $action === 'unlock') receipts_unlock($body);
if ($method === 'POST') receipts_create($body);
if (in_array($method, ['PUT', 'PATCH'], true)) receipts_update($body);
if ($method === 'DELETE') {
    $user = field_inventory_require_permission('inventory_receipts.cancel');
    $id = trim((string) ($_GET['id'] ?? $body['id'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $id);
    if (($receipt['status'] ?? '') === 'deleted') respond_ok(['deleted' => true, 'softDeleted' => true, 'idempotent' => true]);
    $delete = db()->prepare('UPDATE inventory_receipts SET previous_status=status,status="deleted",deleted_at=NOW(),deleted_by=:actor,updated_at=NOW() WHERE id=:id');
    $delete->execute(['id' => $id, 'actor' => $user['id']]);
    respond_ok(['deleted' => true, 'softDeleted' => true]);
}
respond_error('Method not allowed', 405);
