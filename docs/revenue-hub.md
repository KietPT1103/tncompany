# Revenue hub

URL: `/doanh-thu` (legacy `/revenue` redirects here, preserving filters). Uses the existing TN login. There is deliberately no navigation link.

## Access
In TN account management, edit permissions and tick **Xem doanh thu liên hệ thống** (`revenue_hub.view`). Admin accounts automatically have access. Other roles need an explicit grant; their role defaults and the reports permission do not grant it. Revoke the checkbox to deny the next API request. No separate Mo login is required.

This permission allows reading reports across all counters and all connected sources. It does not grant POS, booking mutation or account management rights.

## Connect MoHomestay
Deploy both code changes. Set server-only configuration (never use VITE_ variables):

TN PHP environment:
```
REVENUE_MO_URL=https://your-mohomestay-host
REVENUE_MO_KEY=<same random secret of at least 32 characters>
```
MoHomestay `.env`:
```
REVENUE_INTEGRATION_KEY=<same random secret of at least 32 characters>
```
Generate a secret with `php -r "echo bin2hex(random_bytes(32));"`. Store it privately on both servers. Do not put it in source control, query parameters or frontend code. Empty/unconfigured keys fail closed. HTTPS is required; HTTP loopback is supported only with TN APP_ENV=local. The new Mo endpoint is GET `/api/integration/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD`, authenticated with `X-Revenue-Key`.

No database migration or data synchronization is needed. Never enable a source by accepting a browser-supplied upstream URL. Configuration changes require restarting long-running local PHP processes if they inherit environment values.

## Date/accounting rules
- Date ranges are inclusive, Vietnam time, at most 93 days.
- TN: completed bills by transaction date, cash/transfer from bill totals, quantities match the main overview category rules and historical item overrides (cup and bakery counts are independent). Canceled bills and canceled/non-cash-flow vouchers are excluded. All counters can be selected. Ca đơn and Chưa gán ca remain separate, including expenses without a shift. No 2,000-row cap.
- Mo: actual PAID payment records by payment date, converted from UTC to Vietnam time. Room receipts exclude canceled/test bookings. Late checkout receipts, paid retail sales and included expense vouchers are separate. Total collected is room + late checkout + retail, never added again to booking totals. This is a receipts report, not revenue allocated over nights stayed. Noncash/unknown payment methods are shown as other, not invented as cash. Missing paid timestamps cannot be assigned to a day and are not guessed.
- No guest names, contact details, door codes or private identity data are returned.

## Add a system
1. Add a server provider to `public/api/_lib/revenue_hub.php::revenue_providers()` (or a dedicated provider file). Validate its fixed server URL and credential; use a bounded timeout and safe errors. Never forward the TN user token to the external service.
2. Return metadata `version:1, source, from, to, updatedAt` and source-specific `totals`/`days`. Preserve native business fields rather than inventing cup/shift fields for other domains.
3. Add the distinct React report renderer, then register `{id,label,Report}` in `src/features/revenue/sources.ts`.
4. Add server environment examples and fixtures for date boundaries, cancellations, expenses and auth. Test source switching, stale responses, reload, and 360px layout.
5. Login, hub permission, date controls, URL persistence and reload remain shared. A source failure must not prevent switching to another source.

## Checks
TN: `php scripts/revenue-hub-test.php`, `node --test scripts/revenue-hub-*.test.mjs`, `npm run build`.
Mo: `php tools/revenue-integration-test.php` and the required repository checks in AGENTS.md.
