<?php
declare(strict_types=1);
define('INVOICE_FUNCTIONS_ONLY',true);
require_once __DIR__.'/invoice-entries.php';
require_once __DIR__.'/_lib/internal_invoice_import.php';
require_once __DIR__.'/_lib/outside_expenses.php';
require_once __DIR__.'/_lib/internal_invoice_sheets.php';
require_once __DIR__.'/_lib/internal_invoice_sheet_sync.php';
$user=auth_require_permission('internal_invoices.access');
internal_sheets_ensure_schema();
$method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
if($method==='GET')respond_ok(internal_sheets_status());
if($method!=='POST')respond_error('Method not allowed',405);
$body=read_json_body();
try {respond_ok(internal_sheets_sync($user,!empty($body['automatic'])));}
catch(RuntimeException $e){respond_error($e->getMessage(),$e->getCode()===409?409:500);}
