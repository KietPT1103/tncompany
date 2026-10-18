<?php
declare(strict_types=1);
define('INVOICE_FUNCTIONS_ONLY',true);
require_once __DIR__.'/invoice-entries.php';
require_once __DIR__.'/_lib/internal_invoice_import.php';
$user=auth_require_permission('internal_invoices.access');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET')!=='POST') respond_error('Method not allowed',405);
internal_invoice_ensure_schema();
$body=read_json_body();
if (($body['mode'] ?? '')==='preview') {
    $rows=$body['rows'] ?? [];
    if (!is_array($rows) || count($rows)>200) respond_error('Mỗi lần đối chiếu tối đa 200 dòng.',422);
    respond_ok(['rows'=>array_map('internal_import_preview',$rows)]);
}
if (($body['mode'] ?? '')!=='apply') respond_error('Yêu cầu import không hợp lệ.',422);
db()->exec('CREATE TABLE IF NOT EXISTS internal_invoice_import_operations (
 operation_id VARCHAR(64) PRIMARY KEY,payload_hash CHAR(64) NOT NULL,result_json TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)');
$stmt=db()->query("SELECT GET_LOCK('internal_invoice_import',10)");
if ((int)$stmt->fetchColumn()!==1) respond_error('Đang có lượt import khác. Thử lại sau.',409);
try {
    db()->beginTransaction();
    $result=internal_import_apply($body,$user);
    db()->commit();
} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    throw $e;
} finally {
    db()->query("SELECT RELEASE_LOCK('internal_invoice_import')");
}
respond_ok($result);
