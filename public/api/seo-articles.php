<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/seo_articles.php';

function seo_articles_fetch_by_id(string $id): ?array
{
    $statement = db()->prepare('SELECT * FROM seo_articles WHERE id = :id LIMIT 1');
    $statement->execute([
        'id' => $id,
    ]);

    $row = $statement->fetch();
    return $row ? seo_articles_map_row($row) : null;
}

function seo_articles_validate_target_store(string $value): string
{
    $allowed = ['company', 'cafe', 'hotpot', 'farm'];
    return in_array($value, $allowed, true) ? $value : 'company';
}

function seo_articles_build_payload(array $body, ?array $existing = null): array
{
    $title = trim((string) ($body['title'] ?? ($existing['title'] ?? '')));
    if ($title === '') {
        respond_error('Title is required', 422);
    }

    $slugInput = trim((string) ($body['slug'] ?? ''));
    $slug = seo_articles_slugify($slugInput !== '' ? $slugInput : $title);
    if ($slug === '') {
        respond_error('Slug is required', 422);
    }

    $contentBlocks = seo_articles_normalize_blocks(
        $body['contentJson'] ?? ($existing['contentJson'] ?? null),
        (string) ($body['contentHtml'] ?? ($existing['contentHtml'] ?? ''))
    );
    $contentHtml = seo_articles_sanitize_html(
        $body['contentHtml'] ?? seo_articles_blocks_to_html($contentBlocks)
    );
    if ($contentHtml === '') {
        respond_error('Article content is required', 422);
    }

    $isPublished = array_key_exists('isPublished', $body)
        ? !empty($body['isPublished'])
        : (bool) ($existing['isPublished'] ?? false);

    $publishedAt = array_key_exists('publishedAt', $body)
        ? seo_articles_normalize_datetime((string) ($body['publishedAt'] ?? ''))
        : ($existing['publishedAt'] ?? null);

    if ($isPublished && $publishedAt === null) {
        $publishedAt = date('Y-m-d H:i:s');
    }

    return [
        'slug' => $slug,
        'title' => $title,
        'excerpt' => trim((string) ($body['excerpt'] ?? ($existing['excerpt'] ?? ''))),
        'content_html' => $contentHtml,
        'content_json' => $contentBlocks,
        'cover_image_url' => trim((string) ($body['coverImageUrl'] ?? ($existing['coverImageUrl'] ?? ''))),
        'meta_title' => trim((string) ($body['metaTitle'] ?? ($existing['metaTitle'] ?? ''))),
        'meta_description' => trim((string) ($body['metaDescription'] ?? ($existing['metaDescription'] ?? ''))),
        'target_store' => seo_articles_validate_target_store(
            trim((string) ($body['targetStore'] ?? ($existing['targetStore'] ?? 'company')))
        ),
        'is_published' => $isPublished ? 1 : 0,
        'published_at' => $publishedAt,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
auth_require(['admin']);

if ($method === 'GET') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id !== '') {
        respond_ok([
            'item' => seo_articles_fetch_by_id($id),
        ]);
    }

    $limit = max(1, min(200, (int) ($_GET['limit'] ?? 100)));
    $query = trim((string) ($_GET['query'] ?? ''));
    $status = trim((string) ($_GET['status'] ?? 'all'));

    $sql = 'SELECT * FROM seo_articles WHERE 1 = 1';
    $params = [];

    if ($query !== '') {
        $sql .= ' AND (title LIKE :query OR slug LIKE :query OR excerpt LIKE :query)';
        $params['query'] = '%' . $query . '%';
    }

    if ($status === 'published') {
        $sql .= ' AND is_published = 1';
    } elseif ($status === 'draft') {
        $sql .= ' AND is_published = 0';
    }

    $sql .= ' ORDER BY updated_at DESC LIMIT :limit';

    $statement = db()->prepare($sql);
    foreach ($params as $key => $value) {
        $statement->bindValue(':' . $key, $value);
    }
    $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
    $statement->execute();

    respond_ok([
        'items' => array_map(
            static function (array $row): array {
                return seo_articles_map_row($row);
            },
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    $user = auth_current_user();
    $body = read_json_body();
    $payload = seo_articles_build_payload($body);

    if (seo_articles_slug_exists($payload['slug'])) {
        respond_error('Slug already exists', 422);
    }

    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO seo_articles (
            id, slug, title, excerpt, content_html, content_json, cover_image_url,
            meta_title, meta_description, target_store, is_published,
            published_at, created_by, created_at, updated_at
         ) VALUES (
            :id, :slug, :title, :excerpt, :content_html, :content_json, :cover_image_url,
            :meta_title, :meta_description, :target_store, :is_published,
            :published_at, :created_by, :created_at, :updated_at
         )'
    );

    $now = date('Y-m-d H:i:s');
    $statement->execute([
        'id' => $id,
        'slug' => $payload['slug'],
        'title' => $payload['title'],
        'excerpt' => $payload['excerpt'],
        'content_html' => $payload['content_html'],
        'content_json' => json_encode($payload['content_json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'cover_image_url' => $payload['cover_image_url'] !== '' ? $payload['cover_image_url'] : null,
        'meta_title' => $payload['meta_title'] !== '' ? $payload['meta_title'] : null,
        'meta_description' => $payload['meta_description'] !== '' ? $payload['meta_description'] : null,
        'target_store' => $payload['target_store'],
        'is_published' => $payload['is_published'],
        'published_at' => $payload['published_at'],
        'created_by' => $user['id'] ?? null,
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    respond_ok([
        'id' => $id,
    ], 201);
}

if ($method === 'PATCH') {
    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Article id is required', 422);
    }

    $existing = seo_articles_fetch_by_id($id);
    if (!$existing) {
        respond_error('Article not found', 404);
    }

    $payload = seo_articles_build_payload($body, $existing);
    if (seo_articles_slug_exists($payload['slug'], $id)) {
        respond_error('Slug already exists', 422);
    }

    $statement = db()->prepare(
        'UPDATE seo_articles
         SET slug = :slug,
             title = :title,
             excerpt = :excerpt,
             content_html = :content_html,
             content_json = :content_json,
             cover_image_url = :cover_image_url,
             meta_title = :meta_title,
             meta_description = :meta_description,
             target_store = :target_store,
             is_published = :is_published,
             published_at = :published_at,
             updated_at = :updated_at
         WHERE id = :id'
    );

    $statement->execute([
        'id' => $id,
        'slug' => $payload['slug'],
        'title' => $payload['title'],
        'excerpt' => $payload['excerpt'],
        'content_html' => $payload['content_html'],
        'content_json' => json_encode($payload['content_json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'cover_image_url' => $payload['cover_image_url'] !== '' ? $payload['cover_image_url'] : null,
        'meta_title' => $payload['meta_title'] !== '' ? $payload['meta_title'] : null,
        'meta_description' => $payload['meta_description'] !== '' ? $payload['meta_description'] : null,
        'target_store' => $payload['target_store'],
        'is_published' => $payload['is_published'],
        'published_at' => $payload['published_at'],
        'updated_at' => date('Y-m-d H:i:s'),
    ]);

    respond_ok([
        'updated' => true,
    ]);
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Article id is required', 422);
    }

    $statement = db()->prepare('DELETE FROM seo_articles WHERE id = :id');
    $statement->execute([
        'id' => $id,
    ]);

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
