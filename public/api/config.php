<?php

declare(strict_types=1);

$envString = static fn (string $name, string $default = ''): string =>
    trim((string) (getenv($name) !== false ? getenv($name) : $default));

$envInt = static fn (string $name, int $default): int =>
    (int) (getenv($name) !== false ? getenv($name) : $default);

$envBool = static fn (string $name, bool $default): bool =>
    filter_var(
        getenv($name) !== false ? getenv($name) : ($default ? '1' : '0'),
        FILTER_VALIDATE_BOOLEAN
    );

$appEnv = strtolower($envString('APP_ENV', 'production'));
$dbDriver = strtolower($envString('DB_DRIVER', 'mysql'));
$defaultSqlitePath = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'dev.sqlite';

return [
    'app_env' => $appEnv,
    'app_debug' => $envBool('APP_DEBUG', $appEnv === 'local'),
    'db_driver' => $dbDriver,
    'db_host' => $envString('DB_HOST', 'localhost'),
    'db_port' => $envInt('DB_PORT', 3306),
    'db_name' => $envString('DB_NAME'),
    'db_user' => $envString('DB_USER'),
    'db_password' => $envString('DB_PASSWORD'),
    'db_database' => $envString('DB_DATABASE', $defaultSqlitePath),
    'cors_origin' => $envString('CORS_ORIGIN', '*'),
    'timezone' => $envString('APP_TIMEZONE', 'Asia/Ho_Chi_Minh'),
    'site_url' => rtrim($envString('SITE_URL', 'https://tnservice.vn'), '/'),
    'pusher_enabled' => $envBool('PUSHER_ENABLED', false),
    'pusher_app_id' => $envString('PUSHER_APP_ID'),
    'pusher_app_key' => $envString('PUSHER_APP_KEY'),
    'pusher_app_secret' => $envString('PUSHER_APP_SECRET'),
    'pusher_app_cluster' => $envString('PUSHER_APP_CLUSTER', 'ap1'),

    // Stored outside the public web root by default.
    'private_storage_path' => $envString(
        'PRIVATE_STORAGE_PATH',
        dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'private'
    ),
    'receipt_image_storage_driver' => strtolower($envString('RECEIPT_IMAGE_STORAGE_DRIVER', 'local')),
    'r2_account_id' => $envString('R2_ACCOUNT_ID'),
    'r2_endpoint' => $envString('R2_ENDPOINT'),
    'r2_bucket' => $envString('R2_BUCKET'),
    'r2_access_key_id' => $envString('R2_ACCESS_KEY_ID'),
    'r2_secret_access_key' => $envString('R2_SECRET_ACCESS_KEY'),

    'tiktok_provider' => strtolower($envString('TIKTOK_PROVIDER', 'disabled')),
    'tiktok_request_timeout' => max(5, $envInt('TIKTOK_REQUEST_TIMEOUT', 45)),
    'tiktok_max_videos' => max(1, $envInt('TIKTOK_MAX_VIDEOS', 20)),
    'tiktok_max_comments_per_video' => max(1, $envInt('TIKTOK_MAX_COMMENTS_PER_VIDEO', 200)),
    'tiktok_upstream_base_url' => rtrim($envString('TIKTOK_UPSTREAM_BASE_URL'), '/'),
    'tiktok_upstream_token' => $envString('TIKTOK_UPSTREAM_TOKEN'),
    'tiktok_apify_token' => $envString('TIKTOK_APIFY_TOKEN'),
    'tiktok_apify_search_actor_id' => $envString('TIKTOK_APIFY_SEARCH_ACTOR_ID'),
    'tiktok_apify_comment_actor_id' => $envString('TIKTOK_APIFY_COMMENT_ACTOR_ID'),
    'tiktok_worker_key' => $envString('TIKTOK_WORKER_KEY'),

    'gesture_edit_provider' => strtolower($envString('GESTURE_EDIT_PROVIDER', 'local_flux')),
    'gesture_edit_model' => $envString('GESTURE_EDIT_MODEL', 'gpt-image-1'),
    'gesture_edit_size' => $envString('GESTURE_EDIT_SIZE', '1024x1024'),
    'gesture_edit_timeout_seconds' => max(5, $envInt('GESTURE_EDIT_TIMEOUT_SECONDS', 180)),
    'gesture_edit_local_url' => $envString('GESTURE_EDIT_LOCAL_URL', 'http://127.0.0.1:8754/edit'),
    'gesture_edit_local_token' => $envString('GESTURE_EDIT_LOCAL_TOKEN'),
    'gesture_edit_local_model_id' => $envString(
        'GESTURE_EDIT_LOCAL_MODEL_ID',
        'black-forest-labs/FLUX.2-klein-4B'
    ),
    'gesture_edit_local_output_size' => $envString('GESTURE_EDIT_LOCAL_OUTPUT_SIZE', '1024x1024'),
];
