<?php
declare(strict_types=1);

function employees_next_code(PDO $pdo): string
{
    $used = [];
    foreach ($pdo->query('SELECT employee_code FROM employees')->fetchAll(PDO::FETCH_COLUMN) as $code) {
        $code = trim((string)$code);
        if ($code !== '' && ctype_digit($code)) {
            $used[ltrim($code, '0') ?: '0'] = true;
        }
    }
    $next = 1;
    while (isset($used[(string)$next])) $next++;
    return str_pad((string)$next, 5, '0', STR_PAD_LEFT);
}

/** The callback inserts exactly one employee using the supplied code. */
function employees_insert_with_code(PDO $pdo, string $requestedCode, callable $insert): string
{
    $requestedCode = trim($requestedCode);
    $locked = false;
    $lockName = 'tn_company_employee_code_create';
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
        $lock = $pdo->prepare('SELECT GET_LOCK(:name, 10)');
        $lock->execute(['name'=>$lockName]);
        $locked = (int)$lock->fetchColumn() === 1;
        if (!$locked) throw new RuntimeException('Hệ thống đang cấp mã nhân viên. Vui lòng thử lại.', 503);
    }
    try {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $code = $requestedCode !== '' ? $requestedCode : employees_next_code($pdo);
            try {
                $insert($code);
                return $code;
            } catch (PDOException $exception) {
                $duplicate = in_array((int)($exception->errorInfo[1] ?? 0), [1062, 19], true);
                if ($requestedCode !== '' || !$duplicate || $attempt === 4) throw $exception;
            }
        }
        throw new RuntimeException('Không thể cấp mã nhân viên.');
    } finally {
        if ($locked) {
            $release = $pdo->prepare('SELECT RELEASE_LOCK(:name)');
            $release->execute(['name'=>$lockName]);
        }
    }
}
