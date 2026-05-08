<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

const INVOICE_UPLOAD_RELATIVE_ROOT = 'uploads/invoices';
const INVOICE_MAX_FILE_SIZE = 10 * 1024 * 1024;

function invoice_public_url(string $relativePath): string
{
    return '/' . ltrim(str_replace('\\', '/', $relativePath), '/');
}

function invoice_upload_root(): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, INVOICE_UPLOAD_RELATIVE_ROOT);
}

function invoice_absolute_path(string $relativePath): string
{
    return dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
}

function invoice_safe_name(string $value, string $fallback): string
{
    $value = trim($value);
    if ($value === '') {
        return $fallback;
    }

    $value = preg_replace('/[<>:"\/\\\\|?*\x00-\x1F]/u', '-', $value) ?? $fallback;
    $value = preg_replace('/\s+/u', ' ', $value) ?? $fallback;
    $value = trim($value, ". \t\n\r\0\x0B");

    if ($value === '') {
        return $fallback;
    }

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, 120);
    }

    return substr($value, 0, 120);
}

function invoice_normalize_scope($value): string
{
    $scope = strtolower(trim((string) $value));
    if (!in_array($scope, ['internal', 'tax'], true)) {
        respond_error('Invoice scope is invalid', 422);
    }

    return $scope;
}

function invoice_normalize_store_id($value): string
{
    $storeId = trim((string) $value);
    return $storeId !== '' ? $storeId : 'cafe';
}

function invoice_normalize_date($value): string
{
    $raw = trim((string) $value);
    if ($raw === '') {
        respond_error('Invoice date is required', 422);
    }

    try {
        return (new DateTimeImmutable($raw))->format('Y-m-d');
    } catch (Throwable $exception) {
        respond_error('Invoice date is invalid', 422);
    }
}

function invoice_normalize_decimal($value): float
{
    if (is_int($value) || is_float($value)) {
        return round((float) $value, 2);
    }

    $normalized = preg_replace('/[^0-9.,-]/', '', (string) $value);
    $normalized = str_replace(',', '', (string) $normalized);
    if ($normalized === '' || !is_numeric($normalized)) {
        return 0.0;
    }

    return round((float) $normalized, 2);
}

function invoice_trim_nullable($value, int $maxLength): ?string
{
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }

    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength);
    }

    return substr($text, 0, $maxLength);
}

function invoice_parse_items($value): array
{
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        $value = is_array($decoded) ? $decoded : [];
    }

    if (!is_array($value)) {
        respond_error('Items payload is invalid', 422);
    }

    $items = [];
    foreach ($value as $item) {
        if (!is_array($item)) {
            continue;
        }

        $name = invoice_trim_nullable($item['name'] ?? $item['itemName'] ?? '', 255);
        if ($name === null) {
            continue;
        }

        $quantity = invoice_normalize_decimal($item['quantity'] ?? 0);
        $unitPrice = invoice_normalize_decimal($item['unitPrice'] ?? $item['unit_price'] ?? 0);
        $lineTotal = round($quantity * $unitPrice, 2);
        if ($quantity <= 0 || $unitPrice < 0 || $lineTotal <= 0) {
            continue;
        }

        $items[] = [
            'name' => $name,
            'quantity' => $quantity,
            'unit' => invoice_trim_nullable($item['unit'] ?? '', 50),
            'unitPrice' => $unitPrice,
            'lineTotal' => $lineTotal,
        ];
    }

    if ($items === []) {
        respond_error('At least one valid item is required', 422);
    }

    return $items;
}

function invoice_parse_evidence_ids($value): array
{
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        $value = is_array($decoded) ? $decoded : [];
    }

    if (!is_array($value)) {
        return [];
    }

    $ids = [];
    foreach ($value as $item) {
        $id = (int) $item;
        if ($id > 0) {
            $ids[] = $id;
        }
    }

    return array_values(array_unique($ids));
}

function invoice_collect_uploaded_files(): array
{
    $candidates = [];
    if (isset($_FILES['evidences'])) {
        $candidates[] = $_FILES['evidences'];
    }
    if (isset($_FILES['evidences[]'])) {
        $candidates[] = $_FILES['evidences[]'];
    }

    $files = [];
    foreach ($candidates as $uploaded) {
        if (!is_array($uploaded)) {
            continue;
        }

        if (is_array($uploaded['name'] ?? null)) {
            $count = count($uploaded['name']);
            for ($index = 0; $index < $count; $index += 1) {
                $errorCode = (int) ($uploaded['error'][$index] ?? UPLOAD_ERR_NO_FILE);
                if ($errorCode === UPLOAD_ERR_NO_FILE) {
                    continue;
                }

                $files[] = [
                    'name' => (string) ($uploaded['name'][$index] ?? ''),
                    'tmp_name' => (string) ($uploaded['tmp_name'][$index] ?? ''),
                    'size' => (int) ($uploaded['size'][$index] ?? 0),
                    'error' => $errorCode,
                    'type' => (string) ($uploaded['type'][$index] ?? ''),
                ];
            }
            continue;
        }

        $errorCode = (int) ($uploaded['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode !== UPLOAD_ERR_NO_FILE) {
            $files[] = [
                'name' => (string) ($uploaded['name'] ?? ''),
                'tmp_name' => (string) ($uploaded['tmp_name'] ?? ''),
                'size' => (int) ($uploaded['size'] ?? 0),
                'error' => $errorCode,
                'type' => (string) ($uploaded['type'] ?? ''),
            ];
        }
    }

    return $files;
}

function invoice_validate_uploaded_files(array $files): void
{
    if ($files === []) {
        return;
    }

    $allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
    ];
    $finfo = new finfo(FILEINFO_MIME_TYPE);

    foreach ($files as $file) {
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($errorCode !== UPLOAD_ERR_OK) {
            respond_error('Cannot upload one of the evidences', 422, ['uploadError' => $errorCode]);
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            respond_error('Uploaded file is invalid', 422);
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0 || $size > INVOICE_MAX_FILE_SIZE) {
            respond_error('Evidence file size is invalid or too large', 422, [
                'maxBytes' => INVOICE_MAX_FILE_SIZE,
            ]);
        }

        $mime = strtolower((string) $finfo->file($tmpName));
        if (!in_array($mime, $allowedMimeTypes, true)) {
            respond_error('Evidence file type is not supported', 422, [
                'mimeType' => $mime,
            ]);
        }
    }
}

function invoice_extension_from_mime(string $mime, string $originalName): string
{
    $mimeMap = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf',
    ];

    $mime = strtolower($mime);
    if (isset($mimeMap[$mime])) {
        return $mimeMap[$mime];
    }

    $pathExtension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    return $pathExtension !== '' ? $pathExtension : 'bin';
}

function invoice_store_uploaded_file(array $file, string $scope, string $storeId, string $invoiceId): array
{
    $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errorCode !== UPLOAD_ERR_OK) {
        throw new RuntimeException('Cannot upload one of the evidences');
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('Uploaded file is invalid');
    }

    $size = (int) ($file['size'] ?? 0);
    if ($size <= 0 || $size > INVOICE_MAX_FILE_SIZE) {
        throw new RuntimeException('Evidence file size is invalid or too large');
    }

    $originalName = invoice_trim_nullable($file['name'] ?? '', 255) ?? 'evidence';
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = strtolower((string) $finfo->file($tmpName));
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'], true)) {
        throw new RuntimeException('Evidence file type is not supported');
    }

    $datePrefix = (new DateTimeImmutable())->format('Y-m');
    $relativeDirectory = INVOICE_UPLOAD_RELATIVE_ROOT
        . '/'
        . invoice_safe_name($storeId, 'store')
        . '/'
        . invoice_safe_name($scope, 'scope')
        . '/'
        . $datePrefix;
    $absoluteDirectory = invoice_absolute_path($relativeDirectory);

    if (!is_dir($absoluteDirectory) && !mkdir($absoluteDirectory, 0775, true) && !is_dir($absoluteDirectory)) {
        throw new RuntimeException('Cannot create invoice upload directory');
    }

    $extension = invoice_extension_from_mime($mime, $originalName);
    $storedBaseName = invoice_safe_name(pathinfo($originalName, PATHINFO_FILENAME), 'evidence');
    $storedFileName = sprintf('%s-%s.%s', $invoiceId, substr(uuidv4(), 0, 8), $extension);
    $relativePath = $relativeDirectory . '/' . $storedFileName;
    $absolutePath = invoice_absolute_path($relativePath);

    if (!move_uploaded_file($tmpName, $absolutePath)) {
        throw new RuntimeException('Cannot move uploaded evidence file');
    }

    return [
        'filePath' => $relativePath,
        'fileName' => $storedBaseName . '.' . $extension,
        'originalName' => $originalName,
        'mimeType' => $mime,
        'fileSize' => $size,
    ];
}

function invoice_delete_file(?string $relativePath): void
{
    if (!$relativePath) {
        return;
    }

    $absolutePath = invoice_absolute_path($relativePath);
    if (is_file($absolutePath)) {
        @unlink($absolutePath);
    }
}

function invoice_fetch_items_grouped(array $invoiceIds): array
{
    if ($invoiceIds === []) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($invoiceIds), '?'));
    $statement = db()->prepare(
        'SELECT id, invoice_id, item_name, quantity, unit, unit_price, line_total
         FROM invoice_entry_items
         WHERE invoice_id IN (' . $placeholders . ')
         ORDER BY id ASC'
    );
    $statement->execute($invoiceIds);

    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $invoiceId = (string) $row['invoice_id'];
        if (!isset($grouped[$invoiceId])) {
            $grouped[$invoiceId] = [];
        }

        $grouped[$invoiceId][] = [
            'id' => (int) $row['id'],
            'name' => (string) $row['item_name'],
            'quantity' => (float) $row['quantity'],
            'unit' => $row['unit'] ?: '',
            'unitPrice' => (float) $row['unit_price'],
            'lineTotal' => (float) $row['line_total'],
        ];
    }

    return $grouped;
}

function invoice_fetch_evidences_grouped(array $invoiceIds): array
{
    if ($invoiceIds === []) {
        return [];
    }

    $placeholders = implode(', ', array_fill(0, count($invoiceIds), '?'));
    $statement = db()->prepare(
        'SELECT id, invoice_id, file_path, file_name, original_name, mime_type, file_size, uploaded_at
         FROM invoice_entry_evidences
         WHERE invoice_id IN (' . $placeholders . ')
         ORDER BY id ASC'
    );
    $statement->execute($invoiceIds);

    $grouped = [];
    foreach ($statement->fetchAll() as $row) {
        $invoiceId = (string) $row['invoice_id'];
        if (!isset($grouped[$invoiceId])) {
            $grouped[$invoiceId] = [];
        }

        $grouped[$invoiceId][] = [
            'id' => (int) $row['id'],
            'fileName' => (string) $row['file_name'],
            'originalName' => (string) $row['original_name'],
            'mimeType' => (string) $row['mime_type'],
            'fileSize' => (int) $row['file_size'],
            'uploadedAt' => (string) $row['uploaded_at'],
            'fileUrl' => invoice_public_url((string) $row['file_path']),
        ];
    }

    return $grouped;
}

function invoice_map_entry(array $row, array $itemsByInvoiceId, array $evidencesByInvoiceId): array
{
    $invoiceId = (string) $row['id'];

    return [
        'id' => $invoiceId,
        'storeId' => (string) $row['store_id'],
        'scope' => (string) $row['invoice_scope'],
        'invoiceNumber' => $row['invoice_number'] ?: null,
        'partnerName' => $row['partner_name'] ?: null,
        'invoiceDate' => (string) $row['invoice_date'],
        'note' => $row['note'] ?: null,
        'totalAmount' => (float) $row['total_amount'],
        'createdBy' => $row['created_by'] ?: null,
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
        'items' => $itemsByInvoiceId[$invoiceId] ?? [],
        'evidences' => $evidencesByInvoiceId[$invoiceId] ?? [],
    ];
}

function invoice_get_entry_or_null(string $id): ?array
{
    $statement = db()->prepare('SELECT * FROM invoice_entries WHERE id = :id LIMIT 1');
    $statement->execute(['id' => $id]);
    $row = $statement->fetch();
    if (!$row) {
        return null;
    }

    $itemsByInvoiceId = invoice_fetch_items_grouped([$id]);
    $evidencesByInvoiceId = invoice_fetch_evidences_grouped([$id]);
    return invoice_map_entry($row, $itemsByInvoiceId, $evidencesByInvoiceId);
}

function invoice_save_entry(array $user): array
{
    $action = trim((string) ($_POST['action'] ?? 'create'));
    $isUpdate = $action === 'update';
    $invoiceId = $isUpdate ? trim((string) ($_POST['id'] ?? '')) : uuidv4();

    if ($isUpdate && $invoiceId === '') {
        respond_error('Invoice id is required for update', 422);
    }

    $storeId = invoice_normalize_store_id($_POST['storeId'] ?? 'cafe');
    $scope = invoice_normalize_scope($_POST['scope'] ?? '');
    $invoiceDate = invoice_normalize_date($_POST['invoiceDate'] ?? '');
    $invoiceNumber = invoice_trim_nullable($_POST['invoiceNumber'] ?? '', 100);
    $partnerName = invoice_trim_nullable($_POST['partnerName'] ?? '', 255);
    $note = invoice_trim_nullable($_POST['note'] ?? '', 5000);
    $items = invoice_parse_items($_POST['items'] ?? '[]');
    $keptEvidenceIds = invoice_parse_evidence_ids($_POST['keptEvidenceIds'] ?? '[]');
    $uploadedFiles = invoice_collect_uploaded_files();
    invoice_validate_uploaded_files($uploadedFiles);
    $totalAmount = 0.0;

    foreach ($items as $item) {
        $totalAmount += (float) $item['lineTotal'];
    }
    $totalAmount = round($totalAmount, 2);

    $newlyStoredFiles = [];
    $filesToDeleteAfterCommit = [];

    if ($isUpdate) {
        $existingStatement = db()->prepare(
            'SELECT id
             FROM invoice_entries
             WHERE id = :id
               AND store_id = :store_id
               AND invoice_scope = :invoice_scope
             LIMIT 1'
        );
        $existingStatement->execute([
            'id' => $invoiceId,
            'store_id' => $storeId,
            'invoice_scope' => $scope,
        ]);

        if (!$existingStatement->fetch()) {
            respond_error('Invoice not found', 404);
        }
    }

    db()->beginTransaction();

    try {
        if ($isUpdate) {
            $updateStatement = db()->prepare(
                'UPDATE invoice_entries
                 SET invoice_number = :invoice_number,
                     partner_name = :partner_name,
                     invoice_date = :invoice_date,
                     note = :note,
                     total_amount = :total_amount
                 WHERE id = :id'
            );
            $updateStatement->execute([
                'id' => $invoiceId,
                'invoice_number' => $invoiceNumber,
                'partner_name' => $partnerName,
                'invoice_date' => $invoiceDate,
                'note' => $note,
                'total_amount' => $totalAmount,
            ]);

            $existingEvidenceStatement = db()->prepare(
                'SELECT id, file_path
                 FROM invoice_entry_evidences
                 WHERE invoice_id = :invoice_id'
            );
            $existingEvidenceStatement->execute([
                'invoice_id' => $invoiceId,
            ]);

            foreach ($existingEvidenceStatement->fetchAll() as $row) {
                $evidenceId = (int) $row['id'];
                if (!in_array($evidenceId, $keptEvidenceIds, true)) {
                    $filesToDeleteAfterCommit[] = (string) $row['file_path'];
                }
            }

            if ($keptEvidenceIds === []) {
                $deleteEvidenceStatement = db()->prepare(
                    'DELETE FROM invoice_entry_evidences WHERE invoice_id = :invoice_id'
                );
                $deleteEvidenceStatement->execute([
                    'invoice_id' => $invoiceId,
                ]);
            } else {
                $placeholders = implode(', ', array_fill(0, count($keptEvidenceIds), '?'));
                $deleteEvidenceStatement = db()->prepare(
                    'DELETE FROM invoice_entry_evidences
                     WHERE invoice_id = ?
                       AND id NOT IN (' . $placeholders . ')'
                );
                $deleteEvidenceStatement->execute(array_merge([$invoiceId], $keptEvidenceIds));
            }

            $deleteItemsStatement = db()->prepare('DELETE FROM invoice_entry_items WHERE invoice_id = :invoice_id');
            $deleteItemsStatement->execute([
                'invoice_id' => $invoiceId,
            ]);
        } else {
            $insertStatement = db()->prepare(
                'INSERT INTO invoice_entries (
                    id, store_id, invoice_scope, invoice_number, partner_name,
                    invoice_date, note, total_amount, created_by
                 ) VALUES (
                    :id, :store_id, :invoice_scope, :invoice_number, :partner_name,
                    :invoice_date, :note, :total_amount, :created_by
                 )'
            );
            $insertStatement->execute([
                'id' => $invoiceId,
                'store_id' => $storeId,
                'invoice_scope' => $scope,
                'invoice_number' => $invoiceNumber,
                'partner_name' => $partnerName,
                'invoice_date' => $invoiceDate,
                'note' => $note,
                'total_amount' => $totalAmount,
                'created_by' => $user['displayName'] ?? $user['email'] ?? $user['id'] ?? null,
            ]);
        }

        $itemStatement = db()->prepare(
            'INSERT INTO invoice_entry_items (
                invoice_id, item_name, quantity, unit, unit_price, line_total
             ) VALUES (
                :invoice_id, :item_name, :quantity, :unit, :unit_price, :line_total
             )'
        );

        foreach ($items as $item) {
            $itemStatement->execute([
                'invoice_id' => $invoiceId,
                'item_name' => $item['name'],
                'quantity' => $item['quantity'],
                'unit' => $item['unit'],
                'unit_price' => $item['unitPrice'],
                'line_total' => $item['lineTotal'],
            ]);
        }

        if ($uploadedFiles !== []) {
            $evidenceStatement = db()->prepare(
                'INSERT INTO invoice_entry_evidences (
                    invoice_id, file_path, file_name, original_name, mime_type, file_size
                 ) VALUES (
                    :invoice_id, :file_path, :file_name, :original_name, :mime_type, :file_size
                 )'
            );

            foreach ($uploadedFiles as $file) {
                $storedFile = invoice_store_uploaded_file($file, $scope, $storeId, $invoiceId);
                $newlyStoredFiles[] = $storedFile['filePath'];
                $evidenceStatement->execute([
                    'invoice_id' => $invoiceId,
                    'file_path' => $storedFile['filePath'],
                    'file_name' => $storedFile['fileName'],
                    'original_name' => $storedFile['originalName'],
                    'mime_type' => $storedFile['mimeType'],
                    'file_size' => $storedFile['fileSize'],
                ]);
            }
        }

        db()->commit();

        foreach ($filesToDeleteAfterCommit as $filePath) {
            invoice_delete_file($filePath);
        }

        $entry = invoice_get_entry_or_null($invoiceId);
        if ($entry === null) {
            respond_error('Cannot load saved invoice', 500);
        }

        return $entry;
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        foreach ($newlyStoredFiles as $filePath) {
            invoice_delete_file($filePath);
        }

        throw $exception;
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$user = auth_require(['admin']);

if ($method === 'GET') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id !== '') {
        $item = invoice_get_entry_or_null($id);
        if ($item === null) {
            respond_error('Invoice not found', 404);
        }

        respond_ok([
            'item' => $item,
        ]);
    }

    $storeId = invoice_normalize_store_id($_GET['storeId'] ?? 'cafe');
    $scope = invoice_normalize_scope($_GET['scope'] ?? '');
    $search = trim((string) ($_GET['search'] ?? ''));
    $startDate = trim((string) ($_GET['startDate'] ?? ''));
    $endDate = trim((string) ($_GET['endDate'] ?? ''));
    $limit = max(1, min(500, (int) ($_GET['limit'] ?? 200)));

    $sql = 'SELECT *
            FROM invoice_entries
            WHERE store_id = :store_id
              AND invoice_scope = :invoice_scope';
    $params = [
        'store_id' => $storeId,
        'invoice_scope' => $scope,
    ];

    if ($search !== '') {
        $sql .= ' AND (
            id LIKE :search_id
            OR invoice_number LIKE :search_invoice_number
            OR partner_name LIKE :search_partner_name
            OR note LIKE :search_note
            OR EXISTS (
                SELECT 1
                FROM invoice_entry_items invoice_items
                WHERE invoice_items.invoice_id = invoice_entries.id
                  AND (
                    invoice_items.item_name LIKE :search_item_name
                    OR COALESCE(invoice_items.unit, "") LIKE :search_item_unit
                  )
            )
        )';
        $searchValue = '%' . $search . '%';
        $params['search_id'] = $searchValue;
        $params['search_invoice_number'] = $searchValue;
        $params['search_partner_name'] = $searchValue;
        $params['search_note'] = $searchValue;
        $params['search_item_name'] = $searchValue;
        $params['search_item_unit'] = $searchValue;
    }

    if ($startDate !== '') {
        $sql .= ' AND invoice_date >= :start_date';
        $params['start_date'] = invoice_normalize_date($startDate);
    }

    if ($endDate !== '') {
        $sql .= ' AND invoice_date <= :end_date';
        $params['end_date'] = invoice_normalize_date($endDate);
    }

    $sql .= ' ORDER BY invoice_date DESC, created_at DESC LIMIT ' . $limit;
    $statement = db()->prepare($sql);
    $statement->execute($params);
    $rows = $statement->fetchAll();

    $invoiceIds = array_map(
        static function (array $row): string {
            return (string) $row['id'];
        },
        $rows
    );

    $itemsByInvoiceId = invoice_fetch_items_grouped($invoiceIds);
    $evidencesByInvoiceId = invoice_fetch_evidences_grouped($invoiceIds);

    respond_ok([
        'items' => array_map(
            static function (array $row) use ($itemsByInvoiceId, $evidencesByInvoiceId): array {
                return invoice_map_entry($row, $itemsByInvoiceId, $evidencesByInvoiceId);
            },
            $rows
        ),
    ]);
}

if ($method === 'POST') {
    $savedItem = invoice_save_entry($user);
    respond_ok([
        'item' => $savedItem,
    ]);
}

if ($method === 'DELETE') {
    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? $_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Invoice id is required', 422);
    }

    $evidenceStatement = db()->prepare(
        'SELECT file_path FROM invoice_entry_evidences WHERE invoice_id = :invoice_id'
    );
    $evidenceStatement->execute([
        'invoice_id' => $id,
    ]);
    $filePaths = array_map(
        static function (array $row): string {
            return (string) $row['file_path'];
        },
        $evidenceStatement->fetchAll()
    );

    $deleteStatement = db()->prepare('DELETE FROM invoice_entries WHERE id = :id');
    $deleteStatement->execute([
        'id' => $id,
    ]);

    foreach ($filePaths as $filePath) {
        invoice_delete_file($filePath);
    }

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
