<?php
declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

function prepared_stock_ensure_schema(): void
{
    ingredients_ensure_schema();
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_prepared_counts (
        id VARCHAR(64) PRIMARY KEY,store_id VARCHAR(32) NOT NULL,count_date DATE NOT NULL,
        note TEXT NULL,created_by VARCHAR(255) NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_inventory_prepared_counts_store_date(store_id,count_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_prepared_count_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,count_id VARCHAR(64) NOT NULL,
        ingredient_id VARCHAR(64) NOT NULL,actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
        UNIQUE KEY uniq_inventory_prepared_count_item(count_id,ingredient_id),
        KEY idx_inventory_prepared_count_items_ingredient(ingredient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function prepared_stock_date(string $value, string $fallback): string
{
    $value = trim($value) ?: $fallback;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) respond_error('Ngày kiểm tồn không hợp lệ.', 422);
    return $value;
}

function prepared_stock_actor(array $user): string
{
    return trim((string) ($user['displayName'] ?? $user['display_name'] ?? $user['username'] ?? $user['email'] ?? $user['id'] ?? ''));
}

function prepared_stock_business_today(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
}

prepared_stock_ensure_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = auth_require_permission('inventory_prepared_closings.access');

if ($method === 'POST') {
    $body = read_json_body();
    $storeId = field_inventory_require_store($user, trim((string) ($body['storeId'] ?? '')));
    if ($storeId === 'warehouse') respond_error('Kho thợ không sử dụng tồn bán thành phẩm.', 422);
    $today = prepared_stock_business_today();
    $countDate = prepared_stock_date((string) ($body['countDate'] ?? ''), $today);
    if ($countDate > $today) respond_error('Không thể chốt tồn cho ngày tương lai.', 422);
    if ($countDate < $today && ($user['role'] ?? '') !== 'admin' && !auth_has_permission($user, 'inventory_closings.edit_past')) {
        respond_error('Ngày chốt đã khóa. Chỉ admin hoặc tài khoản có quyền sửa chốt kho quá ngày được chỉnh sửa.', 403);
    }
    $rawItems = is_array($body['items'] ?? null) ? $body['items'] : [];
    if ($rawItems === []) respond_error('Vui lòng nhập tồn bán thành phẩm.', 422);
    $pdo = db(); $pdo->beginTransaction();
    try {
        $countId = uuidv4();
        $pdo->prepare('INSERT INTO inventory_prepared_counts(id,store_id,count_date,note,created_by) VALUES(:id,:store,:date,:note,:actor)')
            ->execute(['id'=>$countId,'store'=>$storeId,'date'=>$countDate,'note'=>trim((string)($body['note']??'')),'actor'=>prepared_stock_actor($user)]);
        $find = $pdo->prepare('SELECT i.id FROM ingredients i WHERE i.id=:id AND i.store_id=:store AND i.is_active=1 AND EXISTS(SELECT 1 FROM ingredient_components ic WHERE ic.parent_ingredient_id=i.id) LIMIT 1');
        $insert = $pdo->prepare('INSERT INTO inventory_prepared_count_items(count_id,ingredient_id,actual_quantity) VALUES(:count,:ingredient,:quantity)');
        $update = $pdo->prepare('UPDATE ingredients SET preparation_stock_quantity=:quantity,updated_at=NOW() WHERE id=:ingredient AND store_id=:store');
        $seen = [];
        foreach ($rawItems as $item) {
            $ingredientId = trim((string) ($item['ingredientId'] ?? ''));
            $quantity = round((float) str_replace(',', '.', (string) ($item['actualQuantity'] ?? 0)), 3);
            if ($ingredientId === '' || $quantity < 0 || isset($seen[$ingredientId])) throw new RuntimeException('Dữ liệu tồn bán thành phẩm không hợp lệ.');
            $find->execute(['id'=>$ingredientId,'store'=>$storeId]);
            if (!$find->fetchColumn()) throw new RuntimeException('Bán thành phẩm không thuộc cửa hàng đang chọn.');
            $seen[$ingredientId] = true;
            $insert->execute(['count'=>$countId,'ingredient'=>$ingredientId,'quantity'=>$quantity]);
            $update->execute(['quantity'=>$quantity,'ingredient'=>$ingredientId,'store'=>$storeId]);
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        respond_error($exception->getMessage(), 422);
    }
    respond_ok(['id'=>$countId], 201);
}

if ($method !== 'GET') respond_error('Method not allowed', 405);
$storeId = field_inventory_require_store($user, trim((string) ($_GET['storeId'] ?? '')));
if ($storeId === 'warehouse') respond_error('Kho thợ không sử dụng tồn bán thành phẩm.', 422);
$today = prepared_stock_business_today();
$to = prepared_stock_date((string) ($_GET['dateTo'] ?? ''), $today);
$from = prepared_stock_date((string) ($_GET['dateFrom'] ?? ''), (new DateTimeImmutable($to))->modify('first day of this month')->format('Y-m-d'));
if ($from > $to) respond_error('Ngày bắt đầu phải trước ngày kết thúc.', 422);

$latestStatement = db()->prepare('SELECT id,count_date FROM inventory_prepared_counts WHERE store_id=:store AND count_date<=:date ORDER BY count_date DESC,created_at DESC LIMIT 1');
$latestStatement->execute(['store'=>$storeId,'date'=>$to]); $latest = $latestStatement->fetch(); $actual = [];
if ($latest) {
    $statement = db()->prepare('SELECT ingredient_id,actual_quantity FROM inventory_prepared_count_items WHERE count_id=:id');
    $statement->execute(['id'=>$latest['id']]); foreach ($statement->fetchAll() as $row) $actual[(string)$row['ingredient_id']] = (float)$row['actual_quantity'];
}
$openingStatement = db()->prepare('SELECT id,count_date FROM inventory_prepared_counts WHERE store_id=:store AND count_date<:date ORDER BY count_date DESC,created_at DESC LIMIT 1');
$openingStatement->execute(['store'=>$storeId,'date'=>$from]); $openingCount = $openingStatement->fetch(); $opening = [];
if ($openingCount) {
    $statement = db()->prepare('SELECT ingredient_id,actual_quantity FROM inventory_prepared_count_items WHERE count_id=:id');
    $statement->execute(['id'=>$openingCount['id']]); foreach ($statement->fetchAll() as $row) $opening[(string)$row['ingredient_id']] = (float)$row['actual_quantity'];
}

$salesStatement = db()->prepare('SELECT pi.ingredient_id,SUM(bi.quantity*pi.quantity) quantity
    FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
    JOIN products p ON p.store_id=b.store_id AND p.product_code=bi.menu_id
    JOIN product_ingredients pi ON pi.store_id=b.store_id AND pi.product_id=p.id
    JOIN ingredients prepared ON prepared.id=pi.ingredient_id AND EXISTS(SELECT 1 FROM ingredient_components recipe WHERE recipe.parent_ingredient_id=prepared.id)
    WHERE b.store_id=:store AND b.status=:status AND DATE(b.created_at) BETWEEN :date_from AND :date_to
    GROUP BY pi.ingredient_id');
$salesStatement->execute(['store'=>$storeId,'status'=>'completed','date_from'=>$from,'date_to'=>$to]); $used = [];
foreach ($salesStatement->fetchAll() as $row) $used[(string)$row['ingredient_id']] = (float)$row['quantity'];

$statement = db()->prepare('SELECT prepared.id,prepared.ingredient_code,prepared.ingredient_name,
    COALESCE(NULLIF(prepared.base_unit,""),prepared.unit) unit,prepared.preparation_stock_quantity,
    prepared.conversion_output_quantity
    FROM ingredients prepared WHERE prepared.store_id=:store AND prepared.is_active=1
    AND EXISTS(SELECT 1 FROM ingredient_components ic WHERE ic.parent_ingredient_id=prepared.id)
    ORDER BY prepared.ingredient_name');
$statement->execute(['store'=>$storeId]); $items = [];
$componentStatement=db()->prepare('SELECT source.id,source.ingredient_code,source.ingredient_name,COALESCE(NULLIF(source.base_unit,""),source.unit) unit,ic.input_quantity FROM ingredient_components ic JOIN ingredients source ON source.id=ic.component_ingredient_id WHERE ic.parent_ingredient_id=:parent ORDER BY source.ingredient_name');
foreach ($statement->fetchAll() as $row) {
    $id=(string)$row['id'];$output=max((float)$row['conversion_output_quantity'],0.000001);$componentStatement->execute(['parent'=>$id]);$components=[];
    foreach($componentStatement->fetchAll()as$component)$components[]=['ingredientId'=>(string)$component['id'],'ingredientCode'=>(string)$component['ingredient_code'],'ingredientName'=>(string)$component['ingredient_name'],'unit'=>(string)($component['unit']??''),'inputQuantity'=>(float)$component['input_quantity'],'conversionFactor'=>round((float)$component['input_quantity']/$output,6)];
    $current=array_key_exists($id,$actual)?$actual[$id]:(float)$row['preparation_stock_quantity'];
    $items[]=['ingredientId'=>$id,'ingredientCode'=>(string)$row['ingredient_code'],'ingredientName'=>(string)$row['ingredient_name'],
        'unit'=>(string)($row['unit']??''),'components'=>$components,
        'openingQuantity'=>array_key_exists($id,$opening)?$opening[$id]:null,'usedQuantity'=>round($used[$id]??0,3),
        'actualQuantity'=>array_key_exists($id,$actual)?$actual[$id]:null,'currentQuantity'=>round($current,3),
        'rawEquivalentQuantity'=>array_sum(array_map(static fn(array$component):float=>round($current*$component['conversionFactor'],3),$components))];
}
$canEditPast=($user['role']??'')==='admin'||auth_has_permission($user,'inventory_closings.edit_past');
respond_ok(['items'=>$items,'dateFrom'=>$from,'dateTo'=>$to,'latestCountDate'=>$latest['count_date']??null,'openingCountDate'=>$openingCount['count_date']??null,'canEditPast'=>$canEditPast,'isLocked'=>$to<$today&&!$canEditPast]);
