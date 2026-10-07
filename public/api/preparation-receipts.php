<?php
declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';
require_once __DIR__ . '/_lib/preparation_receipt_cancellations.php';

function preparation_receipts_ensure_schema(): void
{
    ingredients_ensure_schema();
    auth_ensure_column('inventory_issues', 'revision', 'INT UNSIGNED NOT NULL DEFAULT 0');
    auth_ensure_column('inventory_issues', 'shift_id', 'VARCHAR(64) NULL AFTER created_by');
    auth_ensure_column('inventory_issues', 'shift_type', 'VARCHAR(20) NULL AFTER shift_id');
    auth_ensure_column('inventory_issues', 'requires_preparation_receipt', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER shift_type');
    db()->exec('CREATE TABLE IF NOT EXISTS preparation_receipts (
        id VARCHAR(64) PRIMARY KEY, store_id VARCHAR(32) NOT NULL, issue_id VARCHAR(64) NOT NULL,
        receipt_code VARCHAR(100) NOT NULL, receipt_date DATE NOT NULL, received_by VARCHAR(255) NOT NULL,
        note TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_preparation_receipt_issue (issue_id),
        UNIQUE KEY uniq_preparation_receipt_code (store_id,receipt_code),
        KEY idx_preparation_receipts_store_date (store_id,receipt_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS preparation_receipt_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, receipt_id VARCHAR(64) NOT NULL,
        ingredient_id VARCHAR(64) NOT NULL, ingredient_code VARCHAR(100) NOT NULL,
        ingredient_name VARCHAR(255) NOT NULL, unit VARCHAR(50) NULL,
        expected_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_preparation_receipt_items_receipt (receipt_id),
        CONSTRAINT fk_preparation_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES preparation_receipts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    preparation_receipts_ensure_cancellation_schema();
}

function preparation_receipts_actor(array $user): string
{
    return trim((string) ($user['displayName'] ?? $user['display_name'] ?? $user['username'] ?? $user['email'] ?? $user['id'] ?? ''));
}

function preparation_receipts_code(string $storeId): string
{
    $prefix = 'NPC-' . date('Ym') . '-';
    $statement = db()->prepare('SELECT receipt_code FROM preparation_receipts WHERE store_id=:store AND receipt_code LIKE :prefix ORDER BY receipt_code DESC LIMIT 1');
    $statement->execute(['store' => $storeId, 'prefix' => $prefix . '%']);
    $last = (string) ($statement->fetchColumn() ?: '');
    return $prefix . str_pad((string) ((int) substr($last, -4) + 1), 4, '0', STR_PAD_LEFT);
}

function preparation_issue_items(string $issueId): array
{
    $statement = db()->prepare('SELECT ii.ingredient_id,ii.ingredient_code,ii.ingredient_name,
        ii.quantity issued_quantity,ii.unit issued_unit,
        COALESCE(NULLIF(i.base_unit,""),i.unit,ii.unit) unit,
        COALESCE(ii.base_quantity,ii.quantity) expected_quantity
        FROM inventory_issue_items ii
        LEFT JOIN ingredients i ON i.id=ii.ingredient_id
        WHERE ii.issue_id=:issue AND COALESCE(i.item_kind,"ingredient")<>"fresh" ORDER BY ii.id');
    $statement->execute(['issue' => $issueId]);
    return array_map(static fn(array $row): array => [
        'ingredientId' => (string) $row['ingredient_id'],
        'ingredientCode' => (string) $row['ingredient_code'],
        'ingredientName' => (string) $row['ingredient_name'],
        'unit' => (string) ($row['unit'] ?? ''),
        'issuedQuantity' => (float) $row['issued_quantity'],
        'issuedUnit' => (string) ($row['issued_unit'] ?? ''),
        'expectedQuantity' => (float) $row['expected_quantity'],
    ], $statement->fetchAll());
}

preparation_receipts_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = auth_require_permission('preparation_receipts.access');

if ($method === 'GET') {
    $storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
    if ($storeId === 'warehouse') respond_error('Kho thợ không sử dụng kho pha chế.', 422);
    $dateParams = ['store' => $storeId]; $pendingDates = ''; $historyDates = '';
    foreach (['dateFrom' => '>=', 'dateTo' => '<='] as $key => $operator) {
        $value = trim((string) ($_GET[$key] ?? ''));
        if ($value === '') continue;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) respond_error('Ngày lọc không hợp lệ.', 422);
        $dateParams[$key] = $value;
        $pendingDates .= " AND issue_date $operator :$key";
        $historyDates .= " AND r.receipt_date $operator :$key";
    }
    if (isset($dateParams['dateFrom'], $dateParams['dateTo']) && $dateParams['dateFrom'] > $dateParams['dateTo']) respond_error('Khoảng ngày không hợp lệ.', 422);
    $pendingStatement = db()->prepare('SELECT id,issue_code,issue_date,destination,issued_by,completed_at
        FROM inventory_issues WHERE store_id=:store AND status="completed" AND requires_preparation_receipt=1
        ' . $pendingDates . ' ORDER BY completed_at ASC');
    $pendingStatement->execute($dateParams);
    $pending = array_map(static function (array $row): array {
        return [
            'issueId' => (string) $row['id'], 'issueCode' => (string) $row['issue_code'],
            'issueDate' => (string) $row['issue_date'], 'destination' => (string) $row['destination'],
            'issuedBy' => (string) ($row['issued_by'] ?? ''), 'completedAt' => $row['completed_at'] ?: null,
            'items' => preparation_issue_items((string) $row['id']),
        ];
    }, $pendingStatement->fetchAll());

    $historyStatement = db()->prepare('SELECT r.id,r.issue_id,r.receipt_code,r.receipt_date,r.received_by,r.note,r.created_at,r.status,r.cancel_reason,r.cancelled_by,r.cancelled_at,
        i.issue_code FROM preparation_receipts r LEFT JOIN inventory_issues i ON i.id=r.issue_id
        WHERE r.store_id=:store' . $historyDates . ' ORDER BY r.created_at DESC,r.id DESC');
    $historyStatement->execute($dateParams);
    $itemStatement = db()->prepare('SELECT ingredient_code,ingredient_name,unit,expected_quantity,actual_quantity FROM preparation_receipt_items WHERE receipt_id=:receipt ORDER BY id');
    $history = array_map(static function (array $row) use ($itemStatement): array {
        $itemStatement->execute(['receipt' => $row['id']]);
        $items = array_map(static fn(array $item): array => [
            'ingredientCode' => (string) $item['ingredient_code'], 'ingredientName' => (string) $item['ingredient_name'],
            'unit' => (string) ($item['unit'] ?? ''), 'expectedQuantity' => (float) $item['expected_quantity'],
            'actualQuantity' => (float) $item['actual_quantity'],
        ], $itemStatement->fetchAll());
        return [
            'id' => (string) $row['id'], 'issueId' => (string) $row['issue_id'],
            'issueCode' => (string) ($row['issue_code'] ?? ''), 'receiptCode' => (string) $row['receipt_code'],
            'receiptDate' => (string) $row['receipt_date'], 'receivedBy' => (string) $row['received_by'],
            'note' => (string) ($row['note'] ?? ''), 'createdAt' => (string) $row['created_at'], 'items' => $items,
            'status' => (string) $row['status'], 'cancelReason' => (string) ($row['cancel_reason'] ?? ''),
            'cancelledBy' => $row['cancelled_by'] ?: null, 'cancelledAt' => $row['cancelled_at'] ?: null,
        ];
    }, $historyStatement->fetchAll());
    respond_ok(['pending' => $pending, 'history' => $history]);
}

if ($method !== 'POST') respond_error('Method not allowed', 405);
$body = read_json_body();
$storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));
if ($storeId === 'warehouse') respond_error('Kho thợ không sử dụng kho pha chế.', 422);
if (($body['action'] ?? '') === 'cancel') {
    if ($user['role'] !== 'admin') respond_error('Chỉ admin được hủy phiếu nhận kho pha chế.', 403);
    $receiptId = trim((string) ($body['id'] ?? ''));
    $reason = trim((string) ($body['reason'] ?? ''));
    if ($receiptId === '' || $reason === '' || mb_strlen($reason) > 1000) respond_error('Vui lòng nhập lý do hủy (tối đa 1000 ký tự).', 422);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $find = $pdo->prepare('SELECT issue_id FROM preparation_receipts WHERE id=:id AND store_id=:store');
        $find->execute(['id'=>$receiptId,'store'=>$storeId]);
        $issueId = $find->fetchColumn();
        if (!$issueId) throw new RuntimeException('Không tìm thấy phiếu nhận.');
        // Same lock order as receiving and correcting: issue, receipt, ingredients.
        $lockIssue = $pdo->prepare('SELECT status FROM inventory_issues WHERE id=:id AND store_id=:store FOR UPDATE');
        $lockIssue->execute(['id'=>$issueId,'store'=>$storeId]);
        if ($lockIssue->fetchColumn() !== 'completed') throw new RuntimeException('Phiếu xuất liên quan không còn hợp lệ.');
        $lockReceipt = $pdo->prepare('SELECT status FROM preparation_receipts WHERE id=:id AND store_id=:store FOR UPDATE');
        $lockReceipt->execute(['id'=>$receiptId,'store'=>$storeId]);
        if ($lockReceipt->fetchColumn() !== 'completed') throw new RuntimeException('Phiếu nhận đã hủy, không thể hủy lần nữa.');
        $lines = $pdo->prepare('SELECT ingredient_id,SUM(actual_quantity) quantity FROM preparation_receipt_items WHERE receipt_id=:id GROUP BY ingredient_id ORDER BY ingredient_id');
        $lines->execute(['id'=>$receiptId]);
        $items = $lines->fetchAll();
        $lock = $pdo->prepare('SELECT preparation_stock_quantity,ingredient_code FROM ingredients WHERE id=:id AND store_id=:store FOR UPDATE');
        $subtract = $pdo->prepare('UPDATE ingredients SET preparation_stock_quantity=:quantity,updated_at=NOW() WHERE id=:id AND store_id=:store');
        foreach ($items as $item) {
            $lock->execute(['id'=>$item['ingredient_id'],'store'=>$storeId]);
            $ingredient = $lock->fetch();
            $lock->closeCursor();
            if (!$ingredient) throw new RuntimeException('Không tìm thấy nguyên liệu của phiếu nhận.');
            $after = round((float)$ingredient['preparation_stock_quantity'] - (float)$item['quantity'], 3);
            if ($after < 0) throw new RuntimeException('Tồn pha chế của ' . $ingredient['ingredient_code'] . ' không đủ để hủy phiếu.');
            $subtract->execute(['id'=>$item['ingredient_id'],'store'=>$storeId,'quantity'=>$after]);
        }
        $pdo->prepare('UPDATE preparation_receipts SET status="cancelled",cancel_reason=:reason,cancelled_by=:actor,cancelled_at=NOW() WHERE id=:id')
            ->execute(['id'=>$receiptId,'reason'=>$reason,'actor'=>preparation_receipts_actor($user)]);
        $pdo->prepare('UPDATE inventory_issues SET requires_preparation_receipt=1,revision=revision+1,updated_at=NOW() WHERE id=:id')->execute(['id'=>$issueId]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond_error($exception->getMessage(), 409);
    }
    respond_ok(['cancelled'=>true,'issueId'=>$issueId]);
}
if (isset($body['action'])) respond_error('Thao tác không hợp lệ.', 422);
$issueId = trim((string) ($body['issueId'] ?? ''));
$receivedBy = trim((string) ($body['receivedBy'] ?? ''));
$rawItems = is_array($body['items'] ?? null) ? $body['items'] : [];
if ($issueId === '' || $rawItems === []) respond_error('Vui lòng chọn phiếu xuất và nhập số lượng thực nhận.', 422);
if ($receivedBy === '') respond_error('Vui lòng nhập tên người nhận.', 422);
$received = [];
foreach ($rawItems as $item) {
    $ingredientId = trim((string) ($item['ingredientId'] ?? ''));
    $quantity = round((float) str_replace(',', '.', (string) ($item['actualQuantity'] ?? 0)), 3);
    if ($ingredientId === '' || $quantity < 0) respond_error('Số lượng nhận không hợp lệ.', 422);
    $received[$ingredientId] = $quantity;
}

$pdo = db();
$pdo->beginTransaction();
try {
    $issueStatement = $pdo->prepare('SELECT * FROM inventory_issues WHERE id=:id AND store_id=:store FOR UPDATE');
    $issueStatement->execute(['id' => $issueId, 'store' => $storeId]);
    $issue = $issueStatement->fetch();
    if (!$issue || $issue['status'] !== 'completed' || (int) $issue['requires_preparation_receipt'] !== 1) {
        throw new RuntimeException('Phiếu xuất không còn chờ quầy pha chế nhận.');
    }
    $activeReceipt = $pdo->prepare('SELECT id FROM preparation_receipts WHERE issue_id=:id AND status="completed" LIMIT 1');
    $activeReceipt->execute(['id'=>$issueId]);
    if ($activeReceipt->fetchColumn()) throw new RuntimeException('Phiếu xuất đã được nhận.');
    $lines = preparation_issue_items($issueId);
    if (count($received) !== count($lines)) throw new RuntimeException('Vui lòng nhập đủ số lượng cho tất cả nguyên liệu.');
    $receiptId = uuidv4();
    $pdo->prepare('INSERT INTO preparation_receipts(id,store_id,issue_id,receipt_code,receipt_date,received_by,note) VALUES(:id,:store,:issue,:code,:date,:actor,:note)')
        ->execute(['id' => $receiptId, 'store' => $storeId, 'issue' => $issueId, 'code' => preparation_receipts_code($storeId), 'date' => date('Y-m-d'), 'actor' => $receivedBy, 'note' => trim((string) ($body['note'] ?? ''))]);
    $insert = $pdo->prepare('INSERT INTO preparation_receipt_items(receipt_id,ingredient_id,ingredient_code,ingredient_name,unit,expected_quantity,actual_quantity) VALUES(:receipt,:ingredient,:code,:name,:unit,:expected,:actual)');
    $addStock = $pdo->prepare('UPDATE ingredients SET preparation_stock_quantity=preparation_stock_quantity+:quantity,updated_at=NOW() WHERE id=:ingredient AND store_id=:store');
    foreach ($lines as $line) {
        $ingredientId = $line['ingredientId'];
        if (!array_key_exists($ingredientId, $received)) throw new RuntimeException('Thiếu nguyên liệu ' . $line['ingredientCode'] . '.');
        $actual = $received[$ingredientId];
        $insert->execute(['receipt' => $receiptId, 'ingredient' => $ingredientId, 'code' => $line['ingredientCode'], 'name' => $line['ingredientName'], 'unit' => $line['unit'], 'expected' => $line['expectedQuantity'], 'actual' => $actual]);
        $addStock->execute(['quantity' => $actual, 'ingredient' => $ingredientId, 'store' => $storeId]);
    }
    $pdo->prepare('UPDATE inventory_issues SET requires_preparation_receipt=0,updated_at=NOW() WHERE id=:id')->execute(['id' => $issueId]);
    $pdo->commit();
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond_error($exception->getMessage(), 422);
}
respond_ok(['id' => $receiptId], 201);
