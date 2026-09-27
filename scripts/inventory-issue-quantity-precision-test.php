<?php

declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/inventory_issue_quantities.php';

function assert_same_quantity(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL {$message}: expected " . var_export($expected, true) . ', got ' . var_export($actual, true) . PHP_EOL);
        exit(1);
    }
}

assert_same_quantity(0.0004, inventory_issue_parse_quantity('0,0004'), 'keeps six-decimal purchase quantity');
assert_same_quantity(0.4, inventory_issue_base_quantity(0.0004, 1000), 'converts kg to fractional grams');
assert_same_quantity('0.0004', inventory_issue_format_quantity(0.0004), 'formats exact remaining kg');

echo "PASS inventory issue quantity precision\n";
