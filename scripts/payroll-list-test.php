<?php
declare(strict_types=1);

// Execute the list query from the endpoint against an isolated database.
$source = file_get_contents(__DIR__.'/../public/api/payrolls.php');
if (!preg_match('/"(SELECT id, store_id, name, status, period_start, period_end, created_at\s+FROM payrolls\s+WHERE store_id = :store_id.*?)"/s', $source, $match)) {
    throw new RuntimeException('Payroll list query not found');
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE payrolls (id TEXT, store_id TEXT, name TEXT, source TEXT, status TEXT, period_start TEXT, period_end TEXT, created_at TEXT)');
$insert = $pdo->prepare('INSERT INTO payrolls (id,store_id,name,source,created_at) VALUES (?,?,?,?,?)');
foreach ([
    ['actual','cafe','Bảng lương tháng 10','timesheet_import','2026-10-31'],
    ['manual','cafe','Lương phụ thợ',null,'2026-10-30'],
    ['empty','cafe','Kỳ lương cũ','','2026-10-29'],
    ['estimate','cafe','Lịch tuần','payroll_estimate','2026-11-02'],
    ['legacy','cafe','Ước tính lương 26-10 - 01-11','timesheet_import','2026-11-01'],
    ['other','restaurant','Bảng lương bếp','timesheet_import','2026-10-31'],
] as $row) $insert->execute($row);
$query = $pdo->prepare($match[1]);
$query->execute(['store_id'=>'cafe']);
$ids = $query->fetchAll(PDO::FETCH_COLUMN);
if ($ids !== ['actual','manual','empty']) throw new RuntimeException('Actual payroll list must exclude new and legacy estimates: '.json_encode($ids));
if ((int)$pdo->query('SELECT COUNT(*) FROM payrolls')->fetchColumn() !== 6) throw new RuntimeException('Filtering must not remove records');
echo "PASS payroll list excludes estimates and retains actual payrolls, legacy null sources and store scope\n";
