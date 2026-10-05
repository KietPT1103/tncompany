<?php
declare(strict_types=1);
require_once __DIR__ . '/inventory_issue_quantities.php';

function inventory_issue_validate_correction(string $role, array $issue, ?int $revision, string $action, string $reason): void
{
    if ($issue['status'] === 'cancelled') throw new RuntimeException('Phiếu đã hủy, không thể sửa hoặc hủy lần nữa.');
    if (($action === 'cancel' || $issue['status'] === 'completed') && $role !== 'admin') {
        throw new RuntimeException('Chỉ admin được sửa phiếu đã hoàn thành hoặc hủy phiếu.');
    }
    if ($revision === null || $revision !== (int) ($issue['revision'] ?? 0)) {
        throw new RuntimeException('Phiếu đã thay đổi. Vui lòng tải lại dữ liệu trước khi tiếp tục.');
    }
    if ($action === 'cancel' && trim($reason) === '') throw new RuntimeException('Vui lòng nhập lý do hủy phiếu.');
    if (mb_strlen($reason) > 1000) throw new RuntimeException('Lý do hủy tối đa 1000 ký tự.');
}

/** Caller holds the issue lock and transaction. Saved snapshots determine whether old stock was deducted. */
function inventory_issue_apply_corrected_stock(PDO $pdo, string $storeId, array $oldItems, array $newLines): array
{
    if (!$pdo->inTransaction()) throw new RuntimeException('Điều chỉnh tồn phải nằm trong giao dịch.');
    $restores = [];
    foreach ($oldItems as $item) {
        if ($item['stockBefore'] !== null) {
            $id = $item['ingredientId'];
            $restores[$id] = ($restores[$id] ?? 0) + (float) ($item['baseQuantity'] ?? $item['quantity']);
        }
    }
    $newById = [];
    foreach ($newLines as $line) $newById[$line['ingredient']['id']] = $line;
    $ids = array_unique(array_merge(array_keys($restores), array_keys($newById)));
    sort($ids, SORT_STRING);
    $lockSuffix = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
    $lock = $pdo->prepare('SELECT * FROM ingredients WHERE id=:id AND store_id=:store' . $lockSuffix);
    $update = $pdo->prepare('UPDATE ingredients SET stock_quantity=:stock,updated_at=NOW() WHERE id=:id AND store_id=:store');
    $snapshots = [];
    foreach ($ids as $id) {
        $lock->execute(['id'=>$id, 'store'=>$storeId]);
        $ingredient = $lock->fetch();
        $lock->closeCursor();
        if (!$ingredient) throw new RuntimeException('Không tìm thấy nguyên liệu của phiếu.');
        $line = $newById[$id] ?? null;
        $base = $line ? inventory_issue_base_quantity((float) $line['quantity'], max(0.000001, (float) ($ingredient['purchase_to_base_factor'] ?? 1))) : 0.0;
        $stocked = $line && ($ingredient['item_kind'] ?? 'ingredient') !== 'fresh';
        $before = round((float) $ingredient['stock_quantity'] + ($restores[$id] ?? 0), 3);
        $after = round($before - ($stocked ? $base : 0), 3);
        if ($after < 0) throw new RuntimeException('Không đủ tồn kho cho nguyên liệu ' . $ingredient['ingredient_code'] . '.');
        if (isset($restores[$id]) || $stocked) $update->execute(['id'=>$id, 'store'=>$storeId, 'stock'=>$after]);
        if ($line) $snapshots[$id] = ['before'=>$stocked ? $before : null, 'after'=>$stocked ? $after : null, 'baseQuantity'=>$base];
    }
    return $snapshots;
}