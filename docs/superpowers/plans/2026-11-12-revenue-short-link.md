# Revenue Short Link Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Open revenue reports from a short share link without typing a code.
**Architecture:** Keep hashed links in a singleton configuration with an independent version. Existing revenue tokens can belong to either the current code version or the current link version. Exchange the link through the existing public access endpoint and replace the browser route with `/doanh-thu`.
**Tech Stack:** PHP/PDO, React, React Router, existing Node/Edge browser checks.
**Spec:** `docs/superpowers/specs/2026-11-12-revenue-short-link-design.md` (approved in chat).

## Global Constraints

- `/d/<16 URL-safe characters>` uses 96 random bits; persist only hashes.
- Admin-only generation; read-only report access; no automatic expiry.
- Link rotation revokes link sessions, preserves code sessions. Code rotation revokes everything.
- Suppress referrers from the initial HTML; noindex link routes; retry network failures.

## Review Focus

- First link works even before the first shared code is configured.
- Opening a revoked link cannot fall back to a remembered valid token.
- Storage unavailable still permits the current visit.
- Failed generation does not leave an old displayed link that looks current.
- Retries and component unmounts cannot navigate from a stale response.

### Task 1: Link generation, exchange and revocation

**Files:** `public/api/_lib/revenue_access.php`, `public/api/revenue-access.php`, `public/api/revenue-access-code.php`, `scripts/revenue-access-test.php`, `scripts/revenue-access-http.test.mjs`.
**Interfaces:** `revenue_access_generate_link(PDO): string`; `revenue_access_unlock_link(PDO,string,string,?int): string`. Admin POST `{action:"link"}` returns `{path}`; public POST `{link}` returns `{token}`.

- [x] Add failing domain and HTTP checks for format, hashes, permissions, link-first setup, rotation, invalid inputs and rate limits.
- [x] Run PHP/HTTP checks and confirm the feature is missing.
- [x] Implement singleton link table, separate version validation and rate-limited exchange.
- [x] Run access tests; expect PASS.

### Task 2: Automatic opening and admin copy controls

**Files:** `src/features/revenue/RevenueLinkPage.tsx`, `src/features/revenue/RevenueAccessGate.tsx`, `src/features/outside-expenses/RevenueAccessCode.tsx`, `src/App.jsx`, `src/seo/pageSeo.js`, `index.html`, `scripts/revenue-short-link-browser.test.mjs`, `docs/revenue-hub.md`.
**Interfaces:** Consume Task 1 endpoints. Pass an in-memory token through router state when browser storage is unavailable.

- [x] Add a browser fixture checking automatic exchange, route replacement, invalid-link denial with remembered credentials, retry, storage failure and admin generation/copy.
- [x] Run it; confirm missing route/component behavior fails.
- [x] Implement route and UI; clear stale admin output, keep code controls.
- [x] Run browser checks, existing revenue checks, and `npm run build`; expect PASS.
- [x] Review final diff and document deployment state accurately.

## Execution record

- User explicitly requested immediate implementation after approving the design. Execute inline without another approval round.
- Work in the provided IDE checkout; leave changes reviewable without committing, pushing or triggering the production deployment workflow.
- Task 1 complete: domain and HTTP tests failed for missing link generation, then passed with generation, exchange, rate limits and version-based revocation implemented.
- Task 2 complete: 25 browser checks pass at 360px and 1440px; existing revenue browser checks, report calculation/SQL/rendering checks, permission/filter checks and PHP syntax checks pass. Production build succeeds; it retains bundle-size and unused React import warnings.
- Review: a fresh reviewer found stale router state could override a later code login. Reproduced with a failing test, fixed by consuming the handoff once, and passed regression plus targeted follow-up review.
- Test fixture ruling: pin the existing revenue browser fixture to 2026-10-25 because its October date assertions otherwise followed the current November quick range. This changes only the test clock.
- Final diff whitespace check passes. No production link has been generated; the built change is local and has not been deployed.
