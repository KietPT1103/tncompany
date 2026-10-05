<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/_lib/preparation_receipt_cancellations.php';
// A local fixture simulates another request winning the index DDL race.
class MigrationRacePDO extends PDO {
    public function query(string $query, ?int $fetchMode=null, mixed ...$args): PDOStatement|false {
        $name=str_contains($query, "'uniq_preparation_receipt_issue'") ? 'uniq_preparation_receipt_issue' : 'idx_preparation_receipt_issue';
        return parent::query("SELECT name AS Key_name FROM sqlite_master WHERE type='index' AND name='$name'",PDO::FETCH_ASSOC);
    }
    public function exec(string $statement): int|false {
        if (str_contains($statement,'DROP INDEX')) {
            parent::exec('DROP INDEX uniq_preparation_receipt_issue');
            $e=new PDOException('Concurrent request already dropped index'); $e->errorInfo=['42000',1091,'missing']; throw $e;
        }
        if (str_contains($statement,'ADD INDEX')) {
            parent::exec('CREATE INDEX idx_preparation_receipt_issue ON preparation_receipts(issue_id)');
            $e=new PDOException('Concurrent request already added index'); $e->errorInfo=['42000',1061,'duplicate']; throw $e;
        }
        return parent::exec($statement);
    }
}
$pdo=new MigrationRacePDO('sqlite::memory:');
$pdo->exec('CREATE TABLE preparation_receipts (id TEXT,issue_id TEXT)');
$pdo->exec('CREATE UNIQUE INDEX uniq_preparation_receipt_issue ON preparation_receipts(issue_id)');
function db(): PDO {return $GLOBALS['pdo'];}
function auth_ensure_column(string $table,string $column,string $definition): void {
    $e=new PDOException('Concurrent request already added column'); $e->errorInfo=['42S21',1060,'duplicate']; throw $e;
}
preparation_receipts_ensure_cancellation_schema();
$pdo->exec("INSERT INTO preparation_receipts VALUES ('old','issue'),('new','issue')");
if (!$pdo->query("SHOW INDEX FROM preparation_receipts WHERE Key_name='idx_preparation_receipt_issue'")->fetchColumn()) throw new RuntimeException('Missing replacement index');
echo "PASS concurrent preparation receipt schema migration\n";