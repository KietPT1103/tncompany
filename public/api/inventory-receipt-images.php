<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/r2_storage.php';

const RECEIPT_IMAGE_MAX_BYTES = 12582912;

function receipt_image_storage_root(): string
{
    global $config;
    $configured = trim((string) ($config['private_storage_path'] ?? ''));
    return $configured !== '' ? rtrim($configured, DIRECTORY_SEPARATOR) : dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'private';
}

function receipt_image_storage_driver(): string
{
    $configured = strtolower(receipt_image_storage_config('receipt_image_storage_driver', 'RECEIPT_IMAGE_STORAGE_DRIVER', 'local'));
    return $configured === 'r2' ? 'r2' : 'local';
}

function receipt_image_storage_config(string $configKey, string $environmentKey, string $default = ''): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') {
        return trim((string) $environmentValue);
    }
    $configured = trim((string) ($config[$configKey] ?? ''));
    return $configured !== '' ? $configured : $default;
}

function receipt_image_r2(): R2Storage
{
    static $storage = null;
    if ($storage instanceof R2Storage) return $storage;

    $accountId = receipt_image_storage_config('r2_account_id', 'R2_ACCOUNT_ID');
    $endpoint = receipt_image_storage_config('r2_endpoint', 'R2_ENDPOINT');
    if ($endpoint === '' && $accountId !== '') {
        $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
    }
    $storage = new R2Storage(
        $endpoint,
        receipt_image_storage_config('r2_bucket', 'R2_BUCKET'),
        receipt_image_storage_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
        receipt_image_storage_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
    );
    return $storage;
}

function receipt_image_is_r2_path(string $path): bool
{
    return strpos($path, 'r2://') === 0;
}

function receipt_image_r2_key(string $path): string
{
    return receipt_image_is_r2_path($path) ? substr($path, 5) : $path;
}

function receipt_image_find(array $user, string $id): array
{
    $statement = db()->prepare(
        'SELECT im.*,r.store_id,r.status FROM inventory_receipt_images im
         INNER JOIN inventory_receipts r ON r.id=im.receipt_id WHERE im.id=:id LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $image = $statement->fetch();
    if (!$image) respond_error('Không tìm thấy ảnh.', 404);
    field_inventory_require_store($user, (string) $image['store_id']);
    return $image;
}

function receipt_image_create_thumbnail(string $source, string $target, string $mime): bool
{
    if (!function_exists('imagecreatetruecolor')) return false;
    $create = [
        'image/jpeg' => 'imagecreatefromjpeg',
        'image/png' => 'imagecreatefrompng',
        'image/webp' => 'imagecreatefromwebp',
    ][$mime] ?? null;
    $save = [
        'image/jpeg' => 'imagejpeg',
        'image/png' => 'imagepng',
        'image/webp' => 'imagewebp',
    ][$mime] ?? null;
    if (!$create || !$save || !function_exists($create) || !function_exists($save)) return false;
    $sourceImage = @$create($source);
    if (!$sourceImage) return false;
    $width = imagesx($sourceImage);
    $height = imagesy($sourceImage);
    $scale = min(1, 480 / max($width, $height));
    $targetWidth = max(1, (int) round($width * $scale));
    $targetHeight = max(1, (int) round($height * $scale));
    $thumbnail = imagecreatetruecolor($targetWidth, $targetHeight);
    if ($mime === 'image/png') {
        imagealphablending($thumbnail, false);
        imagesavealpha($thumbnail, true);
    }
    imagecopyresampled($thumbnail, $sourceImage, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
    $saved = $mime === 'image/png' ? @$save($thumbnail, $target, 7) : @$save($thumbnail, $target, 82);
    imagedestroy($sourceImage);
    imagedestroy($thumbnail);
    return (bool) $saved;
}

function receipt_image_emit(array $image, string $size): void
{
    $relative = $size === 'thumbnail' && $image['thumbnail_path'] ? $image['thumbnail_path'] : $image['file_path'];
    if (receipt_image_is_r2_path($relative)) {
        $contents = receipt_image_r2()->get(receipt_image_r2_key($relative));
        while (ob_get_level() > 0) @ob_end_clean();
        header('Content-Type: ' . $image['mime_type']);
        header('Content-Length: ' . strlen($contents));
        header('Cache-Control: private, max-age=3600');
        echo $contents;
        exit;
    }
    $root = realpath(receipt_image_storage_root());
    $path = realpath(receipt_image_storage_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative));
    if (!$root || !$path || strpos($path, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) {
        respond_error('Tệp ảnh không còn tồn tại.', 404);
    }
    while (ob_get_level() > 0) @ob_end_clean();
    header('Content-Type: ' . $image['mime_type']);
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, max-age=3600');
    readfile($path);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    $user = field_inventory_require_permission('inventory_receipts.view');
    $image = receipt_image_find($user, trim((string) ($_GET['id'] ?? '')));
    receipt_image_emit($image, strtolower((string) ($_GET['size'] ?? '')));
}

if ($method === 'POST') {
    $user = field_inventory_require_permission('inventory_receipts.upload_image');
    $receiptId = trim((string) ($_POST['receiptId'] ?? ''));
    $clientFileId = trim((string) ($_POST['clientFileId'] ?? ''));
    $receipt = field_inventory_require_receipt($user, $receiptId);
    if (!in_array($receipt['status'], ['pending_explanation', 'draft'], true)) respond_error('Phiếu đã khóa.', 409);
    if ($clientFileId === '') respond_error('Thiếu clientFileId.', 422);

    $duplicate = db()->prepare('SELECT id FROM inventory_receipt_images WHERE receipt_id=:receipt AND client_file_id=:client LIMIT 1');
    $duplicate->execute(['receipt' => $receiptId, 'client' => $clientFileId]);
    if ($existingId = $duplicate->fetchColumn()) {
        respond_ok(['item' => field_inventory_load_images($receiptId), 'idempotent' => true]);
    }
    $photo = $_FILES['photo'] ?? null;
    if (!is_array($photo) || ($photo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) respond_error('Ảnh upload không hợp lệ.', 422);
    if ((int) $photo['size'] > RECEIPT_IMAGE_MAX_BYTES) respond_error('Ảnh vượt quá giới hạn 12 MB.', 413);

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = (string) $finfo->file($photo['tmp_name']);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime])) respond_error('Chỉ chấp nhận JPEG, PNG hoặc WebP.', 422);
    $dimensions = @getimagesize($photo['tmp_name']) ?: [null, null];
    $capturedAt = field_inventory_datetime($_POST['capturedAt'] ?? null, true);
    $itemId = trim((string) ($_POST['receiptItemId'] ?? ''));
    if ($itemId !== '') {
        $checkItem = db()->prepare('SELECT 1 FROM inventory_receipt_items WHERE id=:item AND receipt_id=:receipt');
        $checkItem->execute(['item' => $itemId, 'receipt' => $receiptId]);
        if (!$checkItem->fetchColumn()) respond_error('Dòng hàng không thuộc phiếu.', 422);
    }
    $imageId = uuidv4();
    $relativeDir = 'inventory-receipts/' . rawurlencode((string) $receipt['store_id']) . '/' .
        (new DateTimeImmutable($capturedAt))->format('Y-m') . '/' . rawurlencode($receiptId);
    $filename = bin2hex(random_bytes(24)) . '.' . $extensions[$mime];
    $objectPath = $relativeDir . '/' . $filename;
    $relativePath = receipt_image_storage_driver() === 'r2' ? 'r2://' . $objectPath : $objectPath;
    $thumbnailName = pathinfo($filename, PATHINFO_FILENAME) . '.thumb.' . $extensions[$mime];
    $thumbnailObjectPath = $relativeDir . '/' . $thumbnailName;
    $thumbnailPath = receipt_image_storage_driver() === 'r2' ? 'r2://' . $thumbnailObjectPath : $thumbnailObjectPath;
    $thumbnailAbsolute = tempnam(sys_get_temp_dir(), 'receipt-thumb-');
    if ($thumbnailAbsolute === false || !receipt_image_create_thumbnail($photo['tmp_name'], $thumbnailAbsolute, $mime)) {
        if (is_string($thumbnailAbsolute) && is_file($thumbnailAbsolute)) @unlink($thumbnailAbsolute);
        $thumbnailAbsolute = null;
        $thumbnailPath = null;
    }
    $absolute = null;
    $storedOriginal = false;
    $storedThumbnail = false;

    if (receipt_image_storage_driver() === 'r2') {
        try {
            receipt_image_r2()->putFile($objectPath, $photo['tmp_name'], $mime);
            $storedOriginal = true;
            if ($thumbnailPath && $thumbnailAbsolute) {
                receipt_image_r2()->putFile($thumbnailObjectPath, $thumbnailAbsolute, $mime);
                $storedThumbnail = true;
            }
        } catch (Throwable $exception) {
            if ($storedOriginal) {
                try { receipt_image_r2()->delete($objectPath); } catch (Throwable $ignored) {}
            }
            if ($thumbnailAbsolute && is_file($thumbnailAbsolute)) @unlink($thumbnailAbsolute);
            throw $exception;
        }
    } else {
        $directory = receipt_image_storage_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativeDir);
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new RuntimeException('Không thể tạo thư mục ảnh.');
        }
        $absolute = $directory . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($photo['tmp_name'], $absolute)) throw new RuntimeException('Không thể lưu ảnh.');
        $storedOriginal = true;
        if ($thumbnailPath && $thumbnailAbsolute) {
            $targetThumbnail = $directory . DIRECTORY_SEPARATOR . $thumbnailName;
            if (@rename($thumbnailAbsolute, $targetThumbnail) || @copy($thumbnailAbsolute, $targetThumbnail)) {
                $storedThumbnail = true;
            } else {
                $thumbnailPath = null;
            }
        }
    }
    if ($thumbnailAbsolute && is_file($thumbnailAbsolute)) @unlink($thumbnailAbsolute);

    try {
        db()->beginTransaction();
        $insert = db()->prepare(
            'INSERT INTO inventory_receipt_images
             (id,receipt_id,receipt_item_id,client_file_id,file_path,thumbnail_path,mime_type,file_size,width,height,captured_at,
              latitude,longitude,location_accuracy,location_address,uploaded_by)
             VALUES (:id,:receipt,:item,:client,:path,:thumbnail,:mime,:size,:width,:height,:captured,
              :latitude,:longitude,:accuracy,:address,:uploaded)'
        );
        $insert->execute([
            'id' => $imageId, 'receipt' => $receiptId, 'item' => $itemId !== '' ? (int) $itemId : null,
            'client' => $clientFileId, 'path' => $relativePath, 'thumbnail' => $thumbnailPath, 'mime' => $mime, 'size' => $photo['size'],
            'width' => $dimensions[0], 'height' => $dimensions[1], 'captured' => $capturedAt,
            'latitude' => field_inventory_nullable_decimal($_POST['latitude'] ?? null),
            'longitude' => field_inventory_nullable_decimal($_POST['longitude'] ?? null),
            'accuracy' => field_inventory_nullable_decimal($_POST['locationAccuracy'] ?? null),
            'address' => trim((string) ($_POST['locationAddress'] ?? '')) ?: null, 'uploaded' => $user['id'],
        ]);
        if (filter_var($_POST['finalizeQuick'] ?? false, FILTER_VALIDATE_BOOL)) {
            $update = db()->prepare(
                'UPDATE inventory_receipts SET status="pending_explanation",
                 captured_at=COALESCE(captured_at,:captured),updated_at=NOW() WHERE id=:id AND status="draft"'
            );
            $update->execute(['id' => $receiptId, 'captured' => $capturedAt]);
        }
        db()->commit();
    } catch (Throwable $exception) {
        if (db()->inTransaction()) db()->rollBack();
        if (receipt_image_storage_driver() === 'r2') {
            if ($storedOriginal) {
                try { receipt_image_r2()->delete($objectPath); } catch (Throwable $ignored) {}
            }
            if ($storedThumbnail && $thumbnailPath) {
                try { receipt_image_r2()->delete($thumbnailObjectPath); } catch (Throwable $ignored) {}
            }
        } else {
            if ($absolute) @unlink($absolute);
            if ($storedThumbnail && $thumbnailPath) {
                @unlink($directory . DIRECTORY_SEPARATOR . $thumbnailName);
            }
        }
        throw $exception;
    }
    respond_ok(['item' => field_inventory_load_images($receiptId)], 201);
}

if ($method === 'DELETE') {
    $user = field_inventory_require_permission('inventory_receipts.upload_image');
    $body = read_json_body();
    $image = receipt_image_find($user, trim((string) ($_GET['id'] ?? $body['id'] ?? '')));
    if ($image['status'] === 'completed') respond_error('Không thể xóa ảnh của phiếu đã hoàn thành.', 409);
    if (receipt_image_is_r2_path($image['file_path'])) {
        receipt_image_r2()->delete(receipt_image_r2_key($image['file_path']));
        if ($image['thumbnail_path']) receipt_image_r2()->delete(receipt_image_r2_key($image['thumbnail_path']));
    } else {
        $path = receipt_image_storage_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $image['file_path']);
        if (is_file($path)) @unlink($path);
        if ($image['thumbnail_path']) {
            $thumbnail = receipt_image_storage_root() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $image['thumbnail_path']);
            if (is_file($thumbnail)) @unlink($thumbnail);
        }
    }
    $delete = db()->prepare('DELETE FROM inventory_receipt_images WHERE id=:id');
    $delete->execute(['id' => $image['id']]);
    respond_ok(['deleted' => true]);
}

respond_error('Method not allowed', 405);
