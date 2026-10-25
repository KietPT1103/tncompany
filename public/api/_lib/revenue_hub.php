<?php

declare(strict_types=1);

function revenue_dates(string $from, string $to): array
{
    $zone = new DateTimeZone('Asia/Ho_Chi_Minh');
    $start = DateTimeImmutable::createFromFormat('!Y-m-d', $from, $zone);
    $end = DateTimeImmutable::createFromFormat('!Y-m-d', $to, $zone);
    if (!$start || !$end || $start->format('Y-m-d') !== $from || $end->format('Y-m-d') !== $to
        || $end < $start || $start->diff($end)->days > 92) {
        throw new InvalidArgumentException('Chọn khoảng ngày hợp lệ, tối đa 93 ngày.');
    }
    return [$start, $end->modify('+1 day')];
}

function revenue_empty(): array
{
    return array_fill_keys(['revenue', 'cash', 'transfer', 'expense', 'income', 'cups', 'bakery', 'bills'], 0.0);
}

function revenue_category(string $name): string
{
    $value = mb_strtolower(trim($name));
    return strtr($value, [
        'à'=>'a','á'=>'a','ả'=>'a','ã'=>'a','ạ'=>'a','ă'=>'a','ằ'=>'a','ắ'=>'a','ẳ'=>'a','ẵ'=>'a','ặ'=>'a',
        'â'=>'a','ầ'=>'a','ấ'=>'a','ẩ'=>'a','ẫ'=>'a','ậ'=>'a','è'=>'e','é'=>'e','ẻ'=>'e','ẽ'=>'e','ẹ'=>'e',
        'ê'=>'e','ề'=>'e','ế'=>'e','ể'=>'e','ễ'=>'e','ệ'=>'e','ì'=>'i','í'=>'i','ỉ'=>'i','ĩ'=>'i','ị'=>'i',
        'ò'=>'o','ó'=>'o','ỏ'=>'o','õ'=>'o','ọ'=>'o','ô'=>'o','ồ'=>'o','ố'=>'o','ổ'=>'o','ỗ'=>'o','ộ'=>'o',
        'ơ'=>'o','ờ'=>'o','ớ'=>'o','ở'=>'o','ỡ'=>'o','ợ'=>'o','ù'=>'u','ú'=>'u','ủ'=>'u','ũ'=>'u','ụ'=>'u',
        'ư'=>'u','ừ'=>'u','ứ'=>'u','ử'=>'u','ữ'=>'u','ự'=>'u','ỳ'=>'y','ý'=>'y','ỷ'=>'y','ỹ'=>'y','ỵ'=>'y',
    ]);
}

function revenue_tn(PDO $pdo, string $from, string $to, string $store): array
{
    [$start, $end] = revenue_dates($from, $to);
    $stores = $pdo->query('SELECT id,name FROM stores ORDER BY name')->fetchAll();
    if ($store !== 'all' && !in_array($store, array_column($stores, 'id'), true)) {
        throw new InvalidArgumentException('Quầy không hợp lệ.');
    }
    $days = [];
    for ($date = $start; $date < $end; $date = $date->modify('+1 day')) {
        $shifts = [];
        foreach (['shift_1', 'shift_2', 'shift_3', 'single', 'unassigned'] as $type) {
            $shifts[$type] = revenue_empty();
        }
        $key = $date->format('Y-m-d');
        $days[$key] = ['date' => $key, 'totals' => revenue_empty(), 'shifts' => $shifts];
    }
    $params = [$start->format('Y-m-d H:i:s'), $end->format('Y-m-d H:i:s')];
    $filter = 'b.created_at>=? AND b.created_at<?';
    if ($store !== 'all') {
        $filter .= ' AND b.store_id=?';
        $params[] = $store;
    }
    $shift = "COALESCE(s.shift_type,'unassigned')";
    $join = ' LEFT JOIN cashier_shifts s ON s.id=b.shift_id AND s.store_id=b.store_id ';
    $statement = $pdo->prepare("SELECT DATE(b.created_at) AS day,$shift AS shift_type,
        SUM(b.total) AS revenue,COUNT(*) AS bills,
        SUM(CASE WHEN b.payment_method='transfer' THEN b.total ELSE 0 END) AS transfer,
        SUM(CASE WHEN b.payment_method='transfer' THEN 0 ELSE b.total END) AS cash
        FROM bills b $join WHERE $filter AND b.status='completed' GROUP BY DATE(b.created_at),$shift");
    $statement->execute($params);
    foreach ($statement->fetchAll() as $row) {
        foreach (['revenue', 'bills', 'transfer', 'cash'] as $key) {
            $days[$row['day']]['shifts'][$row['shift_type']][$key] += (float)$row[$key];
        }
    }
    $statement = $pdo->prepare("SELECT DATE(b.created_at) AS day,$shift AS shift_type,c.name AS category,
        c.counts_as_cup AS category_cup,i.counts_as_cup,SUM(i.quantity) AS quantity
        FROM bill_items i JOIN bills b ON b.id=i.bill_id $join
        LEFT JOIN products p ON p.product_code=i.menu_id AND p.store_id=b.store_id
        LEFT JOIN categories c ON c.id=p.category_id
        WHERE $filter AND b.status='completed' AND i.quantity>0
        GROUP BY DATE(b.created_at),$shift,c.name,c.counts_as_cup,i.counts_as_cup");
    $statement->execute($params);
    foreach ($statement->fetchAll() as $row) {
        $name = revenue_category((string)($row['category'] ?? ''));
        $bakery = $name === 'banh';
        $legacyCup = $name !== '';
        foreach (['banh', 'topping', 'do an', 'mon an', 'thuc an'] as $prefix) {
            if ($name === $prefix || str_starts_with($name, $prefix . ' ')) $legacyCup = false;
        }
        $cup = $row['counts_as_cup'] !== null ? (bool)$row['counts_as_cup']
            : ($row['category_cup'] !== null ? (bool)$row['category_cup'] : $legacyCup);
        if ($bakery) $days[$row['day']]['shifts'][$row['shift_type']]['bakery'] += (float)$row['quantity'];
        if ($cup) $days[$row['day']]['shifts'][$row['shift_type']]['cups'] += (float)$row['quantity'];
    }
    $voucherFilter = 'v.happened_at>=? AND v.happened_at<?';
    if ($store !== 'all') $voucherFilter .= ' AND v.store_id=?';
    $statement = $pdo->prepare("SELECT DATE(v.happened_at) AS day,COALESCE(s.shift_type,'unassigned') AS shift_type,
        v.voucher_type,SUM(v.amount) AS amount FROM cash_vouchers v
        LEFT JOIN cashier_shifts s ON s.id=v.shift_id AND s.store_id=v.store_id
        WHERE $voucherFilter AND v.cancelled_at IS NULL AND v.include_in_cash_flow=1
        GROUP BY DATE(v.happened_at),COALESCE(s.shift_type,'unassigned'),v.voucher_type");
    $statement->execute($params);
    foreach ($statement->fetchAll() as $row) {
        if (in_array($row['voucher_type'], ['income', 'expense'], true)) {
            $days[$row['day']]['shifts'][$row['shift_type']][$row['voucher_type']] += (float)$row['amount'];
        }
    }
    $totals = revenue_empty();
    foreach ($days as &$day) {
        foreach ($day['shifts'] as $metrics) {
            foreach ($metrics as $key => $value) $day['totals'][$key] += $value;
        }
        foreach ($day['totals'] as $key => $value) $totals[$key] += $value;
    }
    unset($day);
    return ['version' => 1, 'source' => 'tnservice', 'from' => $from, 'to' => $to,
        'updatedAt' => gmdate(DATE_ATOM), 'totals' => $totals, 'days' => array_reverse(array_values($days)), 'stores' => $stores];
}

// Adding a source requires an explicit server allowlist entry and a frontend renderer.
function revenue_providers(): array
{
    return [
        'tnservice' => static fn(PDO $pdo, string $from, string $to, string $store): array => revenue_tn($pdo, $from, $to, $store),
        'mohomestay' => static fn(PDO $pdo, string $from, string $to, string $store): array => revenue_mo($from, $to),
    ];
}

function revenue_mo(string $from, string $to): array
{
    revenue_dates($from, $to);
    $base = rtrim(trim((string)getenv('REVENUE_MO_URL')), '/');
    $key = trim((string)getenv('REVENUE_MO_KEY'));
    if ($base === '' || strlen($key) < 32) throw new LogicException('MoHomestay chưa kết nối.');
    $url = parse_url($base);
    $local = in_array($url['host'] ?? '', ['127.0.0.1', 'localhost'], true)
        && strtolower((string)getenv('APP_ENV')) === 'local';
    if (!is_array($url) || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])
        || (($url['scheme'] ?? '') !== 'https' && !($local && ($url['scheme'] ?? '') === 'http'))) {
        throw new LogicException('Cấu hình MoHomestay không hợp lệ.');
    }
    $handle = curl_init($base . '/api/integration/revenue?' . http_build_query(['from' => $from, 'to' => $to]));
    curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'X-Revenue-Key: ' . $key]]);
    $body = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    $result = is_string($body) ? json_decode($body, true) : null;
    if ($status !== 200 || !is_array($result) || ($result['version'] ?? null) !== 1
        || ($result['source'] ?? '') !== 'mohomestay' || ($result['from'] ?? '') !== $from
        || ($result['to'] ?? '') !== $to || !is_array($result['totals'] ?? null) || !is_array($result['days'] ?? null)) {
        throw new RuntimeException('Chưa tải được MoHomestay.');
    }
    return $result;
}
