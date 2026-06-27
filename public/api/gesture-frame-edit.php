<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/openai.php';

auth_require_permission('gesture_studio.access', ['admin']);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

/**
 * @return array{mime:string,data:string}
 */
function gesture_parse_data_url(string $value): array
{
    if (preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', $value, $matches) !== 1) {
        respond_error('Image payload is invalid.', 422);
    }

    $binary = base64_decode($matches[2], true);
    if (!is_string($binary) || $binary === '') {
        respond_error('Image payload cannot be decoded.', 422);
    }

    return [
        'mime' => strtolower((string) $matches[1]),
        'data' => $binary,
    ];
}

function gesture_config_value(string $envName, string $configKey, string $default = ''): string
{
    global $config;

    $envValue = getenv($envName);
    if ($envValue !== false) {
        $trimmed = trim((string) $envValue);
        if ($trimmed !== '') {
            return $trimmed;
        }
    }

    $configValue = $config[$configKey] ?? null;
    if (is_string($configValue) || is_numeric($configValue)) {
        $trimmed = trim((string) $configValue);
        if ($trimmed !== '') {
            return $trimmed;
        }
    }

    return $default;
}

function gesture_uploads_directory(): string
{
    $directory = dirname(__DIR__) . '/uploads/gesture-studio';
    if (!is_dir($directory) && !mkdir($directory, 0777, true) && !is_dir($directory)) {
        respond_error('Cannot prepare gesture upload directory.', 500);
    }

    return $directory;
}

function gesture_store_output(string $binary): string
{
    $directory = gesture_uploads_directory();
    $fileName = 'gesture-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.png';
    $filePath = $directory . '/' . $fileName;

    if (file_put_contents($filePath, $binary) === false) {
        respond_error('Cannot persist generated image.', 500);
    }

    return '/uploads/gesture-studio/' . $fileName;
}

/**
 * @param array<int|string, CURLFile|string> $payload
 * @param array<int, string> $headers
 * @return array<string, mixed>
 */
function gesture_post_multipart(string $url, array $payload, array $headers = []): array
{
    if (!function_exists('curl_init')) {
        respond_error('cURL is required for image edit requests.', 500);
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => max(10, (int) (openai_env('OPENAI_TIMEOUT_SECONDS', '90') ?? '90')),
    ]);

    $rawResponse = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if (!is_string($rawResponse) || $rawResponse === '') {
        respond_error(
            $curlError !== '' ? 'Image edit request failed: ' . $curlError : 'Empty response from image edit provider.',
            502
        );
    }

    $decoded = json_decode($rawResponse, true);
    if (!is_array($decoded)) {
        respond_error('Image edit provider returned invalid JSON.', 502, [
            'body' => substr($rawResponse, 0, 500),
        ]);
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        $message = (string) ($decoded['error']['message'] ?? $decoded['error'] ?? 'Image edit request failed.');
        respond_error($message, 502, ['status' => $httpCode]);
    }

    return $decoded;
}

/**
 * @return array{provider:string,model:string,imageUrl:string,revisedPrompt:?string}
 */
function gesture_edit_with_openai(string $prompt, array $sourceImage, array $maskImage): array
{
    $apiKey = openai_api_key();
    if ($apiKey === '') {
        respond_error('Missing OPENAI_API_KEY for image editing.', 500);
    }

    $imagePath = tempnam(sys_get_temp_dir(), 'gesture-image-');
    $maskPath = tempnam(sys_get_temp_dir(), 'gesture-mask-');
    if ($imagePath === false || $maskPath === false) {
        respond_error('Cannot prepare temporary image files.', 500);
    }

    file_put_contents($imagePath, $sourceImage['data']);
    file_put_contents($maskPath, $maskImage['data']);

    $model = gesture_config_value('GESTURE_EDIT_MODEL', 'gesture_edit_model', 'gpt-image-1');
    $payload = [
        'model' => $model,
        'prompt' => $prompt,
        'size' => gesture_config_value('GESTURE_EDIT_SIZE', 'gesture_edit_size', '1024x1024'),
        'image[]' => new CURLFile($imagePath, $sourceImage['mime'], 'frame.png'),
        'mask' => new CURLFile($maskPath, $maskImage['mime'], 'mask.png'),
    ];

    $headers = [
        'Authorization: Bearer ' . $apiKey,
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

    try {
        $response = gesture_post_multipart(openai_base_url() . '/images/edits', $payload, $headers);
    } finally {
        @unlink($imagePath);
        @unlink($maskPath);
    }

    $base64Image = (string) ($response['data'][0]['b64_json'] ?? '');
    if ($base64Image === '') {
        respond_error('Image edit provider did not return image data.', 502);
    }

    $binary = base64_decode($base64Image, true);
    if (!is_string($binary) || $binary === '') {
        respond_error('Generated image is invalid.', 502);
    }

    return [
        'provider' => 'openai',
        'model' => $model,
        'imageUrl' => gesture_store_output($binary),
        'revisedPrompt' => isset($response['data'][0]['revised_prompt']) ? (string) $response['data'][0]['revised_prompt'] : null,
    ];
}

$body = read_json_body();
$prompt = trim((string) ($body['prompt'] ?? ''));
$imageDataUrl = trim((string) ($body['imageDataUrl'] ?? ''));
$maskDataUrl = trim((string) ($body['maskDataUrl'] ?? ''));
$box = is_array($body['box'] ?? null) ? $body['box'] : [];

if ($prompt === '') {
    respond_error('Prompt is required.', 422);
}

if ($imageDataUrl === '' || $maskDataUrl === '') {
    respond_error('Frame image and mask are required.', 422);
}

$width = max(0, (int) ($box['width'] ?? 0));
$height = max(0, (int) ($box['height'] ?? 0));
if ($width < 24 || $height < 24) {
    respond_error('Selected frame is too small.', 422);
}

$sourceImage = gesture_parse_data_url($imageDataUrl);
$maskImage = gesture_parse_data_url($maskDataUrl);

foreach ([$sourceImage['mime'], $maskImage['mime']] as $mime) {
    if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
        respond_error('Only PNG/JPEG/WEBP images are supported.', 422);
    }
}

$provider = strtolower(gesture_config_value('GESTURE_EDIT_PROVIDER', 'gesture_edit_provider', 'openai'));
if ($provider !== 'openai') {
    respond_error(
        'Configured gesture edit provider is not supported by this build. Set GESTURE_EDIT_PROVIDER=openai or extend the endpoint.',
        500
    );
}

respond_ok(gesture_edit_with_openai($prompt, $sourceImage, $maskImage));
