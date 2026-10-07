<?php
declare(strict_types=1);

function payroll_estimates_map(array $row): array
{
    return [
        'id'=>(string)$row['id'], 'storeId'=>(string)$row['store_id'], 'name'=>(string)$row['name'],
        'status'=>(string)$row['status'], 'startDate'=>$row['period_start'], 'endDate'=>$row['period_end'],
        'createdAt'=>$row['created_at'], 'updatedAt'=>$row['updated_at'] ?: $row['created_at'],
        'employeeCount'=>(int)($row['employee_count'] ?? 0), 'totalHours'=>(float)($row['total_hours'] ?? 0),
        'totalSalary'=>(float)($row['total_salary'] ?? 0),
    ];
}

function payroll_estimates_filter(): string
{
    // Older estimate schedules were saved using the import source, with this generated name.
    return "p.store_id=:store AND (p.source='payroll_estimate' OR (p.source='timesheet_import' AND p.name LIKE :legacy))";
}

function payroll_estimates_list(PDO $pdo, string $store, int $page): array
{
    if ($page < 1 || $page > 100000) throw new InvalidArgumentException('Trang không hợp lệ.');
    $params = ['store'=>$store,'legacy'=>'Ước tính lương %'];
    $filter = payroll_estimates_filter();
    $count = $pdo->prepare("SELECT COUNT(*) FROM payrolls p WHERE $filter");
    $count->execute($params);
    $stmt = $pdo->prepare("SELECT p.*,
        (SELECT COUNT(DISTINCT e.employee_id) FROM payroll_entries e WHERE e.payroll_id=p.id) AS employee_count,
        (SELECT SUM(e.total_hours) FROM payroll_entries e WHERE e.payroll_id=p.id) AS total_hours,
        (SELECT SUM(e.salary) FROM payroll_entries e WHERE e.payroll_id=p.id) AS total_salary
        FROM payrolls p WHERE $filter
        ORDER BY COALESCE(p.updated_at,p.created_at) DESC,p.created_at DESC,p.id DESC
        LIMIT 10 OFFSET ".(($page-1)*10));
    $stmt->execute($params);
    return ['items'=>array_map('payroll_estimates_map',$stmt->fetchAll()),'total'=>(int)$count->fetchColumn(),'page'=>$page];
}

function payroll_estimates_detail(PDO $pdo, string $store, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT p.* FROM payrolls p WHERE '.payroll_estimates_filter().' AND p.id=:id');
    $stmt->execute(['store'=>$store,'legacy'=>'Ước tính lương %','id'=>$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $stmt = $pdo->prepare('SELECT * FROM payroll_entries WHERE payroll_id=:id ORDER BY id');
    $stmt->execute(['id'=>$id]);
    return ['schedule'=>payroll_estimates_map($row),'entries'=>$stmt->fetchAll()];
}

function payroll_estimates_delete(PDO $pdo, string $store, string $id): bool
{
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('DELETE FROM payrolls WHERE id=:id AND store_id=:store
            AND (source=\'payroll_estimate\' OR (source=\'timesheet_import\' AND name LIKE :legacy))');
        $stmt->execute(['id'=>$id, 'store'=>$store, 'legacy'=>'Ước tính lương %']);
        if ($stmt->rowCount() !== 1) {
            $pdo->rollBack();
            return false;
        }
        $stmt = $pdo->prepare('DELETE FROM payroll_entries WHERE payroll_id=:id');
        $stmt->execute(['id'=>$id]);
        $pdo->commit();
        return true;
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}
