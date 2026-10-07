<?php
declare(strict_types=1);

// Explicit Unicode collation makes search independent of each column's collation.
function admin_search_expression(string $column): string
{
    return 'REPLACE(REPLACE(CONVERT(COALESCE(' . $column . ', "") USING utf8mb4), "đ", "d"), "Đ", "D") COLLATE utf8mb4_unicode_ci';
}
function admin_search_value(string $value): string
{
    return '%' . str_replace(['đ', 'Đ'], ['d', 'D'], trim($value)) . '%';
}
