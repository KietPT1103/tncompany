<?php
declare(strict_types=1);

// Reporting snapshots do not move inventory. Each recipe is stored per one sold unit.
function ingredient_usage_ensure_schema(): void
{
    db()->exec('CREATE TABLE IF NOT EXISTS bill_recipe_snapshots (
        bill_id VARCHAR(64) NOT NULL,
        menu_id VARCHAR(100) NOT NULL,
        unit VARCHAR(50) NULL,
        recipe_json LONGTEXT NULL,
        snapshot_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (bill_id, menu_id),
        CONSTRAINT fk_bill_recipe_snapshot_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
}

function ingredient_usage_recipe_resolver(): callable
{
    $cache = []; $catalogs = [];
    return static function (string $store, array $sales) use (&$cache, &$catalogs): array {
        $key = $store . ':' . $sales[0]['productCode'];
        $catalogs[$store] ??= products_inventory_consumption_catalog($store);
        return $cache[$key] ??= products_inventory_resolve_consumption_preview($store, $sales, $catalogs[$store]);
    };
}

function ingredient_usage_capture_bill(string $store, string $billId, callable $resolve): array
{
    $statement = db()->prepare('SELECT bi.menu_id, MAX(bi.name) name, MAX(p.unit) unit
        FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
        LEFT JOIN products p ON p.store_id=b.store_id AND p.product_code=bi.menu_id
        WHERE b.id=:bill AND b.store_id=:store AND b.status=\'completed\'
        GROUP BY bi.menu_id');
    $statement->execute(['bill'=>$billId, 'store'=>$store]);
    $rows = $statement->fetchAll();
    $find = db()->prepare('SELECT recipe_json FROM bill_recipe_snapshots WHERE bill_id=:bill AND menu_id=:code');
    $insert = db()->prepare('INSERT INTO bill_recipe_snapshots(bill_id,menu_id,unit,recipe_json) VALUES(:bill,:code,:unit,NULL)');
    $update = db()->prepare('UPDATE bill_recipe_snapshots SET recipe_json=:recipe,snapshot_at=CURRENT_TIMESTAMP WHERE bill_id=:bill AND menu_id=:code AND recipe_json IS NULL');
    $saved = 0;
    $errors = [];
    foreach ($rows as $row) {
        $key = ['bill'=>$billId, 'code'=>$row['menu_id']];
        $find->execute($key);
        $existing = $find->fetch();
        if ($existing && $existing['recipe_json'] !== null) continue;
        if (!$existing) {
            try { $insert->execute($key + ['unit'=>$row['unit']]); }
            catch (PDOException $e) {
                // Concurrent checkout/backfill may already have captured this product.
                if (!in_array((string)$e->getCode(), ['23000','23505'], true)) throw $e;
            }
        }
        $preview = $resolve($store, [['productCode'=>(string)$row['menu_id'], 'productName'=>(string)$row['name'], 'quantity'=>1]]);
        if (!empty($preview['errors']) || empty($preview['items'])) {
            $errors = array_merge($errors, $preview['errors'] ?? []);
            continue;
        }
        $recipe = array_map(static fn(array $item): array => [
            'id'=>(string)$item['productId'], 'code'=>(string)$item['productCode'],
            'name'=>(string)$item['productName'], 'unit'=>(string)($item['unit'] ?? ''),
            'quantity'=>(float)$item['quantity'],
        ], $preview['items']);
        $update->execute($key + ['recipe'=>json_encode($recipe, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        $saved += $update->rowCount();
    }
    return ['saved'=>$saved, 'errors'=>array_values(array_unique($errors))];
}

function ingredient_usage_report(string $store, string $from, string $to): array
{
    $statement = db()->prepare('SELECT bi.menu_id,bi.name,bi.quantity,COALESCE(s.unit,p.unit) unit,s.recipe_json
        FROM bills b JOIN bill_items bi ON bi.bill_id=b.id
        LEFT JOIN bill_recipe_snapshots s ON s.bill_id=b.id AND s.menu_id=bi.menu_id
        LEFT JOIN products p ON p.store_id=b.store_id AND p.product_code=bi.menu_id
        WHERE b.store_id=:store AND b.status=\'completed\' AND b.created_at>=:start AND b.created_at<:end
        ORDER BY bi.menu_id,b.created_at');
    $end = (new DateTimeImmutable($to))->modify('+1 day')->format('Y-m-d');
    $statement->execute(['store'=>$store, 'start'=>$from.' 00:00:00', 'end'=>$end.' 00:00:00']);
    $sales = []; $ingredients = []; $total = 0.0; $pending = 0.0;
    while ($row = $statement->fetch()) {
        $quantity = (float)$row['quantity'];
        $unit = (string)($row['unit'] ?? '');
        $key = json_encode([$row['menu_id'], $unit]);
        if (!isset($sales[$key])) $sales[$key] = ['code'=>$row['menu_id'],'name'=>$row['name'],'unit'=>$unit,'quantity'=>0.0,'pendingQuantity'=>0.0];
        $sales[$key]['quantity'] += $quantity;
        $total += $quantity;
        if ($row['recipe_json'] === null) {
            $sales[$key]['pendingQuantity'] += $quantity;
            $pending += $quantity;
            continue;
        }
        foreach (json_decode($row['recipe_json'], true, 512, JSON_THROW_ON_ERROR) as $item) {
            // Keep unlike units separate, including historical unit changes.
            $ingredientKey = json_encode([$item['id'], $item['unit']]);
            if (!isset($ingredients[$ingredientKey])) $ingredients[$ingredientKey] = ['code'=>$item['code'],'name'=>$item['name'],'unit'=>$item['unit'],'quantity'=>0.0];
            $ingredients[$ingredientKey]['quantity'] += $quantity * (float)$item['quantity'];
        }
    }
    $ingredients = array_values($ingredients);
    foreach ($ingredients as &$item) $item['quantity'] = round($item['quantity'], 3);
    unset($item);
    usort($ingredients, static fn(array $a,array $b): int => strcmp($a['code'],$b['code']));
    return ['sales'=>array_values($sales),'ingredients'=>$ingredients,'totalSoldQuantity'=>$total,'pendingQuantity'=>$pending];
}

function ingredient_usage_pending_bills(string $store, string $from, string $to, string $cursor = '', int $limit = 200): array
{
    $limit = max(1, min(200, $limit));
    $fetchLimit = $limit + 1;
    $end = (new DateTimeImmutable($to))->modify('+1 day')->format('Y-m-d').' 00:00:00';
    $statement = db()->prepare("SELECT b.id FROM bills b
        WHERE b.store_id=:store AND b.status='completed' AND b.created_at>=:start AND b.created_at<:end AND b.id>:cursor
        AND EXISTS (SELECT 1 FROM bill_items bi LEFT JOIN bill_recipe_snapshots s ON s.bill_id=bi.bill_id AND s.menu_id=bi.menu_id
            WHERE bi.bill_id=b.id AND s.recipe_json IS NULL)
        ORDER BY b.id LIMIT $fetchLimit");
    $statement->execute(['store'=>$store,'start'=>$from.' 00:00:00','end'=>$end,'cursor'=>$cursor]);
    $ids = $statement->fetchAll(PDO::FETCH_COLUMN);
    $hasMore = count($ids) > $limit;
    $ids = array_slice($ids, 0, $limit);
    return ['ids'=>$ids, 'nextCursor'=>$hasMore ? (string)end($ids) : null];
}
