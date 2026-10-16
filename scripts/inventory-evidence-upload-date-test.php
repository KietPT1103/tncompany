<?php
declare(strict_types=1);
// Execute the real creation handler with isolated persistence and permission stubs.
$source = file_get_contents(__DIR__ . '/../public/api/inventory-receipts.php');
$start = strpos($source, 'function receipts_create(');
$end = strpos($source, 'function receipts_update(', $start);
eval(substr($source, $start, $end - $start));
$admin = true;
$saved = [];
$sql = '';
function field_inventory_require_permission($permission) { return ['id'=>'admin']; }
function receipts_store($body) { return $body['storeId']; }
function field_inventory_require_store($user, $store) { return $store; }
function field_inventory_is_admin($user) { global $admin; return $admin; }
function field_inventory_datetime($value) { return $value; }
function field_inventory_nullable_decimal($value) { return $value; }
function uuidv4() { return 'receipt-test'; }
function products_inventory_generate_receipt_code($store) { return 'NK-TEST'; }
function receipts_full($user, $id) { return []; }
function respond_error($message, $code) { throw new RuntimeException($message, $code); }
function respond_ok($body, $code) { throw new RuntimeException('saved', $code); }
class FakeDateStatement {
 function execute($params) { global $saved; $saved=$params; }
}
class FakeDateDatabase {
 function prepare($statement) { global $sql; $sql=$statement; return new FakeDateStatement(); }
}
function db() { return new FakeDateDatabase(); }
function runCreation(array $body, int $expected) {
 try { receipts_create(['storeId'=>'cafe']+$body); }
 catch (RuntimeException $error) { if ($error->getCode() === $expected) return; throw $error; }
 throw new RuntimeException('Missing response');
}
runCreation(['receiptDate'=>'2026-10-07','capturedAt'=>'2026-10-07T12:00:00+07:00'],201);
if ($saved['receipt_date']!=='2026-10-07' || strpos($sql, ':receipt_date')===false || strpos($sql, 'CURDATE()')!==false) throw new RuntimeException('Selected date not persisted');
foreach (['2026-02-30','2026-13-01','','07/10/2026','2026-1-1'] as $invalid) runCreation(['receiptDate'=>$invalid],422);
runCreation(['receiptDate'=>'2024-02-29'],201);
runCreation(['capturedDate'=>'2026-10-07'],201);
if ($saved['captured_at']!=='2026-10-07 12:00:00') throw new RuntimeException('Selected capture date not persisted');
$today=(new DateTimeImmutable('now',new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
if ($saved['receipt_date']!==$today) throw new RuntimeException('Capture date must not change warehouse entry date');
foreach (['2026-02-30','2026-13-01','','07/10/2026'] as $invalid) runCreation(['capturedDate'=>$invalid],422);
$admin=false;
runCreation(['capturedDate'=>'2026-10-07'],403);
runCreation(['receiptDate'=>'2026-10-07'],403);
runCreation([],201);
$today=(new DateTimeImmutable('now',new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
if ($saved['receipt_date']!==$today) throw new RuntimeException('Default local date incorrect');
echo "PASS evidence upload dates: persistence, invalid dates, leap day, admin permission, Vietnam default date\n";
