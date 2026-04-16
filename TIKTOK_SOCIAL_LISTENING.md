# TikTok Social Listening

## Rule Zero

This module only accepts real TikTok data.

- No generated comments
- No seeded TikTok rows
- No fake fallback payloads
- If the provider cannot return data, the module returns an empty result

## Runtime Flow

1. `POST /api/tiktok/search.php` creates a search job with `keyword`, `date_from`, and `date_to`.
2. Queue worker runs `FetchVideoJob` to fetch real TikTok videos from the configured provider.
3. Queue worker runs `FetchCommentJob` per video to fetch real comments only.
4. Comments are ingested into `social_listening_comments` with `search_id`, `video_url`, `share_url`, and `video_username`.
5. Frontend polls `GET /api/tiktok/status.php` and `GET /api/tiktok/comments.php`.

## Provider Modes

Set one provider in `public/api/config.php`:

- `tiktok_provider = webhook`
- `tiktok_provider = apify`

If no provider is configured, the module stays in real-data-only mode and returns empty results instead of mock data.

## Queue Worker

- One-off: `php scripts/tiktok-social-listening-worker.php --once`
- Daemon: `npm run worker:tiktok-social-listening`

## Main Files

- `public/api/tiktok/search.php`
- `public/api/tiktok/status.php`
- `public/api/tiktok/comments.php`
- `public/api/_lib/social_listening/TikTokCollectorService.php`
- `public/api/_lib/social_listening/TikTokSearchService.php`
- `public/api/_lib/social_listening/FetchVideoJob.php`
- `public/api/_lib/social_listening/FetchCommentJob.php`
- `src/app/(dashboard)/social-listening/TikTokSearchPage.tsx`
- `src/services/socialListeningService.ts`

## URL Rules

- Priority: `share_url -> video_url -> https://www.tiktok.com/@{video_username}/video/{video_id}`
- Final fallback: `https://www.tiktok.com/search?q={keyword}`

## Mock Data

The old TikTok mock seed path is intentionally disabled.
