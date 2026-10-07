<?php
declare(strict_types=1);

function daily_profit_date($value): string
{
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) throw new InvalidArgumentException('Ngày báo cáo không hợp lệ.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('Ngày báo cáo không hợp lệ.');
    return $value;
}
function daily_profit_money($value, string $label): float
{
    if ((!is_int($value) && !is_float($value)) || !is_finite((float)$value) || $value < 0 || $value > 1e12) {
        throw new InvalidArgumentException('Vui lòng nhập số tiền hợp lệ cho ' . $label . '. Không phát sinh thì nhập 0.');
    }
    return round((float)$value, 2);
}
function daily_profit_validate_inputs(array $body): array
{
    $result = [];
    foreach (['salary'=>'lương một ngày', 'electricity'=>'tiền điện', 'water'=>'tiền nước', 'other'=>'chi phí khác trong ngày'] as $key=>$label) {
        $result[$key] = daily_profit_money($body[$key] ?? null, $label);
    }
    $result['marketing'] = daily_profit_money(array_key_exists('marketing', $body) ? $body['marketing'] : 0, 'marketing');
    $overrides = $body['costOverrides'] ?? [];
    if (!is_array($overrides) || count($overrides) > 2000) throw new InvalidArgumentException('Danh sách cost không hợp lệ hoặc quá dài.');
    $result['costOverrides'] = [];
    foreach ($overrides as $key=>$value) {
        if (strlen((string)$key) > 300 || (string)$key === '') throw new InvalidArgumentException('Mã món không hợp lệ.');
        $result['costOverrides'][(string)$key] = daily_profit_money($value, 'cost món');
    }
    return $result;
}
function daily_profit_ensure_schema(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS daily_profit_inputs (
        store_id VARCHAR(32) NOT NULL, report_date VARCHAR(10) NOT NULL,
        inputs_json TEXT NOT NULL, updated_by VARCHAR(64) NOT NULL,
        updated_at VARCHAR(32) NOT NULL, PRIMARY KEY (store_id, report_date)
    )');
}
function daily_profit_load(PDO $pdo, string $storeId, string $date): ?array
{
    $stmt = $pdo->prepare('SELECT inputs_json, updated_at FROM daily_profit_inputs WHERE store_id=:store AND report_date=:date');
    $stmt->execute(['store'=>$storeId, 'date'=>$date]);
    $row = $stmt->fetch();
    return $row ? daily_profit_saved_row($row) : null;
}
function daily_profit_saved_row(array $row): array
{
    $inputs = json_decode($row['inputs_json'], true, 512, JSON_THROW_ON_ERROR);
    // Preserve manual costs from the original form under the new daily other-cost field.
    if (!array_key_exists('marketing', $inputs)) {
        $other = $inputs['other'] ?? null;
        foreach (['rent'] as $key) {
            $other = $other !== null && isset($inputs[$key]) ? $other + $inputs[$key] : null;
        }
        foreach ($inputs['additionalExpenses'] ?? [] as $expense) {
            $other = $other !== null && isset($expense['amount']) ? $other + $expense['amount'] : null;
        }
        $inputs = ['salary'=>$inputs['salary'] ?? null, 'utilities'=>$inputs['utilities'] ?? null, 'other'=>$other, 'marketing'=>0, 'costOverrides'=>$inputs['costOverrides'] ?? []];
    }
    if (!array_key_exists('electricity', $inputs) || !array_key_exists('water', $inputs)) {
        $legacy = $inputs['utilities'] ?? null;
        $inputs['electricity'] = $legacy === 0 || $legacy === 0.0 ? 0 : null;
        $inputs['water'] = $legacy === 0 || $legacy === 0.0 ? 0 : null;
        $inputs['legacyUtilities'] = $legacy;
        unset($inputs['utilities']);
    }
    return ['inputs'=>$inputs, 'updatedAt'=>$row['updated_at']];
}
function daily_profit_save(PDO $pdo, string $storeId, string $date, array $inputs, string $userId): void
{
    $sql = 'INSERT INTO daily_profit_inputs (store_id,report_date,inputs_json,updated_by,updated_at) VALUES (:store,:date,:inputs,:user,:updated)';
    $sql .= $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? ' ON CONFLICT(store_id,report_date) DO UPDATE SET inputs_json=excluded.inputs_json, updated_by=excluded.updated_by, updated_at=excluded.updated_at'
        : ' ON DUPLICATE KEY UPDATE inputs_json=VALUES(inputs_json), updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)';
    $pdo->prepare($sql)->execute(['store'=>$storeId,'date'=>$date,'inputs'=>json_encode($inputs, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'user'=>$userId,'updated'=>date('c')]);
}
function daily_profit_source(PDO $pdo, string $storeId, string $date): array
{
    return profit_period_sources($pdo, $storeId, $date, $date)[$date];
}
function daily_profit_require_complete(array $source, array $inputs): void
{
    foreach ($source['sales'] as $sale) {
        if ($sale['unitCost'] === null && !array_key_exists($sale['key'], $inputs['costOverrides'])) throw new InvalidArgumentException('Cần nhập cost cho món ' . $sale['name'] . '.');
    }
}

require_once __DIR__ . '/profit_period.php';
