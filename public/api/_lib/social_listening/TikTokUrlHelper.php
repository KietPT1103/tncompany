<?php

declare(strict_types=1);

final class TikTokUrlHelper
{
    public static function buildSearchUrl(string $keyword): string
    {
        $query = trim($keyword);
        if ($query === '') {
            return 'https://www.tiktok.com';
        }

        return 'https://www.tiktok.com/search?q=' . rawurlencode($query);
    }

    public static function buildVideoUrl(?string $videoUsername, ?string $videoId): ?string
    {
        $username = ltrim(trim((string) $videoUsername), '@');
        $id = trim((string) $videoId);

        if ($username === '' || $id === '') {
            return null;
        }

        return sprintf('https://www.tiktok.com/@%s/video/%s', rawurlencode($username), rawurlencode($id));
    }

    public static function buildDirectUrl(
        string $keyword,
        ?string $shareUrl,
        ?string $videoUrl,
        ?string $videoUsername,
        ?string $videoId
    ): string {
        $normalizedShareUrl = self::normalizeUrl($shareUrl);
        if ($normalizedShareUrl !== null) {
            return $normalizedShareUrl;
        }

        $normalizedVideoUrl = self::normalizeUrl($videoUrl);
        if ($normalizedVideoUrl !== null) {
            return $normalizedVideoUrl;
        }

        $builtUrl = self::buildVideoUrl($videoUsername, $videoId);
        if ($builtUrl !== null) {
            return $builtUrl;
        }

        return self::buildSearchUrl($keyword);
    }

    public static function normalizeUrl(?string $value): ?string
    {
        $url = trim((string) $value);
        if ($url === '') {
            return null;
        }

        if (!preg_match('/^https?:\/\//i', $url)) {
            return null;
        }

        return $url;
    }
}
