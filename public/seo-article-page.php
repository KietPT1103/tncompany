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
$defaultTitle = 'Tin tức | T&N Company';
$defaultDescription = 'Tin tức, bài viết và nội dung SEO về cà phê, lẩu, farm và hệ sinh thái Ông Quan tại Cần Thơ.';
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
        --bg: #f9f6f1;
        --panel: rgba(255, 255, 255, 0.92);
        --line: #e8dccd;
        --ink: #172033;
        --muted: #6f7b91;
        --brand: #7b4b25;
        --brand-strong: #5f3819;
        --brand-soft: #f4e7d5;
        --blue: #1d4ed8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", system-ui, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 0% 14%, rgba(236, 178, 116, 0.32), transparent 18%),
          radial-gradient(circle at 100% 90%, rgba(239, 205, 171, 0.30), transparent 16%),
          linear-gradient(180deg, #fcfaf7 0%, #f8f3ed 100%);
      }
      a { color: inherit; }
      .shell {
        max-width: 1240px;
        margin: 0 auto;
        padding: 24px 18px 72px;
      }
      .site-header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: center;
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 28px;
        padding: 14px 18px;
        box-shadow: 0 22px 50px rgba(98, 64, 35, 0.10);
        backdrop-filter: blur(8px);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .brand-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        border-radius: 16px;
        background: linear-gradient(180deg, #8b5b31 0%, #6b3f1f 100%);
        color: #fff;
        font-weight: 800;
        font-size: 17px;
      }
      .brand-title {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
      }
      .brand-sub {
        margin: 4px 0 0;
        color: #756554;
        font-size: 13px;
      }
      .page-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }
      .page-nav a {
        padding: 12px 16px;
        border-radius: 999px;
        text-decoration: none;
        color: #755e4a;
        font-weight: 700;
        transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
      }
      .page-nav a:hover {
        background: #f6ede2;
        color: var(--brand-strong);
      }
      .page-nav a.is-active {
        background: linear-gradient(180deg, #8b5b31 0%, #6b3f1f 100%);
        color: #fff;
        box-shadow: 0 10px 22px rgba(107, 63, 31, 0.24);
      }
      .page-header {
        max-width: 900px;
        margin: 42px auto 0;
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
        background: rgba(255, 255, 255, 0.72);
        padding: 9px 14px;
        border: 1px solid #edf2f7;
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
        max-width: 900px;
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
        list-style-position: outside;
      }
      .content ul {
        list-style-type: disc;
      }
      .content ol {
        list-style-type: decimal;
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
        max-width: 900px;
        margin: 0 auto 32px;
      }
      .list-heading h1 {
        font-size: clamp(36px, 5vw, 60px);
      }
      .list-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 22px;
      }
      .card {
        display: block;
        overflow: hidden;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: rgba(255, 255, 255, 0.88);
        text-decoration: none;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        box-shadow: 0 18px 40px rgba(98, 64, 35, 0.08);
      }
      .card:hover {
        transform: translateY(-4px);
        border-color: #d8c2ab;
        box-shadow: 0 24px 48px rgba(98, 64, 35, 0.12);
      }
      .card-cover {
        aspect-ratio: 16 / 10;
        width: 100%;
        object-fit: cover;
        display: block;
      }
      .card-cover-placeholder {
        aspect-ratio: 16 / 10;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f6e7d4 0%, #fdf7ef 100%);
        color: #8b6b4f;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 13px;
      }
      .card-body {
        padding: 20px 20px 22px;
      }
      .card h2 {
        margin: 10px 0 12px;
        font-size: 26px;
        line-height: 1.18;
        color: var(--ink);
      }
      .card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.75;
      }
      .card .eyebrow {
        letter-spacing: 0.18em;
      }
      .empty {
        max-width: 900px;
        margin: 0 auto;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.8;
      }
      .not-found {
        max-width: 900px;
        margin: 48px auto 0;
      }
      @media (max-width: 920px) {
        .site-header {
          flex-direction: column;
          align-items: stretch;
        }
        .page-nav {
          justify-content: flex-start;
        }
      }
      @media (max-width: 768px) {
        .shell { padding: 18px 14px 56px; }
        .summary { font-size: 18px; }
        .content { font-size: 17px; line-height: 1.85; }
        .content h2 { font-size: 32px; }
        .content h3 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="site-header">
        <div class="brand">
          <span class="brand-mark">T&amp;N</span>
          <div>
            <p class="brand-title">T&amp;N service</p>
            <p class="brand-sub">Trang chủ doanh nghiệp &amp; hệ sinh thái Ông Quan</p>
          </div>
        </div>

        <nav class="page-nav" aria-label="Điều hướng trang">
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/')) ?>">Cà phê</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/tiem-lau-ong-quan')) ?>">Tiệm lẩu</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/ong-quan-farm')) ?>">Farm</a>
          <a class="is-active" href="<?= seo_runtime_escape(seo_runtime_absolute_url('/tin-tuc')) ?>">Tin tức</a>
          <a href="<?= seo_runtime_escape(seo_runtime_absolute_url('/about')) ?>">Về chúng tôi</a>
        </nav>
      </header>

      <?php if ($isDetail && $article): ?>
        <header class="page-header">
          <div class="eyebrow">Tin tức</div>
          <h1><?= seo_runtime_escape($article['title']) ?></h1>
          <div class="summary"><?= seo_runtime_escape($article['excerpt'] ?: $description) ?></div>
          <div class="meta">
            <span>Đăng lúc: <?= seo_runtime_escape($article['publishedAt'] ?: $article['createdAt']) ?></span>
            <span>Cập nhật: <?= seo_runtime_escape($article['updatedAt']) ?></span>
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
          <h1>Tin tức không tồn tại hoặc chưa được publish</h1>
          <div class="summary">
            Trang này hiện không có bài viết public. Nếu bài vừa đăng, hãy kiểm tra trạng thái publish trong admin.
          </div>
        </section>
      <?php else: ?>
        <section class="list-shell">
          <div class="list-heading">
            <div class="eyebrow">Kho nội dung</div>
            <h1>Tin tức &amp; bài viết mới nhất</h1>
            <div class="summary">
              Tổng hợp các bài viết về cà phê, tiệm lẩu, farm và trải nghiệm tại Cần Thơ. Mỗi bài có ảnh bìa, mô tả rõ ràng và URL riêng để dễ chia sẻ cũng như tối ưu tìm kiếm.
            </div>
          </div>

          <?php if ($articles === []): ?>
            <p class="empty">Chưa có bài viết nào được publish.</p>
          <?php else: ?>
            <div class="list-grid">
              <?php foreach ($articles as $item): ?>
                <?php $itemCover = trim((string) ($item['coverImageUrl'] ?? '')); ?>
                <a class="card" href="<?= seo_runtime_escape(seo_articles_public_path($item['slug'])) ?>">
                  <?php if ($itemCover !== ''): ?>
                    <img class="card-cover" src="<?= seo_runtime_escape(seo_runtime_resolve_asset_url($itemCover)) ?>" alt="<?= seo_runtime_escape($item['title']) ?>" />
                  <?php else: ?>
                    <div class="card-cover-placeholder">Tin tức T&amp;N</div>
                  <?php endif; ?>

                  <div class="card-body">
                    <div class="eyebrow"><?= seo_runtime_escape((string) strtoupper($item['targetStore'] ?: 'company')) ?></div>
                    <h2><?= seo_runtime_escape($item['title']) ?></h2>
                    <p><?= seo_runtime_escape($item['excerpt'] ?: 'Bài viết đang được cập nhật mô tả ngắn.') ?></p>
                  </div>
                </a>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </section>
      <?php endif; ?>
    </div>
  </body>
</html>
