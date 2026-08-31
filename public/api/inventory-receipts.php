<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

auth_ensure_column('inventory_receipts', 'order_creator_name', 'VARCHAR(255) NULL AFTER supplier_id');
auth_ensure_column('inventory_receipts', 'locked_at', 'DATETIME NULL AFTER order_creator_name');
auth_ensure_column('inventory_receipts', 'locked_by', 'VARCHAR(64) NULL AFTER locked_at');
auth_ensure_column('inventory_receipts', 'unlocked_at', 'DATETIME NULL AFTER locked_by');
auth_ensure_column('inventory_receipts', 'unlocked_by', 'VARCHAR(64) NULL AFTER unlocked_at');
auth_ensure_column('inventory_receipts', 'entry_source', "ENUM('mobile_photo','web_manual') NOT NULL DEFAULT 'mobile_photo' AFTER receipt_date");

final class ReceiptValidationException extends RuntimeException
{
    public int $status;
    public function __construct(string $message, int $status = 422)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function receipts_store(array $body = []): string
{
    return trim((string) ($body['areaId'] ?? $body['storeId'] ?? $_GET['areaId'] ?? $_GET['storeId'] ?? ''));
}

function receipts_full(array $user, string $id): array
{
    $row = field_inventory_require_receipt($user, $id);
    return field_inventory_receipt_payload($row, field_inventory_load_items($id), field_inventory_load_images($id), $user);
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
    $params = [];
    $allowedSql = [];
    foreach ($allowed as $index => $value) {
        $key = 'area_' . $index;
        $allowedSql[] = ':' . $key;
        $params[$key] = $value;
    }
    $where[] = 'r.store_id IN (' . implode(',', $allowedSql) . ')';

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
    foreach (['dateFrom' => ['r.created_at >= :date_from', 'date_from', ' 00:00:00'],
              'dateTo' => ['r.created_at <= :date_to', 'date_to', ' 23:59:59']] as $queryKey => $definition) {
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
        $needle = '%' . $keyword . '%';
        $where[] = '(r.receipt_code LIKE :keyword_code OR r.note LIKE :keyword_note OR r.location_address LIKE :keyword_address)';
        $params['keyword_code'] = $needle;
        $params['keyword_note'] = $needle;
        $params['keyword_address'] = $needle;
    }
    $productKeyword = trim((string) ($_GET['productKeyword'] ?? ''));
    if ($productKeyword !== '') {
        $needle = '%' . $productKeyword . '%';
        $where[] = 'EXISTS (SELECT 1 FROM inventory_receipt_items si WHERE si.receipt_id=r.id AND (si.product_code LIKE :product_code OR si.product_name LIKE :product_name))';
        $params['product_code'] = $needle;
        $params['product_name'] = $needle;
    }
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
    $items = array_map(static function (array $row) use ($user): array {
        $item = field_inventory_receipt_payload($row, [], [], $user);
        $item['itemCount'] = (int) $row['item_count'];
        $item['imageCount'] = (int) $row['image_count'];
        $item['thumbnailUrl'] = $row['thumbnail_id'] ? '/api/inventory-receipt-images.php?id=' . rawurlencode($row['thumbnail_id']) . '&size=thumbnail' : null;
        $item['capturedByName'] = $row['captured_by_name'] ?: null;
        return $item;
    }, $statement->fetchAll());

    $counts = array_fill_keys(FIELD_RECEIPT_STATUSES, 0);
    $allowedParams = array_filter($params, static fn(string $key): bool => strpos($key, 'area_') === 0, ARRAY_FILTER_USE_KEY);
    $countWhere = 'r.store_id IN (' . implode(',', $allowedSql) . ')';
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
    respond_ok(['items' => $items, 'counts' => $counts, 'pagination' => [
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
    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO inventory_receipts (
          id,store_id,supplier_id,order_creator_name,receipt_code,client_request_id,receipt_date,status,note,received_at,captured_at,
          latitude,longitude,location_accuracy,location_address,total_quantity,total_amount,created_by
         ) VALUES (
          :id,:store_id,:supplier_id,:order_creator_name,:code,:client_id,CURDATE(),"draft",:note,:received_at,:captured_at,
          :latitude,:longitude,:accuracy,:address,0,0,:created_by)'
    );
    $statement->execute([
        'id' => $id, 'store_id' => $storeId,
        'supplier_id' => $supplierId,
        'order_creator_name' => $orderCreatorName,
        'code' => products_inventory_generate_receipt_code($storeId),
        'client_id' => $clientId ?: null, 'note' => trim((string) ($body['note'] ?? '')),
        'received_at' => field_inventory_datetime($body['receivedAt'] ?? null),
        'captured_at' => field_inventory_datetime($body['capturedAt'] ?? null),
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
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) {
        respond_error('Phiếu đã khóa, không thể chỉnh sửa.', 409);
    }
    $status = strtolower(trim((string) ($body['status'] ?? $receipt['status'])));
    if (!in_array($status, ['pending_explanation', 'draft'], true)) {
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
    $statement = db()->prepare('UPDATE inventory_receipts SET status=:status,note=:note,supplier_id=:supplier_id,order_creator_name=:order_creator_name,updated_at=NOW() WHERE id=:id');
    $statement->execute([
        'id' => $id, 'status' => $status,
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
        $receipt = field_inventory_load_receipt($id, true);
        if (!$receipt) throw new ReceiptValidationException('Không tìm thấy phiếu nhập.', 404);
        if ($receipt['status'] === 'completed') {
            db()->commit();
            respond_ok(['item' => receipts_full($user, $id), 'idempotent' => true]);
        }
        if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) {
            throw new ReceiptValidationException('Không thể hoàn thành phiếu ở trạng thái hiện tại.', 409);
        }
        if (!field_inventory_can_edit_receipt($user, $receipt)) {
            throw new ReceiptValidationException('Phiếu đã tự động khóa sau 24 giờ. Chỉ admin mới có thể giải trình hoặc mở khóa.', 423);
        }
        if (trim((string) ($receipt['supplier_id'] ?? '')) === '') {
            throw new ReceiptValidationException('Vui lòng chọn nhà phân phối trước khi hoàn thành.');
        }
        if (trim((string) ($receipt['order_creator_name'] ?? '')) === '') {
            throw new ReceiptValidationException('Vui lòng nhập tên người tạo đơn trước khi hoàn thành.');
        }
        $imageCheck = db()->prepare('SELECT COUNT(*) FROM inventory_receipt_images WHERE receipt_id=:id');
        $imageCheck->execute(['id' => $id]);
        if ((int) $imageCheck->fetchColumn() < 1) {
            throw new ReceiptValidationException('Cần ít nhất một ảnh watermark.');
        }
        $query = db()->prepare(
            'SELECT i.id,i.ingredient_id,i.quantity,i.unit_cost,p.stock_quantity,p.store_id,
                    COALESCE(NULLIF(p.base_unit,""),p.unit) base_unit,
                    GREATEST(COALESCE(p.purchase_to_base_factor,1),0.000001) conversion_factor
             FROM inventory_receipt_items i INNER JOIN ingredients p ON p.id=i.ingredient_id
             WHERE i.receipt_id=:id ORDER BY i.id FOR UPDATE'
        );
        $query->execute(['id' => $id]);
        $items = $query->fetchAll();
        if ($items === []) {
            throw new ReceiptValidationException('Cần ít nhất một dòng hàng.');
        }
        $updateLine = db()->prepare('UPDATE inventory_receipt_items SET line_total=:total,updated_at=NOW() WHERE id=:id');
        $updateStock = db()->prepare('UPDATE ingredients SET stock_quantity=:stock,cost=:cost WHERE id=:id');
        $movement = db()->prepare(
            'INSERT INTO inventory_stock_movements
             (id,receipt_id,receipt_item_id,store_id,product_id,ingredient_id,quantity,stock_before,stock_after,created_by)
             VALUES (:id,:receipt,:item,:store,NULL,:ingredient,:quantity,:before,:after,:actor)'
        );
        $totalQuantity = 0.0;
        $totalAmount = 0.0;
        foreach ($items as $item) {
            $quantity = (float) $item['quantity'];
            $baseQuantity = round($quantity * (float) $item['conversion_factor'], 3);
            $price = (float) $item['unit_cost'];
            if ($quantity <= 0 || $price < 0 || $item['store_id'] !== $receipt['store_id']) {
                throw new ReceiptValidationException('Dòng hàng không hợp lệ hoặc sản phẩm không thuộc khu vực.');
            }
            $lineTotal = round($quantity * $price, 2);
            $after = round((float) $item['stock_quantity'] + $baseQuantity, 3);
            $baseCost = round($price / (float) $item['conversion_factor'], 6);
            $updateLine->execute(['id' => $item['id'], 'total' => $lineTotal]);
            $updateStock->execute(['id' => $item['ingredient_id'], 'stock' => $after, 'cost' => $baseCost]);
            $movement->execute([
                'id' => uuidv4(), 'receipt' => $id, 'item' => $item['id'], 'store' => $receipt['store_id'],
                'ingredient' => $item['ingredient_id'], 'quantity' => $baseQuantity, 'before' => $item['stock_quantity'],
                'after' => $after, 'actor' => $user['id'],
            ]);
            $totalQuantity += $quantity;
            $totalAmount += $lineTotal;
        }
        $complete = db()->prepare(
            'UPDATE inventory_receipts SET status="completed",total_quantity=:quantity,total_amount=:amount,
             completed_by=:name,completed_by_user_id=:actor,completed_at=NOW(),updated_at=NOW() WHERE id=:id'
        );
        $complete->execute([
            'id' => $id, 'quantity' => round($totalQuantity, 3), 'amount' => round($totalAmount, 2),
            'name' => $user['displayName'] ?? $user['email'], 'actor' => $user['id'],
        ]);
        db()->commit();
    } catch (ReceiptValidationException $exception) {
        if (db()->inTransaction()) db()->rollBack();
        respond_error($exception->getMessage(), $exception->status);
    } catch (Throwable $exception) {
        if (db()->inTransaction()) db()->rollBack();
        throw $exception;
    }
    respond_ok(['item' => receipts_full($user, $id)]);
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

function receipts_unlock(array $body): void
{
    $user = field_inventory_require_permission('inventory_receipts.update');
    if (!field_inventory_is_admin($user)) {
        respond_error('Chỉ admin mới có thể mở khóa phiếu.', 403);
    }
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
if ($method === 'POST' && $action === 'unlock') receipts_unlock($body);
if ($method === 'POST') receipts_create($body);
if (in_array($method, ['PUT', 'PATCH'], true)) receipts_update($body);
if ($method === 'DELETE') {
    $user = field_inventory_require_permission('inventory_receipts.cancel');
    $id = trim((string) ($_GET['id'] ?? $body['id'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $id);
    field_inventory_assert_receipt_editable($user, $receipt);
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) respond_error('Chỉ có thể xóa phiếu chưa hoàn thành.', 409);
    $delete = db()->prepare('DELETE FROM inventory_receipts WHERE id=:id');
    $delete->execute(['id' => $id]);
    respond_ok(['deleted' => true]);
}
respond_error('Method not allowed', 405);
