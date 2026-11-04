<?php
declare(strict_types=1);

function payroll_day_locks_ensure(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS payroll_estimate_day_locks (
        store_id VARCHAR(32) NOT NULL,
        work_date CHAR(10) NOT NULL,
        salary_snapshot TEXT NOT NULL,
        locked_by VARCHAR(64) NOT NULL,
        PRIMARY KEY (store_id, work_date)
    )');
}

function payroll_day_locks_read(PDO $pdo, string $store, string $start = '0000-00-00', string $end = '9999-12-31'): array
{
    $stmt = $pdo->prepare('SELECT work_date, salary_snapshot FROM payroll_estimate_day_locks
        WHERE store_id=? AND work_date BETWEEN ? AND ? ORDER BY work_date');
    $stmt->execute([$store, $start, $end]);
    return $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
}

function payroll_day_locks_assert_range(PDO $pdo, string $store, string $start, string $end): void
{
    $dates = payroll_day_locks_read($pdo, $store, $start, $end);
    if ($dates) throw new DomainException('Ngày '.array_key_first($dates).' đã chốt lương. Chỉ admin có thể chỉnh sửa.');
}

function payroll_day_locks_entry_projection(?array $entry, array $lockedDates): array
{
    if (!$entry || !$lockedDates) return [];
    $shifts = json_decode((string)($entry['shifts_json'] ?? '[]'), true);
    $lockedShifts = [];
    foreach (is_array($shifts) ? $shifts : [] as $shift) {
        if (!is_array($shift)) continue;
        $date = str_replace('/', '-', (string)($shift['date'] ?? ''));
        if (!isset($lockedDates[$date])) continue;
        $lockedShifts[] = [
            'date' => $date,
            'role' => $shift['role'] ?? $entry['role'] ?? '',
            'inTime' => (string)($shift['inTime'] ?? ''),
            'outTime' => (string)($shift['outTime'] ?? ''),
            'hours' => (float)($shift['hours'] ?? 0),
            'valid' => (bool)($shift['isValid'] ?? true),
            'weekend' => (bool)($shift['isWeekend'] ?? false),
            'rateOverride' => (float)($shift['hourlyRateOverride'] ?? 0),
        ];
    }
    if (!$lockedShifts) return [];
    sort($lockedShifts);
    $monthly = in_array($entry['salary_type'] ?? '', ['fixed', 'monthly'], true);
    return [
        'shifts' => $lockedShifts,
        'employee' => (string)($entry['employee_id'] ?? ''),
        'name' => (string)($entry['employee_name'] ?? ''),
        'code' => (string)($entry['employee_code'] ?? ''),
        'monthly' => $monthly,
        'rate' => $monthly
            ? ((float)($entry['monthly_salary'] ?? 0) ?: (float)($entry['fixed_salary'] ?? 0))
            : (float)($entry['hourly_rate'] ?? 0),
    ];
}
