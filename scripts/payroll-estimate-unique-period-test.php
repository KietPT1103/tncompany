<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/payroll_estimates.php';
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE payrolls (id TEXT,store_id TEXT,name TEXT,source TEXT,period_start TEXT,period_end TEXT)');
$insert = $pdo->prepare('INSERT INTO payrolls VALUES (?,?,?,?,?,?)');
$insert->execute(['new','cafe','Lịch tuần','payroll_estimate','2026-11-02','2026-11-08']);
$insert->execute(['old','cafe','Ước tính lương 26-10 - 01-11','timesheet_import','2026-10-26','2026-11-01']);
$insert->execute(['actual','cafe','Bảng lương','timesheet_import','2026-10-01','2026-10-31']);
function check_period(PDO $pdo,string $store,string $start,string $end,string $exclude='',bool $blocked=false): void {
    try { payroll_estimates_assert_unique_period($pdo,$store,$start,$end,$exclude); }
    catch (DomainException $error) { if ($blocked) return; throw $error; }
    if ($blocked) throw new RuntimeException('Duplicate estimate must be blocked');
}
check_period($pdo,'cafe','2026-11-02','2026-11-08','',true);
check_period($pdo,'cafe','2026-10-26','2026-11-01','',true);
check_period($pdo,'cafe','2026-11-02','2026-11-08','new');
check_period($pdo,'cafe','2026-11-02','2026-11-08','old',true);
check_period($pdo,'restaurant','2026-11-02','2026-11-08');
check_period($pdo,'cafe','2026-11-03','2026-11-08');
check_period($pdo,'cafe','2026-10-01','2026-10-31');
$insert->execute(['duplicate','cafe','Lịch trùng cũ','payroll_estimate','2026-11-02','2026-11-08']);
check_period($pdo,'cafe','2026-11-02','2026-11-08','new');
foreach ([['','2026-11-08'],['2026-02-30','2026-03-01'],['2026-11-08','2026-11-02']] as [$start,$end]) {
    try { payroll_estimates_assert_unique_period($pdo,'cafe',$start,$end); }
    catch (InvalidArgumentException $error) { continue; }
    throw new RuntimeException('Invalid period must be rejected');
}
echo "PASS duplicate periods: new, legacy, self-edit, another store, different period, actual payroll and invalid dates\n";
