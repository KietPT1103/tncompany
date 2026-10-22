<?php
declare(strict_types=1);
function inventory_check_validate_count(array $item, bool $complete): void {
    $resolution = (string)($item['resolutionType'] ?? 'adjustment');
    if (!in_array($resolution, ['adjustment', 'missing_receipt', 'missing_issue'], true))
        throw new InvalidArgumentException('Loại xử lý chênh lệch không hợp lệ.');
    if ($complete && $resolution !== 'adjustment')
        throw new InvalidArgumentException('Cần bổ sung phiếu nhập/xuất, cập nhật tồn máy và xác nhận đã đối chiếu trước khi chốt.');
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

function inventory_checks_required_actions(string $id, string $status): array {
    if ($status === 'completed') return $id === '' ? ['inventory_checks.create','inventory_checks.complete'] : ['inventory_checks.complete'];
    return [$id === '' ? 'inventory_checks.create' : 'inventory_checks.update'];
}
/** Approving without edit permission must never mutate the saved count or explanation. */
function inventory_checks_same_draft(array $saved, array $payload): bool {
    $canonical = static function(array $check): array {
        $items = [];
        foreach (($check['items'] ?? []) as $item) {
            $raw = $item['actualQuantity'] ?? null;
            $items[] = [(string)($item['productCode'] ?? ''), $raw === null || $raw === '' ? null : round((float)$raw, 3), trim((string)($item['note'] ?? '')), (string)($item['resolutionType'] ?? 'adjustment')];
        }
        usort($items, static fn(array $a,array $b):int => strcmp($a[0],$b[0]));
        return [(string)($check['checkDate'] ?? ''), trim((string)($check['note'] ?? '')), $items];
    };
    return $canonical($saved) === $canonical($payload);
}

function inventory_checks_require_draft(string $status): void {
    if ($status !== 'draft') throw new InvalidArgumentException('Chỉ có thể sửa hoặc chốt đợt kiểm kho đang là bản nháp.');
}
