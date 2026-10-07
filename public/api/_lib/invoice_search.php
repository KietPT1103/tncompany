<?php
declare(strict_types=1);
require_once __DIR__ . '/search.php';
function invoice_search_expression(string $column): string { return admin_search_expression($column); }
function invoice_search_value(string $value): string { return admin_search_value($value); }
