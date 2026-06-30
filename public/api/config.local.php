<?php

declare(strict_types=1);

return [
    'app_env' => 'local',
    'app_debug' => true,
    'db_driver' => 'mysql',
    'db_host' => 'wayland.maychu.cloud',
    'db_port' => 3306,
    'db_name' => 'tnservic69a7_tnservice',
    'db_user' => 'tnservic69a7_tnservice',
    'db_password' => 'nhungkiet04',
    'cors_origin' => '*',
    'timezone' => 'Asia/Ho_Chi_Minh',
    'tiktok_provider' => 'apify',
    'tiktok_request_timeout' => 120,
    'tiktok_max_videos' => 100,
    'tiktok_max_comments_per_video' => 500,
    'tiktok_apify_token' => 'apify_api_KyEraaTwMbITCLlHOaYul39EJ4e0sh2hftjz',
    'tiktok_apify_search_actor_id' => 'clockworks/tiktok-scraper',
    'tiktok_apify_comment_actor_id' => 'clockworks/tiktok-comments-scraper',
    'tiktok_worker_key' => 'chuoi_random_cua_anh',
    'gesture_edit_provider' => 'local_flux',
    'gesture_edit_model' => 'gpt-image-1',
    'gesture_edit_size' => '1024x1024',
    'gesture_edit_timeout_seconds' => 180,
    'gesture_edit_local_url' => 'http://127.0.0.1:8754/edit',
    'gesture_edit_local_token' => '',
    'gesture_edit_local_model_id' => 'black-forest-labs/FLUX.2-klein-4B',
    'gesture_edit_local_output_size' => '1024x1024',
];
