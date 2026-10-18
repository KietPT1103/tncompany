<?php
declare(strict_types=1);

function internal_invoice_category_key(string $name): string {
    $name = preg_replace('/\s+/u', ' ', trim($name)) ?? '';
    return function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
}
function internal_invoice_number(): string {
    return 'NB-' . strtoupper(bin2hex(random_bytes(16)));
}
function internal_invoice_validate_rows(array $rows): array {
    $result = [];
    foreach ($rows as $index => $row) {
        if (!is_array($row)) throw new InvalidArgumentException('Dòng ' . ($index + 1) . ' không hợp lệ.');
        $name = trim((string) ($row['name'] ?? $row['itemName'] ?? ''));
        $price = $row['unitPrice'] ?? $row['unit_price'] ?? '';
        $quantity = $row['quantity'] ?? '';
        $category = trim((string) ($row['categoryName'] ?? ''));
        $unit = trim((string) ($row['unit'] ?? ''));
        if ((function_exists('mb_strlen') ? mb_strlen($category) : strlen($category)) > 150) throw new InvalidArgumentException('Dòng ' . ($index + 1) . ': loại hàng tối đa 150 ký tự.');
        if ($name === '' && $unit === '' && $category === '' && empty($row['categoryId']) && ($price === '' || $price === null) && ($quantity === '' || $quantity === null || (string)$quantity === '1')) continue;
        if ($name === '' || !is_numeric($quantity) || !is_numeric($price) || !is_finite((float)$quantity) || !is_finite((float)$price) || (float)$quantity <= 0 || (float)$price <= 0) {
            throw new InvalidArgumentException('Dòng ' . ($index + 1) . ': nhập tên, số lượng và đơn giá lớn hơn 0.');
        }
        $result[] = $row;
    }
    return $result;
}
function internal_invoice_ensure_schema(): void {
    static $done = false;
    if ($done) return;
    db()->exec('CREATE TABLE IF NOT EXISTS internal_invoice_categories (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL,
        normalized_name VARCHAR(150) NOT NULL, UNIQUE KEY uq_internal_invoice_category (normalized_name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    try { auth_ensure_column('invoice_entry_items', 'internal_category_id', 'BIGINT UNSIGNED NULL'); }
    catch (PDOException $e) { if ((int)($e->errorInfo[1] ?? 0) !== 1060) throw $e; }
    $done = true;
}
function internal_invoice_category(string $name): ?int {
    $name = preg_replace('/\s+/u', ' ', trim($name)) ?? '';
    if ($name === '') return null;
    if ((function_exists('mb_strlen') ? mb_strlen($name) : strlen($name)) > 150) throw new InvalidArgumentException('Loại hàng tối đa 150 ký tự.');
    $stmt = db()->prepare('INSERT INTO internal_invoice_categories (name,normalized_name) VALUES (?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');
    $stmt->execute([$name, internal_invoice_category_key($name)]);
    return (int)db()->lastInsertId();
}
function internal_invoice_resolve_category(array $item): ?int {
    if (trim((string)($item['categoryName'] ?? '')) !== '') return internal_invoice_category((string)$item['categoryName']);
    $id = (int)($item['categoryId'] ?? 0);
    if (!$id) return null;
    $stmt = db()->prepare('SELECT id FROM internal_invoice_categories WHERE id=?');
    $stmt->execute([$id]);
    if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Loại hàng không tồn tại.');
    return $id;
}
