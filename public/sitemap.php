<?php

declare(strict_types=1);

require_once __DIR__ . '/_seo_runtime.php';

header('Content-Type: application/xml; charset=utf-8');

$staticUrls = [
    [
        'loc' => seo_runtime_absolute_url('/'),
        'priority' => '1.0',
    ],
    [
        'loc' => seo_runtime_absolute_url('/about'),
        'priority' => '0.8',
    ],
    [
        'loc' => seo_runtime_absolute_url('/tiem-lau-ong-quan'),
        'priority' => '0.8',
    ],
    [
        'loc' => seo_runtime_absolute_url('/ong-quan-farm'),
        'priority' => '0.8',
    ],
    [
        'loc' => seo_runtime_absolute_url('/bai-viet'),
        'priority' => '0.8',
    ],
];

$articles = seo_articles_fetch_public_articles(500);

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($staticUrls as $item): ?>
  <url>
    <loc><?= seo_runtime_escape($item['loc']) ?></loc>
    <priority><?= seo_runtime_escape($item['priority']) ?></priority>
  </url>
<?php endforeach; ?>
<?php foreach ($articles as $article): ?>
  <url>
    <loc><?= seo_runtime_escape(seo_runtime_absolute_url(seo_articles_public_path($article['slug']))) ?></loc>
    <?php if ($article['updatedAt']): ?>
    <lastmod><?= seo_runtime_escape(date('c', strtotime((string) $article['updatedAt']))) ?></lastmod>
    <?php endif; ?>
    <priority>0.7</priority>
  </url>
<?php endforeach; ?>
</urlset>
