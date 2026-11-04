# Revenue hub

URL: `/doanh-thu` (legacy `/revenue` redirects here, preserving filters). Uses the existing TN login. There is deliberately no navigation link.

## Access
The public `/doanh-thu` page uses a shared code, independent of TN account login or role. Both TN and Mo reports require a separate revenue bearer token on every API call. Admin tokens and the legacy `revenue_hub.view` grant do not bypass this gate.

Admins create a random code or save their own (6–64 characters, case-sensitive) below the sheet-link form in **Liên kết sheet chi**. The new code is returned only once for copying; the database stores its password hash. No code exists until an admin first creates one. Creating/saving a code revokes all previous revenue tokens. This code is shared across all dates, stores and sources, not tied to the sheet currently selected.

After unlocking, the browser stores a random token in `localStorage` with no application expiry. Clearing site storage or replacing the code requires entering the code again. Only token digests are stored server-side. Temporary connectivity failures retain the remembered token and offer retry. Unlocking is limited to ten attempts per client IP per 15-minute window. When running behind a reverse proxy, ensure `REMOTE_ADDR` identifies the client appropriately.

The token permits revenue reads only; it does not grant account, sheet-management, POS or booking access. No guest names, contact details or door codes are exposed.

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

Access checks: `php scripts/revenue-access-test.php`, `node scripts/revenue-hub-browser.test.mjs`.
