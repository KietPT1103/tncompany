<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/payroll_estimates.php';
$pdo = new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE employees(id TEXT,store_id TEXT,role TEXT,hourly_rate REAL,monthly_salary REAL)');
$pdo->exec("INSERT INTO employees VALUES ('kitchen','restaurant','Phụ bếp',25000,9000000),('cafe','cafe','Thu ngân',20000,0),('farm','farm','Thú y',15000,0)");
$before = $pdo->query('SELECT * FROM employees ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
foreach ([['cafe','kitchen'],['restaurant','cafe'],['farm','farm']] as [$store,$id]) {
    if (payroll_estimates_employee_id($pdo,$store,['employeeId'=>$id,'role'=>'Bếp','hourlyRate'=>0]) !== $id) throw new RuntimeException('Wrong employee identity');
}
foreach ([['cafe','farm'],['farm','kitchen'],['cafe','missing'],['cafe','']] as [$store,$id]) {
    try { payroll_estimates_employee_id($pdo,$store,['employeeId'=>$id]); } catch (InvalidArgumentException $e) { continue; }
    throw new RuntimeException('Invalid employee must be rejected');
}
if ($pdo->query('SELECT * FROM employees ORDER BY id')->fetchAll(PDO::FETCH_ASSOC) !== $before) throw new RuntimeException('Scheduling must preserve employee roles and salary settings');
echo "PASS estimate employee identity: Cafe/kitchen sharing, store scope, original role and salary preserved\n";
