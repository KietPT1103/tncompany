<?php

declare(strict_types=1);

require_once __DIR__ . '/_seo_runtime.php';

header('Content-Type: text/html; charset=utf-8');

function tn_news_store_options(): array
{
    return [
        'all' => [
            'label' => 'Tất cả',
            'shortLabel' => 'All',
            'description' => 'Toàn bộ tin tức trong hệ sinh thái',
        ],
        'company' => [
            'label' => 'Toàn hệ',
            'shortLabel' => 'Toàn hệ',
            'description' => 'Nội dung dùng chung cho cả 3 quầy',
        ],
        'cafe' => [
            'label' => 'Cà phê',
            'shortLabel' => 'Cafe',
            'description' => 'Tin từ quầy cà phê và trải nghiệm đồ uống',
        ],
        'hotpot' => [
            'label' => 'Tiệm lẩu',
            'shortLabel' => 'Lẩu',
            'description' => 'Tin từ quầy lẩu, món ăn và dịch vụ bàn',
        ],
        'farm' => [
            'label' => 'Farm',
            'shortLabel' => 'Farm',
            'description' => 'Tin từ nông trại, nguyên liệu và mùa vụ',
        ],
    ];
}

function tn_news_store_meta(?string $store): array
{
    $key = trim((string) $store);

    $map = [
        'company' => [
            'key' => 'company',
            'label' => 'Toàn hệ sinh thái',
            'shortLabel' => 'Toàn hệ',
        ],
        'cafe' => [
            'key' => 'cafe',
            'label' => 'Quầy cà phê',
            'shortLabel' => 'Cà phê',
        ],
        'hotpot' => [
            'key' => 'hotpot',
            'label' => 'Tiệm lẩu',
            'shortLabel' => 'Lẩu',
        ],
        'farm' => [
            'key' => 'farm',
            'label' => 'Farm',
            'shortLabel' => 'Farm',
        ],
    ];

    return $map[$key] ?? $map['company'];
}

function tn_news_format_date(?string $value, string $format = 'd.m.Y'): string
{
    $raw = trim((string) $value);
    if ($raw === '') {
        return '';
    }

    $timestamp = strtotime($raw);
    if ($timestamp === false) {
        return $raw;
    }

    return date($format, $timestamp);
}

function tn_news_article_date(array $article, string $format = 'd.m.Y'): string
{
    return tn_news_format_date((string) ($article['publishedAt'] ?: $article['createdAt']), $format);
}

function tn_news_filter_path(string $store): string
{
    $base = seo_runtime_absolute_url('/tin-tuc');
    if ($store === 'all') {
        return $base;
    }

    return $base . '?store=' . rawurlencode($store);
}

$slug = trim((string) ($_GET['slug'] ?? ''));
$isDetail = $slug !== '';
$article = $isDetail ? seo_articles_fetch_public_article_by_slug($slug) : null;

if ($isDetail && !$article) {
    http_response_code(404);
}

$articles = $isDetail ? [] : seo_articles_fetch_public_articles(100);
$storeOptions = tn_news_store_options();
$storeFilter = trim((string) ($_GET['store'] ?? 'all'));

if (!array_key_exists($storeFilter, $storeOptions)) {
    $storeFilter = 'all';
}

$articleCounts = [
    'all' => count($articles),
    'company' => 0,
    'cafe' => 0,
    'hotpot' => 0,
    'farm' => 0,
];

foreach ($articles as $item) {
    $storeKey = tn_news_store_meta((string) ($item['targetStore'] ?? 'company'))['key'];
    $articleCounts[$storeKey] = ($articleCounts[$storeKey] ?? 0) + 1;
}

$visibleArticles = $articles;

if (!$isDetail && $storeFilter !== 'all') {
    $visibleArticles = array_values(array_filter(
        $articles,
        static fn(array $item): bool => tn_news_store_meta((string) ($item['targetStore'] ?? 'company'))['key'] === $storeFilter
    ));
}

$featuredArticle = !$isDetail ? ($visibleArticles[0] ?? null) : null;
$gridArticles = $featuredArticle ? array_slice($visibleArticles, 1) : [];
$defaultTitle = 'Tin tức | T&N Company';
$defaultDescription = 'Tin tức và bài viết dùng chung cho quầy cà phê, tiệm lẩu và farm trong hệ sinh thái T&N Company.';
$canonical = $isDetail && $article
    ? seo_runtime_absolute_url(seo_articles_public_path($article['slug']))
    : seo_runtime_absolute_url('/tin-tuc');
$title = $article
    ? trim((string) ($article['metaTitle'] ?: $article['title'])) . ' | T&N Company'
    : $defaultTitle;
$description = $article
    ? trim((string) ($article['metaDescription'] ?: $article['excerpt']))
    : $defaultDescription;
$coverImage = $article && $article['coverImageUrl']
    ? seo_runtime_resolve_asset_url((string) $article['coverImageUrl'])
    : seo_runtime_absolute_url('/favicon.svg');

$schema = $article
    ? [
        '@context' => 'https://schema.org',
        '@type' => 'BlogPosting',
        'headline' => $article['title'],
        'description' => $description,
        'datePublished' => $article['publishedAt'] ?: $article['createdAt'],
        'dateModified' => $article['updatedAt'],
        'mainEntityOfPage' => $canonical,
        'image' => [$coverImage],
        'author' => [
            '@type' => 'Organization',
            'name' => 'T&N Company',
        ],
        'publisher' => [
            '@type' => 'Organization',
            'name' => 'T&N Company',
            'logo' => [
                '@type' => 'ImageObject',
                'url' => seo_runtime_absolute_url('/favicon.svg'),
            ],
        ],
    ]
    : [
        '@context' => 'https://schema.org',
        '@type' => 'CollectionPage',
        'name' => 'Tin tức',
        'description' => $defaultDescription,
        'url' => $canonical,
    ];
?>
<?php
$indexPath = __DIR__ . '/spa-shell.html';
if (!file_exists($indexPath)) {
    $indexPath = __DIR__ . '/index.html';
}
if (!file_exists($indexPath)) {
    // Nếu ở môi trường local chạy npm run dev, file index.html ở thư mục gốc
    $indexPath = dirname(__DIR__) . '/index.html';
}

if (!file_exists($indexPath)) {
    http_response_code(500);
    echo "Lỗi: Không tìm thấy file index.html (ứng dụng React) để chèn SEO. Vui lòng build dự án (npm run build) và đảm bảo có file index.html nằm cùng thư mục trên server.";
    exit;
}

$reactHtml = file_get_contents($indexPath);

$escTitle = seo_runtime_escape($title);
$escDesc = seo_runtime_escape($description);
$escCanonical = seo_runtime_escape($canonical);
$escCover = seo_runtime_escape($coverImage);
$robots = $article || !$isDetail ? 'index,follow' : 'noindex,nofollow';
$ogType = $article ? 'article' : 'website';
$schemaJson = json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

$seoBlock = <<<HTML
    <title>{$escTitle}</title>
    <meta name="description" content="{$escDesc}" />
    <meta name="robots" content="{$robots}" />
    <link rel="canonical" href="{$escCanonical}" />
    <meta property="og:type" content="{$ogType}" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:site_name" content="T&amp;N Company" />
    <meta property="og:title" content="{$escTitle}" />
    <meta property="og:description" content="{$escDesc}" />
    <meta property="og:url" content="{$escCanonical}" />
    <meta property="og:image" content="{$escCover}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{$escTitle}" />
    <meta name="twitter:description" content="{$escDesc}" />
    <meta name="twitter:image" content="{$escCover}" />
    <script type="application/ld+json">{$schemaJson}</script>
HTML;

// Xóa title và description mặc định của Vite React
$reactHtml = preg_replace('/<title>.*?<\/title>/is', '', $reactHtml);
$reactHtml = preg_replace('/<meta[^>]+name="description"[^>]*>/is', '', $reactHtml);

// Chèn SEO block vào <head>
$reactHtml = str_ireplace('</head>', $seoBlock . "\n  </head>", $reactHtml);

echo $reactHtml;
