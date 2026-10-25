<?php

declare(strict_types=1);
if (PHP_SAPI !== "cli") {
    http_response_code(404);
    exit();
}
require_once __DIR__ . "/../_lib/bootstrap.php";
require_once __DIR__ . "/../_lib/outside_expenses.php";
$p = db();
outside_expenses_ensure_schema($p);
$failed = 0;
foreach (
    $p
        ->query(
            "SELECT month_key,store_id,last_attempt_at FROM outside_expense_sources",
        )
        ->fetchAll(PDO::FETCH_ASSOC)
    as $c
) {
    if (
        $c["last_attempt_at"] &&
        strtotime($c["last_attempt_at"]) > time() - 1800
    ) {
        continue;
    }
    try {
        $r = outside_expenses_sync($p, $c["month_key"], $c["store_id"]);
        if ($r["error"]) {
            $failed++;
            fwrite(
                STDERR,
                $c["month_key"] .
                    " " .
                    $c["store_id"] .
                    ": " .
                    $r["error"] .
                    PHP_EOL,
            );
        }
    } catch (Throwable $e) {
        $failed++;
        fwrite(STDERR, $e->getMessage() . PHP_EOL);
    }
}
exit($failed ? 1 : 0);
