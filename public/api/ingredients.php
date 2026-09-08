<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/ingredients.php';

ingredients_ensure_schema();

function ingredient_component_rows(string $ingredientId): array
{
    $statement = db()->prepare('SELECT ic.component_ingredient_id,ic.input_quantity,
        source.ingredient_code,source.ingredient_name,COALESCE(NULLIF(source.base_unit,""),source.unit) unit,source.cost
        FROM ingredient_components ic JOIN ingredients source ON source.id=ic.component_ingredient_id
        WHERE ic.parent_ingredient_id=:parent ORDER BY source.ingredient_name');
    $statement->execute(['parent'=>$ingredientId]);
    return array_map(static fn(array $row):array=>[
        'ingredientId'=>(string)$row['component_ingredient_id'],'ingredientCode'=>(string)$row['ingredient_code'],
        'ingredientName'=>(string)$row['ingredient_name'],'unit'=>(string)($row['unit']??''),
        'inputQuantity'=>(float)$row['input_quantity'],'cost'=>$row['cost']!==null?(float)$row['cost']:null,
    ],$statement->fetchAll());
}

function ingredient_replace_components(string $parentId, array $components): void
{
    db()->prepare('DELETE FROM ingredient_components WHERE parent_ingredient_id=:parent')->execute(['parent'=>$parentId]);
    if($components===[])return;
    $insert=db()->prepare('INSERT INTO ingredient_components(parent_ingredient_id,component_ingredient_id,input_quantity) VALUES(:parent,:component,:quantity)');
    foreach($components as$component)$insert->execute(['parent'=>$parentId,'component'=>$component['ingredientId'],'quantity'=>$component['inputQuantity']]);
}

function ingredient_payload(array $row): array
{
    $components=ingredient_component_rows((string)$row['id']);
    $output=$row['conversion_output_quantity']!==null?(float)$row['conversion_output_quantity']:null;
    $componentCost=$components!==[]&&$output&&$output>0?array_reduce($components,static fn(float$sum,array$item):float=>$sum+(float)($item['cost']??0)*(float)$item['inputQuantity'],0.0)/$output:null;
    return [
        'id' => (string) $row['id'],
        'ingredientCode' => (string) $row['ingredient_code'],
        'ingredientName' => (string) $row['ingredient_name'],
        'unit' => $row['base_unit'] ?: ($row['unit'] ?: ''),
        'purchaseUnit' => $row['purchase_unit'] ?: ($row['unit'] ?: ''),
        'baseUnit' => $row['base_unit'] ?: ($row['unit'] ?: ''),
        'purchaseToBaseFactor' => max(0.000001, (float) ($row['purchase_to_base_factor'] ?? 1)),
        'cost' => $componentCost!==null?round($componentCost,6):(($row['effective_cost'] ?? $row['cost']) !== null ? (float) ($row['effective_cost'] ?? $row['cost']) : null),
        'directCost' => $row['cost'] !== null ? (float) $row['cost'] : null,
        'conversionSourceIngredientId' => $row['conversion_source_ingredient_id'] ?: null,
        'conversionSourceCode' => $row['conversion_source_code'] ?? null,
        'conversionSourceName' => $row['conversion_source_name'] ?? null,
        'conversionSourceUnit' => $row['conversion_source_unit'] ?? null,
        'conversionInputQuantity' => $row['conversion_input_quantity'] !== null ? (float) $row['conversion_input_quantity'] : null,
        'conversionOutputQuantity' => $row['conversion_output_quantity'] !== null ? (float) $row['conversion_output_quantity'] : null,
        'conversionComponents' => $components,
        'stockQuantity' => (float) $row['stock_quantity'],
        'preparationStockQuantity' => (string) $row['store_id'] === 'warehouse'
            ? 0.0
            : (float) ($row['preparation_stock_quantity'] ?? 0),
        'supplierId' => $row['supplier_id'] ?: null,
        'supplierCode' => $row['supplier_code'] ?? null,
        'supplierName' => $row['supplier_name'] ?? null,
        'supplierItemCode' => $row['supplier_item_code'] ?: '',
        'description' => $row['description'] ?: '',
        'isActive' => (bool) $row['is_active'],
        'storeId' => (string) $row['store_id'],
    ];
}

function ingredient_conversion_values(string $storeId, array $body, ?array $existing = null): array
{
    $rawComponents=array_key_exists('conversionComponents',$body)&&is_array($body['conversionComponents'])?$body['conversionComponents']:($existing?ingredient_component_rows((string)$existing['id']):[]);
    $output = is_numeric($body['conversionOutputQuantity'] ?? ($existing['conversion_output_quantity'] ?? null))
        ? (float) ($body['conversionOutputQuantity'] ?? $existing['conversion_output_quantity']) : null;
    $cost = is_numeric($body['cost'] ?? ($existing['cost'] ?? null))
        ? (float) ($body['cost'] ?? $existing['cost']) : null;

    if ($rawComponents === []) {
        return ['source' => null, 'input' => null, 'output' => null, 'cost' => $cost, 'components'=>[]];
    }
    if (!$output || $output <= 0) {
        respond_error('Quy đổi bán thành phẩm không hợp lệ.', 422);
    }
    $statement = db()->prepare(
        'SELECT i.id,i.cost,i.conversion_source_ingredient_id,
          (SELECT COUNT(*) FROM ingredient_components nested WHERE nested.parent_ingredient_id=i.id) component_count
         FROM ingredients i WHERE i.id=:id AND i.store_id=:store_id AND i.is_active=1 LIMIT 1'
    );
    $components=[];$seen=[];$totalCost=0.0;
    foreach($rawComponents as$item){$sourceId=trim((string)($item['ingredientId']??$item['componentIngredientId']??''));$input=is_numeric($item['inputQuantity']??null)?round((float)$item['inputQuantity'],6):0.0;
        if($sourceId===''||$input<=0||isset($seen[$sourceId])||($existing&&$sourceId===(string)$existing['id']))respond_error('Thành phần bán thành phẩm không hợp lệ hoặc bị trùng.',422);
        $statement->execute(['id'=>$sourceId,'store_id'=>$storeId]);$source=$statement->fetch();$statement->closeCursor();
        if(!$source||!empty($source['conversion_source_ingredient_id'])||(int)$source['component_count']>0)respond_error('Thành phần phải là nguyên liệu gốc đang hoạt động.',422);
        $seen[$sourceId]=true;$components[]=['ingredientId'=>$sourceId,'inputQuantity'=>$input];$totalCost+=(float)($source['cost']??0)*$input;
    }
    $first=$components[0];
    return ['source'=>$first['ingredientId'],'input'=>$first['inputQuantity'],'output'=>round($output,6),'cost'=>round($totalCost/$output,6),'components'=>$components];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $user = auth_require_permission([
        'ingredients.access',
        'products.components.update',
        'inventory_stock.view',
        'product.access',
        'inventory_checks.access',
        'inventory_issues.access',
        'inventory_receipts.access',
        'inventory_receipts.view',
    ]);
    $storeId = trim((string) ($_GET['areaId'] ?? $_GET['storeId'] ?? ''));
    field_inventory_require_store($user, $storeId);
    if (strtolower(trim((string) ($_GET['action'] ?? ''))) === 'next-code') {
        $prefix = $storeId === 'warehouse' ? 'VT' : 'NL';
        respond_ok(['suggestedCode' => ingredients_next_code($prefix, 'ingredients', 'ingredient_code')]);
    }
    $search = trim((string) ($_GET['search'] ?? ''));
    $params = ['store_id' => $storeId];
    $sql = 'SELECT i.*,s.supplier_code,s.supplier_name,
                   source.ingredient_code AS conversion_source_code,
                   source.ingredient_name AS conversion_source_name,
                   COALESCE(NULLIF(source.base_unit,""),source.unit) AS conversion_source_unit,
                   source.cost AS conversion_source_cost,
                   CASE
                     WHEN source.id IS NOT NULL AND i.conversion_input_quantity>0 AND i.conversion_output_quantity>0
                     THEN source.cost*i.conversion_input_quantity/i.conversion_output_quantity
                     ELSE i.cost
                   END AS effective_cost
            FROM ingredients i
            LEFT JOIN suppliers s
              ON s.id COLLATE utf8mb4_unicode_ci=i.supplier_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN ingredients source
              ON source.id COLLATE utf8mb4_unicode_ci=i.conversion_source_ingredient_id COLLATE utf8mb4_unicode_ci
            WHERE i.store_id=:store_id';
    if ($search !== '') {
        $sql .= ' AND (i.ingredient_code LIKE :needle_code OR i.ingredient_name LIKE :needle_name
                       OR i.normalized_name LIKE :normalized OR s.supplier_name LIKE :needle_supplier)';
        $needle = '%' . $search . '%';
        $params['needle_code'] = $needle;
        $params['needle_name'] = $needle;
        $params['needle_supplier'] = $needle;
        $params['normalized'] = '%' . ingredients_normalized_name($search) . '%';
    }
    $sql .= ' ORDER BY i.ingredient_name';
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $items = array_map('ingredient_payload', $statement->fetchAll());
    $stockContext = strtolower(trim((string) ($_GET['context'] ?? ''))) === 'stock';
    if ($stockContext && ($user['role'] ?? '') !== 'admin') {
        foreach ($items as &$item) {
            $item['cost'] = null;
            $item['directCost'] = null;
            foreach ($item['conversionComponents'] as &$component) $component['cost'] = null;
            unset($component);
        }
        unset($item);
    }
    respond_ok([
        'items' => $items,
        'canCreate' => field_inventory_has_permission($user, 'products.create'),
        'suggestedCode' => ingredients_next_code($storeId === 'warehouse' ? 'VT' : 'NL', 'ingredients', 'ingredient_code'),
    ]);
}

$body = read_json_body();
$bodyAction = strtolower(trim((string) ($body['action'] ?? '')));
$user = auth_require_permission($bodyAction === 'migrate-category'
    ? ['ingredients.access', 'product.access', 'inventory_checks.access', 'inventory_issues.access', 'inventory_receipts.access', 'inventory_receipts.view']
    : ['ingredients.access', 'product.access', 'products.create', 'inventory_receipts.access', 'inventory_receipts.update']);
$storeId = trim((string) ($body['areaId'] ?? $body['storeId'] ?? $_GET['storeId'] ?? ''));
field_inventory_require_store($user, $storeId);

if ($method === 'POST') {
    if ($bodyAction === 'migrate-category') {
        $statement = db()->prepare(
            'INSERT INTO ingredients (
                id,store_id,ingredient_code,ingredient_name,normalized_name,unit,purchase_unit,base_unit,
                purchase_to_base_factor,cost,stock_quantity,supplier_id,supplier_item_code,description,is_active
             )
             SELECT UUID(),p.store_id,p.product_code,p.product_name,p.normalized_name,
                COALESCE(NULLIF(p.unit,""),"đơn vị"),COALESCE(NULLIF(p.unit,""),"đơn vị"),
                COALESCE(NULLIF(p.unit,""),"đơn vị"),1,p.cost,p.stock_quantity,NULL,NULL,p.description,p.is_selling
             FROM products p
             INNER JOIN categories c ON c.id COLLATE utf8mb4_unicode_ci=p.category_id COLLATE utf8mb4_unicode_ci
             WHERE p.store_id=:store_id AND LOWER(c.name)=LOWER(:category_name)
               AND NOT EXISTS (
                 SELECT 1 FROM ingredients i
                 WHERE i.store_id=p.store_id AND LOWER(i.ingredient_code)=LOWER(p.product_code)
               )'
        );
        $statement->execute(['store_id' => $storeId, 'category_name' => 'Nguyên liệu']);
        $migratedCount = $statement->rowCount();
        $markMoved = db()->prepare(
            'UPDATE products p
             INNER JOIN categories c ON c.id COLLATE utf8mb4_unicode_ci=p.category_id COLLATE utf8mb4_unicode_ci
             SET p.item_type="ingredient",p.is_selling=0
             WHERE p.store_id=:store_id AND LOWER(c.name)=LOWER(:category_name)'
        );
        $markMoved->execute(['store_id' => $storeId, 'category_name' => 'Nguyên liệu']);
        respond_ok(['migratedCount' => $migratedCount, 'movedCount' => $markMoved->rowCount()]);
    }
    $code = trim((string) ($body['ingredientCode'] ?? $body['productCode'] ?? ''));
    $name = trim((string) ($body['ingredientName'] ?? $body['productName'] ?? ''));
    $purchaseUnit = trim((string) ($body['purchaseUnit'] ?? $body['unit'] ?? ''));
    $baseUnit = trim((string) ($body['baseUnit'] ?? $body['unit'] ?? ''));
    $conversionFactor = is_numeric($body['purchaseToBaseFactor'] ?? null) ? (float) $body['purchaseToBaseFactor'] : 1.0;
    if ($code === '' || $name === '') {
        respond_error('Vui lòng nhập mã và tên nguyên liệu.', 422);
    }
    if ($purchaseUnit === '' || $baseUnit === '' || $conversionFactor <= 0) {
        respond_error('Vui lòng nhập đơn vị nhập, đơn vị sử dụng và hệ số quy đổi lớn hơn 0.', 422);
    }
    $duplicate = db()->prepare(
        'SELECT id FROM ingredients
         WHERE store_id=:store_id AND
           (LOWER(ingredient_code)=LOWER(:code) OR normalized_name=:normalized) LIMIT 1'
    );
    $duplicate->execute([
        'store_id' => $storeId, 'code' => $code, 'normalized' => ingredients_normalized_name($name),
    ]);
    if ($duplicate->fetchColumn()) {
        respond_error('Mã hoặc tên nguyên liệu đã tồn tại trong khu vực.', 409);
    }
    $supplierId = trim((string) ($body['supplierId'] ?? '')) ?: null;
    if ($supplierId) {
        $supplier = db()->prepare('SELECT 1 FROM suppliers WHERE id=:id AND store_id=:store_id LIMIT 1');
        $supplier->execute(['id' => $supplierId, 'store_id' => $storeId]);
        if (!$supplier->fetchColumn()) respond_error('Nhà phân phối không thuộc khu vực này.', 422);
    }
    $conversion = ingredient_conversion_values($storeId, $body);
    $id = uuidv4();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'INSERT INTO ingredients
             (id,store_id,ingredient_code,ingredient_name,normalized_name,unit,purchase_unit,base_unit,purchase_to_base_factor,
              conversion_source_ingredient_id,conversion_input_quantity,conversion_output_quantity,cost,stock_quantity,
              supplier_id,supplier_item_code,description,is_active)
             VALUES
             (:id,:store_id,:code,:name,:normalized,:unit,:purchase_unit,:base_unit,:conversion_factor,
              :conversion_source,:conversion_input,:conversion_output,:cost,:stock,:supplier,:supplier_item_code,:description,:active)'
        );
        $statement->execute([
            'id' => $id, 'store_id' => $storeId, 'code' => $code, 'name' => $name,
            'normalized' => ingredients_normalized_name($name),
            'unit' => $baseUnit,
            'purchase_unit' => $purchaseUnit,
            'base_unit' => $baseUnit,
            'conversion_factor' => round($conversionFactor, 6),
            'conversion_source' => $conversion['source'],
            'conversion_input' => $conversion['input'],
            'conversion_output' => $conversion['output'],
            'cost' => $conversion['cost'],
            'stock' => is_numeric($body['stockQuantity'] ?? null) ? round((float) $body['stockQuantity'], 3) : 0,
            'supplier' => $supplierId,
            'supplier_item_code' => trim((string) ($body['supplierItemCode'] ?? '')) ?: null,
            'description' => trim((string) ($body['description'] ?? '')) ?: null,
            'active' => array_key_exists('isActive', $body) && !$body['isActive'] ? 0 : 1,
        ]);
        ingredient_replace_components($id,$conversion['components']);
        $created = ingredients_find($storeId, $id);
        if (!$created) {
            throw new RuntimeException('Khong the doc lai nguyen lieu vua tao.');
        }
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
    respond_ok(['created' => true, 'item' => ingredient_payload($created)], 201);
}

$code = trim((string) ($body['ingredientCode'] ?? $_GET['ingredientCode'] ?? ''));
$existing = ingredients_find($storeId, $code);
if (!$existing) respond_error('Không tìm thấy nguyên liệu.', 404);

if (in_array($method, ['PUT', 'PATCH'], true)) {
    $name = trim((string) ($body['ingredientName'] ?? $existing['ingredient_name']));
    $purchaseUnit = trim((string) ($body['purchaseUnit'] ?? $existing['purchase_unit'] ?? $existing['unit'] ?? ''));
    $baseUnit = trim((string) ($body['baseUnit'] ?? $existing['base_unit'] ?? $existing['unit'] ?? ''));
    $conversionFactor = is_numeric($body['purchaseToBaseFactor'] ?? $existing['purchase_to_base_factor'] ?? 1)
        ? (float) ($body['purchaseToBaseFactor'] ?? $existing['purchase_to_base_factor'] ?? 1) : 1.0;
    if ($purchaseUnit === '' || $baseUnit === '' || $conversionFactor <= 0) {
        respond_error('Quy cách nguyên liệu không hợp lệ.', 422);
    }
    $supplierId = array_key_exists('supplierId', $body)
        ? (trim((string) $body['supplierId']) ?: null)
        : ($existing['supplier_id'] ?: null);
    $conversion = ingredient_conversion_values($storeId, $body, $existing);
    $statement = db()->prepare(
        'UPDATE ingredients SET ingredient_name=:name,normalized_name=:normalized,unit=:unit,purchase_unit=:purchase_unit,
          base_unit=:base_unit,purchase_to_base_factor=:conversion_factor,
          conversion_source_ingredient_id=:conversion_source,conversion_input_quantity=:conversion_input,
          conversion_output_quantity=:conversion_output,cost=:cost,
          stock_quantity=:stock,supplier_id=:supplier,supplier_item_code=:supplier_item_code,
          description=:description,is_active=:active,updated_at=NOW()
         WHERE id=:id'
    );
    $statement->execute([
        'id' => $existing['id'], 'name' => $name, 'normalized' => ingredients_normalized_name($name),
        'unit' => $baseUnit,
        'purchase_unit' => $purchaseUnit,
        'base_unit' => $baseUnit,
        'conversion_factor' => round($conversionFactor, 6),
        'conversion_source' => $conversion['source'],
        'conversion_input' => $conversion['input'],
        'conversion_output' => $conversion['output'],
        'cost' => $conversion['cost'],
        'stock' => is_numeric($body['stockQuantity'] ?? $existing['stock_quantity'])
            ? round((float) ($body['stockQuantity'] ?? $existing['stock_quantity']), 3) : 0,
        'supplier' => $supplierId,
        'supplier_item_code' => trim((string) ($body['supplierItemCode'] ?? $existing['supplier_item_code'])) ?: null,
        'description' => trim((string) ($body['description'] ?? $existing['description'])) ?: null,
        'active' => array_key_exists('isActive', $body) ? ($body['isActive'] ? 1 : 0) : (int) $existing['is_active'],
    ]);
    ingredient_replace_components((string)$existing['id'],$conversion['components']);
    respond_ok(['updated' => true, 'item' => ingredient_payload(ingredients_find($storeId, (string) $existing['id']) ?: $existing)]);
}

if ($method === 'DELETE') {
    $used = db()->prepare(
        'SELECT (SELECT COUNT(*) FROM product_ingredients WHERE ingredient_id=:id)
              + (SELECT COUNT(*) FROM ingredients WHERE conversion_source_ingredient_id=:id)
              + (SELECT COUNT(*) FROM ingredient_components WHERE component_ingredient_id=:id OR parent_ingredient_id=:id)
              + (SELECT COUNT(*) FROM inventory_receipt_items WHERE product_id=:id)'
    );
    $used->execute(['id' => $existing['id']]);
    if ((int) $used->fetchColumn() > 0) {
        db()->prepare('UPDATE ingredients SET is_active=0,updated_at=NOW() WHERE id=:id')
            ->execute(['id' => $existing['id']]);
        respond_ok(['deleted' => false, 'deactivated' => true]);
    }
    db()->prepare('DELETE FROM ingredients WHERE id=:id')->execute(['id' => $existing['id']]);
    respond_ok(['deleted' => true]);
}

respond_error('Method not allowed', 405);
