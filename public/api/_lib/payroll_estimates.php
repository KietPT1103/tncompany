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
        'roles'=>$row['roles'] ?? [],
    ];
}

function payroll_estimates_filter(): string
{
    // Older estimate schedules were saved using the import source, with this generated name.
    return "p.store_id=:store AND (p.source='payroll_estimate' OR (p.source='timesheet_import' AND p.name LIKE :legacy))";
}

function payroll_estimates_roles(array $entries): array
{
    $roles = [];
    foreach ($entries as $entry) {
        $shifts = json_decode((string)($entry['shifts_json'] ?? '[]'),true);
        $assigned = [];
        if (is_array($shifts)) foreach ($shifts as $shift) {
            if (!is_array($shift)) continue;
            $role = trim((string)($shift['role'] ?? $entry['role'] ?? ''));
            if ($role !== '') $assigned[$role] = true;
        }
        if (!$assigned && trim((string)($entry['role'] ?? '')) !== '') $assigned[trim($entry['role'])] = true;
        $roles += $assigned;
    }
    return array_keys($roles);
}

function payroll_estimates_list(PDO $pdo, string $store, int $page, string $start = '', string $end = ''): array
{
    if ($page < 1 || $page > 100000) throw new InvalidArgumentException('Trang không hợp lệ.');
    $params = ['store'=>$store,'legacy'=>'Ước tính lương %'];
    $filter = payroll_estimates_filter();
    if ($start !== '' || $end !== '') {
        foreach ([$start,$end] as $date) {
            $parsed = DateTimeImmutable::createFromFormat('!Y-m-d',$date);
            if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new InvalidArgumentException('Khoảng ngày không hợp lệ.');
        }
        if ($start > $end) throw new InvalidArgumentException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
        $filter .= ' AND p.period_start=:start AND p.period_end=:end';
        $params += ['start'=>$start,'end'=>$end];
    }
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
    $items = $stmt->fetchAll();
    if ($items) {
        $entries = $pdo->prepare('SELECT payroll_id,role,shifts_json FROM payroll_entries WHERE payroll_id IN ('.implode(',',array_fill(0,count($items),'?')).')');
        $entries->execute(array_column($items,'id'));
        $byPayroll = [];
        foreach ($entries->fetchAll() as $entry) $byPayroll[$entry['payroll_id']][] = $entry;
        foreach ($items as &$item) $item['roles'] = payroll_estimates_roles($byPayroll[$item['id']] ?? []);
        unset($item);
    }
    $summary = null;
    if ($start !== '') {
        $totals = $pdo->prepare("SELECT COUNT(DISTINCT p.id) AS schedule_count, COUNT(DISTINCT e.employee_id) AS employee_count,
            SUM(e.total_hours) AS total_hours,SUM(e.salary) AS total_salary
            FROM payrolls p LEFT JOIN payroll_entries e ON e.payroll_id=p.id WHERE $filter");
        $totals->execute($params);
        $row = $totals->fetch();
        $summary = ['startDate'=>$start,'endDate'=>$end,'scheduleCount'=>(int)$row['schedule_count'],
            'employeeCount'=>(int)$row['employee_count'],'totalHours'=>(float)($row['total_hours'] ?? 0),
            'totalSalary'=>round((float)($row['total_salary'] ?? 0),2)];
    }
    return ['items'=>array_map('payroll_estimates_map',$items),'total'=>(int)$count->fetchColumn(),'page'=>$page,'summary'=>$summary];
}

function payroll_estimates_detail(PDO $pdo, string $store, string $id): ?array
{
    $stmt = $pdo->prepare('SELECT p.* FROM payrolls p WHERE '.payroll_estimates_filter().' AND p.id=:id');
    $stmt->execute(['store'=>$store,'legacy'=>'Ước tính lương %','id'=>$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $stmt = $pdo->prepare('SELECT * FROM payroll_entries WHERE payroll_id=:id ORDER BY id');
    $stmt->execute(['id'=>$id]);
    $entries = $stmt->fetchAll();
    $row['roles'] = payroll_estimates_roles($entries);
    return ['schedule'=>payroll_estimates_map($row),'entries'=>$entries];
}

function payroll_estimates_delete(PDO $pdo, string $store, string $id): bool
{
    return payroll_estimates_delete_many($pdo, $store, [$id]);
}

function payroll_estimates_delete_many(PDO $pdo, string $store, array $ids): bool
{
    if (count($ids) < 1 || count($ids) > 100) throw new InvalidArgumentException('Chọn từ 1 đến 100 lịch để xoá.');
    foreach ($ids as $id) {
        if (!is_string($id) || trim($id) === '' || strlen($id) > 64) throw new InvalidArgumentException('Mã lịch không hợp lệ.');
    }
    if (count(array_unique($ids)) !== count($ids)) throw new InvalidArgumentException('Danh sách lịch bị trùng.');

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('DELETE FROM payrolls WHERE id=:id AND store_id=:store
            AND (source=\'payroll_estimate\' OR (source=\'timesheet_import\' AND name LIKE :legacy))');
        $deleteEntries = $pdo->prepare('DELETE FROM payroll_entries WHERE payroll_id=:id');
        foreach ($ids as $id) {
            $stmt->execute(['id'=>$id, 'store'=>$store, 'legacy'=>'Ước tính lương %']);
            if ($stmt->rowCount() !== 1) {
                $pdo->rollBack();
                return false;
            }
            $deleteEntries->execute(['id'=>$id]);
        }
        $pdo->commit();
        return true;
    } catch (Throwable $exception) {
        $pdo->rollBack();
        throw $exception;
    }
}
