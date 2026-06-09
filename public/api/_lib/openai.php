<?php

declare(strict_types=1);

function openai_config_value(string $envName, string $configKey, ?string $default = null): ?string
{
    global $config;

    $envValue = getenv($envName);
    if ($envValue !== false) {
        $envValue = trim((string) $envValue);
        if ($envValue !== '') {
            return $envValue;
        }
    }

    if (isset($config[$configKey])) {
        $configValue = trim((string) $config[$configKey]);
        if ($configValue !== '') {
            return $configValue;
        }
    }

    return $default;
}

function openai_env(string $name, ?string $default = null): ?string
{
    $configKeyMap = [
        'OPENAI_API_KEY' => 'openai_api_key',
        'OPENAI_MODEL' => 'openai_model',
        'OPENAI_SEO_MODEL' => 'openai_seo_model',
        'OPENAI_BASE_URL' => 'openai_base_url',
        'OPENAI_ORGANIZATION' => 'openai_organization',
        'OPENAI_PROJECT' => 'openai_project',
        'OPENAI_TIMEOUT_SECONDS' => 'openai_timeout_seconds',
    ];

    if (isset($configKeyMap[$name])) {
        return openai_config_value($name, $configKeyMap[$name], $default);
    }

    $value = getenv($name);
    if ($value === false) {
        return $default;
    }

    $value = trim((string) $value);
    return $value !== '' ? $value : $default;
}

function openai_api_key(): string
{
    return openai_env('OPENAI_API_KEY', '') ?? '';
}

function openai_base_url(): string
{
    return rtrim(openai_env('OPENAI_BASE_URL', 'https://api.openai.com/v1') ?? 'https://api.openai.com/v1', '/');
}

function openai_post_json(string $path, array $payload): array
{
    $apiKey = openai_api_key();
    if ($apiKey === '') {
        respond_error(
            'Missing OpenAI key. Add OPENAI_API_KEY to .env.local or openai_api_key to public/api/config.local.php.',
            500
        );
    }

    $url = openai_base_url() . $path;
    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
        'Accept: application/json',
    ];

    $organization = openai_env('OPENAI_ORGANIZATION');
    if ($organization !== null) {
        $headers[] = 'OpenAI-Organization: ' . $organization;
    }

    $project = openai_env('OPENAI_PROJECT');
    if ($project !== null) {
        $headers[] = 'OpenAI-Project: ' . $project;
    }

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($jsonPayload === false) {
        respond_error('Failed to encode OpenAI request payload.', 500);
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $jsonPayload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => max(10, (int) (openai_env('OPENAI_TIMEOUT_SECONDS', '90') ?? '90')),
        ]);

        $rawResponse = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if (!is_string($rawResponse) || $rawResponse === '') {
            respond_error(
                $curlError !== '' ? 'OpenAI request failed: ' . $curlError : 'Empty response from OpenAI.',
                502
            );
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $jsonPayload,
                'timeout' => max(10, (int) (openai_env('OPENAI_TIMEOUT_SECONDS', '90') ?? '90')),
                'ignore_errors' => true,
            ],
        ]);

        $rawResponse = @file_get_contents($url, false, $context);
        $statusLine = $http_response_header[0] ?? 'HTTP/1.1 500 Internal Server Error';
        preg_match('/\s(\d{3})\s/', $statusLine, $matches);
        $httpCode = isset($matches[1]) ? (int) $matches[1] : 500;

        if (!is_string($rawResponse) || $rawResponse === '') {
            respond_error('OpenAI request failed and returned no content.', 502);
        }
    }

    $decoded = json_decode($rawResponse, true);
    if (!is_array($decoded)) {
        respond_error('OpenAI returned invalid JSON.', 502, [
            'body' => substr($rawResponse, 0, 500),
        ]);
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        $message = (string) ($decoded['error']['message'] ?? 'OpenAI request failed.');
        respond_error($message, 502, [
            'status' => $httpCode,
        ]);
    }

    return $decoded;
}
