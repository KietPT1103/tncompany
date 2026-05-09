<?php

declare(strict_types=1);

function seo_articles_ensure_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS seo_articles (
            id VARCHAR(36) PRIMARY KEY,
            slug VARCHAR(191) NOT NULL,
            title VARCHAR(255) NOT NULL,
            excerpt TEXT NULL,
            content_html LONGTEXT NOT NULL,
            content_json LONGTEXT NULL,
            cover_image_url VARCHAR(500) NULL,
            meta_title VARCHAR(255) NULL,
            meta_description VARCHAR(320) NULL,
            target_store VARCHAR(32) NULL,
            is_published TINYINT(1) NOT NULL DEFAULT 0,
            published_at DATETIME NULL,
            created_by VARCHAR(36) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_seo_articles_slug (slug),
            KEY idx_seo_articles_published (is_published, published_at),
            KEY idx_seo_articles_target_store (target_store),
            KEY idx_seo_articles_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    seo_articles_ensure_column('content_json', 'LONGTEXT NULL AFTER content_html');
}

function seo_articles_ensure_column(string $column, string $definition): void
{
    global $config;

    if (!preg_match('/^[a-z_]+$/', $column)) {
        throw new InvalidArgumentException('Invalid article column');
    }

    if (($config['db_driver'] ?? 'mysql') === 'sqlite') {
        return;
    }

    $statement = db()->prepare(
        'SELECT COLUMN_NAME
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = :table_name
           AND column_name = :column_name
         LIMIT 1'
    );
    $statement->execute([
        'table_name' => 'seo_articles',
        'column_name' => $column,
    ]);

    if ($statement->fetch()) {
        return;
    }

    db()->exec(sprintf('ALTER TABLE seo_articles ADD COLUMN %s %s', $column, $definition));
}

seo_articles_ensure_table();

function seo_articles_slugify(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    $value = str_replace(['đ', 'Đ'], 'd', $value);

    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }

    if (function_exists('iconv')) {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($converted) && $converted !== '') {
            $value = $converted;
        }
    }

    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');

    return $value;
}

function seo_articles_sanitize_html(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }

    $html = preg_replace('#<script\b[^>]*>(.*?)</script>#is', '', $html) ?? '';
    $html = preg_replace('/\son[a-z]+\s*=\s*"[^"]*"/i', '', $html) ?? '';
    $html = preg_replace("/\son[a-z]+\s*=\s*'[^']*'/i", '', $html) ?? '';
    $html = preg_replace('/\son[a-z]+\s*=\s*[^\s>]+/i', '', $html) ?? '';
    $html = preg_replace('/(href|src)\s*=\s*"javascript:[^"]*"/i', '$1="#"', $html) ?? '';
    $html = preg_replace("/(href|src)\s*=\s*'javascript:[^']*'/i", '$1=\'#\'', $html) ?? '';

    return trim($html);
}

function seo_articles_normalize_blocks($blocks, string $fallbackHtml = ''): array
{
    if (!is_array($blocks)) {
        $fallbackText = trim(strip_tags($fallbackHtml));
        if ($fallbackText === '' && trim($fallbackHtml) === '') {
            return [];
        }

        return [[
            'id' => uuidv4(),
            'heading' => '',
            'html' => seo_articles_sanitize_html($fallbackHtml),
            'imageUrl' => '',
            'imageAlt' => '',
        ]];
    }

    $normalized = [];

    foreach ($blocks as $block) {
        if (!is_array($block)) {
            continue;
        }

        $html = seo_articles_sanitize_html((string) ($block['html'] ?? ''));
        $heading = trim((string) ($block['heading'] ?? ''));
        $imageUrl = trim((string) ($block['imageUrl'] ?? ''));
        $imageAlt = trim((string) ($block['imageAlt'] ?? ''));

        if ($heading === '' && $html === '' && $imageUrl === '') {
            continue;
        }

        $normalized[] = [
            'id' => trim((string) ($block['id'] ?? '')) ?: uuidv4(),
            'heading' => $heading,
            'html' => $html,
            'imageUrl' => $imageUrl,
            'imageAlt' => $imageAlt,
        ];
    }

    return $normalized;
}

function seo_articles_blocks_to_html(array $blocks): string
{
    $segments = [];

    foreach ($blocks as $block) {
        $heading = trim((string) ($block['heading'] ?? ''));
        $html = trim((string) ($block['html'] ?? ''));
        $imageUrl = trim((string) ($block['imageUrl'] ?? ''));
        $imageAlt = trim((string) ($block['imageAlt'] ?? ''));

        $parts = [];

        if ($heading !== '') {
            $parts[] = '<h2>' . htmlspecialchars($heading, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</h2>';
        }

        if ($html !== '') {
            $parts[] = $html;
        }

        if ($imageUrl !== '') {
            $safeUrl = htmlspecialchars($imageUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $safeAlt = htmlspecialchars($imageAlt !== '' ? $imageAlt : $heading, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $parts[] = sprintf(
                '<figure><img src="%s" alt="%s" loading="lazy" /></figure>',
                $safeUrl,
                $safeAlt
            );
        }

        if ($parts !== []) {
            $segments[] = '<section>' . implode("\n", $parts) . '</section>';
        }
    }

    return implode("\n", $segments);
}

function seo_articles_excerpt(string $excerpt, string $contentHtml, int $limit = 180): string
{
    $source = trim($excerpt);
    if ($source === '') {
        $source = trim(preg_replace('/\s+/', ' ', strip_tags($contentHtml)) ?? '');
    }

    if ($source === '') {
        return '';
    }

    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($source, 'UTF-8') <= $limit) {
            return $source;
        }

        return rtrim(mb_substr($source, 0, $limit - 1, 'UTF-8')) . '…';
    }

    if (strlen($source) <= $limit) {
        return $source;
    }

    return rtrim(substr($source, 0, $limit - 1)) . '...';
}

function seo_articles_normalize_datetime(?string $value): ?string
{
    $value = trim((string) $value);
    if ($value === '') {
        return null;
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return null;
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function seo_articles_map_row(array $row): array
{
    $contentHtml = (string) ($row['content_html'] ?? '');
    $decodedBlocks = json_decode((string) ($row['content_json'] ?? '[]'), true);
    $contentJson = seo_articles_normalize_blocks($decodedBlocks, $contentHtml);
    $excerpt = seo_articles_excerpt((string) ($row['excerpt'] ?? ''), $contentHtml);

    return [
        'id' => (string) $row['id'],
        'slug' => (string) $row['slug'],
        'title' => (string) $row['title'],
        'excerpt' => $excerpt,
        'contentHtml' => $contentHtml,
        'contentJson' => $contentJson,
        'coverImageUrl' => $row['cover_image_url'] ? (string) $row['cover_image_url'] : '',
        'metaTitle' => $row['meta_title'] ? (string) $row['meta_title'] : '',
        'metaDescription' => $row['meta_description'] ? (string) $row['meta_description'] : '',
        'targetStore' => $row['target_store'] ? (string) $row['target_store'] : 'company',
        'isPublished' => (bool) ($row['is_published'] ?? false),
        'publishedAt' => $row['published_at'] ? (string) $row['published_at'] : null,
        'createdBy' => $row['created_by'] ? (string) $row['created_by'] : null,
        'createdAt' => (string) $row['created_at'],
        'updatedAt' => (string) $row['updated_at'],
    ];
}

function seo_articles_slug_exists(string $slug, ?string $ignoreId = null): bool
{
    $sql = 'SELECT id FROM seo_articles WHERE slug = :slug';
    $params = ['slug' => $slug];

    if ($ignoreId) {
        $sql .= ' AND id <> :ignore_id';
        $params['ignore_id'] = $ignoreId;
    }

    $sql .= ' LIMIT 1';

    $statement = db()->prepare($sql);
    $statement->execute($params);

    return (bool) $statement->fetch();
}

function seo_articles_public_path(string $slug): string
{
    return '/bai-viet/' . rawurlencode($slug);
}

function seo_articles_fetch_public_article_by_slug(string $slug): ?array
{
    $statement = db()->prepare(
        'SELECT *
         FROM seo_articles
         WHERE slug = :slug
           AND is_published = 1
           AND (published_at IS NULL OR published_at <= NOW())
         LIMIT 1'
    );
    $statement->execute([
        'slug' => $slug,
    ]);

    $row = $statement->fetch();
    return $row ? seo_articles_map_row($row) : null;
}

function seo_articles_fetch_public_articles(int $limit = 50): array
{
    $statement = db()->prepare(
        'SELECT *
         FROM seo_articles
         WHERE is_published = 1
           AND (published_at IS NULL OR published_at <= NOW())
         ORDER BY COALESCE(published_at, created_at) DESC
         LIMIT :limit'
    );
    $statement->bindValue(':limit', max(1, min(500, $limit)), PDO::PARAM_INT);
    $statement->execute();

    return array_map(
        static function (array $row): array {
            return seo_articles_map_row($row);
        },
        $statement->fetchAll()
    );
}
