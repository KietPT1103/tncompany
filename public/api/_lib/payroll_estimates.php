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

function payroll_estimates_assert_unique_period(PDO $pdo, string $store, string $start, string $end, string $exclude = ''): void
{
    foreach ([$start, $end] as $value) {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('Khoảng ngày không hợp lệ.');
    }
    if ($start > $end) throw new InvalidArgumentException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    if ($exclude !== '') {
        $current = $pdo->prepare('SELECT period_start,period_end FROM payrolls WHERE id=:id AND store_id=:store');
        $current->execute(['id'=>$exclude,'store'=>$store]);
        $period = $current->fetch(PDO::FETCH_ASSOC);
        // Existing duplicate records remain editable when their period is unchanged.
        if ($period && $period['period_start'] === $start && $period['period_end'] === $end) return;
    }
    $query = $pdo->prepare('SELECT p.id FROM payrolls p WHERE '.payroll_estimates_filter().'
        AND p.period_start=:start AND p.period_end=:end AND p.id<>:exclude LIMIT 1');
    $query->execute(['store'=>$store,'legacy'=>'Ước tính lương %','start'=>$start,'end'=>$end,'exclude'=>$exclude]);
    if ($query->fetchColumn() !== false) {
        throw new DomainException('Đã có lịch ước tính lương cho khoảng ngày này tại cửa hàng. Vui lòng mở lịch trong Lịch phân ca đã lưu để chỉnh sửa.');
    }
}

// Serialize estimate writes per store, including concurrent requests from different tabs.
function payroll_estimates_lock_store(PDO $pdo, string $store): string
{
    $key = 'estimate:'.substr(hash('sha256', $store), 0, 50);
    $query = $pdo->prepare('SELECT GET_LOCK(:key, 10)');
    $query->execute(['key'=>$key]);
    if ((int)$query->fetchColumn() !== 1) throw new RuntimeException('Lịch đang được lưu ở phiên khác. Vui lòng thử lại.');
    return $key;
}

function payroll_estimates_unlock_store(PDO $pdo, string $key): void
{
    $query = $pdo->prepare('SELECT RELEASE_LOCK(:key)');
    $query->execute(['key'=>$key]);
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

function payroll_estimates_employee_id(PDO $pdo, string $store, array $entry): string
{
    $id = trim((string)($entry['employeeId'] ?? ''));
    $query = $pdo->prepare('SELECT store_id FROM employees WHERE id=:id');
    $query->execute(['id'=>$id]);
    $employeeStore = $query->fetchColumn();
    $allowedStores = in_array($store, ['cafe','restaurant'], true) ? ['cafe','restaurant'] : [$store];
    if ($id === '' || !in_array($employeeStore, $allowedStores, true)) throw new InvalidArgumentException('Nhân viên không thuộc cửa hàng được phân ca. Vui lòng tải lại danh sách nhân viên.');
    // Scheduling another role must not overwrite the employee's profile or salary settings.
    return $id;
}

function payroll_estimates_totals(array $entries, string $start, string $end): array
{
    $hours = 0.0; $salary = 0.0; $people = []; $monthlyDays = []; $cells = [];
    foreach ($entries as $index=>$entry) {
        $person = (string)($entry['employee_id'] ?? $entry['id'] ?? $index);
        $shifts = json_decode((string)($entry['shifts_json'] ?? '[]'), true);
        // Very old records without shift details can only use their saved aggregates.
        if (!is_array($shifts) || !$shifts) {
            $people[$person] = true;
            $hours += (float)($entry['total_hours'] ?? 0);
            $salary += (float)($entry['salary'] ?? 0);
            continue;
        }
        $monthly = in_array($entry['salary_type'] ?? '', ['monthly','fixed'], true);
        $rate = $monthly ? (float)(($entry['monthly_salary'] ?? 0) ?: ($entry['fixed_salary'] ?? 0)) / 30 : (float)($entry['hourly_rate'] ?? 0);
        foreach ($shifts as $shiftIndex=>$shift) {
            if (!is_array($shift) || ($shift['isValid'] ?? true) === false) continue;
            if (($shift['excludedFromEstimate'] ?? false) === true) continue;
            $date = str_replace('/', '-', (string)($shift['date'] ?? substr((string)($shift['inTime'] ?? ''),0,10)));
            if ($date < $start || $date > $end || !is_numeric($shift['hours'] ?? null) || (float)$shift['hours'] <= 0) continue;
            $role = (string)($shift['role'] ?? $entry['role'] ?? '');
            $slot = isset($shift['inTime'],$shift['outTime']) ? $shift['inTime'].'|'.$shift['outTime'] : (string)$shiftIndex;
            $cell = $person.'|'.$date.'|'.$role.'|'.$slot;
            if (isset($cells[$cell])) continue;
            $cells[$cell] = true; $people[$person] = true;
            $hours += (float)$shift['hours'];
            if ($monthly) {
                if (isset($monthlyDays[$person][$date])) continue;
                $monthlyDays[$person][$date] = true;
                $salary += $rate;
            } else $salary += (float)$shift['hours'] * $rate;
        }
    }
    return ['employee_count'=>count($people),'total_hours'=>$hours,'total_salary'=>$salary,'employee_keys'=>array_keys($people)];
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
    $stmt = $pdo->prepare("SELECT p.* FROM payrolls p WHERE $filter
        ORDER BY COALESCE(p.updated_at,p.created_at) DESC,p.created_at DESC,p.id DESC
        LIMIT 10 OFFSET ".(($page-1)*10));
    $stmt->execute($params);
    $items = $stmt->fetchAll();
    if ($items) {
        $entries = $pdo->prepare('SELECT * FROM payroll_entries WHERE payroll_id IN ('.implode(',',array_fill(0,count($items),'?')).')');
        $entries->execute(array_column($items,'id'));
        $byPayroll = [];
        foreach ($entries->fetchAll() as $entry) $byPayroll[$entry['payroll_id']][] = $entry;
        foreach ($items as &$item) {
            $savedEntries = $byPayroll[$item['id']] ?? [];
            $item['roles'] = payroll_estimates_roles($savedEntries);
            $item = array_merge($item,payroll_estimates_totals($savedEntries,(string)$item['period_start'],(string)$item['period_end']));
        }
        unset($item);
    }
    $summary = null;
    if ($start !== '') {
        $totals = $pdo->prepare("SELECT e.* FROM payroll_entries e JOIN payrolls p ON p.id=e.payroll_id WHERE $filter");
        $totals->execute($params);
        $groups = []; $people = []; $hours = 0.0; $salary = 0.0;
        foreach ($totals->fetchAll() as $entry) $groups[$entry['payroll_id']][] = $entry;
        foreach ($groups as $group) {
            $total = payroll_estimates_totals($group,$start,$end);
            $hours += $total['total_hours']; $salary += $total['total_salary'];
            foreach ($total['employee_keys'] as $key) $people[$key] = true;
        }
        $scheduleCount = $pdo->prepare("SELECT COUNT(*) FROM payrolls p WHERE $filter");
        $scheduleCount->execute($params);
        $summary = ['startDate'=>$start,'endDate'=>$end,'scheduleCount'=>(int)$scheduleCount->fetchColumn(),
            'employeeCount'=>count($people),'totalHours'=>$hours,'totalSalary'=>round($salary,2)];
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
    $row = array_merge($row,payroll_estimates_totals($entries,(string)$row['period_start'],(string)$row['period_end']));
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
