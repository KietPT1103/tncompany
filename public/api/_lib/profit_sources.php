<?php
declare(strict_types=1);

function profit_source_table_exists(PDO $pdo, string $table): bool
{
    $sql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? "SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name"
        : 'SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=:name';
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['name'=>$table]);
    return (bool)$stmt->fetchColumn();
}

// Match the estimate page: hourly shifts plus one monthly salary / 30 per employee/day.
function profit_source_salary(PDO $pdo, string $store, array $dates): array
{
    $result = array_fill_keys($dates, null);
    if (!profit_source_table_exists($pdo, 'payrolls') || !profit_source_table_exists($pdo, 'payroll_entries')) return $result;
    $stmt = $pdo->prepare("SELECT id,name,period_start,period_end FROM payrolls
        WHERE store_id=:store AND period_start<=:end AND period_end>=:start
        AND (source='payroll_estimate' OR name LIKE :legacy)
        ORDER BY COALESCE(updated_at,created_at) DESC,created_at DESC,id DESC");
    $stmt->execute(['store'=>$store,'start'=>$dates[0],'end'=>$dates[count($dates)-1],'legacy'=>'Ước tính lương %']);
    $reports = $stmt->fetchAll();
    if (!$reports) return $result;
    $ids = array_column($reports, 'id');
    $entries = $pdo->prepare('SELECT payroll_id,employee_id,hourly_rate,salary_type,monthly_salary,fixed_salary,shifts_json FROM payroll_entries WHERE payroll_id IN ('.implode(',', array_fill(0,count($ids),'?')).')');
    $entries->execute($ids);
    $amounts = []; $invalid = []; $monthlyDays = [];
    foreach ($entries->fetchAll() as $entryIndex => $entry) {
        $shifts = json_decode((string)$entry['shifts_json'], true);
        if (!is_array($shifts)) { $invalid[$entry['payroll_id']] = true; continue; }
        $isMonthly = in_array($entry['salary_type'], ['monthly','fixed'], true);
        $rate = $isMonthly ? (float)($entry['monthly_salary'] ?: $entry['fixed_salary']) / 30 : (float)$entry['hourly_rate'];
        $employeeKey = (string)($entry['employee_id'] ?: 'row:'.$entryIndex);
        foreach ($shifts as $shift) {
            if (!is_array($shift)) { $invalid[$entry['payroll_id']] = true; continue; }
            if (isset($shift['isValid']) && !$shift['isValid']) continue;
            $date = str_replace('/', '-', (string)($shift['date'] ?? ''));
            $hours = $shift['hours'] ?? null;
            if (!is_numeric($hours) || (float)$hours < 0 || !is_finite((float)$hours) || $rate < 0 || !is_finite($rate)) {
                $invalid[$entry['payroll_id']] = true; continue;
            }
            if ($isMonthly) {
                if ((float)$hours === 0.0 || isset($monthlyDays[$entry['payroll_id']][$employeeKey][$date])) continue;
                $monthlyDays[$entry['payroll_id']][$employeeKey][$date] = true;
            }
            $amount = $isMonthly ? $rate : (float)$hours*$rate;
            $amounts[$entry['payroll_id']][$date] = ($amounts[$entry['payroll_id']][$date] ?? 0) + $amount;
        }
    }
    foreach ($dates as $date) foreach ($reports as $report) {
        if ($date < $report['period_start'] || $date > $report['period_end']) continue;
        $result[$date] = ['amount'=>isset($invalid[$report['id']]) ? null : daily_profit_money($amounts[$report['id']][$date] ?? 0, 'ước lượng lương'), 'payrollId'=>$report['id'],'name'=>$report['name']];
        break; // One latest report for the whole day, never sum overlapping versions.
    }
    return $result;
}

function profit_source_costs(PDO $pdo, string $store): array
{
    $stmt = $pdo->prepare('SELECT id,product_code,cost,has_cost FROM products WHERE store_id=:store');
    $stmt->execute(['store'=>$store]);
    $products = $stmt->fetchAll();
    $ingredients = []; $parts = []; $recipes = [];
    if (profit_source_table_exists($pdo, 'ingredients') && profit_source_table_exists($pdo, 'product_ingredients')) {
        $stmt = $pdo->prepare('SELECT id,cost,conversion_source_ingredient_id,conversion_input_quantity,conversion_output_quantity FROM ingredients WHERE store_id=:store');
        $stmt->execute(['store'=>$store]);
        foreach ($stmt->fetchAll() as $row) $ingredients[$row['id']] = $row;
        $stmt = $pdo->prepare('SELECT product_id,ingredient_id,quantity FROM product_ingredients WHERE store_id=:store');
        $stmt->execute(['store'=>$store]);
        foreach ($stmt->fetchAll() as $row) $recipes[$row['product_id']][] = $row;
        if ($ingredients && profit_source_table_exists($pdo, 'ingredient_components')) {
            $stmt = $pdo->prepare('SELECT parent_ingredient_id,component_ingredient_id,input_quantity FROM ingredient_components WHERE parent_ingredient_id IN ('.implode(',',array_fill(0,count($ingredients),'?')).')');
            $stmt->execute(array_keys($ingredients));
            foreach ($stmt->fetchAll() as $row) $parts[$row['parent_ingredient_id']][] = $row;
        }
    }
    $memo = [];
    $costOf = function(string $id, array $visiting = []) use (&$costOf,&$memo,$ingredients,$parts): ?float {
        if (array_key_exists($id,$memo)) return $memo[$id];
        if (isset($visiting[$id]) || !isset($ingredients[$id])) return null;
        $visiting[$id] = true;
        $row = $ingredients[$id]; $output = (float)$row['conversion_output_quantity'];
        if (!empty($parts[$id])) {
            if ($output <= 0) return $memo[$id] = null;
            $total = 0;
            foreach ($parts[$id] as $part) {
                $quantity = (float)$part['input_quantity'];
                if ($quantity < 0 || !is_finite($quantity)) return $memo[$id] = null;
                if ($quantity === 0.0) continue;
                $cost = $costOf((string)$part['component_ingredient_id'],$visiting);
                if ($cost === null) return $memo[$id] = null;
                $total += $quantity*$cost;
            }
            return $memo[$id] = $total/$output;
        }
        if (!empty($row['conversion_source_ingredient_id']) && (float)$row['conversion_input_quantity'] > 0 && $output > 0) {
            $cost = $costOf((string)$row['conversion_source_ingredient_id'],$visiting);
            return $memo[$id] = $cost === null ? null : $cost*(float)$row['conversion_input_quantity']/$output;
        }
        $cost = $row['cost'] === null ? null : (float)$row['cost'];
        return $memo[$id] = $cost !== null && is_finite($cost) && $cost >= 0 ? $cost : null;
    };
    $result = [];
    foreach ($products as $product) {
        $cost = $product['cost'] !== null && !empty($product['has_cost']) ? daily_profit_money((float)$product['cost'],'cost món') : null;
        $source = $cost === null ? null : 'catalog';
        if ($cost === null && !empty($recipes[$product['id']])) {
            $cost = 0;
            foreach ($recipes[$product['id']] as $part) {
                $quantity = (float)$part['quantity'];
                $unit = $quantity === 0.0 ? 0 : $costOf((string)$part['ingredient_id']);
                if ($unit === null || $quantity < 0 || !is_finite($quantity)) { $cost = null; break; }
                $cost += $quantity*$unit;
            }
            if ($cost !== null) { $cost = daily_profit_money($cost,'cost công thức'); $source = 'recipe'; }
        }
        $result[$product['product_code']] = ['unitCost'=>$cost,'costSource'=>$source];
    }
    return $result;
}
