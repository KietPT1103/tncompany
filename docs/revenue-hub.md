# Revenue hub

URL: `/doanh-thu` (legacy `/revenue` redirects here, preserving filters). Access uses a shared revenue code or short link, independent of TN account login. There is deliberately no navigation link.

## Access
The public `/doanh-thu` page uses a shared code, independent of TN account login or role. Both TN and Mo reports require a separate revenue bearer token on every API call. Admin tokens and the legacy `revenue_hub.view` grant do not bypass this gate.

Admins create a random code or save their own (6–64 characters, case-sensitive) below the sheet-link form in **Liên kết sheet chi**. The new code is returned only once for copying; the database stores its password hash. No code exists until an admin first creates one. Creating/saving a code revokes all previous revenue tokens. This code is shared across all dates, stores and sources, not tied to the sheet currently selected.

After unlocking, the browser stores a random token in `localStorage` with no application expiry. Clearing site storage or replacing the code requires entering the code again. Only token digests are stored server-side. Temporary connectivity failures retain the remembered token and offer retry. Unlocking is limited to ten attempts per client IP per 15-minute window. When running behind a reverse proxy, ensure `REMOTE_ADDR` identifies the client appropriately.

The token permits revenue reads only; it does not grant account, sheet-management, POS or booking access. No guest names, contact details or door codes are exposed.

### Short share link

In **Liên kết sheet chi → Mã xem doanh thu**, admins can choose **Tạo link xem doanh thu** and **Sao chép link**. The resulting URL is `/d/<16 URL-safe characters>` (96 random bits). It is returned only at creation; save it before leaving or reloading. It can be created before any shared code exists. Anyone holding the link can open the revenue reports without entering a code or signing in, and can forward it to others.

The browser exchanges the link for a separate revenue token, then replaces the address with `/doanh-thu`. Browser storage remembers the token; when storage is blocked, a one-time router handoff permits the current visit. The gate consumes and clears that handoff so an old token cannot override a later code login. Link routes use `noindex,nofollow` and canonicalize to `/doanh-thu`; the initial HTML sets a no-referrer policy. Link exchange requests are POST requests and access responses use `Cache-Control: no-store`.

Only the link digest is stored in `revenue_access_links`, which is created automatically by the access schema. Generating another link immediately revokes the previous link and its browser sessions, preserving sessions opened with the shared code. Changing the shared code revokes all links and all previous revenue sessions. Links do not expire automatically. Link guesses have a separate limit of ten attempts per IP per 15-minute window.

Checks: `php scripts/revenue-access-test.php`, `node scripts/revenue-access-http.test.mjs`, `node scripts/revenue-short-link-browser.test.mjs` (requires built CSS and Microsoft Edge on Windows).

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
