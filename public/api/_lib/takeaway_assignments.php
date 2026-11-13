<?php
declare(strict_types=1);

/** Call during request setup, before beginning a transaction (MySQL DDL commits). */
function takeaway_assignments_ensure_schema(PDO $pdo): void
{
    if ($pdo->inTransaction()) throw new LogicException('Initialize takeaway assignments before starting a transaction.');
    $suffix = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'
        ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $pdo->exec('CREATE TABLE IF NOT EXISTS user_takeaway_shifts (
        user_id VARCHAR(36) NOT NULL, store_id VARCHAR(50) NOT NULL,
        shift_number INTEGER NOT NULL, PRIMARY KEY (user_id,store_id)
    )'.$suffix);
}

/** No schema changes here: safe to read within a cycle-opening transaction. */
function takeaway_assignments_read(PDO $pdo, string $userId): array
{
    $statement = $pdo->prepare('SELECT store_id,shift_number FROM user_takeaway_shifts WHERE user_id=? ORDER BY store_id');
    $statement->execute([$userId]);
    $result = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) $result[(string)$row['store_id']] = (int)$row['shift_number'];
    return $result;
}

function takeaway_assignments_validate(PDO $pdo, $value, array $storeIds): array
{
    if (!is_array($value)) throw new InvalidArgumentException('Phân ca take away không hợp lệ.');
    $statement = $pdo->prepare('SELECT is_take_away,takeaway_shift_enabled,takeaway_shift_count FROM stores WHERE id=? AND deleted_at IS NULL');
    $result = [];
    foreach ($value as $storeId => $number) {
        if (!is_string($storeId) || !in_array($storeId, $storeIds, true)) throw new InvalidArgumentException('Chỉ được phân ca tại quầy tài khoản được truy cập.');
        $statement->execute([$storeId]);
        $store = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$store || !$store['is_take_away'] || !$store['takeaway_shift_enabled'] || !is_int($number) || $number < 1 || $number > (int)$store['takeaway_shift_count'] || $number > 24) {
            throw new InvalidArgumentException('Ca được gán phải thuộc cấu hình ca take away hiện tại.');
        }
        $result[$storeId] = $number;
    }
    return $result;
}

function takeaway_assignments_write(PDO $pdo, string $userId, array $assignments): void
{
    $pdo->prepare('DELETE FROM user_takeaway_shifts WHERE user_id=?')->execute([$userId]);
    $insert = $pdo->prepare('INSERT INTO user_takeaway_shifts(user_id,store_id,shift_number) VALUES(?,?,?)');
    foreach ($assignments as $storeId => $number) $insert->execute([$userId,$storeId,$number]);
}
