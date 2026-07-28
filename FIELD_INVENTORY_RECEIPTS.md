# Field inventory receipts

## Phase 0 audit

- Authentication uses hashed bearer tokens in `api_tokens`; `auth_require_permission()` is the API gate.
- `stores` is the existing operational-area entity and `products`/stock are already scoped by `store_id`.
- Stock lives in `products.stock_quantity`; completed receipts previously updated it in a transaction.
- Web requests go through `src/lib/api.ts`, which injects the bearer token and supports PHP method overrides.
- Existing uploads under `public/uploads` are public assets, so receipt evidence uses a new private storage path and a token-checked streaming endpoint.
- Main migration risks are the existing two-value receipt status enum, historical `created_by` display names, and MySQL version support for `ADD COLUMN IF NOT EXISTS`.

## Important decisions

- Reuse `stores` as areas to avoid duplicating business concepts and to keep stock area-scoped.
- Keep the original `/admin/product/receipts` URL as a redirect to the new module.
- A quick receipt is created as `draft`, then becomes `pending_explanation` in the transaction that stores its first image. This prevents a persistent pending receipt without evidence.
- The server never trusts totals, creator, completion actor, or area permission from the client.
- Watermark rendering is performed by capturing the photo-plus-overlay view into a new JPEG. The camera source is deleted immediately after that file is created.
- Mobile retry persists both client idempotency keys and the watermarked file URI in SQLite.

## Setup

1. Apply `database/field_inventory_receipts_patch.sql` to the existing MySQL database.
2. Configure PHP `private_storage_path` outside the public document root if the default project-level `storage/private` path is not suitable.
3. Copy `mobile/.env.example` to `mobile/.env` and set the HTTPS API base URL.
4. Run `cd mobile && npm install`.
5. Run the web/API locally with `npm run dev:full`; run mobile with `cd mobile && npm start`.

## Verification

- PHP syntax: `php -l public/api/inventory-receipts.php` and the other new endpoints.
- Web production build: `npm run build`.
- Mobile types: `cd mobile && npm run typecheck`.
- Expo project health: `cd mobile && npx expo-doctor`.
- Destructive API scenario: configure the four `TN_*` environment values documented in `scripts/inventory-receipts-api-smoke.php`, then run that script against a test database.

### Latest local verification (2026-07-27)

- PHP syntax passed for all changed/new field-inventory endpoints and the smoke script.
- Web production and SSR builds passed.
- Mobile TypeScript and Expo lint passed.
- Expo Doctor passed all 20 checks.
- `git diff --check` passed.
- The destructive API smoke scenario has not been run: the configured database host was unreachable from this workstation and no `TN_*` test environment values were available.

## Operational notes

- Thumbnail generation uses PHP GD when available; without GD, the authorized image endpoint falls back to the full image.
- `storage/private/inventory-receipts` must be writable by PHP and must not be served directly by the web server.
- Offline background execution remains best-effort; reliable retry happens on app launch, foreground, and the manual “Thử lại đồng bộ” action.
- EAS project IDs and signing credentials are intentionally not committed; configure them for the organization before release builds.
- The web receipt detail page supports adding, editing and deleting draft line items, completing a receipt, and cancelling a draft with a required reason.
