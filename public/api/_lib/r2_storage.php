<?php

declare(strict_types=1);

final class R2Storage
{
    private string $endpoint;
    private string $bucket;
    private string $accessKeyId;
    private string $secretAccessKey;

    public function __construct(string $endpoint, string $bucket, string $accessKeyId, string $secretAccessKey)
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('PHP cURL extension is required for R2 storage.');
        }

        $endpoint = rtrim(trim($endpoint), '/');
        $bucket = trim($bucket);
        if (!filter_var($endpoint, FILTER_VALIDATE_URL) || parse_url($endpoint, PHP_URL_SCHEME) !== 'https') {
            throw new RuntimeException('R2 endpoint must be a valid HTTPS URL.');
        }
        if ($bucket === '' || !preg_match('/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/', $bucket)) {
            throw new RuntimeException('R2 bucket name is invalid.');
        }
        if (trim($accessKeyId) === '' || trim($secretAccessKey) === '') {
            throw new RuntimeException('R2 Access Key ID or Secret Access Key is missing.');
        }

        $this->endpoint = $endpoint;
        $this->bucket = $bucket;
        $this->accessKeyId = trim($accessKeyId);
        $this->secretAccessKey = trim($secretAccessKey);
    }

    public function putFile(string $key, string $sourcePath, string $mimeType): void
    {
        if (!is_file($sourcePath) || !is_readable($sourcePath)) {
            throw new RuntimeException('R2 upload source is not readable.');
        }

        $payloadHash = hash_file('sha256', $sourcePath);
        if (!is_string($payloadHash)) {
            throw new RuntimeException('Cannot calculate R2 upload checksum.');
        }

        $handle = fopen($sourcePath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Cannot open R2 upload source.');
        }

        try {
            $this->request('PUT', $key, $payloadHash, $mimeType, $handle, (int) filesize($sourcePath));
        } finally {
            fclose($handle);
        }
    }

    public function get(string $key): string
    {
        return $this->request('GET', $key, hash('sha256', ''));
    }

    public function delete(string $key): void
    {
        $this->request('DELETE', $key, hash('sha256', ''));
    }

    public function presignedGetUrl(string $key, int $expiresInSeconds = 900): string
    {
        $expiresInSeconds = max(60, min(604800, $expiresInSeconds));
        $host = (string) parse_url($this->endpoint, PHP_URL_HOST);
        $canonicalUri = '/' . rawurlencode($this->bucket) . '/' . $this->encodeKey($key);
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $amzDate = $now->format('Ymd\THis\Z');
        $date = $now->format('Ymd');
        $scope = "{$date}/auto/s3/aws4_request";
        $query = [
            'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential' => $this->accessKeyId . '/' . $scope,
            'X-Amz-Date' => $amzDate,
            'X-Amz-Expires' => (string) $expiresInSeconds,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort($query);
        $canonicalQuery = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $canonicalRequest = "GET\n{$canonicalUri}\n{$canonicalQuery}\nhost:{$host}\n\nhost\nUNSIGNED-PAYLOAD";
        $stringToSign = "AWS4-HMAC-SHA256\n{$amzDate}\n{$scope}\n" . hash('sha256', $canonicalRequest);
        $dateKey = hash_hmac('sha256', $date, 'AWS4' . $this->secretAccessKey, true);
        $regionKey = hash_hmac('sha256', 'auto', $dateKey, true);
        $serviceKey = hash_hmac('sha256', 's3', $regionKey, true);
        $signingKey = hash_hmac('sha256', 'aws4_request', $serviceKey, true);
        $query['X-Amz-Signature'] = hash_hmac('sha256', $stringToSign, $signingKey);

        return $this->endpoint . $canonicalUri . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @param resource|null $uploadHandle
     */
    private function request(
        string $method,
        string $key,
        string $payloadHash,
        ?string $mimeType = null,
        $uploadHandle = null,
        int $uploadSize = 0
    ): string {
        $host = (string) parse_url($this->endpoint, PHP_URL_HOST);
        $canonicalUri = '/' . rawurlencode($this->bucket) . '/' . $this->encodeKey($key);
        $url = $this->endpoint . $canonicalUri;
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $amzDate = $now->format('Ymd\THis\Z');
        $date = $now->format('Ymd');
        $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        $canonicalHeaders = "host:{$host}\n"
            . "x-amz-content-sha256:{$payloadHash}\n"
            . "x-amz-date:{$amzDate}\n";
        $canonicalRequest = $method . "\n"
            . $canonicalUri . "\n\n"
            . $canonicalHeaders . "\n"
            . $signedHeaders . "\n"
            . $payloadHash;
        $scope = "{$date}/auto/s3/aws4_request";
        $stringToSign = "AWS4-HMAC-SHA256\n{$amzDate}\n{$scope}\n" . hash('sha256', $canonicalRequest);
        $dateKey = hash_hmac('sha256', $date, 'AWS4' . $this->secretAccessKey, true);
        $regionKey = hash_hmac('sha256', 'auto', $dateKey, true);
        $serviceKey = hash_hmac('sha256', 's3', $regionKey, true);
        $signingKey = hash_hmac('sha256', 'aws4_request', $serviceKey, true);
        $signature = hash_hmac('sha256', $stringToSign, $signingKey);
        $authorization = 'AWS4-HMAC-SHA256 Credential=' . $this->accessKeyId . '/' . $scope
            . ', SignedHeaders=' . $signedHeaders
            . ', Signature=' . $signature;

        $headers = [
            'Authorization: ' . $authorization,
            'x-amz-content-sha256: ' . $payloadHash,
            'x-amz-date: ' . $amzDate,
            'Expect:',
        ];
        if ($mimeType !== null && $mimeType !== '') {
            $headers[] = 'Content-Type: ' . $mimeType;
        }

        $curl = curl_init($url);
        if ($curl === false) {
            throw new RuntimeException('Cannot initialize R2 request.');
        }
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => is_resource($uploadHandle) ? 600 : 90,
        ]);
        if (is_resource($uploadHandle)) {
            curl_setopt($curl, CURLOPT_UPLOAD, true);
            curl_setopt($curl, CURLOPT_INFILE, $uploadHandle);
            curl_setopt($curl, CURLOPT_INFILESIZE, $uploadSize);
        }

        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $curlError = curl_error($curl);
        curl_close($curl);

        if ($body === false) {
            throw new RuntimeException('R2 connection failed: ' . ($curlError !== '' ? $curlError : 'unknown error'));
        }
        $accepted = $method === 'DELETE' ? [200, 204] : [200];
        if (!in_array($status, $accepted, true)) {
            $detail = trim(strip_tags((string) $body));
            $detail = preg_replace('/\s+/', ' ', $detail) ?: '';
            throw new RuntimeException(
                sprintf('R2 request failed (HTTP %d)%s', $status, $detail !== '' ? ': ' . substr($detail, 0, 300) : '')
            );
        }

        return (string) $body;
    }

    private function encodeKey(string $key): string
    {
        $segments = array_values(array_filter(
            explode('/', str_replace('\\', '/', trim($key, '/'))),
            static fn(string $segment): bool => $segment !== '' && $segment !== '.' && $segment !== '..'
        ));
        if ($segments === []) {
            throw new RuntimeException('R2 object key is empty.');
        }
        return implode('/', array_map('rawurlencode', $segments));
    }
}
