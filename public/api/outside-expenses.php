<?php

declare(strict_types=1);
require_once __DIR__ . "/_lib/bootstrap.php";
require_once __DIR__ . "/_lib/auth.php";
require_once __DIR__ . "/_lib/outside_expenses.php";
auth_require(["admin"]);
try {
    $p = db();
    outside_expenses_ensure_schema($p);
    $method = $_SERVER["REQUEST_METHOD"] ?? "GET";
    if (!in_array($method, ["GET", "PUT", "POST"], true)) {
        respond_error("Method not allowed", 405);
    }
    $b =
        $method === "GET"
            ? $_GET
            : json_decode(
                file_get_contents("php://input"),
                true,
                32,
                JSON_THROW_ON_ERROR,
            );
    if (!is_array($b)) {
        throw new InvalidArgumentException("Dữ liệu không hợp lệ.");
    }
    $month = $b["month"] ?? date("Y-m");
    $store = $b["storeId"] ?? "cafe";
    if (!is_string($month) || !is_string($store)) {
        throw new InvalidArgumentException("Bộ lọc không hợp lệ.");
    }
    outside_expenses_month($month);
    $s = $p->prepare("SELECT id FROM stores WHERE id=?");
    $s->execute([$store]);
    if (!$s->fetch()) {
        throw new InvalidArgumentException("Quầy không hợp lệ.");
    }
    if ($method === "PUT") {
        foreach (["url", "sheetName", "gid"] as $k) {
            if (isset($b[$k]) && !is_string($b[$k])) {
                throw new InvalidArgumentException("Liên kết không hợp lệ.");
            }
        }
        $src = outside_expenses_source(
            $b["url"] ?? "",
            $month,
            $b["sheetName"] ?? null,
            $b["gid"] ?? null,
        );
        $csv = outside_expenses_fetch($src["fetchUrl"]);
        $items = outside_expenses_parse($csv, $month);
        outside_expenses_save(
            $p,
            $month,
            $store,
            $src["url"],
            $src["sheetName"],
            $src["gid"],
            $items,
        );
    } elseif ($method === "POST") {
        outside_expenses_sync($p, $month, $store);
    }
    $c = outside_expenses_config($p, $month, $store);
    $end = date("Y-m-t", strtotime($month . "-01"));
    respond_ok([
        "config" => $c
            ? [
                "month" => $c["month_key"],
                "storeId" => $c["store_id"],
                "url" => $c["url"],
                "sheetName" => $c["sheet_name"],
                "gid" => $c["gid"],
                "lastSyncedAt" => $c["last_synced_at"],
                "lastAttemptAt" => $c["last_attempt_at"],
                "error" => $c["error"],
            ]
            : null,
        "report" => outside_expenses_report($p, $month . "-01", $end, [$store]),
        "stores" => $p
            ->query("SELECT id,name FROM stores ORDER BY name")
            ->fetchAll(PDO::FETCH_ASSOC),
    ]);
} catch (InvalidArgumentException | JsonException $e) {
    respond_error($e->getMessage(), 422);
} catch (PDOException $e) {
    respond_error("Chưa lưu được dữ liệu. Thử lại sau.", 502);
} catch (RuntimeException $e) {
    respond_error($e->getMessage(), 502);
} catch (Throwable $e) {
    respond_error("Chưa xử lý được yêu cầu. Thử lại sau.", 502);
}
