<?php
declare(strict_types=1);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/auth.php';
require_once __DIR__.'/_lib/invoice_search.php';
require_once __DIR__.'/_lib/internal_invoice_partners.php';
auth_require_permission('internal_invoices.access');
if(($_SERVER['REQUEST_METHOD'] ?? 'GET')!=='GET')respond_error('Method not allowed',405);
respond_ok(['items'=>internal_invoice_partners(substr(trim((string)($_GET['search'] ?? '')),0,255))]);
