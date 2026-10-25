<?php
declare(strict_types=1);

final class CashTransferError extends RuntimeException
{
    public function __construct(string $message, public int $status = 422)
    {
        parent::__construct($message);
    }
}

/** Safe for report endpoints to call before the POS has ever been visited. */
function cash_transfers_ensure_schema(PDO $pdo): void
{
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    foreach (['source_shift_id', 'transfer_request_id'] as $column) {
        if ($sqlite) {
            $columns = $pdo->query('PRAGMA table_info(cash_vouchers)')->fetchAll(PDO::FETCH_ASSOC);
            $exists = in_array($column, array_column($columns, 'name'), true);
        } else {
            $statement = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?');
            $statement->execute(['cash_vouchers', $column]);
            $exists = (bool)$statement->fetchColumn();
        }
        if (!$exists) {
            try {
                $pdo->exec('ALTER TABLE cash_vouchers ADD COLUMN ' . $column . ' VARCHAR(64) NULL');
            } catch (PDOException $error) {
                if ($error->getCode() !== '42S21' && !str_contains($error->getMessage(), 'duplicate column')) throw $error;
            }
        }
    }
    $indexes = [
        'idx_cash_vouchers_transfer_request' => 'UNIQUE INDEX idx_cash_vouchers_transfer_request ON cash_vouchers(store_id,transfer_request_id)',
        'idx_cash_vouchers_source_shift' => 'INDEX idx_cash_vouchers_source_shift ON cash_vouchers(source_shift_id)',
    ];
    foreach ($indexes as $name => $definition) {
        if ($sqlite) {
            $pdo->exec('CREATE ' . str_replace('INDEX ', 'INDEX IF NOT EXISTS ', $definition));
            continue;
        }
        $statement = $pdo->prepare('SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?');
        $statement->execute(['cash_vouchers', $name]);
        if (!$statement->fetchColumn()) {
            try {
                $pdo->exec('CREATE ' . $definition);
            } catch (PDOException $error) {
                if ((int)($error->errorInfo[1] ?? 0) !== 1061) throw $error;
            }
        }
    }
}

function cash_transfers_lock(PDO $pdo): string
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
}

function cash_transfers_label(array $shift): string
{
    $type = (string)($shift['shift_type'] ?? '');
    return ($type === 'single' ? 'Ca đơn' : 'Ca ' . str_replace('shift_', '', $type))
        . ' (' . substr((string)($shift['opened_at'] ?? ''), 0, 16) . ')';
}

function cash_transfers_outgoing(PDO $pdo, string $storeId, string $shiftId): float
{
    // Current locking reads avoid stale InnoDB snapshots after waiting for a source lock.
    $statement = $pdo->prepare("SELECT amount FROM cash_vouchers
        WHERE store_id=? AND source_shift_id=? AND voucher_type='income'
          AND include_in_cash_flow=1 AND cancelled_at IS NULL"
        . ($pdo->inTransaction() ? cash_transfers_lock($pdo) : ''));
    $statement->execute([$storeId, $shiftId]);
    return array_sum(array_map('floatval', $statement->fetchAll(PDO::FETCH_COLUMN)));
}

function cash_transfers_report(PDO $pdo, string $storeId, string $from, string $to): array
{
    $statement = $pdo->prepare("SELECT v.id,v.code,v.amount,v.source_shift_id,v.shift_id,
        s.shift_type AS source_type,s.opened_at AS source_opened,
        r.shift_type AS receiver_type,r.opened_at AS receiver_opened
        FROM cash_vouchers v
        JOIN cashier_shifts s ON s.id=v.source_shift_id AND s.store_id=v.store_id
        JOIN cashier_shifts r ON r.id=v.shift_id AND r.store_id=v.store_id
        WHERE v.store_id=? AND s.opened_at>=? AND s.opened_at<?
          AND v.voucher_type='income' AND v.include_in_cash_flow=1 AND v.cancelled_at IS NULL
        ORDER BY s.opened_at,v.id");
    $statement->execute([$storeId, $from . ' 00:00:00', date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00']);
    return array_map(static function (array $row): array {
        $row['amount'] = (float)$row['amount'];
        $row['source_label'] = cash_transfers_label(['shift_type' => $row['source_type'], 'opened_at' => $row['source_opened']]);
        $row['receiver_label'] = cash_transfers_label(['shift_type' => $row['receiver_type'], 'opened_at' => $row['receiver_opened']]);
        return $row;
    }, $statement->fetchAll(PDO::FETCH_ASSOC));
}

/** Replays must match the cash movement and its authenticated creator. */
function cash_transfers_replay(array $old, string $source, string $receiver, string $cashier, float $amount): array
{
    if ((string)$old['source_shift_id'] !== $source || (string)$old['shift_id'] !== $receiver
        || (string)$old['cashier_id'] !== $cashier || abs((float)$old['amount'] - $amount) > 0.001) {
        throw new CashTransferError('Mã yêu cầu đã được dùng cho nội dung khác.', 409);
    }
    return ['existingId' => (string)$old['id']];
}

/** Caller retains the transaction and all locks through voucher insertion. */
function cash_transfers_prepare(PDO $pdo, array $body, array $user, string $storeId): array
{
    $source = trim((string)($body['sourceShiftId'] ?? ''));
    if ($source === '') return ['sourceShiftId' => null, 'transferRequestId' => null];
    $request = trim((string)($body['transferRequestId'] ?? ''));
    $cashier = (string)($user['id'] ?? '');
    $amount = (float)($body['amount'] ?? 0);
    if (($body['type'] ?? '') !== 'income' || !filter_var($body['includeInCashFlow'] ?? true, FILTER_VALIDATE_BOOLEAN)) {
        throw new CashTransferError('Chỉ phiếu thu hạch toán dòng tiền được thu từ ca trước.');
    }
    if (!is_finite($amount) || $amount <= 0 || $request === '' || strlen($request) > 64 || strlen($source) > 64) {
        throw new CashTransferError('Số tiền hoặc mã yêu cầu chuyển ca không hợp lệ.');
    }
    $replay = $pdo->prepare('SELECT * FROM cash_vouchers WHERE store_id=? AND transfer_request_id=?' . cash_transfers_lock($pdo));
    $replay->execute([$storeId, $request]);
    if ($old = $replay->fetch(PDO::FETCH_ASSOC)) {
        return cash_transfers_replay($old, $source, (string)($body['shiftId'] ?? ''), $cashier, $amount);
    }
    $statement = $pdo->prepare("SELECT * FROM cashier_shifts
        WHERE store_id=? AND cashier_uid=? AND status='open'
        ORDER BY opened_at DESC,id DESC LIMIT 1" . cash_transfers_lock($pdo));
    $statement->execute([$storeId, $cashier]);
    $receiver = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$receiver || ($body['shiftId'] ?? '') !== $receiver['id']) {
        throw new CashTransferError('Ca nhận phải là ca hiện tại đang mở của bạn.', 403);
    }
    if ($source === $receiver['id']) throw new CashTransferError('Ca nguồn phải khác ca nhận.');
    $statement = $pdo->prepare('SELECT * FROM cashier_shifts WHERE id=? AND store_id=?' . cash_transfers_lock($pdo));
    $statement->execute([$source, $storeId]);
    $shift = $statement->fetch(PDO::FETCH_ASSOC);
    if (!$shift || substr($shift['opened_at'], 0, 10) !== substr($receiver['opened_at'], 0, 10)
        || $shift['opened_at'] >= $receiver['opened_at']) {
        throw new CashTransferError('Chọn ca nguồn đã mở trước, cùng quầy và ngày kinh doanh.');
    }
    // A retry that waited for the source lock now sees the committed original.
    $replay->execute([$storeId, $request]);
    if ($old = $replay->fetch(PDO::FETCH_ASSOC)) {
        return cash_transfers_replay($old, $source, (string)$receiver['id'], $cashier, $amount);
    }
    if ($shift['status'] === 'closed' && $shift['closing_cash'] !== null) {
        // Closed raw cash includes the incoming transfers already; preserve it unchanged.
        $available = (float)$shift['closing_cash'] - (float)$shift['opening_cash'];
    } else {
        $statement = $pdo->prepare("SELECT total FROM bills
            WHERE store_id=? AND shift_id=? AND status<>'cancelled'
              AND (payment_method IS NULL OR payment_method<>'transfer')" . cash_transfers_lock($pdo));
        $statement->execute([$storeId, $source]);
        $available = array_sum(array_map('floatval', $statement->fetchAll(PDO::FETCH_COLUMN)));
        $statement = $pdo->prepare('SELECT voucher_type,amount FROM cash_vouchers
            WHERE store_id=? AND shift_id=? AND include_in_cash_flow=1 AND cancelled_at IS NULL' . cash_transfers_lock($pdo));
        $statement->execute([$storeId, $source]);
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $voucher) {
            $available += ($voucher['voucher_type'] === 'income' ? 1 : -1) * (float)$voucher['amount'];
        }
    }
    $available -= cash_transfers_outgoing($pdo, $storeId, $source);
    if ($amount > $available + 0.001) throw new CashTransferError('Số tiền vượt quá tiền còn có thể thu từ ca nguồn.', 409);
    return [
        'sourceShiftId' => $source, 'transferRequestId' => $request, 'shiftId' => $receiver['id'],
        'sourceShiftLabel' => cash_transfers_label($shift), 'receiverShiftLabel' => cash_transfers_label($receiver),
    ];
}
