<?php
declare(strict_types=1);

require_once __DIR__ . "/cash_transfers.php";

final class ShiftManagementError extends RuntimeException
{
    public function __construct(string $message, public int $status = 422) { parent::__construct($message); }
}

function shift_require_admin(array $user): void
{
    if (($user['role'] ?? '') !== 'admin') throw new ShiftManagementError('Chỉ quản trị viên được điều chỉnh ca.', 403);
}

function shift_is_previous_day(string $openedAt, ?string $businessDate = null): bool
{
    return substr($openedAt, 0, 10) < ($businessDate ?? date('Y-m-d'));
}

function shift_validate_active_use(array $shift, array $user, bool $confirmed, ?string $businessDate = null): void
{
    if (($shift['status'] ?? '') !== 'open') throw new ShiftManagementError('Ca đã đóng. Vui lòng tải lại trang và mở ca mới.', 409);
    if (($user['role'] ?? '') === 'user' && (string)$shift['cashier_uid'] !== (string)$user['id']) {
        throw new ShiftManagementError('Ca không thuộc thu ngân hiện tại.', 403);
    }
    if (shift_is_previous_day((string)$shift['opened_at'], $businessDate) && !$confirmed) {
        throw new ShiftManagementError('Ca còn mở từ ngày trước. Hãy đóng ca cũ hoặc xác nhận tiếp tục ca qua đêm trước khi bán hàng.', 409);
    }
}

function shift_lock_suffix(PDO $pdo): string
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
}

function shift_management_ensure_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS cashier_shift_corrections (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        store_id VARCHAR(32) NOT NULL, shift_id VARCHAR(64) NOT NULL,
        actor_id VARCHAR(64) NOT NULL, actor_name VARCHAR(255) NOT NULL,
        reason VARCHAR(1000) NOT NULL, before_json LONGTEXT NOT NULL,
        after_json LONGTEXT NOT NULL, transfers_json LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_shift_corrections_shift (shift_id, created_at),
        KEY idx_shift_corrections_store (store_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function shift_management_find(PDO $pdo, string $storeId, string $id, bool $lock = false): array
{
    $s = $pdo->prepare('SELECT * FROM cashier_shifts WHERE id=? AND store_id=?' . ($lock ? shift_lock_suffix($pdo) : ''));
    $s->execute([$id, $storeId]);
    $row = $s->fetch();
    if (!$row) throw new ShiftManagementError('Không tìm thấy ca trong chi nhánh này.', 404);
    return $row;
}

function shift_management_review(PDO $pdo, string $storeId, string $id, bool $lock = false): array
{
    $shift = shift_management_find($pdo, $storeId, $id, $lock);
    $s = $pdo->prepare('SELECT id,store_id,shift_id,table_number,total,status,payment_method,created_at FROM bills WHERE shift_id=? ORDER BY id' . ($lock ? shift_lock_suffix($pdo) : ''));
    $s->execute([$id]);
    $bills = $s->fetchAll();
    $s = $pdo->prepare('SELECT id,store_id,shift_id,amount,voucher_type,include_in_cash_flow,cancelled_at,happened_at FROM cash_vouchers WHERE shift_id=? ORDER BY id' . ($lock ? shift_lock_suffix($pdo) : ''));
    $s->execute([$id]);
    $vouchers = $s->fetchAll();
    return ['shift' => $shift, 'bills' => $bills, 'vouchers' => $vouchers,
        'reviewToken' => hash('sha256', json_encode([$shift, $bills, $vouchers], JSON_THROW_ON_ERROR))];
}

function shift_management_datetime($value): string
{
    $text = trim((string)$value);
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $text);
    if (!$parsed || $parsed->format('Y-m-d H:i:s') !== $text) throw new ShiftManagementError('Ngày giờ không hợp lệ.');
    return $text;
}

function shift_management_recalculate(PDO $pdo, array $shift): void
{
    // Current reads avoid an old InnoDB REPEATABLE READ snapshot after waiting for a POS transaction.
    $lock = $pdo->inTransaction() ? shift_lock_suffix($pdo) : '';
    $s = $pdo->prepare('SELECT total,status,payment_method FROM bills WHERE shift_id=? AND store_id=? ORDER BY id' . $lock);
    $s->execute([$shift['id'], $shift['store_id']]);
    $summary = array_fill_keys(['cash_sales','transfer_sales','total_sales','completed_bills','cancelled_bills','cancelled_amount','income_vouchers','expense_vouchers'], 0);
    foreach ($s->fetchAll() as $bill) {
        if ($bill['status'] === 'cancelled') {
            $summary['cancelled_bills']++; $summary['cancelled_amount'] += (float)$bill['total'];
        } else {
            $summary['completed_bills']++; $summary['total_sales'] += (float)$bill['total'];
            $summary[$bill['payment_method'] === 'transfer' ? 'transfer_sales' : 'cash_sales'] += (float)$bill['total'];
        }
    }
    $s = $pdo->prepare('SELECT amount,voucher_type,include_in_cash_flow,cancelled_at FROM cash_vouchers WHERE shift_id=? AND store_id=? ORDER BY id' . $lock);
    $s->execute([$shift['id'], $shift['store_id']]);
    foreach ($s->fetchAll() as $voucher) {
        if ($voucher['cancelled_at'] === null && (bool)$voucher['include_in_cash_flow']) {
            $summary[$voucher['voucher_type'] === 'income' ? 'income_vouchers' : 'expense_vouchers'] += (float)$voucher['amount'];
        }
    }
    $summary['net_cash_flow'] = $summary['total_sales'] + $summary['income_vouchers'] - $summary['expense_vouchers'];
    $summary['expected_closing_cash'] = (float)$shift['opening_cash'] + $summary['cash_sales'] + $summary['income_vouchers'] - $summary['expense_vouchers'];
    $fields = array_map(static fn($key) => $key . '=:' . $key, array_keys($summary));
    $summary['id'] = $shift['id'];
    $pdo->prepare('UPDATE cashier_shifts SET ' . implode(',', $fields) . ' WHERE id=:id')->execute($summary);
}

/** Keep existing active transfer relations valid when an administrator corrects shift times. */
function shift_validate_cash_transfer_times(PDO $pdo, string $storeId, string $id, string $openedAt): void
{
    // The edited shift is already locked. A concurrent POS transfer waits on that lock,
    // then validates the corrected times; current reads include transfers committed first.
    $statement = $pdo->prepare("SELECT voucher.source_shift_id,voucher.shift_id,
        source.store_id AS source_store,source.opened_at AS source_opened,
        receiver.store_id AS receiver_store,receiver.opened_at AS receiver_opened
        FROM cash_vouchers voucher
        JOIN cashier_shifts source ON source.id=voucher.source_shift_id
        JOIN cashier_shifts receiver ON receiver.id=voucher.shift_id
        WHERE voucher.store_id=? AND (voucher.source_shift_id=? OR voucher.shift_id=?)
          AND voucher.voucher_type='income' AND voucher.include_in_cash_flow=1 AND voucher.cancelled_at IS NULL"
        . shift_lock_suffix($pdo));
    $statement->execute([$storeId, $id, $id]);
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $transfer) {
        $sourceOpened = $transfer['source_shift_id'] === $id ? $openedAt : $transfer['source_opened'];
        $receiverOpened = $transfer['shift_id'] === $id ? $openedAt : $transfer['receiver_opened'];
        if ($transfer['source_store'] !== $storeId || $transfer['receiver_store'] !== $storeId
            || substr($sourceOpened, 0, 10) !== substr($receiverOpened, 0, 10) || $sourceOpened >= $receiverOpened) {
            throw new ShiftManagementError('Giờ mở ca mới làm sai ngày hoặc thứ tự ca của phiếu thu từ ca trước. Hủy phiếu chuyển ca trước khi điều chỉnh.');
        }
    }
}

function shift_management_correct(PDO $pdo, string $storeId, array $user, array $input): array
{
    shift_require_admin($user);
    $id = trim((string)($input['id'] ?? ''));
    $reason = trim((string)($input['reason'] ?? ''));
    if ($reason === '' || mb_strlen($reason) > 1000) throw new ShiftManagementError('Nhập lý do điều chỉnh, tối đa 1000 ký tự.');
    if (($input['reviewed'] ?? false) !== true) throw new ShiftManagementError('Cần xác nhận đã kiểm tra hóa đơn và phiếu thu/chi.');
    $openedAt = shift_management_datetime($input['openedAt'] ?? '');
    $closedAt = empty($input['closedAt']) ? null : shift_management_datetime($input['closedAt']);
    if ($closedAt !== null && $closedAt < $openedAt) throw new ShiftManagementError('Giờ đóng ca phải từ giờ mở ca trở đi.');
    if ($openedAt > date('Y-m-d H:i:s') || ($closedAt !== null && $closedAt > date('Y-m-d H:i:s'))) {
        throw new ShiftManagementError('Không được đặt thời gian ca trong tương lai.');
    }
    $transfers = $input['transfers'] ?? [];
    if (!is_array($transfers) || count($transfers) > 5000) throw new ShiftManagementError('Danh sách chuyển hóa đơn không hợp lệ.');
    $targets = [];
    foreach ($transfers as $move) {
        if (!is_array($move) || empty($move['billId']) || empty($move['targetShiftId']) || $move['targetShiftId'] === $id || isset($targets[$move['billId']])) {
            throw new ShiftManagementError('Hóa đơn hoặc ca đích không hợp lệ / bị trùng.');
        }
        $targets[(string)$move['billId']] = (string)$move['targetShiftId'];
    }
    shift_management_find($pdo, $storeId, $id);
    cash_transfers_ensure_schema($pdo);
    $pdo->beginTransaction();
    try {
        // Lock all involved shifts in a stable order to serialize corrections and POS writes.
        $ids = array_unique(array_merge([$id], array_values($targets)));
        sort($ids, SORT_STRING);
        $shifts = [];
        foreach ($ids as $shiftId) {
            try { $shifts[$shiftId] = shift_management_find($pdo, $storeId, $shiftId, true); }
            catch (ShiftManagementError $e) { if ($shiftId !== $id) throw new ShiftManagementError('Ca đích không tồn tại hoặc thuộc chi nhánh khác.'); throw $e; }
        }
        $review = shift_management_review($pdo, $storeId, $id, true);
        if (!hash_equals($review['reviewToken'], (string)($input['reviewToken'] ?? ''))) {
            throw new ShiftManagementError('Ca, hóa đơn hoặc phiếu thu/chi đã thay đổi. Tải lại ca và kiểm tra trước khi lưu.', 409);
        }
        $source = $review['shift'];
        if (($source['status'] === 'closed') !== ($closedAt !== null)) {
            throw new ShiftManagementError('Chỉnh giờ không thay đổi trạng thái ca. Ca đang mở phải đóng qua quy trình bàn giao.');
        }
        $byId = array_column($review['bills'], null, 'id');
        foreach ($targets as $billId => $targetId) {
            $bill = $byId[$billId] ?? null;
            $target = $shifts[$targetId];
            if (!$bill || $bill['store_id'] !== $storeId) throw new ShiftManagementError('Hóa đơn không còn thuộc ca đang sửa.');
            if ($bill['created_at'] < $target['opened_at'] || (!empty($target['closed_at']) && $bill['created_at'] > $target['closed_at'])) {
                throw new ShiftManagementError('Hóa đơn ' . $billId . ' nằm ngoài thời gian ca đích.');
            }
        }
        shift_validate_cash_transfer_times($pdo, $storeId, $id, $openedAt);
        $before = $shifts;
        $pdo->prepare('UPDATE cashier_shifts SET opened_at=?,closed_at=? WHERE id=? AND store_id=?')->execute([$openedAt,$closedAt,$id,$storeId]);
        foreach ($targets as $billId => $targetId) {
            $pdo->prepare('UPDATE bills SET shift_id=? WHERE id=? AND shift_id=? AND store_id=?')->execute([$targetId,$billId,$id,$storeId]);
        }
        $after = [];
        foreach ($shifts as $shiftId => $shift) {
            shift_management_recalculate($pdo, $shift);
            $after[$shiftId] = shift_management_find($pdo,$storeId,$shiftId);
        }
        $json = static fn($data) => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $pdo->prepare('INSERT INTO cashier_shift_corrections (store_id,shift_id,actor_id,actor_name,reason,before_json,after_json,transfers_json) VALUES (?,?,?,?,?,?,?,?)')->execute([
            $storeId,$id,(string)$user['id'],(string)($user['display_name'] ?? $user['displayName'] ?? $user['email'] ?? $user['id']),$reason,$json($before),$json($after),$json($transfers),
        ]);
        $pdo->commit();
        return ['updated'=>true,'affectedShiftIds'=>array_values($ids),'movedBills'=>count($targets)];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function shift_validate_close_preview(array $current, array $preview, ?string $expectedOpenedAt): void
{
    if ($expectedOpenedAt !== null && $expectedOpenedAt !== $current['opened_at']) {
        throw new ShiftManagementError('Giờ mở ca đã được điều chỉnh. Tải lại đối soát trước khi đóng ca.', 409);
    }
    $map = ['cashSales'=>'cash_sales','transferSales'=>'transfer_sales','totalSales'=>'total_sales','completedBills'=>'completed_bills','cancelledBills'=>'cancelled_bills','cancelledAmount'=>'cancelled_amount','incomeVouchers'=>'income_vouchers','expenseVouchers'=>'expense_vouchers','netCashFlow'=>'net_cash_flow','expectedClosingCash'=>'expected_closing_cash'];
    foreach ($map as $key => $column) {
        if (!isset($preview[$key]) || !is_numeric($preview[$key]) || abs((float)$preview[$key] - (float)$current[$column]) > 0.01) {
            throw new ShiftManagementError('Dữ liệu ca đã thay đổi. Bấm tải lại đối soát trước khi đóng ca.', 409);
        }
    }
}
