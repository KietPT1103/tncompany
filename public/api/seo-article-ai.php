<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/openai.php';
require_once __DIR__ . '/_lib/seo_articles.php';

auth_require_permission('seo_articles.access');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Not found', 404);
}

function seo_article_ai_string(array $body, string $key): string
{
    return trim((string) ($body[$key] ?? ''));
}

function seo_article_ai_array_of_strings($value): array
{
    if (is_string($value)) {
        $value = preg_split('/,|\r\n|\r|\n/', $value) ?: [];
    }

    if (!is_array($value)) {
        return [];
    }

    $normalized = [];
    foreach ($value as $item) {
        $candidate = trim((string) $item);
        if ($candidate !== '') {
            $normalized[] = $candidate;
        }
    }

    return array_values(array_unique($normalized));
}

$body = read_json_body();
$topic = seo_article_ai_string($body, 'topic');
$primaryKeyword = seo_article_ai_string($body, 'primaryKeyword');
$tone = seo_article_ai_string($body, 'tone');
$audience = seo_article_ai_string($body, 'audience');
$customNotes = seo_article_ai_string($body, 'customNotes');
$targetStore = seo_articles_validate_target_store(seo_article_ai_string($body, 'targetStore'));
$secondaryKeywords = seo_article_ai_array_of_strings($body['secondaryKeywords'] ?? []);

if ($topic === '') {
    respond_error('Topic is required.', 422);
}

if ($primaryKeyword === '') {
    respond_error('Primary keyword is required.', 422);
}

$targetStoreLabels = [
    'company' => 'he sinh thai Tong cong ty',
    'cafe' => 'tiem cafe Ong Quan',
    'hotpot' => 'tiem lau Ong Quan',
    'farm' => 'Ong Quan Farm',
];

$jsonSchema = [
    'name' => 'seo_article_blueprint',
    'strict' => true,
    'schema' => [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['title', 'slug', 'excerpt', 'metaTitle', 'metaDescription', 'blocks'],
        'properties' => [
            'title' => ['type' => 'string'],
            'slug' => ['type' => 'string'],
            'excerpt' => ['type' => 'string'],
            'metaTitle' => ['type' => 'string'],
            'metaDescription' => ['type' => 'string'],
            'blocks' => [
                'type' => 'array',
                'minItems' => 3,
                'items' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['heading', 'html', 'imageAlt'],
                    'properties' => [
                        'heading' => ['type' => 'string'],
                        'html' => ['type' => 'string'],
                        'imageAlt' => ['type' => 'string'],
                    ],
                ],
            ],
        ],
    ],
];

$model = openai_env('OPENAI_SEO_MODEL', openai_env('OPENAI_MODEL', 'gpt-4o-mini')) ?? 'gpt-4o-mini';
$secondaryKeywordText = $secondaryKeywords === [] ? 'Khong co' : implode(', ', $secondaryKeywords);

$systemPrompt = <<<PROMPT
You are a senior Vietnamese SEO content strategist and copywriter.
Return only valid JSON matching the provided schema.
Write in natural Vietnamese, no markdown fences, no placeholder text.
Each block.html must contain clean HTML paragraphs and can include ul or ol when helpful.
Avoid fabricated factual claims. Keep the tone useful, credible, and conversion-oriented.
PROMPT;

$userPrompt = <<<PROMPT
Hay viet mot bai SEO hoan chinh bang tieng Viet voi cac dau vao sau:

- Chu de: {$topic}
- Tu khoa chinh: {$primaryKeyword}
- Tu khoa phu: {$secondaryKeywordText}
- Thuong hieu/nhom dich vu: {$targetStoreLabels[$targetStore]}
- Giong van: {$tone}
- Doi tuong doc gia: {$audience}
- Ghi chu them: {$customNotes}

Yeu cau bat buoc:
1. Tieu de hap dan, tu nhien, co chua tu khoa chinh.
2. Slug ngan gon, khong dau, SEO-friendly.
3. Excerpt 2-3 cau, tom tat ro rang.
4. Meta title toi uu CTR, khong qua 60 ky tu neu co the.
5. Meta description khoang 140-160 ky tu neu co the.
6. Tao it nhat 4 muc noi dung trong blocks.
7. Moi block can co heading, html, imageAlt.
8. html phai la HTML sach, co the dung <p>, <ul>, <ol>, <strong>.
9. Doan mo dau nen giai quyet intent tim kiem, cac muc sau nen co thong tin huu ich, loi ich, kinh nghiem, va ket lai bang CTA mem.
10. Khong dua script, style, iframe, hay markdown.
PROMPT;

$response = openai_post_json('/chat/completions', [
    'model' => $model,
    'temperature' => 0.7,
    'messages' => [
        [
            'role' => 'system',
            'content' => $systemPrompt,
        ],
        [
            'role' => 'user',
            'content' => $userPrompt,
        ],
    ],
    'response_format' => [
        'type' => 'json_schema',
        'json_schema' => $jsonSchema,
    ],
]);

$content = (string) ($response['choices'][0]['message']['content'] ?? '');
if ($content === '') {
    respond_error('OpenAI returned an empty article.', 502);
}

$article = json_decode($content, true);
if (!is_array($article)) {
    respond_error('OpenAI returned an invalid article payload.', 502);
}

$normalizedBlocks = [];
foreach (($article['blocks'] ?? []) as $block) {
    if (!is_array($block)) {
        continue;
    }

    $normalizedBlocks[] = [
        'id' => uuidv4(),
        'heading' => trim((string) ($block['heading'] ?? '')),
        'html' => seo_articles_sanitize_html((string) ($block['html'] ?? '')),
        'imageUrl' => '',
        'imageAlt' => trim((string) ($block['imageAlt'] ?? '')),
    ];
}

$normalizedBlocks = seo_articles_normalize_blocks($normalizedBlocks);
if ($normalizedBlocks === []) {
    respond_error('OpenAI did not return usable article sections.', 502);
}

$title = trim((string) ($article['title'] ?? ''));
$slug = seo_articles_slugify((string) ($article['slug'] ?? $title));
$excerpt = trim((string) ($article['excerpt'] ?? ''));
$metaTitle = trim((string) ($article['metaTitle'] ?? ''));
$metaDescription = trim((string) ($article['metaDescription'] ?? ''));

if ($title === '') {
    respond_error('OpenAI article title is empty.', 502);
}

respond_ok([
    'article' => [
        'title' => $title,
        'slug' => $slug !== '' ? $slug : seo_articles_slugify($title),
        'excerpt' => $excerpt,
        'metaTitle' => $metaTitle,
        'metaDescription' => $metaDescription,
        'blocks' => $normalizedBlocks,
    ],
    'model' => $model,
]);
