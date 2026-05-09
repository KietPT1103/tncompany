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
$defaultTitle = 'Bài viết SEO | T&N Company';
$defaultDescription = 'Tổng hợp bài viết SEO về cà phê, lẩu, farm và hệ sinh thái Ông Quan tại Cần Thơ.';
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
        'name' => 'Bài viết SEO',
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
        --bg: #fffdfa;
        --ink: #0f172a;
        --muted: #64748b;
        --line: #e2e8f0;
        --soft: #f8fafc;
        --blue: #1428f0;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", system-ui, sans-serif;
        background: var(--bg);
        color: var(--ink);
      }
      a { color: inherit; }
      .shell {
        max-width: 1200px;
        margin: 0 auto;
        padding: 28px 20px 72px;
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
        padding-bottom: 22px;
        border-bottom: 1px solid var(--line);
      }
      .crumbs,
      .top-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .chip,
      .ghost-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid var(--line);
        padding: 10px 15px;
        text-decoration: none;
        color: var(--muted);
        font-size: 14px;
        background: #fff;
      }
      .page-header {
        max-width: 860px;
        margin: 36px auto 0;
      }
      .eyebrow {
        display: inline-block;
        color: var(--blue);
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.24em;
        text-transform: uppercase;
      }
      h1 {
        margin: 16px 0 0;
        font-size: clamp(42px, 6vw, 78px);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }
      .summary {
        margin-top: 24px;
        color: var(--muted);
        font-size: 22px;
        line-height: 1.75;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
        color: var(--muted);
        font-size: 14px;
      }
      .meta span {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: var(--soft);
        padding: 9px 14px;
      }
      .cover {
        display: block;
        width: 100%;
        max-width: 980px;
        margin: 40px auto 0;
        border-radius: 30px;
        object-fit: cover;
        box-shadow: 0 28px 80px rgba(15, 23, 42, 0.10);
      }
      .article {
        max-width: 860px;
        margin: 44px auto 0;
      }
      .content {
        color: var(--ink);
        font-size: 20px;
        line-height: 1.95;
      }
      .content > section {
        margin-bottom: 48px;
      }
      .content h2 {
        margin: 0 0 22px;
        color: var(--blue);
        font-size: clamp(34px, 4vw, 52px);
        line-height: 1.08;
        letter-spacing: -0.03em;
      }
      .content h3 {
        margin: 0 0 18px;
        color: var(--blue);
        font-size: 30px;
        line-height: 1.16;
      }
      .content p,
      .content ul,
      .content ol,
      .content blockquote {
        margin: 0 0 20px;
      }
      .content ul,
      .content ol {
        padding-left: 1.5rem;
      }
      .content li {
        margin-bottom: 10px;
      }
      .content a {
        color: #2563eb;
        text-decoration: underline;
      }
      .content blockquote {
        border-left: 4px solid #2563eb;
        padding-left: 18px;
        color: #334155;
        font-style: italic;
      }
      .content figure {
        margin: 34px 0 0;
      }
      .content img {
        display: block;
        width: 100%;
        border-radius: 28px;
      }
      .content figcaption {
        margin-top: 12px;
        color: var(--muted);
        font-size: 15px;
      }
      .list-shell {
        margin-top: 36px;
      }
      .list-heading {
        max-width: 860px;
        margin: 0 auto 28px;
      }
      .list-heading h1 {
        font-size: clamp(36px, 5vw, 60px);
      }
      .list-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 18px;
      }
      .card {
        display: block;
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 24px;
        background: #fff;
        text-decoration: none;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      }
      .card:hover {
        transform: translateY(-4px);
        border-color: #cbd5e1;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
      }
      .card .eyebrow {
        letter-spacing: 0.18em;
      }
      .card h2 {
        margin: 16px 0 12px;
        font-size: 28px;
        line-height: 1.18;
        color: var(--ink);
      }
      .card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.75;
      }
      .empty {
        max-width: 860px;
        margin: 0 auto;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.8;
      }
      .not-found {
        max-width: 860px;
        margin: 48px auto 0;
      }
      @media (max-width: 768px) {
        .shell { padding: 20px 16px 56px; }
        .summary { font-size: 18px; }
        .content { font-size: 17px; line-height: 1.85; }
        .content h2 { font-size: 32px; }
        .content h3 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="topbar">
        <div class="crumbs">
          <a class="chip" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/')) ?>">Trang chủ</a>
          <a class="chip" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/bai-viet')) ?>">Bài viết SEO</a>
        </div>
        <div class="top-actions">
          <a class="ghost-link" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/about')) ?>">Về T&amp;N Company</a>
        </div>
      </div>

      <?php if ($isDetail && $article): ?>
        <header class="page-header">
          <div class="eyebrow">Bài viết SEO</div>
          <h1><?= seo_runtime_escape($article['title']) ?></h1>
          <div class="summary"><?= seo_runtime_escape($article['excerpt'] ?: $description) ?></div>
          <div class="meta">
            <span>Đăng lúc: <?= seo_runtime_escape($article['publishedAt'] ?: $article['createdAt']) ?></span>
            <span>Cập nhật: <?= seo_runtime_escape($article['updatedAt']) ?></span>
            <span>URL: /bai-viet/<?= seo_runtime_escape($article['slug']) ?></span>
          </div>
        </header>

        <?php if ($article['coverImageUrl']): ?>
          <img class="cover" src="<?= seo_runtime_escape(seo_runtime_resolve_asset_url((string) $article['coverImageUrl'])) ?>" alt="<?= seo_runtime_escape($article['title']) ?>" />
        <?php endif; ?>

        <article class="article">
          <div class="content"><?= $article['contentHtml'] ?></div>
        </article>
      <?php elseif ($isDetail): ?>
        <section class="not-found">
          <div class="eyebrow">404</div>
          <h1>Bài viết không tồn tại hoặc chưa được publish</h1>
          <div class="summary">
            URL này hiện không có bài viết public. Nếu bài vừa đăng, hãy kiểm tra trạng thái publish trong admin.
          </div>
        </section>
      <?php else: ?>
        <section class="list-shell">
          <div class="list-heading">
            <div class="eyebrow">Kho nội dung</div>
            <h1>Bài viết SEO cho hệ sinh thái Ông Quan</h1>
            <div class="summary">
              Tổng hợp các bài viết public về cà phê, lẩu, farm và trải nghiệm tại Cần Thơ. Mỗi bài có URL riêng, meta riêng và được đưa vào sitemap động để Google dễ crawl hơn.
            </div>
          </div>

          <?php if ($articles === []): ?>
            <p class="empty">Chưa có bài viết nào được publish.</p>
          <?php else: ?>
            <div class="list-grid">
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
