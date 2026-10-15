<?php
declare(strict_types=1);

function products_increment_sp_code(string $currentCode): string
{
    $digits = $currentCode === '' ? '0' : substr($currentCode, 2);
    $width = max(6, strlen($digits));
    $carry = 1;
    for ($index = strlen($digits) - 1; $index >= 0 && $carry; $index--) {
        $digit = (int) $digits[$index] + 1;
        $digits[$index] = (string) ($digit % 10);
        $carry = $digit > 9 ? 1 : 0;
    }
    if ($carry) $digits = '1' . $digits;
    return 'SP' . str_pad($digits, $width, '0', STR_PAD_LEFT);
}
