<?php
declare(strict_types=1);

/** Upgrade existing installations without changing store IDs or historical rows. */
function stores_ensure_schema(PDO $pdo): void
{
    static $ready = [];
    $key = spl_object_id($pdo);
    if (isset($ready[$key])) return;
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $columns = $sqlite
        ? array_column($pdo->query('PRAGMA table_info(stores)')->fetchAll(PDO::FETCH_ASSOC), 'name')
        : $pdo->query('SHOW COLUMNS FROM stores')->fetchAll(PDO::FETCH_COLUMN);
    foreach (['address'=>"VARCHAR(500) NOT NULL DEFAULT ''", 'is_take_away'=>'TINYINT NOT NULL DEFAULT 0', 'takeaway_printing_enabled'=>'TINYINT NOT NULL DEFAULT 0', 'is_active'=>'TINYINT NOT NULL DEFAULT 1', 'deleted_at'=>'DATETIME NULL'] as $name=>$definition) {
        if (in_array($name, $columns, true)) continue;
        try {
            $pdo->exec("ALTER TABLE stores ADD COLUMN $name $definition");
        } catch (PDOException $e) {
            // Concurrent first requests may both attempt the same migration.
            if (($e->errorInfo[1] ?? null) !== 1060) throw $e;
        }
    }
    foreach (['takeaway_shift_enabled'=>'TINYINT NOT NULL DEFAULT 0','takeaway_shift_count'=>'INT NOT NULL DEFAULT 1','takeaway_final_shift'=>'INT NOT NULL DEFAULT 1'] as $name=>$definition) {
        if (in_array($name,$columns,true)) continue;
        try { $pdo->exec("ALTER TABLE stores ADD COLUMN $name $definition"); }
        catch (PDOException $e) { if (($e->errorInfo[1] ?? null)!==1060) throw $e; }
    }
    $ready[$key] = true;
}

function stores_map(array $row): array
{
    return ['id'=>(string)$row['id'], 'name'=>(string)$row['name'], 'address'=>(string)$row['address'],
        'takeawayShiftEnabled'=>(bool)($row['takeaway_shift_enabled']??false), 'takeawayShiftCount'=>(int)($row['takeaway_shift_count']??1), 'takeawayFinalShift'=>(int)($row['takeaway_final_shift']??1),
        'takeawayPrintingEnabled'=>(bool)$row['takeaway_printing_enabled'], 'isTakeAway'=>(bool)$row['is_take_away'], 'isActive'=>(bool)$row['is_active'], 'deletedAt'=>$row['deleted_at']];
}

function stores_find(PDO $pdo, string $id): ?array
{
    stores_ensure_schema($pdo);
    $query = $pdo->prepare('SELECT * FROM stores WHERE id=?');
    $query->execute([$id]);
    $row = $query->fetch(PDO::FETCH_ASSOC);
    return $row ? stores_map($row) : null;
}

function stores_require_available(PDO $pdo, string $id): array
{
    $store = stores_find($pdo, $id);
    if (!$store) throw new DomainException('Quầy không tồn tại.', 404);
    if (!$store['isActive'] || $store['deletedAt'] !== null) throw new DomainException('Quầy đã ngừng hoạt động hoặc bị xoá.', 409);
    return $store;
}

function stores_require_admin(array $user): void
{
    if (($user['role'] ?? '') !== 'admin') throw new DomainException('Chỉ quản trị viên được quản lý quầy.', 403);
}

function stores_list(PDO $pdo, array $user, bool $management = false, bool $history = false): array
{
    stores_ensure_schema($pdo);
    if ($management) stores_require_admin($user);
    $sql = 'SELECT * FROM stores WHERE 1=1';
    if (!$history || $management) $sql .= ' AND deleted_at IS NULL';
    if (!$management && !$history) $sql .= ' AND is_active=1';
    $params = [];
    $canSeeAll = in_array($user['role'] ?? '', ['admin','manager'], true)
        || in_array('accounts.access', $user['permissions'] ?? [], true);
    if (!$canSeeAll) {
        $ids = array_values(array_unique(array_filter(array_merge($user['storeIds'] ?? [], [$user['storeId'] ?? '']))));
        if (!$ids) return [];
        $sql .= ' AND id IN (' . implode(',', array_fill(0,count($ids),'?')) . ')';
        $params = $ids;
    }
    $sql .= " ORDER BY CASE id WHEN 'cafe' THEN 0 WHEN 'restaurant' THEN 1 WHEN 'bakery' THEN 2 WHEN 'farm' THEN 3 WHEN 'warehouse' THEN 4 ELSE 5 END,created_at,id";
    $query = $pdo->prepare($sql);
    $query->execute($params);
    return array_map('stores_map', $query->fetchAll(PDO::FETCH_ASSOC));
}

function stores_save(PDO $pdo, array $user, ?string $id, array $input): array
{
    stores_require_admin($user);
    stores_ensure_schema($pdo);
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) $pdo->beginTransaction();
    try {
    if ($id !== null) {
        $lock=$pdo->prepare('SELECT id FROM stores WHERE id=?' . ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'?'':' FOR UPDATE'));
        $lock->execute([$id]);
    }
    $old = $id !== null ? stores_find($pdo,$id) : null;
    if ($id !== null && (!$old || $old['deletedAt'] !== null)) throw new DomainException('Quầy không tồn tại.',404);
    $values = array_merge($old ?? ['name'=>'', 'address'=>'', 'isTakeAway'=>false, 'isActive'=>true, 'takeawayPrintingEnabled'=>false,'takeawayShiftEnabled'=>false,'takeawayShiftCount'=>1,'takeawayFinalShift'=>1],$input);
    foreach (['name'=>255,'address'=>500] as $field=>$limit) {
        if (!is_string($values[$field])) throw new DomainException('Tên hoặc địa chỉ quầy không hợp lệ.',422);
        $values[$field] = trim($values[$field]);
        $length = preg_match_all('/./us', $values[$field]);
        if ($length === false || $length > $limit) throw new DomainException('Tên tối đa 255 ký tự, địa chỉ tối đa 500 ký tự.',422);
    }
    if ($values['name'] === '') throw new DomainException('Vui lòng nhập tên quầy.',422);
    foreach (['isTakeAway','isActive','takeawayPrintingEnabled','takeawayShiftEnabled'] as $field) {
        if (!is_bool($values[$field])) throw new DomainException('Trạng thái quầy không hợp lệ.',422);
    }
    foreach (['takeawayShiftCount','takeawayFinalShift'] as $field) {
        if (!is_int($values[$field]) || $values[$field]<1 || $values[$field]>24) throw new DomainException('Số ca phải là số nguyên từ 1 đến 24.',422);
    }
    if ($values['takeawayFinalShift']>$values['takeawayShiftCount']) throw new DomainException('Ca cuối phải thuộc danh sách ca.',422);
    $policyChanged=false;
    if ($old) foreach (['isTakeAway','takeawayShiftEnabled','takeawayShiftCount','takeawayFinalShift'] as $field) {
        if ($values[$field]!==$old[$field]) $policyChanged=true;
    }
    if ($policyChanged) {
        foreach (['takeaway_business_cycles'=>'closed_at IS NULL','cashier_shifts'=>"status='open'"] as $table=>$condition) {
            $exists=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'
                ? $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
                : $pdo->prepare('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
            $exists->execute([$table]);
            if (!$exists->fetchColumn()) continue;
            $open=$pdo->prepare("SELECT 1 FROM $table WHERE store_id=? AND $condition LIMIT 1");
            $open->execute([$id]);
            if ($open->fetchColumn()) throw new DomainException('Phải đóng vòng kinh doanh và các ca đang mở trước khi đổi cấu hình ca hoặc phân loại quầy.',409);
        }
    }
    if (!$values['isTakeAway'] && $values['takeawayShiftEnabled']) {
        if (isset($input['takeawayShiftEnabled']) && $input['takeawayShiftEnabled']) throw new DomainException('Chỉ quầy take away được bật chia ca.',422);
        $values['takeawayShiftEnabled']=false;
    }
    if (!$values['isTakeAway']) $values['takeawayPrintingEnabled'] = false;
    $params = [$values['name'],$values['address'],(int)$values['isTakeAway'],(int)$values['isActive'],(int)$values['takeawayPrintingEnabled'],(int)$values['takeawayShiftEnabled'],$values['takeawayShiftCount'],$values['takeawayFinalShift']];
    if ($id === null) {
        $id = 'store_' . bin2hex(random_bytes(12));
        $params[] = $id;
        $pdo->prepare('INSERT INTO stores(name,address,is_take_away,is_active,takeaway_printing_enabled,takeaway_shift_enabled,takeaway_shift_count,takeaway_final_shift,id) VALUES(?,?,?,?,?,?,?,?,?)')->execute($params);
    } else {
        $params[] = $id;
        $query = $pdo->prepare('UPDATE stores SET name=?,address=?,is_take_away=?,is_active=?,takeaway_printing_enabled=?,takeaway_shift_enabled=?,takeaway_shift_count=?,takeaway_final_shift=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL');
        $query->execute($params);
    }
    $saved = stores_find($pdo,$id);
    if (!$saved || $saved['deletedAt'] !== null) throw new DomainException('Quầy đã bị xoá.',409);
    if ($ownsTransaction) $pdo->commit();
    return $saved;
    } catch (Throwable $e) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function stores_delete(PDO $pdo, array $user, string $id): void
{
    stores_require_admin($user);
    $old = stores_find($pdo,$id);
    if (!$old || $old['deletedAt'] !== null) throw new DomainException('Quầy không tồn tại.',404);
    $pdo->prepare('UPDATE stores SET deleted_at=CURRENT_TIMESTAMP,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL')->execute([$id]);
}
