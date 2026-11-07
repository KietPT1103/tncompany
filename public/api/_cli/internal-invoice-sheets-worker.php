<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('INVOICE_FUNCTIONS_ONLY',true);
require_once __DIR__.'/../invoice-entries.php';
require_once __DIR__.'/../_lib/internal_invoice_import.php';
require_once __DIR__.'/../_lib/outside_expenses.php';
require_once __DIR__.'/../_lib/internal_invoice_sheets.php';
require_once __DIR__.'/../_lib/internal_invoice_sheet_sync.php';
try {
    internal_sheets_ensure_schema();
    $status=internal_sheets_sync(['permissions'=>['internal_invoices.access'],'displayName'=>'Đồng bộ Google Sheet'],true);
    echo json_encode($status,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
    exit(empty($status['result']['errors'])?0:1);
} catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
