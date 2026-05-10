<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/seo_articles.php';

function venue_editorial_validate_target_store(string $value): string
{
    $allowed = ['cafe', 'hotpot', 'farm'];
    return in_array($value, $allowed, true) ? $value : '';
}

function venue_editorial_base_url(): string
{
    global $config;

    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host !== '') {
        $forwardedProto = trim((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        $https = trim((string) ($_SERVER['HTTPS'] ?? ''));
        $scheme = ($forwardedProto === 'https' || $https === 'on' || $https === '1')
            ? 'https'
            : 'http';

        return $scheme . '://' . $host;
    }

    $configured = trim((string) ($config['site_url'] ?? ''));
    if ($configured !== '') {
        return rtrim($configured, '/');
    }

    return 'https://tnservice.vn';
}

function venue_editorial_resolve_asset_url(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    if (preg_match('/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i', $value)) {
        return $value;
    }

    return venue_editorial_base_url() . '/' . ltrim($value, '/');
}

function venue_editorial_resolve_html_assets(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }

    return preg_replace_callback(
        '/\b(src|href)\s*=\s*(["\'])(.*?)\2/i',
        static function (array $matches): string {
            $attribute = $matches[1] ?? 'src';
            $quote = $matches[2] ?? '"';
            $value = $matches[3] ?? '';

            return sprintf(
                '%s=%s%s%s',
                $attribute,
                $quote,
                venue_editorial_resolve_asset_url((string) $value),
                $quote
            );
        },
        $html
    ) ?? $html;
}

function venue_editorial_map_article(array $article): array
{
    $contentJson = is_array($article['contentJson'] ?? null) ? $article['contentJson'] : [];
    $mappedBlocks = array_map(
        static function (array $block): array {
            $block['imageUrl'] = venue_editorial_resolve_asset_url((string) ($block['imageUrl'] ?? ''));
            $block['html'] = venue_editorial_resolve_html_assets((string) ($block['html'] ?? ''));
            return $block;
        },
        $contentJson
    );

    $article['coverImageUrl'] = venue_editorial_resolve_asset_url((string) ($article['coverImageUrl'] ?? ''));
    $article['contentHtml'] = venue_editorial_resolve_html_assets((string) ($article['contentHtml'] ?? ''));
    $article['contentJson'] = $mappedBlocks;
    $article['publicPath'] = seo_articles_public_path((string) ($article['slug'] ?? ''));

    return $article;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    respond_error('Method not allowed', 405);
}

$targetStore = venue_editorial_validate_target_store(trim((string) ($_GET['targetStore'] ?? '')));
if ($targetStore === '') {
    respond_ok([
        'item' => null,
    ]);
}

$article = seo_articles_fetch_latest_public_article_for_target_store($targetStore);

respond_ok([
    'item' => $article ? venue_editorial_map_article($article) : null,
]);
