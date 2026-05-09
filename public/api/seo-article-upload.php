<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

auth_require(['admin']);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    respond_error('Upload file is required', 422);
}

$file = $_FILES['file'];

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    respond_error('Upload failed', 422, ['code' => (int) ($file['error'] ?? -1)]);
}

$tmpName = (string) ($file['tmp_name'] ?? '');
if ($tmpName === '' || !is_uploaded_file($tmpName)) {
    respond_error('Invalid upload source', 422);
}

$originalName = (string) ($file['name'] ?? 'image');
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

if (!in_array($extension, $allowedExtensions, true)) {
    respond_error('Unsupported image format', 422);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = $finfo ? finfo_file($finfo, $tmpName) : '';
if ($finfo) {
    finfo_close($finfo);
}

$allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

if (!in_array((string) $mimeType, $allowedMimeTypes, true)) {
    respond_error('Unsupported image mime type', 422);
}

$uploadRoot = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'seo';
$yearMonth = date('Y-m');
$targetDirectory = $uploadRoot . DIRECTORY_SEPARATOR . $yearMonth;

if (!is_dir($targetDirectory) && !mkdir($targetDirectory, 0777, true) && !is_dir($targetDirectory)) {
    respond_error('Cannot create upload directory', 500);
}

$fileName = date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
$targetPath = $targetDirectory . DIRECTORY_SEPARATOR . $fileName;

if (!move_uploaded_file($tmpName, $targetPath)) {
    respond_error('Cannot move uploaded file', 500);
}

$publicUrl = '/uploads/seo/' . $yearMonth . '/' . $fileName;

respond_ok([
    'url' => $publicUrl,
], 201);
