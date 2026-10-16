<?php
declare(strict_types=1);

final class ReceiptValidationException extends RuntimeException
{
    public int $status;
    public function __construct(string $message, int $status = 422)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

/** Complete a receipt exactly once. Caller must commit or roll back the entire transaction. */
function inventory_complete_receipt(string $id, array $user): bool
{
    if (!db()->inTransaction()) throw new LogicException('Receipt completion requires a transaction.');
    $receipt = field_inventory_load_receipt($id, true);
    if (!$receipt) throw new ReceiptValidationException('Không tìm thấy phiếu nhập.', 404);
    $linkedTarget = db()->prepare('SELECT id FROM inventory_receipts WHERE evidence_receipt_id=:id AND (status<>"deleted" OR previous_status="completed") LIMIT 1');
    $linkedTarget->execute(['id' => $id]);
    if ($linkedTarget->fetchColumn()) throw new ReceiptValidationException('Minh chứng đã gắn với phiếu nhập. Hãy mở phiếu nhập liên kết để tránh cộng tồn hai lần.', 409);
    if ($receipt['status'] === 'completed') return true;
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) {
        throw new ReceiptValidationException('Không thể hoàn thành phiếu ở trạng thái hiện tại.', 409);
    }
    if (!field_inventory_can_edit_receipt($user, $receipt)) {
        throw new ReceiptValidationException('Phiếu đã tự động khóa sau 24 giờ. Chỉ admin mới có thể giải trình hoặc mở khóa.', 423);
    }
    if (($receipt['entry_source'] ?? 'mobile_photo') !== 'web_manual' && trim((string) ($receipt['supplier_id'] ?? '')) === '') {
        throw new ReceiptValidationException('Vui lòng chọn nhà phân phối trước khi hoàn thành.');
    }
    if (trim((string) ($receipt['order_creator_name'] ?? '')) === '') {
        throw new ReceiptValidationException('Vui lòng nhập tên người tạo đơn trước khi hoàn thành.');
    }
    $evidenceId = trim((string) ($receipt['evidence_receipt_id'] ?? ''));
    if ($evidenceId !== '') {
        $source = field_inventory_load_receipt($evidenceId, true);
        if (!$source || $source['store_id'] !== $receipt['store_id'] || in_array($source['status'], ['completed', 'cancelled', 'deleted'], true)) {
            throw new ReceiptValidationException('Minh chứng không còn khả dụng.', 409);
        }
        $checkLink = db()->prepare('SELECT id FROM inventory_receipts WHERE evidence_receipt_id=:source AND id<>:target AND (status<>"deleted" OR previous_status="completed") LIMIT 1');
        $checkLink->execute(['source'=>$evidenceId, 'target'=>$id]);
        if ($checkLink->fetchColumn()) throw new ReceiptValidationException('Minh chứng đã liên kết với phiếu khác.', 409);
    }
    if (($receipt['entry_source'] ?? 'mobile_photo') !== 'web_manual' || $evidenceId !== '') {
        $imageCheck = db()->prepare('SELECT COUNT(*) FROM inventory_receipt_images WHERE receipt_id=:id');
        $imageCheck->execute(['id' => $evidenceId ?: $id]);
        if ((int) $imageCheck->fetchColumn() < 1) throw new ReceiptValidationException('Cần ít nhất một ảnh minh chứng.');
    }
    $query = db()->prepare(
        'SELECT i.id,i.ingredient_id,i.item_type,i.quantity,i.unit_cost,p.stock_quantity,p.store_id,p.item_kind,
                COALESCE(NULLIF(p.base_unit,""),p.unit) base_unit,
                GREATEST(COALESCE(p.purchase_to_base_factor,1),0.000001) conversion_factor
         FROM inventory_receipt_items i LEFT JOIN ingredients p ON p.id=i.ingredient_id
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
        if (!is_finite($quantity) || !is_finite($price) || $quantity <= 0 || $price < 0) {
            throw new ReceiptValidationException('Dòng hàng không hợp lệ hoặc sản phẩm không thuộc khu vực.');
        }
        $lineTotal = round($quantity * $price, 2);
        $updateLine->execute(['id' => $item['id'], 'total' => $lineTotal]);
        if (($item['item_type'] ?? 'ingredient') === 'equipment') {
            $totalQuantity += $quantity;
            $totalAmount += $lineTotal;
            continue;
        }
        if (!$item['ingredient_id'] || $item['store_id'] !== $receipt['store_id']) {
            throw new ReceiptValidationException('Nguyen lieu khong con ton tai hoac khong thuoc khu vuc.');
        }
        if (($item['item_kind'] ?? 'ingredient') === 'fresh') {
            $totalQuantity += $quantity;
            $totalAmount += $lineTotal;
            continue;
        }
        $lockStock = db()->prepare('SELECT stock_quantity FROM ingredients WHERE id=:id FOR UPDATE');
        $lockStock->execute(['id'=>$item['ingredient_id']]);
        $currentStock = $lockStock->fetchColumn();
        if ($currentStock === false) throw new ReceiptValidationException('Không tìm thấy nguyên liệu.');
        $item['stock_quantity'] = (float) $currentStock;
        $after = round((float) $item['stock_quantity'] + $baseQuantity, 3);
        $baseCost = round($price / (float) $item['conversion_factor'], 6);
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
    return false;
}
