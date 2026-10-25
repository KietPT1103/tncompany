<?php

declare(strict_types=1);

/** Closed cash is the cashier's original count, including any money received from another shift. */
function revenue_cashflow_calculate(array $shifts, array $bills, array $vouchers, array $expenseReport, array $dates, array $stores): array
{
    $labels = ['shift_1' => 'Ca 1', 'shift_2' => 'Ca 2', 'shift_3' => 'Ca 3', 'single' => 'Ca đơn'];
    $included = array_values(array_filter($vouchers, static fn(array $v): bool =>
        empty($v['cancelled_at']) && (bool)($v['include_in_cash_flow'] ?? true)));
    $income = $spend = $outgoing = $incoming = $sales = [];
    foreach ($bills as $bill) {
        if (($bill['status'] ?? '') === 'cancelled' || ($bill['payment_method'] ?? '') === 'transfer') continue;
        $id = (string)($bill['shift_id'] ?? '');
        $sales[$id] = ($sales[$id] ?? 0) + (float)$bill['total'];
    }
    foreach ($included as $voucher) {
        $id = (string)($voucher['shift_id'] ?? '');
        $amount = (float)$voucher['amount'];
        if ($voucher['voucher_type'] === 'income') {
            $income[$id] = ($income[$id] ?? 0) + $amount;
            $source = (string)($voucher['source_shift_id'] ?? '');
            if ($source !== '') {
                $outgoing[$source] = ($outgoing[$source] ?? 0) + $amount;
                $incoming[$id] = ($incoming[$id] ?? 0) + $amount;
            }
        } elseif ($voucher['voucher_type'] === 'expense') {
            $spend[$id] = ($spend[$id] ?? 0) + $amount;
        }
    }
    $byDay = [];
    foreach ($dates as $date) {
        $byDay[$date] = ['date' => $date, 'grossHandover' => 0.0, 'outsideExpense' => 0.0,
            'netHandover' => 0.0, 'complete' => true, 'provisional' => false,
            'shifts' => [], 'expenses' => [], 'syncStatus' => 'ready', 'lastSyncedAt' => null];
    }
    usort($shifts, static fn(array $a, array $b): int => strcmp($a['opened_at'], $b['opened_at']) ?: strcmp($a['id'], $b['id']));
    foreach ($shifts as $shift) {
        $date = substr((string)$shift['opened_at'], 0, 10);
        if (!isset($byDay[$date]) || !in_array($shift['store_id'], $stores, true)) continue;
        $id = (string)$shift['id'];
        $provisional = $shift['status'] !== 'closed' || $shift['closing_cash'] === null;
        $base = $provisional ? (float)($sales[$id] ?? 0) + (float)($income[$id] ?? 0) - (float)($spend[$id] ?? 0)
            : (float)$shift['closing_cash'] - (float)$shift['opening_cash'];
        $withdrawal = (float)($outgoing[$id] ?? 0);
        $handover = $base - $withdrawal;
        $byDay[$date]['shifts'][] = ['id' => $id, 'storeId' => $shift['store_id'],
            'label' => $labels[$shift['shift_type']] ?? $shift['shift_type'],
            'baseHandover' => $base, 'transferIn' => (float)($incoming[$id] ?? 0), 'transferOut' => $withdrawal,
            'handover' => $handover, 'outsideExpense' => 0.0, 'netHandover' => $handover,
            'status' => $provisional ? 'provisional' : 'closed'];
        $byDay[$date]['grossHandover'] += $handover;
        $byDay[$date]['provisional'] = $byDay[$date]['provisional'] || $provisional;
    }
    $expenseIndex = [];
    foreach ($expenseReport['days'] ?? [] as $row) $expenseIndex[$row['date']][$row['storeId']] = $row;
    foreach ($byDay as $date => &$day) {
        foreach ($stores as $store) {
            $expense = $expenseIndex[$date][$store] ?? ['status' => 'missing', 'total' => null, 'items' => []];
            $status = $expense['status'];
            $available = in_array($status, ['ready', 'stale'], true) && isset($expense['total'])
                && is_numeric($expense['total']) && is_finite((float)$expense['total']);
            if (!$available) {
                $day['complete'] = false;
                $day['syncStatus'] = $status === 'error' ? 'error' : 'missing';
            } elseif ($status === 'stale' && $day['syncStatus'] === 'ready') {
                $day['syncStatus'] = 'stale';
            }
            if (!empty($expense['lastSyncedAt'])) {
                $day['lastSyncedAt'] = $day['lastSyncedAt'] === null ? $expense['lastSyncedAt']
                    : min($day['lastSyncedAt'], $expense['lastSyncedAt']);
            }
            foreach ($expense['items'] ?? [] as $item) {
                $day['expenses'][] = ['name' => (string)$item['name'], 'amount' => (float)$item['amount'], 'storeId' => $store];
            }
            $indexes = array_keys(array_filter($day['shifts'], static fn(array $s): bool => $s['storeId'] === $store));
            if (!$available) {
                foreach ($indexes as $index) $day['shifts'][$index]['netHandover'] = null;
                continue;
            }
            $cost = (float)$expense['total'];
            $day['outsideExpense'] += $cost;
            if ($indexes === [] && $cost != 0) {
                // No invented cashier shift: expose an explicitly unallocated line instead.
                $day['shifts'][] = ['id' => 'unallocated:' . $store . ':' . $date, 'storeId' => $store,
                    'label' => 'Chưa có ca', 'baseHandover' => 0.0, 'transferIn' => 0.0, 'transferOut' => 0.0,
                    'handover' => 0.0, 'outsideExpense' => $cost, 'netHandover' => -$cost, 'status' => 'provisional'];
                $day['provisional'] = true;
            } elseif ($indexes !== []) {
                $last = $indexes[count($indexes) - 1];
                $day['shifts'][$last]['outsideExpense'] = $cost;
                $day['shifts'][$last]['netHandover'] -= $cost;
            }
        }
        if (!$day['complete']) {
            $day['outsideExpense'] = null;
            $day['netHandover'] = null;
        } else {
            $day['netHandover'] = $day['grossHandover'] - $day['outsideExpense'];
        }
    }
    unset($day);
    $complete = !in_array(false, array_column($byDay, 'complete'), true);
    return ['complete' => $complete, 'provisional' => in_array(true, array_column($byDay, 'provisional'), true),
        'grossHandover' => (float)array_sum(array_column($byDay, 'grossHandover')),
        'outsideExpense' => $complete ? (float)array_sum(array_column($byDay, 'outsideExpense')) : null,
        'netHandover' => $complete ? (float)array_sum(array_column($byDay, 'netHandover')) : null,
        'days' => array_reverse(array_values($byDay))];
}

function revenue_cashflow(PDO $pdo, string $from, string $to, array $stores): array
{
    require_once __DIR__ . '/cash_transfers.php';
    require_once __DIR__ . '/outside_expenses.php';
    cash_transfers_ensure_schema($pdo);
    outside_expenses_ensure_schema($pdo);
    [$start, $end] = revenue_dates($from, $to);
    $dates = [];
    for ($date = $start; $date < $end; $date = $date->modify('+1 day')) $dates[] = $date->format('Y-m-d');
    if ($stores === []) return revenue_cashflow_calculate([], [], [], [], $dates, []);
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) $pdo->beginTransaction();
    try {
        $params = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s'), ...$stores];
        $filter = 's.opened_at>=? AND s.opened_at<? AND s.store_id IN (' . implode(',', array_fill(0, count($stores), '?')) . ')';
        $statement = $pdo->prepare("SELECT s.* FROM cashier_shifts s WHERE $filter ORDER BY s.opened_at,s.id");
        $statement->execute($params);
        $shifts = $statement->fetchAll();
        $statement = $pdo->prepare("SELECT b.shift_id,b.total,b.status,b.payment_method FROM bills b
            JOIN cashier_shifts s ON s.id=b.shift_id AND s.store_id=b.store_id WHERE $filter");
        $statement->execute($params);
        $bills = $statement->fetchAll();
        $statement = $pdo->prepare("SELECT v.* FROM cash_vouchers v
            JOIN cashier_shifts s ON s.id=v.shift_id AND s.store_id=v.store_id WHERE $filter");
        $statement->execute($params);
        $report = revenue_cashflow_calculate($shifts, $bills, $statement->fetchAll(),
            outside_expenses_report($pdo, $from, $to, $stores), $dates, $stores);
        if ($ownsTransaction) $pdo->commit();
        return $report;
    } catch (Throwable $error) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
