<?php
declare(strict_types=1);

/** Summaries are keyed by stable employee ID; renamed/reused codes never merge history. */
function employees_payroll_summary(PDO $db, string $storeId): array
{
    $statement = $db->prepare(
        'SELECT pe.employee_id, MAX(p.period_end) AS last_payroll_date, COUNT(DISTINCT p.id) AS payroll_count
         FROM payroll_entries pe
         INNER JOIN payrolls p ON p.id = pe.payroll_id
         WHERE p.store_id = :store_id AND pe.employee_id IS NOT NULL
         GROUP BY pe.employee_id'
    );
    $statement->execute(['store_id' => $storeId]);
    $result = [];
    foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $result[(string)$row['employee_id']] = [
            'lastPayrollDate' => $row['last_payroll_date'] ?: null,
            'payrollCount' => (int)$row['payroll_count'],
        ];
    }
    return $result;
}

/** A batch either deletes every selected employee in this store, or deletes none. */
function employees_delete_many(PDO $db, string $storeId, array $ids): int
{
    $ids = array_values(array_unique(array_filter(array_map(
        static fn($id): string => is_string($id) ? trim($id) : '', $ids
    ))));
    if ($storeId === '' || $ids === [] || count($ids) > 1000) {
        throw new InvalidArgumentException('Vui lòng chọn từ 1 đến 1000 nhân viên trong một cửa hàng.');
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $db->beginTransaction();
    try {
        // Existing foreign keys use SET NULL; payroll snapshots are deliberately retained.
        $statement = $db->prepare("DELETE FROM employees WHERE store_id = ? AND id IN ($placeholders)");
        $statement->execute(array_merge([$storeId], $ids));
        $deleted = $statement->rowCount();
        if ($deleted !== count($ids)) {
            throw new InvalidArgumentException('Danh sách nhân viên đã thay đổi hoặc có nhân viên thuộc cửa hàng khác. Vui lòng tải lại.');
        }
        $db->commit();
        return $deleted;
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}
