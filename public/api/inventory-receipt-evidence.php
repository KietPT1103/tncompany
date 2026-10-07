<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
$user=field_inventory_require_permission('inventory_receipts.upload_image');
if (!field_inventory_is_admin($user)) respond_error('Chỉ quản trị viên được liên kết minh chứng.',403);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond_error('Method not allowed',405);
$body=read_json_body();
$id=trim((string)($body['receiptId'] ?? ''));
$sourceId=trim((string)($body['evidenceReceiptId'] ?? ''));
if ($id==='' || $sourceId==='' || $id===$sourceId) respond_error('Minh chứng không hợp lệ.',422);
$pdo=db();
try {
$pdo->beginTransaction();
$ids=[$id,$sourceId];sort($ids);
$rows=[];
foreach($ids as $key) $rows[$key]=field_inventory_require_receipt($user,$key,true);
$target=$rows[$id];$source=$rows[$sourceId];
if (in_array($target['status'],['deleted','cancelled'],true)) throw new RuntimeException('Phiếu không còn được sửa.');
if ($target['store_id']!==$source['store_id'] || in_array($source['status'],['completed','deleted','cancelled'],true) || field_inventory_load_images($sourceId)===[]) throw new RuntimeException('Minh chứng không khả dụng.');
if (!empty($target['evidence_receipt_id']) && $target['evidence_receipt_id']!==$sourceId) throw new RuntimeException('Phiếu đã liên kết minh chứng khác.');
$check=$pdo->prepare('SELECT id FROM inventory_receipts WHERE evidence_receipt_id=:source AND id<>:target AND status<>"deleted" LIMIT 1');
$check->execute(['source'=>$sourceId,'target'=>$id]);
if($check->fetchColumn()) throw new RuntimeException('Minh chứng đã liên kết với phiếu khác.');
$statement=$pdo->prepare('UPDATE inventory_receipts SET evidence_receipt_id=:source,updated_at=NOW() WHERE id=:target');
$statement->execute(['source'=>$sourceId,'target'=>$id]);
$pdo->commit();respond_ok(['linked'=>true]);
} catch(Throwable $error) { if($pdo->inTransaction())$pdo->rollBack();respond_error($error->getMessage(),422); }
