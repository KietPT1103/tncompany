<?php
declare(strict_types=1);
$library = __DIR__ . '/../public/api/_lib/inventory_issue_corrections.php';
if (is_file($library)) require_once $library;
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException('FAIL: ' . $message); }
function rejected(callable $action, string $message): void {
    try { $action(); } catch (RuntimeException $exception) { return; }
    throw new RuntimeException('FAIL: ' . $message);
}
check(function_exists('inventory_issue_validate_correction'), 'correction policy is available');
$issue = ['status' => 'completed', 'revision' => 2];
inventory_issue_validate_correction('admin', $issue, 2, 'edit', '');
rejected(fn() => inventory_issue_validate_correction('manager', $issue, 2, 'edit', ''), 'non-admin cannot edit completed issue');
rejected(fn() => inventory_issue_validate_correction('user', ['status'=>'draft','revision'=>2], 2, 'cancel', 'Sai'), 'non-admin cannot cancel draft');
rejected(fn() => inventory_issue_validate_correction('admin', $issue, 1, 'edit', ''), 'stale edits rejected');
rejected(fn() => inventory_issue_validate_correction('admin', $issue, 2, 'cancel', '  '), 'cancellation requires reason');
rejected(fn() => inventory_issue_validate_correction('admin', ['status'=>'cancelled','revision'=>3], 3, 'cancel', 'Sai'), 'cannot cancel twice');
inventory_issue_validate_correction('admin', $issue, 2, 'cancel', 'Sai số lượng');
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->sqliteCreateFunction('NOW', fn() => '2026-10-05 12:00:00');
$pdo->exec('CREATE TABLE ingredients (id TEXT PRIMARY KEY, store_id TEXT, ingredient_code TEXT, item_kind TEXT, stock_quantity REAL, purchase_to_base_factor REAL, updated_at TEXT)');
$pdo->exec("INSERT INTO ingredients VALUES ('a','cafe','A','ingredient',70,1000,NULL), ('b','cafe','B','ingredient',20,1,NULL), ('f','cafe','F','fresh',0,1,NULL)");
$old = [['ingredientId'=>'a','baseQuantity'=>30,'stockBefore'=>100,'quantity'=>0.03], ['ingredientId'=>'f','baseQuantity'=>2,'stockBefore'=>null,'quantity'=>2]];
$new = [['ingredient'=>['id'=>'a'], 'quantity'=>0.04], ['ingredient'=>['id'=>'b'], 'quantity'=>5], ['ingredient'=>['id'=>'f'], 'quantity'=>9]];
$pdo->beginTransaction();
$snapshots = inventory_issue_apply_corrected_stock($pdo, 'cafe', $old, $new);
$pdo->commit();
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='a'")->fetchColumn() === 60.0, 'edit adds saved base then deducts new converted quantity');
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='b'")->fetchColumn() === 15.0, 'new ingredient deducted');
check($snapshots['f']['before'] === null && $snapshots['f']['after'] === null, 'fresh item never changes stock');
$pdo->beginTransaction();
inventory_issue_apply_corrected_stock($pdo, 'cafe', [['ingredientId'=>'a','baseQuantity'=>40,'stockBefore'=>100,'quantity'=>0.04], ['ingredientId'=>'b','baseQuantity'=>5,'stockBefore'=>20,'quantity'=>5]], []);
$pdo->commit();
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='a'")->fetchColumn() === 100.0, 'cancel restores stock');
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='b'")->fetchColumn() === 20.0, 'cancel restores all ingredients');
$pdo->beginTransaction();
rejected(fn() => inventory_issue_apply_corrected_stock($pdo, 'cafe', [], [['ingredient'=>['id'=>'a'],'quantity'=>0.01], ['ingredient'=>['id'=>'b'],'quantity'=>21]]), 'insufficient stock rejected');
$pdo->rollBack();
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='a'")->fetchColumn() === 100.0, 'failed correction rolls back earlier deduction');
$pdo->beginTransaction();
inventory_issue_apply_corrected_stock($pdo, 'cafe', [['ingredientId'=>'a','baseQuantity'=>30,'stockBefore'=>100,'quantity'=>0.03]], [['ingredient'=>['id'=>'b'],'quantity'=>2]]);
$pdo->commit();
check((float)$pdo->query("SELECT stock_quantity FROM ingredients WHERE id='a'")->fetchColumn() === 130.0, 'removed ingredient restored using saved base quantity');
echo "PASS inventory issue corrections: policy, conversion, replacement, cancellation, fresh items, rollback\n";