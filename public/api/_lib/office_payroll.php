<?php
declare(strict_types=1);

function office_payroll_ensure_schema(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS office_payroll_months (
        payroll_month CHAR(7) PRIMARY KEY,
        amount BIGINT NOT NULL
    )');
}

function office_payroll_months(PDO $pdo, string $start, string $end): array
{
    $query = $pdo->prepare('SELECT payroll_month, amount FROM office_payroll_months WHERE payroll_month BETWEEN ? AND ?');
    $query->execute([substr($start, 0, 7), substr($end, 0, 7)]);
    return $query->fetchAll(PDO::FETCH_KEY_PAIR);
}

function office_payroll_daily_amount(int $monthlyAmount, string $date): float
{
    $day = new DateTimeImmutable($date);
    $daysInMonth = (int) $day->format('t');
    $dayNumber = (int) $day->format('j');
    $cents = $monthlyAmount * 100;
    return (round($cents * $dayNumber / $daysInMonth) - round($cents * ($dayNumber - 1) / $daysInMonth)) / 100;
}
