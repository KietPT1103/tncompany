# Social Listening Admin Module

## Scope

Admin-only module for TikTok social listening focused on the Ông Quan brand ecosystem:

- `cafe_ong_quan`
- `lau_ong_quan`
- `ong_quan_farm`
- fallback: `general_ong_quan`, `unknown`

This module is not exposed to the public site.

## Architecture

### Ingestion

Current implementation accepts raw comment batches through:

- `POST /api/social-listening.php?action=ingest`
- `POST /api/social-listening.php?action=seed`
- CLI: `php scripts/social-listening-seed.php 2026-03 36`

If the system already has a raw TikTok collector, feed that batch directly into the ingestion service and keep this module as a processing/storage layer only.

If a collector does not exist yet, recommended runtime architecture:

1. Scheduler/cron pulls or receives raw TikTok comments.
2. Queue worker calls `SocialListeningIngestionService`.
3. Processed rows are stored in `social_listening_comments`.
4. Monthly cron runs `php scripts/social-listening-report.php YYYY-MM`.

### Processing pipeline

1. Normalize text
2. Rule-based brand classification
3. Rule-based sentiment + topic tagging
4. Store enriched comment + topic bridge rows
5. Aggregate for dashboard and monthly report

### Storage

- `social_listening_comments`
- `social_listening_comment_topics`
- `social_listening_reports`

## Main files

- `public/api/social-listening.php`
- `public/api/_lib/social_listening.php`
- `public/api/_lib/social_listening/*`
- `src/services/socialListeningService.ts`
- `src/app/(dashboard)/social-listening/page.tsx`

## Exports

Monthly report generator returns:

- JSON
- Markdown
- HTML
- CSV detail

CSV was chosen for detailed export because it is simpler to generate and easy to consume in Excel/Sheets. If needed later, the frontend can convert JSON/CSV to XLSX using the existing `xlsx` dependency.

## Verification

- Unit test: `npm run test:social-listening`
- Seed mock data: `npm run seed:social-listening -- 2026-03 36`
- Generate report: `npm run report:social-listening -- 2026-03`
