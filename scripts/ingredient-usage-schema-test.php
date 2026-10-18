<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/_lib/ingredient_usage.php';
// Check emitted MySQL DDL against representative parent column collations.
class SnapshotSchemaPDO extends PDO {
    public string $collation = 'utf8mb4_general_ci';
    public function query(string $query, ?int $fetchMode = null, mixed ...$args): PDOStatement|false {
        return parent::query("SELECT 'varchar(64)' AS COLUMN_TYPE, 'utf8mb4' AS CHARACTER_SET_NAME, '$this->collation' AS COLLATION_NAME");
    }
    public function exec(string $statement): int|false {
        if (!preg_match('/bill_id\s+varchar\(64\)\s+CHARACTER SET utf8mb4\s+COLLATE ' . $this->collation . '\s+NOT NULL/i', $statement)) throw new RuntimeException('Foreign key collation mismatch: ' . $this->collation);
        if (!str_contains($statement, 'REFERENCES bills(id) ON DELETE CASCADE')) throw new RuntimeException('Missing cascading foreign key');
        return 0;
    }
}
$pdo = new SnapshotSchemaPDO('sqlite::memory:');
function db(): PDO { return $GLOBALS['pdo']; }
foreach (['utf8mb4_general_ci', 'utf8mb4_unicode_ci', 'utf8mb4_0900_ai_ci'] as $collation) {
    $pdo->collation = $collation;
    ingredient_usage_ensure_schema();
}
echo "Ingredient usage schema tests passed\n";
