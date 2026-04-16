<?php

declare(strict_types=1);

final class TikTokHttpClient
{
    /** @var array<string, mixed> */
    private $config;

    public function __construct(array $config = [])
    {
        $this->config = $config;
    }

    /**
     * @param array<string, string> $headers
     * @param array<string, mixed>|null $body
     * @return array{status:int, headers:array<string, string>, body:string, json:mixed}
     */
    public function request(string $method, string $url, array $headers = [], ?array $body = null): array
    {
        $curl = curl_init();
        if ($curl === false) {
            throw new RuntimeException('Unable to initialize cURL.');
        }

        $responseHeaders = [];
        $timeout = max(5, (int) ($this->config['tiktok_request_timeout'] ?? 45));
        $normalizedHeaders = [];

        foreach ($headers as $name => $value) {
            $normalizedHeaders[] = $name . ': ' . $value;
        }

        if ($body !== null) {
            $normalizedHeaders[] = 'Content-Type: application/json';
        }

        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_CONNECTTIMEOUT => min(15, $timeout),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => $normalizedHeaders,
            CURLOPT_HEADERFUNCTION => static function ($curlHandle, string $headerLine) use (&$responseHeaders): int {
                $trimmed = trim($headerLine);
                if ($trimmed === '' || strpos($trimmed, ':') === false) {
                    return strlen($headerLine);
                }

                [$name, $value] = explode(':', $trimmed, 2);
                $responseHeaders[strtolower(trim($name))] = trim($value);
                return strlen($headerLine);
            },
        ]);

        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $rawBody = curl_exec($curl);
        if ($rawBody === false) {
            $error = curl_error($curl) ?: 'Unknown cURL error';
            curl_close($curl);
            throw new RuntimeException($error);
        }

        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        $decoded = null;
        $trimmed = trim($rawBody);
        if ($trimmed !== '' && ($trimmed[0] === '{' || $trimmed[0] === '[')) {
            $decoded = json_decode($trimmed, true);
        }

        return [
            'status' => $status,
            'headers' => $responseHeaders,
            'body' => $rawBody,
            'json' => $decoded,
        ];
    }
}
