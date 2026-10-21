<?php
declare(strict_types=1);
function inventory_check_validate_count(array $item, bool $complete): void {
    $raw = $item['actualQuantity'] ?? null;
    if ($raw === null || trim((string)$raw) === '') {
        if ($complete) throw new InvalidArgumentException('Vui lòng nhập đủ số tồn thực.');
        return;
    }
    if (!is_numeric($raw) || !is_finite((float)$raw) || (float)$raw < 0 || (float)$raw > 999999999999.999)
        throw new InvalidArgumentException('Số tồn thực không hợp lệ.');
    if ($complete && abs((float)$raw - (float)($item['systemQuantity'] ?? 0)) >= 0.0005 && trim((string)($item['note'] ?? '')) === '')
        throw new InvalidArgumentException('Vui lòng giải trình từng mặt hàng chênh lệch.');
}
