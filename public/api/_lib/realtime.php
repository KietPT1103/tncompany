<?php

declare(strict_types=1);

function realtime_settings(): array
{
    global $config;

    $settings = [
        'enabled' => !empty($config['pusher_enabled']),
        'appId' => trim((string) ($config['pusher_app_id'] ?? '')),
        'key' => trim((string) ($config['pusher_app_key'] ?? '')),
        'secret' => trim((string) ($config['pusher_app_secret'] ?? '')),
        'cluster' => trim((string) ($config['pusher_app_cluster'] ?? 'ap1')) ?: 'ap1',
    ];

    $settings['enabled'] = $settings['enabled']
        && $settings['appId'] !== ''
        && $settings['key'] !== ''
        && $settings['secret'] !== '';

    return $settings;
}

function realtime_channel_for_store(string $storeId): string
{
    $normalized = preg_replace('/[^a-z0-9_-]/', '', strtolower(trim($storeId))) ?: 'unknown';
    return 'private-store-' . $normalized;
}

function realtime_publish(string $storeId, string $eventName, array $payload = []): bool
{
    $settings = realtime_settings();
    if (!$settings['enabled']) return false;

    $eventName = preg_replace('/[^a-zA-Z0-9_-]/', '-', trim($eventName)) ?: 'store-updated';
    $eventData = json_encode(
        array_merge($payload, ['storeId' => $storeId, 'sentAt' => gmdate('c')]),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if ($eventData === false) return false;

    $body = json_encode([
        'name' => $eventName,
        'channels' => [realtime_channel_for_store($storeId)],
        'data' => $eventData,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) return false;

    $path = '/apps/' . rawurlencode($settings['appId']) . '/events';
    $query = [
        'auth_key' => $settings['key'],
        'auth_timestamp' => (string) time(),
        'auth_version' => '1.0',
        'body_md5' => md5($body),
    ];
    ksort($query);
    $queryString = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    $query['auth_signature'] = hash_hmac('sha256', "POST\n{$path}\n{$queryString}", $settings['secret']);
    $url = 'https://api-' . $settings['cluster'] . '.pusher.com' . $path . '?'
        . http_build_query($query, '', '&', PHP_QUERY_RFC3986);

    try {
        if (function_exists('curl_init')) {
            $handle = curl_init($url);
            if ($handle === false) return false;
            curl_setopt_array($handle, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT_MS => 500,
                CURLOPT_TIMEOUT_MS => 1000,
            ]);
            curl_exec($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            curl_close($handle);
            return $status >= 200 && $status < 300;
        }

        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 2,
            'ignore_errors' => true,
        ]]);
        $result = @file_get_contents($url, false, $context);
        return $result !== false;
    } catch (Throwable $exception) {
        error_log('Pusher publish failed: ' . $exception->getMessage());
        return false;
    }
}
