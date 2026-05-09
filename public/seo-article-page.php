<?php

declare(strict_types=1);

require_once __DIR__ . '/_seo_runtime.php';

header('Content-Type: text/html; charset=utf-8');

$slug = trim((string) ($_GET['slug'] ?? ''));
$isDetail = $slug !== '';
$article = $isDetail ? seo_articles_fetch_public_article_by_slug($slug) : null;

if ($isDetail && !$article) {
    http_response_code(404);
}

$articles = $isDetail ? [] : seo_articles_fetch_public_articles(100);
$defaultTitle = 'Bai viet SEO | T&N Company';
$defaultDescription = 'Tong hop bai viet SEO ve cafe, lau, farm va he sinh thai Ong Quan tai Can Tho.';
$canonical = $isDetail && $article
    ? seo_runtime_absolute_url(seo_articles_public_path($article['slug']))
    : seo_runtime_absolute_url('/bai-viet');
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
        'name' => 'Bai viet SEO',
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
        --bg: #f5efe6;
        --panel: #fffdf9;
        --line: #e3d7c7;
        --ink: #1f2937;
        --muted: #6b7280;
        --accent: #9a3412;
        --accent-soft: #fff1e8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(154, 52, 18, 0.10), transparent 34%),
          linear-gradient(180deg, #f7f1e7 0%, #f2ebdf 100%);
        color: var(--ink);
      }
      a { color: inherit; }
      .shell { max-width: 1040px; margin: 0 auto; padding: 28px 20px 64px; }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        margin-bottom: 28px;
      }
      .crumbs, .top-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }
      .chip, .ghost-link {
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.78);
        border-radius: 999px;
        padding: 10px 14px;
        text-decoration: none;
        color: var(--muted);
        font-size: 14px;
      }
      .hero, .list-panel, .article-body {
        background: rgba(255,255,255,0.84);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 20px 55px rgba(54, 41, 24, 0.08);
        backdrop-filter: blur(8px);
      }
      .hero {
        padding: 36px;
        margin-bottom: 24px;
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 12px;
        font-size: clamp(32px, 5vw, 54px);
        line-height: 1.05;
      }
      .summary {
        max-width: 760px;
        font-size: 18px;
        line-height: 1.7;
        color: var(--muted);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
        color: var(--muted);
        font-size: 14px;
      }
      .cover {
        width: 100%;
        border-radius: 24px;
        display: block;
        margin-top: 24px;
        max-height: 460px;
        object-fit: cover;
        border: 1px solid var(--line);
      }
      .article-body {
        padding: 34px 36px;
      }
      .article-body .content {
        font-size: 18px;
        line-height: 1.8;
      }
      .article-body .content h2,
      .article-body .content h3 {
        line-height: 1.25;
        margin-top: 32px;
        margin-bottom: 14px;
      }
      .article-body .content p,
      .article-body .content ul,
      .article-body .content ol {
        margin: 0 0 18px;
      }
      .article-body .content a {
        color: var(--accent);
      }
      .list-panel {
        padding: 28px;
      }
      .article-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
        margin-top: 18px;
      }
      .card {
        display: block;
        text-decoration: none;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 20px;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      }
      .card:hover {
        transform: translateY(-3px);
        border-color: #d5bfa3;
        box-shadow: 0 18px 28px rgba(54, 41, 24, 0.08);
      }
      .card h2 {
        margin: 12px 0 10px;
        font-size: 22px;
        line-height: 1.25;
      }
      .card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
      }
      .empty {
        color: var(--muted);
        font-size: 16px;
        line-height: 1.7;
      }
      @media (max-width: 720px) {
        .hero, .article-body, .list-panel { padding: 22px; }
        .summary { font-size: 16px; }
        .article-body .content { font-size: 16px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="topbar">
        <div class="crumbs">
          <a class="chip" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/')) ?>">Trang chu</a>
          <a class="chip" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/bai-viet')) ?>">Bai viet SEO</a>
        </div>
        <div class="top-actions">
          <a class="ghost-link" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/about')) ?>">Ve T&amp;N Company</a>
        </div>
      </div>

      <?php if ($isDetail && $article): ?>
        <section class="hero">
          <div class="eyebrow">Bai viet SEO</div>
          <h1><?= seo_runtime_escape($article['title']) ?></h1>
          <div class="summary"><?= seo_runtime_escape($article['excerpt'] ?: $description) ?></div>
          <div class="meta">
            <span>Dang luc: <?= seo_runtime_escape($article['publishedAt'] ?: $article['createdAt']) ?></span>
            <span>Cap nhat: <?= seo_runtime_escape($article['updatedAt']) ?></span>
            <span>URL: /bai-viet/<?= seo_runtime_escape($article['slug']) ?></span>
          </div>
          <?php if ($article['coverImageUrl']): ?>
            <img class="cover" src="<?= seo_runtime_escape(seo_runtime_resolve_asset_url((string) $article['coverImageUrl'])) ?>" alt="<?= seo_runtime_escape($article['title']) ?>" />
          <?php endif; ?>
        </section>

        <article class="article-body">
          <div class="content"><?= $article['contentHtml'] ?></div>
        </article>
      <?php elseif ($isDetail): ?>
        <section class="hero">
          <div class="eyebrow">404</div>
          <h1>Bai viet khong ton tai hoac chua duoc publish</h1>
          <div class="summary">
            URL nay hien khong co bai viet public. Neu bai vua dang, hay kiem tra trang thai publish trong admin.
          </div>
        </section>
      <?php else: ?>
        <section class="hero">
          <div class="eyebrow">Noi dung public</div>
          <h1>Kho bai viet SEO cho he sinh thai Ong Quan</h1>
          <div class="summary">
            Day la noi admin co the dang bai moi hang ngay. Moi bai viet co URL rieng, meta SEO rieng va duoc dua vao sitemap dong de Google co the crawl nhanh hon.
          </div>
        </section>

        <section class="list-panel">
          <h2>Danh sach bai viet</h2>
          <?php if ($articles === []): ?>
            <p class="empty">Chua co bai viet nao duoc publish.</p>
          <?php else: ?>
            <div class="article-list">
              <?php foreach ($articles as $item): ?>
                <a class="card" href="<?= seo_runtime_escape(seo_articles_public_path($item['slug'])) ?>">
                  <div class="eyebrow"><?= seo_runtime_escape((string) strtoupper($item['targetStore'] ?: 'company')) ?></div>
                  <h2><?= seo_runtime_escape($item['title']) ?></h2>
                  <p><?= seo_runtime_escape($item['excerpt']) ?></p>
                </a>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </section>
      <?php endif; ?>
    </div>
  </body>
</html>
