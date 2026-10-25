<?php

require __DIR__ . "/../public/api/_lib/outside_expenses.php";
function check($v, $m)
{
    if (!$v) {
        throw new RuntimeException($m);
    }
}
function rejects($f)
{
    try {
        $f();
    } catch (Throwable $e) {
        return;
    }
    throw new RuntimeException("Expected rejection");
}
$p = new PDO("sqlite::memory:");
$p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
outside_expenses_ensure_schema($p);
$src = outside_expenses_source(
    "https://docs.google.com/spreadsheets/d/abc_123/edit",
    "2026-10",
);
check(str_contains($src["fetchUrl"], "sheet="), "default tab");
rejects(
    fn() => outside_expenses_source(
        "https://evil.com/spreadsheets/d/x/edit",
        "2026-10",
    ),
);
$csv =
    "Ngày,Chi,Ghi chú,Tổng\n01/10/2026,\"1.000.000 đ\",A,1000000\n01/10/2026,\"1.000.000 đ\",A,1000000\n30/09/2026,99,B,99\n";
check(
    count(outside_expenses_parse($csv, "2026-10")) === 2,
    "repeated rows preserved",
);
rejects(
    fn() => outside_expenses_parse("Ngày,Chi,Tên\n31/02/2026,100,A", "2026-10"),
);
rejects(
    fn() => outside_expenses_parse("Ngày,Chi,Tên\n01/10/2026,bad,A", "2026-10"),
);
outside_expenses_save(
    $p,
    "2026-10",
    "cafe",
    "https://docs.google.com/spreadsheets/d/abc_123/edit",
);
rejects(
    fn() => outside_expenses_save(
        $p,
        "2026-10",
        "other",
        "https://docs.google.com/spreadsheets/d/abc_123/edit",
    ),
);
check(
    outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"])[
        "days"
    ][0]["total"] === null,
    "missing not zero",
);
outside_expenses_sync($p, "2026-10", "cafe", fn() => $csv);
$r = outside_expenses_report($p, "2026-10-01", "2026-10-02", ["cafe"]);
check(
    $r["complete"] &&
        $r["days"][0]["total"] === 2000000.0 &&
        $r["days"][1]["total"] === 0.0,
    "snapshot totals",
);
outside_expenses_sync($p, "2026-10", "cafe", fn() => $csv);
check(
    outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"])[
        "days"
    ][0]["total"] === 2000000.0,
    "idempotent",
);
outside_expenses_sync(
    $p,
    "2026-10",
    "cafe",
    fn() => "Ngày,Chi,Tên\n01/10/2026,50,Edited",
);
check(
    outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"])[
        "days"
    ][0]["total"] === 50.0,
    "replace deleted edited",
);
outside_expenses_sync($p, "2026-10", "cafe", function () {
    throw new RuntimeException("network");
});
$r = outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"]);
check(
    !$r["complete"] &&
        $r["days"][0]["total"] === 50.0 &&
        $r["days"][0]["status"] === "stale",
    "preserve stale",
);
outside_expenses_sync($p, "2026-10", "cafe", fn() => "Ngày,Chi,Tên\n");
check(
    outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"])[
        "days"
    ][0]["total"] === 0.0,
    "verified empty",
);
echo "outside expenses fixtures passed\n";
// Failed first read stays unknown; active lease rejects overlapping requests.
outside_expenses_save(
    $p,
    "2026-11",
    "cafe",
    "https://docs.google.com/spreadsheets/d/november/edit#gid=12",
);
outside_expenses_sync($p, "2026-11", "cafe", function () {
    throw new RuntimeException("unavailable");
});
$r = outside_expenses_report($p, "2026-11-01", "2026-11-01", ["cafe"]);
check(
    $r["days"][0]["total"] === null && $r["days"][0]["status"] === "error",
    "first failure not false zero",
);
$p->exec(
    "UPDATE outside_expense_sources SET lock_until=" .
        (time() + 100) .
        " WHERE month_key='2026-11'",
);
rejects(fn() => outside_expenses_sync($p, "2026-11", "cafe", fn() => $csv));
rejects(
    fn() => outside_expenses_save(
        $p,
        "2026-11",
        "cafe",
        "https://docs.google.com/spreadsheets/d/replacement/edit",
    ),
);
check(
    outside_expenses_source(
        "https://docs.google.com/spreadsheets/d/abc/edit#gid=42",
        "2026-10",
    )["gid"] === "42",
    "fragment gid",
);
foreach (
    [
        "https://docs.google.com.evil.org/spreadsheets/d/x/edit",
        "https://docs.google.com@evil.org/spreadsheets/d/x/edit",
        "http://docs.google.com/spreadsheets/d/x/edit",
        "https://docs.google.com:443/spreadsheets/d/x/edit",
    ]
    as $url
) {
    rejects(fn() => outside_expenses_source($url, "2026-10"));
}
$parsed = outside_expenses_parse(
    "Ngày,Chi,Tên\n01/10/2026,\"1,234,567 ₫\",A\n02/10/2026,\"1.234,50\",B",
    "2026-10",
);
check(
    $parsed[0]["amount"] === 1234567.0 && $parsed[1]["amount"] === 1234.5,
    "money separators",
);
check(
    count(
        outside_expenses_parse("Ngày,Chi,Tên\n01/11/2026,100,X", "2026-10"),
    ) === 0,
    "outside month verified empty",
);
echo "outside expenses edge cases passed\n";

// Publishing a changed source must preserve the last source and snapshot on insert failure.
$p->exec(
    "UPDATE outside_expense_sources SET lock_until=0 WHERE month_key='2026-11'",
);
outside_expenses_sync(
    $p,
    "2026-10",
    "cafe",
    fn() => "Ngày,Chi,Tên\n01/10/2026,75,Before",
);
$prior = outside_expenses_config($p, "2026-10", "cafe");
$p->exec(
    "CREATE TRIGGER fail_snapshot BEFORE INSERT ON outside_expense_items WHEN NEW.name='FAIL' BEGIN SELECT RAISE(ABORT,'forced insert failure'); END",
);
rejects(
    fn() => outside_expenses_save(
        $p,
        "2026-10",
        "cafe",
        "https://docs.google.com/spreadsheets/d/new_source/edit",
        null,
        null,
        [
            [
                "date" => "2026-10-01",
                "amount" => 99,
                "name" => "FAIL",
                "row" => 2,
            ],
        ],
    ),
);
check(
    outside_expenses_config($p, "2026-10", "cafe")["url"] === $prior["url"],
    "failed publish retains original source",
);
check(
    outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"])[
        "days"
    ][0]["total"] === 75.0,
    "failed publish retains snapshot",
);
$p->exec("DROP TRIGGER fail_snapshot");
outside_expenses_save(
    $p,
    "2026-10",
    "cafe",
    "https://docs.google.com/spreadsheets/d/new_source/edit",
    null,
    null,
    [["date" => "2026-10-01", "amount" => 99, "name" => "After", "row" => 2]],
);
check(
    outside_expenses_report($p, "2026-10-01", "2026-10-01", ["cafe"])[
        "days"
    ][0]["total"] === 99.0,
    "atomic source snapshot publish",
);
$p->beginTransaction();
outside_expenses_report($p, "2026-10-01", "2026-10-02", ["cafe"]);
check($p->inTransaction(), "report preserves caller transaction");
$p->rollBack();
echo "atomic publish fixtures passed\n";

// Report uses a single joined snapshot query, and never owns/ends an outer transaction.
class ExpenseReadProbe extends PDO
{
    public int $reads = 0;
    public function prepare(
        string $query,
        array $options = [],
    ): PDOStatement|false {
        if (str_starts_with(ltrim($query), "SELECT")) {
            $this->reads++;
        }
        return parent::prepare($query, $options);
    }
}
$probe = new ExpenseReadProbe("sqlite::memory:");
$probe->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
outside_expenses_ensure_schema($probe);
outside_expenses_save(
    $probe,
    "2026-10",
    "cafe",
    "https://docs.google.com/spreadsheets/d/coherent/edit",
    null,
    null,
    [
        ["date" => "2026-10-01", "amount" => 5, "name" => "Old1", "row" => 2],
        ["date" => "2026-10-02", "amount" => 6, "name" => "Old2", "row" => 3],
    ],
);
$probe->reads = 0;
$probe->beginTransaction();
$coherent = outside_expenses_report($probe, "2026-10-01", "2026-10-02", [
    "cafe",
]);
check(
    $probe->reads === 1,
    "configs and every day read as one database snapshot",
);
check($probe->inTransaction(), "outer transaction still open");
$probe->rollBack();
check(
    $coherent["days"][0]["total"] === 5.0 &&
        $coherent["days"][1]["total"] === 6.0,
    "joined snapshot day grouping",
);
echo "coherent report fixtures passed\n";
