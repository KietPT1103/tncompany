<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    respond_error('Method not allowed', 405);
}

$user = field_inventory_require_permission('inventory_receipts.view');
respond_ok(['items' => field_inventory_allowed_stores($user)]);
