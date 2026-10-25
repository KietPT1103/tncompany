<?php

declare(strict_types=1);
function outside_expenses_ensure_schema(PDO $p): void
{
    $p->exec(
        "CREATE TABLE IF NOT EXISTS outside_expense_sources (month_key VARCHAR(7) NOT NULL, store_id VARCHAR(64) NOT NULL, url TEXT NOT NULL, spreadsheet_id VARCHAR(160) NOT NULL, tab_key VARCHAR(220) NOT NULL, sheet_name VARCHAR(180) NOT NULL, gid VARCHAR(30) NULL, last_synced_at VARCHAR(30) NULL, last_attempt_at VARCHAR(30) NULL, error TEXT NULL, lock_token VARCHAR(40) NULL, lock_until BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(month_key,store_id), UNIQUE(month_key,spreadsheet_id))",
    );
    $p->exec(
        "CREATE TABLE IF NOT EXISTS outside_expense_items (month_key VARCHAR(7) NOT NULL,store_id VARCHAR(64) NOT NULL,row_number INTEGER NOT NULL,expense_date VARCHAR(10) NOT NULL,amount DECIMAL(18,2) NOT NULL,name TEXT NOT NULL,PRIMARY KEY(month_key,store_id,row_number))",
    );
}
function outside_expenses_month(string $month): void
{
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D', $month)) {
        throw new InvalidArgumentException("Tháng không hợp lệ.");
    }
}
function outside_expenses_source(
    string $url,
    string $month,
    ?string $sheetName = null,
    ?string $gid = null,
): array {
    outside_expenses_month($month);
    $u = parse_url(trim($url));
    if (
        !$u ||
        ($u["scheme"] ?? "") !== "https" ||
        ($u["host"] ?? "") !== "docs.google.com" ||
        isset($u["user"]) ||
        isset($u["pass"]) ||
        isset($u["port"]) ||
        !preg_match(
            '~^/spreadsheets/d/([A-Za-z0-9_-]{1,160})(?:/|$)~',
            $u["path"] ?? "",
            $m,
        )
    ) {
        throw new InvalidArgumentException(
            "Dùng liên kết https://docs.google.com/spreadsheets/d/...",
        );
    }
    parse_str($u["query"] ?? "", $q);
    parse_str($u["fragment"] ?? "", $f);
    $gid =
        $gid !== null && $gid !== "" ? $gid : $q["gid"] ?? ($f["gid"] ?? null);
    if (
        $gid !== null &&
        (!is_string($gid) || !preg_match('/^\d{1,20}$/D', $gid))
    ) {
        throw new InvalidArgumentException("gid không hợp lệ.");
    }
    $sheetName = trim($sheetName ?? "");
    if ($sheetName === "") {
        $sheetName = "Tổng chi T" . (int) substr($month, 5, 2);
    }
    if (strlen($sheetName) > 180) {
        throw new InvalidArgumentException("Tên tab quá dài.");
    }
    $query = ["tqx" => "out:csv"];
    $query[$gid !== null ? "gid" : "sheet"] = $gid ?? $sheetName;
    return [
        "url" => trim($url),
        "spreadsheetId" => $m[1],
        "sheetName" => $sheetName,
        "gid" => $gid,
        "tabKey" => $gid !== null ? "gid:" . $gid : "sheet:" . $sheetName,
        "fetchUrl" =>
            "https://docs.google.com/spreadsheets/d/" .
            $m[1] .
            "/gviz/tq?" .
            http_build_query($query),
    ];
}
function outside_expenses_parse(string $csv, string $month): array
{
    outside_expenses_month($month);
    if (
        strlen($csv) > 2097152 ||
        str_contains(strtolower(substr($csv, 0, 500)), "<html")
    ) {
        throw new InvalidArgumentException("Dữ liệu CSV không hợp lệ.");
    }
    $h = fopen("php://temp", "r+");
    fwrite($h, preg_replace('/^\xEF\xBB\xBF/', "", $csv));
    rewind($h);
    $items = [];
    $line = 0;
    $header = false;
    while (($r = fgetcsv($h)) !== false) {
        $line++;
        if ($line > 20000) {
            throw new InvalidArgumentException("Sheet quá nhiều dòng.");
        }
        $date = trim($r[0] ?? "");
        $raw = trim($r[1] ?? "");
        if ($line === 1) {
            $header = (bool) preg_match("/ngày|date/iu", $date);
            if ($header) {
                continue;
            }
        }
        if ($date === "" && $raw === "") {
            continue;
        }
        if ($raw === "") {
            continue;
        }
        $d = DateTimeImmutable::createFromFormat("!d/m/Y", $date);
        if (!$d || $d->format("d/m/Y") !== $date) {
            $d = DateTimeImmutable::createFromFormat("!Y-m-d", $date);
            if (!$d || $d->format("Y-m-d") !== $date) {
                throw new InvalidArgumentException(
                    "Dòng $line: ngày không hợp lệ.",
                );
            }
        }
        $a = preg_replace("/[\s\x{00A0}₫đĐ]/u", "", $raw);
        if (
            !preg_match(
                '/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)(?:[.,]\d{1,2})?$/D',
                $a,
            )
        ) {
            throw new InvalidArgumentException(
                "Dòng $line: tiền chi không hợp lệ.",
            );
        }
        if (preg_match('/[.,](\d{1,2})$/', $a, $dec)) {
            $amount =
                (float) (preg_replace(
                    "/[.,]/",
                    "",
                    substr($a, 0, -strlen($dec[0])),
                ) .
                    "." .
                    $dec[1]);
        } else {
            $amount = (float) str_replace([".", ","], "", $a);
        }
        if (!is_finite($amount) || $amount > 999999999999) {
            throw new InvalidArgumentException("Dòng $line: số tiền quá lớn.");
        }
        if ($d->format("Y-m") === $month) {
            $items[] = [
                "date" => $d->format("Y-m-d"),
                "amount" => $amount,
                "name" => trim($r[2] ?? ""),
                "row" => $line,
            ];
        }
    }
    fclose($h);
    if ($line === 0 || (!$header && count($items) === 0)) {
        throw new InvalidArgumentException("Không nhận diện được dữ liệu chi.");
    }
    return $items;
}
function outside_expenses_fetch(string $url): string
{
    if (!function_exists("curl_init")) {
        throw new RuntimeException("Máy chủ cần PHP cURL.");
    }
    $body = "";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_WRITEFUNCTION => static function ($c, $data) use (&$body) {
            if (strlen($body) + strlen($data) > 2097152) {
                return 0;
            }
            $body .= $data;
            return strlen($data);
        },
    ]);
    $ok = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($ok === false || $code !== 200) {
        throw new RuntimeException(
            "Không đọc được CSV công khai từ Google (HTTP " .
                $code .
                "). Kiểm tra quyền xem và tab.",
        );
    }
    return $body;
}
function outside_expenses_config(PDO $p, string $month, string $store): ?array
{
    $s = $p->prepare(
        "SELECT * FROM outside_expense_sources WHERE month_key=? AND store_id=?",
    );
    $s->execute([$month, $store]);
    $r = $s->fetch(PDO::FETCH_ASSOC);
    return $r ?: null;
}
/** Publish validated source and optional parsed CSV rows together. Existing sources require rows. */
function outside_expenses_save(
    PDO $p,
    string $month,
    string $store,
    string $url,
    ?string $sheetName = null,
    ?string $gid = null,
    ?array $items = null,
): array {
    $src = outside_expenses_source($url, $month, $sheetName, $gid);
    if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/D', $store)) {
        throw new InvalidArgumentException("Quầy không hợp lệ.");
    }
    $s = $p->prepare(
        "SELECT store_id FROM outside_expense_sources WHERE month_key=? AND spreadsheet_id=? AND store_id<>?",
    );
    $s->execute([$month, $src["spreadsheetId"], $store]);
    if ($s->fetch()) {
        throw new InvalidArgumentException(
            "Sheet tháng này đã gắn với quầy khác.",
        );
    }
    $p->beginTransaction();
    try {
        $old = outside_expenses_config($p, $month, $store);
        if ($old && $items === null) {
            throw new InvalidArgumentException(
                "Cần kiểm tra CSV trước khi thay cấu hình.",
            );
        }
        $token = bin2hex(random_bytes(16));
        if ($old) {
            $s = $p->prepare(
                "UPDATE outside_expense_sources SET lock_token=?,lock_until=? WHERE month_key=? AND store_id=? AND lock_until<=?",
            );
            $s->execute([$token, time() + 120, $month, $store, time()]);
            if (!$s->rowCount()) {
                throw new RuntimeException("Đang đồng bộ, thử lại sau.");
            }
            $s = $p->prepare(
                "UPDATE outside_expense_sources SET url=?,spreadsheet_id=?,tab_key=?,sheet_name=?,gid=? WHERE month_key=? AND store_id=? AND lock_token=?",
            );
            $s->execute([
                $src["url"],
                $src["spreadsheetId"],
                $src["tabKey"],
                $src["sheetName"],
                $src["gid"],
                $month,
                $store,
                $token,
            ]);
        } else {
            $s = $p->prepare(
                "INSERT INTO outside_expense_sources (url,spreadsheet_id,tab_key,sheet_name,gid,month_key,store_id,lock_token,lock_until) VALUES (?,?,?,?,?,?,?,?,?)",
            );
            $s->execute([
                $src["url"],
                $src["spreadsheetId"],
                $src["tabKey"],
                $src["sheetName"],
                $src["gid"],
                $month,
                $store,
                $token,
                time() + 120,
            ]);
        }
        if ($items !== null) {
            $p->prepare(
                "DELETE FROM outside_expense_items WHERE month_key=? AND store_id=?",
            )->execute([$month, $store]);
            $s = $p->prepare(
                "INSERT INTO outside_expense_items (month_key,store_id,row_number,expense_date,amount,name) VALUES (?,?,?,?,?,?)",
            );
            foreach ($items as $r) {
                $s->execute([
                    $month,
                    $store,
                    $r["row"],
                    $r["date"],
                    $r["amount"],
                    $r["name"],
                ]);
            }
        }
        $now = $items !== null ? date("Y-m-d H:i:s") : null;
        $s = $p->prepare(
            "UPDATE outside_expense_sources SET last_synced_at=?,last_attempt_at=?,error=NULL,lock_token=NULL,lock_until=0 WHERE month_key=? AND store_id=? AND lock_token=?",
        );
        $s->execute([$now, $now, $month, $store, $token]);
        if (!$s->rowCount()) {
            throw new RuntimeException("Khóa cấu hình hết hạn.");
        }
        $p->commit();
    } catch (Throwable $e) {
        if ($p->inTransaction()) {
            $p->rollBack();
        }
        // The old source and its snapshot survived rollback. Mark that snapshot stale.
        $p->prepare(
            "UPDATE outside_expense_sources SET error=?,last_attempt_at=? WHERE month_key=? AND store_id=? AND lock_until<=?",
        )->execute([
            "Chưa lưu được cấu hình và dữ liệu mới.",
            date("Y-m-d H:i:s"),
            $month,
            $store,
            time(),
        ]);
        throw $e;
    }
    return outside_expenses_config($p, $month, $store);
}
function outside_expenses_sync(
    PDO $p,
    string $month,
    string $store,
    ?callable $fetch = null,
): array {
    $token = bin2hex(random_bytes(16));
    $s = $p->prepare(
        "UPDATE outside_expense_sources SET lock_token=?,lock_until=? WHERE month_key=? AND store_id=? AND lock_until<=?",
    );
    $s->execute([$token, time() + 120, $month, $store, time()]);
    if (!$s->rowCount()) {
        throw new RuntimeException("Chưa cấu hình hoặc đang đồng bộ.");
    }
    try {
        $c = outside_expenses_config($p, $month, $store);
        $src = outside_expenses_source(
            $c["url"],
            $month,
            $c["sheet_name"],
            $c["gid"],
        );
        $items = outside_expenses_parse(
            ($fetch ?? "outside_expenses_fetch")($src["fetchUrl"]),
            $month,
        );
        $p->beginTransaction();
        $s = $p->prepare(
            "UPDATE outside_expense_sources SET last_synced_at=?,last_attempt_at=?,error=NULL,lock_until=0,lock_token=NULL WHERE month_key=? AND store_id=? AND lock_token=?",
        );
        $now = date("Y-m-d H:i:s");
        $s->execute([$now, $now, $month, $store, $token]);
        if (!$s->rowCount()) {
            throw new RuntimeException("Khóa đồng bộ hết hạn.");
        }
        $p->prepare(
            "DELETE FROM outside_expense_items WHERE month_key=? AND store_id=?",
        )->execute([$month, $store]);
        $s = $p->prepare(
            "INSERT INTO outside_expense_items (month_key,store_id,row_number,expense_date,amount,name) VALUES (?,?,?,?,?,?)",
        );
        foreach ($items as $r) {
            $s->execute([
                $month,
                $store,
                $r["row"],
                $r["date"],
                $r["amount"],
                $r["name"],
            ]);
        }
        $p->commit();
    } catch (Throwable $e) {
        if ($p->inTransaction()) {
            $p->rollBack();
        }
        $s = $p->prepare(
            "UPDATE outside_expense_sources SET error=?,last_attempt_at=?,lock_until=0,lock_token=NULL WHERE month_key=? AND store_id=? AND lock_token=?",
        );
        $s->execute([
            $e instanceof PDOException
                ? "Chưa lưu được dữ liệu đồng bộ."
                : substr($e->getMessage(), 0, 1000),
            date("Y-m-d H:i:s"),
            $month,
            $store,
            $token,
        ]);
    }
    return outside_expenses_config($p, $month, $store);
}
function outside_expenses_report(
    PDO $p,
    string $from,
    string $to,
    array $storeIds,
): array {
    $start = DateTimeImmutable::createFromFormat("!Y-m-d", $from);
    $end = DateTimeImmutable::createFromFormat("!Y-m-d", $to);
    if (
        !$start ||
        !$end ||
        $start->format("Y-m-d") !== $from ||
        $end->format("Y-m-d") !== $to ||
        $end < $start ||
        $start->diff($end)->days > 92
    ) {
        throw new InvalidArgumentException("Khoảng ngày không hợp lệ.");
    }
    $configs = [];
    $rows = [];
    $ids = array_values(array_unique($storeIds));
    if ($ids) {
        $slots = implode(",", array_fill(0, count($ids), "?"));
        $statement = $p->prepare(
            "SELECT c.*,i.expense_date,i.name AS item_name,i.amount AS item_amount,i.row_number FROM outside_expense_sources c LEFT JOIN outside_expense_items i ON i.month_key=c.month_key AND i.store_id=c.store_id AND i.expense_date>=? AND i.expense_date<=? WHERE c.month_key>=? AND c.month_key<=? AND c.store_id IN ($slots) ORDER BY c.store_id,c.month_key,i.row_number",
        );
        $statement->execute(
            array_merge(
                [$from, $to, substr($from, 0, 7), substr($to, 0, 7)],
                $ids,
            ),
        );
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $record) {
            $key = $record["store_id"] . "|" . $record["month_key"];
            $configs[$key] = $record;
            if ($record["row_number"] !== null) {
                $rows[$record["store_id"] . "|" . $record["expense_date"]][] = [
                    "name" => $record["item_name"],
                    "amount" => (float) $record["item_amount"],
                    "row" => (int) $record["row_number"],
                ];
            }
        }
    }
    $days = [];
    $complete = true;
    foreach (array_unique($storeIds) as $store) {
        for ($d = $start; $d <= $end; $d = $d->modify("+1 day")) {
            $date = $d->format("Y-m-d");
            $c = $configs[$store . "|" . $d->format("Y-m")] ?? null;
            $synced = $c && $c["last_synced_at"];
            $stale =
                $synced &&
                ($c["error"] ||
                    strtotime($c["last_synced_at"]) < time() - 7200);
            $status = $synced
                ? ($stale
                    ? "stale"
                    : "ready")
                : ($c && $c["error"]
                    ? "error"
                    : "missing");
            $items = [];
            $total = $synced ? 0.0 : null;
            if ($synced) {
                $items = $rows[$store . "|" . $date] ?? [];
                foreach ($items as $item) {
                    $total += $item["amount"];
                }
            }
            if ($status !== "ready") {
                $complete = false;
            }
            $days[] = [
                "date" => $date,
                "storeId" => $store,
                "total" => $total,
                "items" => $items,
                "status" => $status,
                "lastSyncedAt" => $c["last_synced_at"] ?? null,
                "error" => $c["error"] ?? null,
            ];
        }
    }
    return ["days" => $days, "complete" => $complete];
}
