<?php

declare(strict_types=1);

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function respond_ok(array $data = [], int $status = 200): never
{
    respond([
        'ok' => true,
        'data' => $data,
    ], $status);
}

function respond_error(string $message, int $status = 400, array $extra = []): never
{
    respond([
        'ok' => false,
        'error' => $message,
        'meta' => $extra,
    ], $status);
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
