<?php
declare(strict_types=1);
require __DIR__.'/../public/api/_lib/employee_codes.php';
function verify_employee_code(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE employees (id INTEGER PRIMARY KEY, store_id TEXT, employee_code TEXT, UNIQUE(store_id,employee_code))');
verify_employee_code(employees_next_code($pdo) === '00001', 'Start with a padded numeric code');
$pdo->exec("INSERT INTO employees (store_id,employee_code) VALUES ('cafe','00001'),('restaurant','2'),('farm','00003'),('cafe','NV04'),('cafe',''),('cafe','999999999999999999999999999999')");
verify_employee_code(employees_next_code($pdo) === '00004', 'Skip codes from every store and equivalent numeric codes without overflowing');
$insert = function (string $code) use ($pdo): void {
    $stmt = $pdo->prepare("INSERT INTO employees (store_id,employee_code) VALUES ('cafe',?)");
    $stmt->execute([$code]);
};
$code = employees_insert_with_code($pdo, '', $insert);
verify_employee_code($code === '00004' && employees_next_code($pdo) === '00005', 'Automatically allocate and persist code');
verify_employee_code(employees_insert_with_code($pdo,' 00125 ',$insert) === '00125', 'Preserve explicit codes for existing clients');
$calls = 0;
$racedCode = employees_insert_with_code($pdo, '', function (string $code) use ($insert, &$calls): void {
    if ($calls++ === 0) $insert($code); // Another request has just taken this code.
    $insert($code);
});
verify_employee_code($calls === 2 && $racedCode === '00006', 'Retry using fresh database state on a duplicate-code race');
$failed = false;
try { employees_insert_with_code($pdo,'00125',$insert); } catch (PDOException $exception) { $failed = true; }
verify_employee_code($failed, 'Explicit duplicate codes are never silently changed');
$failed = false;
try { employees_insert_with_code($pdo,'',static function (string $code): void { throw new RuntimeException('insert failed'); }); } catch (RuntimeException $exception) { $failed = true; }
verify_employee_code($failed && employees_next_code($pdo) === '00007', 'Other insert errors propagate without claiming a code');
echo "PASS employee codes: automatic generation, global lookup, numeric compatibility, persistence and race recovery\n";
