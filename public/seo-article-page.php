<?php

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

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
<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title><?= seo_runtime_escape($title) ?></title>
    <meta name="description" content="<?= seo_runtime_escape($description) ?>" />
    <meta name="robots" content="<?= $article || !$isDetail ? 'index,follow' : 'noindex,nofollow' ?>" />
    <link rel="canonical" href="<?= seo_runtime_escape($canonical) ?>" />
    <meta property="og:type" content="<?= $article ? 'article' : 'website' ?>" />
    <meta property="og:locale" content="vi_VN" />
    <meta property="og:site_name" content="T&amp;N Company" />
    <meta property="og:title" content="<?= seo_runtime_escape($title) ?>" />
    <meta property="og:description" content="<?= seo_runtime_escape($description) ?>" />
    <meta property="og:url" content="<?= seo_runtime_escape($canonical) ?>" />
    <meta property="og:image" content="<?= seo_runtime_escape($coverImage) ?>" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="<?= seo_runtime_escape($title) ?>" />
    <meta name="twitter:description" content="<?= seo_runtime_escape($description) ?>" />
    <meta name="twitter:image" content="<?= seo_runtime_escape($coverImage) ?>" />
    <script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe8;
        --bg-deep: #ebe2d7;
        --surface: rgba(255, 251, 246, 0.92);
        --surface-strong: #fffdf9;
        --line: rgba(76, 57, 40, 0.12);
        --ink: #221b17;
        --muted: #6c625c;
        --accent: #3f5a52;
        --accent-strong: #2f453f;
        --accent-soft: #dfe8e4;
        --warm: #8f6c4f;
        --shadow: 0 24px 60px rgba(35, 24, 18, 0.10);
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        color: var(--ink);
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(162, 132, 97, 0.18), transparent 22%),
          radial-gradient(circle at bottom right, rgba(63, 90, 82, 0.12), transparent 18%),
          linear-gradient(180deg, #f8f4ee 0%, var(--bg) 100%);
      }

      img {
        max-width: 100%;
      }

      a {
        color: inherit;
      }

      .shell {
        width: min(1240px, calc(100% - 32px));
        margin: 0 auto;
        padding: 18px 0 72px;
      }

      .top-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
        padding: 10px 18px;
        border-radius: 999px;
        background: linear-gradient(90deg, #183630 0%, #2e4d45 100%);
        color: rgba(255, 250, 245, 0.92);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        text-align: center;
      }

      .site-header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: center;
        padding: 16px 20px;
        border: 1px solid rgba(255, 255, 255, 0.46);
        border-radius: 30px;
        background: var(--surface);
        box-shadow: var(--shadow);
        backdrop-filter: blur(12px);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }

      .brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        border-radius: 18px;
        background: linear-gradient(180deg, #f4ede3 0%, #dcccb7 100%);
        border: 1px solid rgba(76, 57, 40, 0.10);
        font-weight: 800;
        color: var(--accent-strong);
      }

      .brand-copy {
        min-width: 0;
      }

      .brand-title {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-size: 28px;
        line-height: 1;
      }

      .brand-sub {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 13px;
      }

      .page-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }

      .page-nav a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 10px 16px;
        border-radius: 999px;
        text-decoration: none;
        color: #635851;
        font-weight: 700;
        transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
      }

      .page-nav a:hover {
        color: var(--accent-strong);
        background: rgba(63, 90, 82, 0.08);
      }

      .page-nav a.is-active {
        color: #fff;
        background: linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%);
        box-shadow: 0 14px 28px rgba(47, 69, 63, 0.22);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 28px;
        height: 1px;
        background: currentColor;
        opacity: 0.4;
      }

      .page-header,
      .list-shell {
        margin-top: 30px;
      }

      .page-header {
        max-width: 900px;
        margin-inline: auto;
      }

      h1,
      h2,
      h3 {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-weight: 700;
      }

      h1 {
        margin-top: 16px;
        font-size: clamp(42px, 6vw, 80px);
        line-height: 0.98;
        letter-spacing: -0.04em;
      }

      .summary {
        margin-top: 20px;
        color: var(--muted);
        font-size: 20px;
        line-height: 1.8;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }

      .meta span {
        display: inline-flex;
        align-items: center;
        min-height: 42px;
        padding: 10px 14px;
        border: 1px solid rgba(76, 57, 40, 0.08);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.76);
        color: #5f5550;
        font-size: 14px;
      }

      .cover {
        display: block;
        width: 100%;
        max-width: 980px;
        margin: 36px auto 0;
        border-radius: 34px;
        object-fit: cover;
        box-shadow: 0 30px 80px rgba(32, 22, 17, 0.14);
      }

      .article {
        max-width: 900px;
        margin: 42px auto 0;
        padding: 38px;
        border-radius: 34px;
        background: rgba(255, 253, 250, 0.86);
        border: 1px solid rgba(76, 57, 40, 0.08);
        box-shadow: 0 28px 72px rgba(32, 22, 17, 0.08);
      }

      .article-back {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 22px;
        color: var(--muted);
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
      }

      .article-back:hover {
        color: var(--accent-strong);
      }

      .content {
        color: var(--ink);
        font-size: 19px;
        line-height: 1.95;
      }

      .content > section {
        margin-bottom: 42px;
      }

      .content h2 {
        margin: 0 0 18px;
        color: var(--accent-strong);
        font-size: clamp(30px, 4vw, 52px);
        line-height: 1.08;
        letter-spacing: -0.03em;
      }

      .content h3 {
        margin: 0 0 16px;
        color: var(--warm);
        font-size: 28px;
        line-height: 1.14;
      }

      .content p,
      .content ul,
      .content ol,
      .content blockquote {
        margin: 0 0 18px;
      }

      .content ul,
      .content ol {
        padding-left: 1.4rem;
      }

      .content li {
        margin-bottom: 10px;
      }

      .content a {
        color: var(--accent-strong);
        text-decoration-thickness: 1px;
      }

      .content blockquote {
        padding-left: 18px;
        border-left: 4px solid rgba(63, 90, 82, 0.28);
        color: #4d4744;
        font-style: italic;
      }

      .content figure {
        margin: 28px 0 0;
      }

      .content img {
        display: block;
        width: 100%;
        border-radius: 26px;
      }

      .content figcaption {
        margin-top: 10px;
        color: var(--muted);
        font-size: 14px;
      }

      .news-intro {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
        gap: 26px;
        align-items: end;
        margin-bottom: 24px;
      }

      .news-intro-copy .summary {
        max-width: 720px;
      }

      .news-stat-card {
        padding: 24px 24px 22px;
        border-radius: 30px;
        background: linear-gradient(180deg, rgba(255, 252, 248, 0.92) 0%, rgba(244, 238, 230, 0.92) 100%);
        border: 1px solid rgba(76, 57, 40, 0.08);
        box-shadow: 0 22px 52px rgba(32, 22, 17, 0.08);
      }

      .news-stat-card p {
        margin: 0;
      }

      .news-stat-label {
        color: var(--muted);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .news-stat-value {
        margin-top: 10px;
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-size: 48px;
        line-height: 1;
      }

      .news-stat-detail {
        margin-top: 14px;
        color: #5f5550;
        line-height: 1.75;
      }

      .featured-article {
        position: relative;
        display: grid;
        align-items: end;
        min-height: 540px;
        overflow: hidden;
        border-radius: 36px;
        border: 1px solid rgba(255, 255, 255, 0.38);
        background: linear-gradient(135deg, #382a22 0%, #6e5745 55%, #96816c 100%);
        box-shadow: 0 34px 84px rgba(27, 20, 15, 0.18);
        text-decoration: none;
      }

      .featured-media,
      .featured-overlay,
      .featured-copy {
        grid-area: 1 / 1;
      }

      .featured-media {
        height: 100%;
      }

      .featured-media img,
      .featured-media .featured-placeholder {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .featured-placeholder {
        display: flex;
        align-items: flex-end;
        justify-content: flex-start;
        padding: 30px;
        color: rgba(255, 248, 242, 0.78);
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-size: clamp(32px, 5vw, 62px);
        letter-spacing: -0.03em;
        background:
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.16), transparent 24%),
          linear-gradient(135deg, rgba(33, 26, 22, 0.2), rgba(33, 26, 22, 0.64));
      }

      .featured-overlay {
        background:
          linear-gradient(90deg, rgba(23, 18, 16, 0.86) 0%, rgba(23, 18, 16, 0.46) 44%, rgba(23, 18, 16, 0.08) 100%),
          linear-gradient(180deg, rgba(23, 18, 16, 0.04) 0%, rgba(23, 18, 16, 0.40) 100%);
      }

      .featured-copy {
        position: relative;
        z-index: 1;
        max-width: 640px;
        padding: 44px 42px;
        color: #fffaf4;
      }

      .featured-copy .eyebrow {
        color: rgba(255, 248, 240, 0.9);
      }

      .featured-title {
        margin-top: 18px;
        font-size: clamp(40px, 5vw, 64px);
        line-height: 0.96;
        letter-spacing: -0.04em;
      }

      .featured-excerpt {
        margin: 18px 0 0;
        max-width: 560px;
        color: rgba(255, 245, 237, 0.84);
        font-size: 18px;
        line-height: 1.8;
      }

      .featured-footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-top: 24px;
      }

      .featured-date,
      .featured-cta {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 10px 16px;
        border-radius: 999px;
        font-size: 14px;
        font-weight: 700;
      }

      .featured-date {
        color: rgba(255, 245, 237, 0.84);
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.18);
      }

      .featured-cta {
        color: #fff;
        background: linear-gradient(180deg, #8f6c4f 0%, #75573f 100%);
        box-shadow: 0 14px 30px rgba(117, 87, 63, 0.30);
      }

      .section-bar {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-end;
        margin: 34px 0 22px;
        padding-bottom: 18px;
        border-bottom: 1px solid rgba(76, 57, 40, 0.10);
      }

      .section-heading p {
        max-width: 560px;
        margin: 10px 0 0;
        color: var(--muted);
        line-height: 1.75;
      }

      .section-heading h2 {
        margin-top: 12px;
        font-size: clamp(34px, 4vw, 54px);
        line-height: 1;
        letter-spacing: -0.03em;
      }

      .filter-pills {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 10px;
      }

      .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(76, 57, 40, 0.08);
        background: rgba(255, 255, 255, 0.68);
        color: #635851;
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
      }

      .filter-pill:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 28px rgba(32, 22, 17, 0.08);
        border-color: rgba(63, 90, 82, 0.18);
      }

      .filter-pill.is-active {
        color: #fff;
        background: linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%);
        border-color: transparent;
        box-shadow: 0 16px 30px rgba(47, 69, 63, 0.24);
      }

      .filter-pill strong {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 26px;
        height: 26px;
        padding-inline: 7px;
        border-radius: 999px;
        background: rgba(34, 27, 23, 0.08);
        font-size: 12px;
      }

      .filter-pill.is-active strong {
        background: rgba(255, 255, 255, 0.14);
      }

      .empty {
        padding: 26px 28px;
        border-radius: 28px;
        background: rgba(255, 252, 248, 0.82);
        border: 1px solid rgba(76, 57, 40, 0.08);
        color: var(--muted);
        line-height: 1.85;
      }

      .list-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 24px;
        align-items: start;
      }

      .card {
        display: block;
        overflow: hidden;
        border-radius: 28px;
        background: rgba(255, 252, 249, 0.88);
        border: 1px solid rgba(76, 57, 40, 0.08);
        box-shadow: 0 18px 44px rgba(32, 22, 17, 0.08);
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .card:hover {
        transform: translateY(-4px);
        border-color: rgba(63, 90, 82, 0.16);
        box-shadow: 0 24px 56px rgba(32, 22, 17, 0.12);
      }

      .card-cover,
      .card-cover-placeholder {
        aspect-ratio: 0.84;
        width: 100%;
        display: block;
      }

      .card-cover {
        object-fit: cover;
      }

      .card-cover-placeholder {
        display: flex;
        align-items: flex-end;
        justify-content: flex-start;
        padding: 20px;
        background:
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.56), transparent 24%),
          linear-gradient(135deg, #d8d5cf 0%, #f1ebe2 100%);
        color: rgba(63, 90, 82, 0.78);
        font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        font-size: 28px;
      }

      .card-body {
        padding: 18px 18px 22px;
      }

      .card-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .store-badge {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 5px 10px;
        border-radius: 999px;
        background: rgba(63, 90, 82, 0.10);
        color: var(--accent-strong);
        letter-spacing: 0.12em;
      }

      .store-badge[data-store="company"] {
        background: rgba(88, 88, 88, 0.10);
        color: #4f4a46;
      }

      .store-badge[data-store="cafe"] {
        background: rgba(143, 108, 79, 0.12);
        color: #6f4f38;
      }

      .store-badge[data-store="hotpot"] {
        background: rgba(164, 88, 66, 0.12);
        color: #874e3a;
      }

      .store-badge[data-store="farm"] {
        background: rgba(91, 122, 88, 0.12);
        color: #466545;
      }

      .card h3 {
        margin-top: 14px;
        font-size: 34px;
        line-height: 1.02;
        letter-spacing: -0.03em;
      }

      .card p {
        margin: 14px 0 0;
        color: var(--muted);
        line-height: 1.8;
      }

      .card-cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        color: var(--accent-strong);
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .ecosystem-callout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
        gap: 28px;
        margin-top: 54px;
        padding: 34px;
        border-radius: 34px;
        background:
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.44), transparent 22%),
          linear-gradient(180deg, rgba(255, 252, 248, 0.94) 0%, rgba(239, 232, 223, 0.94) 100%);
        border: 1px solid rgba(76, 57, 40, 0.08);
        box-shadow: 0 26px 60px rgba(32, 22, 17, 0.08);
      }

      .ecosystem-callout p {
        margin: 16px 0 0;
        color: var(--muted);
        line-height: 1.85;
      }

      .ecosystem-callout h2 {
        margin-top: 16px;
        font-size: clamp(34px, 4vw, 54px);
        line-height: 1;
        letter-spacing: -0.03em;
      }

      .ecosystem-links {
        display: grid;
        gap: 14px;
      }

      .ecosystem-link {
        display: block;
        padding: 18px 20px;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(76, 57, 40, 0.08);
        text-decoration: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .ecosystem-link:hover {
        transform: translateY(-2px);
        border-color: rgba(63, 90, 82, 0.16);
        box-shadow: 0 18px 34px rgba(32, 22, 17, 0.08);
      }

      .ecosystem-link strong {
        display: block;
        font-size: 18px;
      }

      .ecosystem-link span {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        line-height: 1.65;
      }

      .not-found {
        max-width: 860px;
        margin: 48px auto 0;
        padding: 34px;
        border-radius: 32px;
        background: rgba(255, 252, 248, 0.84);
        border: 1px solid rgba(76, 57, 40, 0.08);
        box-shadow: 0 24px 52px rgba(32, 22, 17, 0.08);
      }

      @media (max-width: 1100px) {
        .news-intro,
        .ecosystem-callout {
          grid-template-columns: 1fr;
        }

        .section-bar {
          flex-direction: column;
          align-items: stretch;
        }

        .filter-pills {
          justify-content: flex-start;
        }

        .list-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 920px) {
        .top-strip {
          grid-template-columns: 1fr;
          border-radius: 24px;
          text-align: left;
        }

        .site-header {
          flex-direction: column;
          align-items: stretch;
        }

        .page-nav {
          justify-content: flex-start;
        }

        .featured-article {
          min-height: 480px;
        }
      }

      @media (max-width: 768px) {
        .shell {
          width: min(100% - 24px, 1240px);
          padding-bottom: 56px;
        }

        .brand-title {
          font-size: 24px;
        }

        .summary {
          font-size: 17px;
        }

        .article {
          padding: 24px 18px;
        }

        .content {
          font-size: 17px;
          line-height: 1.85;
        }

        .content h2 {
          font-size: 30px;
        }

        .content h3 {
          font-size: 24px;
        }

        .featured-article {
          min-height: 420px;
        }

        .featured-copy {
          padding: 28px 22px;
        }

        .featured-title {
          font-size: clamp(34px, 9vw, 52px);
        }

        .list-grid {
          grid-template-columns: 1fr;
        }

        .ecosystem-callout {
          padding: 24px 18px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="top-strip">
        <span>Trang tin tức dùng chung cho quầy cà phê, tiệm lẩu và farm</span>
        <span>Nội dung editorial trung tính, không lệch màu theo một quầy</span>
        <span>Cập nhật bài viết, hoạt động và trải nghiệm trong cùng một đầu mối</span>
      </div>

      <header class="site-header">
        <div class="brand">
          <span class="brand-mark">T&amp;N</span>
          <div class="brand-copy">
            <p class="brand-title">The T&amp;N Journal</p>
            <p class="brand-sub">Nhịp tin chung của quầy cà phê, tiệm lẩu và farm trong hệ sinh thái Ông Quan.</p>
          </div>
        </div>

                <nav class="page-nav" aria-label="Điều hướng trang">
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/')) ?>">Trang chủ</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/ca-phe-ong-quan')) ?>">Cà phê</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/tiem-lau-ong-quan')) ?>">Tiệm lẩu</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/ong-quan-farm')) ?>">Farm</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/about')) ?>">Về chúng tôi</a>
        </nav>
      </header>

      <?php if ($isDetail && $article): ?>
        <?php $detailMeta = tn_news_store_meta((string) ($article['targetStore'] ?? 'company')); ?>
        <header class="page-header">
          <div class="eyebrow"><?= seo_runtime_escape($detailMeta['label']) ?></div>
          <h1><?= seo_runtime_escape($article['title']) ?></h1>
          <div class="summary"><?= seo_runtime_escape($article['excerpt'] ?: $description) ?></div>
          <div class="meta">
            <span>Đăng ngày <?= seo_runtime_escape(tn_news_article_date($article, 'd/m/Y')) ?></span>
            <span>Cập nhật <?= seo_runtime_escape(tn_news_format_date((string) $article['updatedAt'], 'd/m/Y')) ?></span>
          </div>
        </header>

        <?php if ($article['coverImageUrl']): ?>
          <img class="cover" src="<?= seo_runtime_escape(seo_runtime_resolve_asset_url((string) $article['coverImageUrl'])) ?>" alt="<?= seo_runtime_escape($article['title']) ?>" />
        <?php endif; ?>

        <article class="article">
          <a class="article-back" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/tin-tuc')) ?>">&larr; Quay lại trang danh sách tin tức</a>
          <div class="content"><?= $article['contentHtml'] ?></div>
        </article>
      <?php elseif ($isDetail): ?>
        <section class="not-found">
          <div class="eyebrow">404</div>
          <h1>Tin tức không tồn tại hoặc chưa được publish</h1>
          <div class="summary">
            Trang này hiện chưa có bài viết public. Nếu bài vừa đăng, hãy kiểm tra lại trạng thái publish trong khu vực quản trị.
          </div>
        </section>
      <?php else: ?>
        <section class="list-shell">
          <div class="news-intro">
            <div class="news-intro-copy">
              <div class="eyebrow">Kho nội dung chung</div>
              <h1>Trang tin tức cho cả 3 quầy</h1>
              <div class="summary">
                Giao diện được chuyển sang hướng editorial trung tính để dùng chung cho cà phê, tiệm lẩu và farm. Nội dung mới nhất được đẩy lên nổi bật, phần còn lại đi theo nhịp card rõ ràng để dễ đọc và dễ chia sẻ.
              </div>
            </div>

            <aside class="news-stat-card" aria-label="Tổng quan kho bài viết">
              <p class="news-stat-label">Bài viết đang hiển thị</p>
              <p class="news-stat-value"><?= seo_runtime_escape((string) count($visibleArticles)) ?></p>
              <p class="news-stat-detail">
                <?php if ($storeFilter === 'all'): ?>
                  Toàn bộ bài viết public từ hệ sinh thái T&amp;N Company đang được gom về cùng một đầu mối.
                <?php else: ?>
                  Đang lọc theo nhóm: <?= seo_runtime_escape($storeOptions[$storeFilter]['description']) ?>.
                <?php endif; ?>
              </p>
            </aside>
          </div>

          <?php if ($featuredArticle): ?>
            <?php
              $featuredStore = tn_news_store_meta((string) ($featuredArticle['targetStore'] ?? 'company'));
              $featuredCover = trim((string) ($featuredArticle['coverImageUrl'] ?? ''));
            ?>
            <a class="featured-article" href="<?= seo_runtime_escape(seo_articles_public_path($featuredArticle['slug'])) ?>">
              <div class="featured-media">
                <?php if ($featuredCover !== ''): ?>
                  <img src="<?= seo_runtime_escape(seo_runtime_resolve_asset_url($featuredCover)) ?>" alt="<?= seo_runtime_escape($featuredArticle['title']) ?>" fetchpriority="high" />
                <?php else: ?>
                  <div class="featured-placeholder">T&amp;N Journal</div>
                <?php endif; ?>
              </div>
              <div class="featured-overlay"></div>
              <div class="featured-copy">
                <div class="eyebrow"><?= seo_runtime_escape($featuredStore['label']) ?></div>
                <h2 class="featured-title"><?= seo_runtime_escape($featuredArticle['title']) ?></h2>
                <p class="featured-excerpt"><?= seo_runtime_escape($featuredArticle['excerpt'] ?: 'Bài viết đang được cập nhật mô tả ngắn để hiển thị ở khu vực nổi bật.') ?></p>
                <div class="featured-footer">
                  <span class="featured-date"><?= seo_runtime_escape(tn_news_article_date($featuredArticle)) ?></span>
                  <span class="featured-cta">Đọc bài viết</span>
                </div>
              </div>
            </a>
          <?php endif; ?>

          <div class="section-bar">
            <div class="section-heading">
              <div class="eyebrow">The Journal</div>
              <h2>Danh sách bài viết</h2>
              <p>Chọn nhanh theo nhóm nội dung, nhưng vẫn giữ cùng một ngôn ngữ màu sắc để trang tin tức không bị tách thành ba phong cách khác nhau.</p>
            </div>

            <div class="filter-pills" aria-label="Lọc bài viết theo nhóm">
              <?php foreach ($storeOptions as $storeKey => $storeOption): ?>
                <a
                  class="filter-pill<?= $storeFilter === $storeKey ? ' is-active' : '' ?>"
                  href="<?= seo_runtime_escape(tn_news_filter_path($storeKey)) ?>"
                >
                  <span><?= seo_runtime_escape($storeOption['label']) ?></span>
                  <strong><?= seo_runtime_escape((string) ($articleCounts[$storeKey] ?? 0)) ?></strong>
                </a>
              <?php endforeach; ?>
            </div>
          </div>

          <?php if ($visibleArticles === []): ?>
            <p class="empty">Chưa có bài viết nào phù hợp với bộ lọc hiện tại. Bạn có thể quay về mục Tất cả để xem toàn bộ nội dung public.</p>
          <?php elseif ($gridArticles === []): ?>
            <p class="empty">Hiện nhóm này chỉ có 1 bài nổi bật. Khi có thêm bài viết, phần danh sách bên dưới sẽ tự mở rộng theo cùng bố cục.</p>
          <?php else: ?>
            <div class="list-grid">
              <?php foreach ($gridArticles as $item): ?>
                <?php
                  $itemStore = tn_news_store_meta((string) ($item['targetStore'] ?? 'company'));
                  $itemCover = trim((string) ($item['coverImageUrl'] ?? ''));
                ?>
                <a class="card" href="<?= seo_runtime_escape(seo_articles_public_path($item['slug'])) ?>">
                  <?php if ($itemCover !== ''): ?>
                    <img class="card-cover" src="<?= seo_runtime_escape(seo_runtime_resolve_asset_url($itemCover)) ?>" alt="<?= seo_runtime_escape($item['title']) ?>" loading="lazy" />
                  <?php else: ?>
                    <div class="card-cover-placeholder">T&amp;N</div>
                  <?php endif; ?>

                  <div class="card-body">
                    <div class="card-meta">
                      <span class="store-badge" data-store="<?= seo_runtime_escape($itemStore['key']) ?>"><?= seo_runtime_escape($itemStore['shortLabel']) ?></span>
                      <span><?= seo_runtime_escape(tn_news_article_date($item)) ?></span>
                    </div>
                    <h3><?= seo_runtime_escape($item['title']) ?></h3>
                    <p><?= seo_runtime_escape($item['excerpt'] ?: 'Bài viết đang được cập nhật mô tả ngắn để hiển thị trên trang danh sách.') ?></p>
                    <span class="card-cta">Xem chi tiết &rarr;</span>
                  </div>
                </a>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>

          <section class="ecosystem-callout">
            <div>
              <div class="eyebrow">Một đầu mối, ba điểm chạm</div>
              <h2>Trang tin tức vẫn kết nối trực tiếp về từng quầy</h2>
              <p>
                Màu chủ đạo được giữ trung tính để phù hợp trang dùng chung, nhưng người đọc vẫn có thể điều hướng nhanh sang từng nhóm dịch vụ. Cách này giúp thương hiệu liền mạch hơn mà không mất ngữ cảnh vận hành riêng của mỗi quầy.
              </p>
            </div>

            <div class="ecosystem-links">
              <a class="ecosystem-link" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/')) ?>">
                <strong>Quầy cà phê</strong>
                <span>Xem không gian, thức uống và nội dung liên quan đến trải nghiệm cà phê.</span>
              </a>
              <a class="ecosystem-link" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/tiem-lau-ong-quan')) ?>">
                <strong>Tiệm lẩu</strong>
                <span>Đi đến khu vực món ăn, phục vụ bàn và các bài viết về menu lẩu.</span>
              </a>
              <a class="ecosystem-link" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/ong-quan-farm')) ?>">
                <strong>Farm</strong>
                <span>Theo dõi mùa vụ, nguyên liệu và câu chuyện phía sau nguồn cung của hệ sinh thái.</span>
              </a>
            </div>
          </section>
        </section>
      <?php endif; ?>
    </div>
  </body>
</html>
