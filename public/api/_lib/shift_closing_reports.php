<?php
declare(strict_types=1);
require_once __DIR__ . '/takeaway_shifts.php';

function shift_closing_report(PDO $pdo, string $storeId, string $shiftId, array $user): array
{
    $shift = takeaway_shift_row($pdo, $storeId, $shiftId);
    takeaway_shift_owner($shift, $user);
    if ($shift['status'] !== 'closed') throw new ShiftManagementError('Ca chưa kết thúc.', 409);
    $binding = takeaway_shift_info($pdo, $shiftId);
    if ($binding && $binding['snapshot_json']) {
        return json_decode($binding['snapshot_json'], true, 512, JSON_THROW_ON_ERROR);
    }
    $storeQuery = $pdo->prepare('SELECT name FROM stores WHERE id=?');
    $storeQuery->execute([$storeId]);
    $number = preg_match('/^shift_(\d+)$/', $shift['shift_type'], $match) ? (int)$match[1] : 1;
    $report = [
        'storeId' => $storeId, 'storeName' => (string)$storeQuery->fetchColumn(),
        'businessDate' => substr($shift['opened_at'], 0, 10),
        'shiftId' => $shiftId, 'shiftNumber' => $binding['shift_number'] ?? $number,
        'isFinalShift' => false, 'openedAt' => $shift['opened_at'], 'closedAt' => $shift['closed_at'],
        'openingCash' => (float)$shift['opening_cash'], 'closingCash' => (float)$shift['closing_cash'],
        'cashierName' => $shift['cashier_name'], 'note' => $shift['close_note'] ?? '',
        'summary' => takeaway_shift_summary($shift), 'cycle' => null,
    ];
    if ($shift['shift_type'] === 'shift_3' && !$binding) {
        $nextDay = (new DateTimeImmutable($report['businessDate']))->modify('+1 day')->format('Y-m-d 00:00:00');
        $query = $pdo->prepare("SELECT * FROM cashier_shifts WHERE store_id=? AND opened_at>=? AND opened_at<? AND opened_at<=? AND status='closed' AND shift_type IN ('shift_1','shift_2','shift_3') ORDER BY opened_at,id");
        $query->execute([$storeId, $report['businessDate'].' 00:00:00', $nextDay, $shift['closed_at']]);
        $totals = array_fill_keys(['totalSales','cashSales','transferSales','incomeVouchers','expenseVouchers','actualHandover','expectedHandover'], 0.0);
        $slots = [];
        foreach ([1,2,3] as $slot) $slots[$slot] = ['number'=>$slot, 'worked'=>false, 'actualHandover'=>0.0];
        foreach ($query->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $summary = takeaway_shift_summary($row);
            foreach (['totalSales','cashSales','transferSales','incomeVouchers','expenseVouchers'] as $key) $totals[$key] += $summary[$key];
            $outgoing = cash_transfers_outgoing($pdo, $storeId, $row['id']);
            $actual = (float)$row['closing_cash'] - (float)$row['opening_cash'] - $outgoing;
            $totals['actualHandover'] += $actual;
            $totals['expectedHandover'] += $summary['cashSales'] + $summary['incomeVouchers'] - $summary['expenseVouchers'] - $outgoing;
            $slot = (int)substr($row['shift_type'], 6);
            $slots[$slot]['worked'] = true;
            $slots[$slot]['actualHandover'] += $actual;
        }
        $report['isFinalShift'] = true;
        $report['cycle'] = $totals + ['shifts'=>array_values($slots), 'difference'=>$totals['actualHandover']-$totals['expectedHandover']];
    }
    return $report;
}

function shift_closing_history(PDO $pdo, string $storeId, array $user, int $offset = 0): array
{
    $where = "store_id=? AND status='closed'";
    $params = [$storeId];
    if (($user['role'] ?? '') === 'user') {
        $where .= ' AND cashier_uid=?';
        $params[] = $user['id'];
    }
    $offset = max(0, $offset);
    $query = $pdo->prepare("SELECT id FROM cashier_shifts WHERE $where ORDER BY closed_at DESC,id DESC LIMIT 21 OFFSET $offset");
    $query->execute($params);
    $ids = $query->fetchAll(PDO::FETCH_COLUMN);
    return [
        'items' => array_map(fn($id) => shift_closing_report($pdo, $storeId, $id, $user), array_slice($ids, 0, 20)),
        'hasMore' => count($ids) > 20,
    ];
}
