<?php
declare(strict_types=1);

function prepared_transfers_ensure_schema(): void
{
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_prepared_transfers (
        id VARCHAR(64) PRIMARY KEY,source_store_id VARCHAR(32) NOT NULL,destination_store_id VARCHAR(32) NOT NULL,
        source_ingredient_id VARCHAR(64) NOT NULL,destination_ingredient_id VARCHAR(64) NOT NULL,
        ingredient_code VARCHAR(100) NOT NULL,ingredient_name VARCHAR(255) NOT NULL,unit VARCHAR(50) NOT NULL,
        quantity DECIMAL(15,3) NOT NULL,source_before DECIMAL(15,3) NOT NULL,source_after DECIMAL(15,3) NOT NULL,
        destination_before DECIMAL(15,3) NOT NULL,destination_after DECIMAL(15,3) NOT NULL,
        actor VARCHAR(255) NOT NULL,note TEXT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY idx_prepared_transfer_source(source_store_id,created_at),
        KEY idx_prepared_transfer_destination(destination_store_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function prepared_transfer(PDO $pdo, string $source, string $destination, string $actor, array $body): string
{
    $raw = str_replace(',', '.', trim((string)($body['quantity'] ?? '')));
    if ($source === $destination || !is_numeric($raw) || !is_finite((float)$raw) || (float)$raw <= 0 || round((float)$raw, 3) != (float)$raw) {
        throw new RuntimeException('Chọn quầy nhận khác và nhập số lượng dương, tối đa 3 chữ số thập phân.');
    }
    $quantity = (float)$raw;
    $pdo->beginTransaction();
    try {
        $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
        $q = $pdo->prepare('SELECT i.*,COALESCE(NULLIF(i.base_unit,""),i.unit) transfer_unit FROM ingredients i
            WHERE i.store_id=:store AND i.id=:id AND i.is_active=1
            AND EXISTS(SELECT 1 FROM ingredient_components c WHERE c.parent_ingredient_id=i.id)' . $lock);
        $q->execute(['store'=>$source,'id'=>(string)($body['ingredientId']??'')]);
        $from = $q->fetch();
        if (!$from) throw new RuntimeException('Bán thành phẩm không thuộc quầy xuất.');
        $q = $pdo->prepare('SELECT i.*,COALESCE(NULLIF(i.base_unit,""),i.unit) transfer_unit FROM ingredients i
            WHERE i.store_id=:store AND i.ingredient_code=:code AND i.is_active=1
            AND EXISTS(SELECT 1 FROM ingredient_components c WHERE c.parent_ingredient_id=i.id)' . $lock);
        $q->execute(['store'=>$destination,'code'=>$from['ingredient_code']]);
        $to = $q->fetch();
        if (!$to || $from['transfer_unit'] !== $to['transfer_unit']) throw new RuntimeException('Quầy nhận cần có bán thành phẩm cùng mã và đơn vị.');
        $before = (float)$from['preparation_stock_quantity'];
        $received = (float)$to['preparation_stock_quantity'];
        if ($quantity > $before) throw new RuntimeException('Không đủ tồn bán thành phẩm để xuất.');
        if (isset($body['expectedStock']) && abs((float)$body['expectedStock']-$before)>0.0001) throw new RuntimeException('Tồn đã thay đổi. Vui lòng tải lại trước khi xuất.');
        $update = $pdo->prepare('UPDATE ingredients SET preparation_stock_quantity=:quantity,updated_at=NOW() WHERE id=:id');
        $update->execute(['quantity'=>round($before-$quantity,3),'id'=>$from['id']]);
        $update->execute(['quantity'=>round($received+$quantity,3),'id'=>$to['id']]);
        $id = uuidv4();
        $q = $pdo->prepare('INSERT INTO inventory_prepared_transfers
            (id,source_store_id,destination_store_id,source_ingredient_id,destination_ingredient_id,ingredient_code,ingredient_name,unit,quantity,source_before,source_after,destination_before,destination_after,actor,note)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $q->execute([$id,$source,$destination,$from['id'],$to['id'],$from['ingredient_code'],$from['ingredient_name'],$from['transfer_unit'],$quantity,$before,round($before-$quantity,3),$received,round($received+$quantity,3),$actor,trim((string)($body['note']??''))]);
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
