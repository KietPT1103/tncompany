# Revenue Hub Implementation Plan

> Cập nhật theo yêu cầu mới: admin tự động có quyền truy cập doanh thu; các vai trò khác vẫn cần được cấp revenue_hub.view. Quy tắc này thay thế yêu cầu cũ về việc admin phải được cấp riêng.

> Execute inline using superpowers:executing-plans. User approved implementation on 2026-10-26.

Goal: /revenue with explicit TN permission and pluggable server-side reporting sources.
Architecture: Source registry -> dedicated TN endpoint -> internal provider / authenticated Mo API. Distinct React renderers share date controls.
Tech: existing React/TypeScript/Tailwind, PHP/PDO.
Spec: outputs/revenue-hub-design.md

Global constraints: TN login only; explicit revenue_hub.view including admins; no navigation link; Vietnam dates; 93-day maximum; no demo data; preserve dirty changes; no commit/deploy.
Review focus: stale requests on source change; inherited admin permissions; UTC Mo dates; canceled/test records; unassigned shifts.

## Task 1: Permission
Files: src/types/auth.ts, src/lib/permissions.ts, public/api/_lib/auth.php, src/features/accounts/account-management-ui.tsx, scripts/revenue-hub-permissions.test.mjs.
Interface: hasPermission(user, revenue_hub.view), auth_has_permission(user, revenue_hub.view).
- [x] Write failing tests for admin default denial, explicit grant, revoke, reports inheritance.
- [x] Run node --test scripts/revenue-hub-permissions.test.mjs and PHP permission fixture, expect failure then pass after implementation.
- [x] Allow explicit permission checkbox for admin; keep defaults excluding new permission.

## Task 2: Reporting providers
Files: public/api/revenue-hub.php, public/api/_lib/revenue_hub.php, Mo src/revenue-integration.php and src/api.php; scripts/revenue-hub-test.php, Mo tools/revenue-integration-test.php.
Interface: version=1, source, from, to, updatedAt, totals, days. Each source owns its business fields.
- [x] Write SQLite-backed fixture tests for quantities, payment totals, canceled data, unassigned shifts, UTC dates, retail/checkout revenue, expenses, invalid dates and key.
- [x] Run fixtures RED; implement provider queries without row caps; run GREEN.
- [x] Add fixed-host upstream configuration, bounded timeout, strict response validation and safe errors.

## Task 3: UI and connection
Files: src/features/revenue/*, src/App.jsx, src/app/login/page.tsx, docs/revenue-hub.md, example environment files.
Interface: registry of source id, label, renderer; GET revenue-hub.php?source&from&to&store.
- [x] Implement standalone mobile UI and URL-preserved filters; abort outdated requests, clear stale data.
- [x] Validate login return target only for /revenue; protect page with explicit permission.
- [x] Build TN; verify Mo required checks; inspect mobile and desktop UI plus permission/API behavior.
- [x] Fresh review and resolve important findings; record remaining configuration needs.

Ledger: work in requested repositories in place to preserve ongoing shift work. No worktree created. User authorized native implementation; no further approval gate. Source changes use scoped writes to the two user-named repositories. No shared production side effects.

Final verification: production build exit 0; browser 34/34; scoped Node 6/6; PHP reporting fixtures and required Mo checks passed. Existing baseline bartender count test and test-related typecheck errors remain documented. Live real-data check is blocked by existing TN local DB3307 connection and Mo DB1045. No commit/push/deploy. See docs/revenue-hub.md for local and server configuration.
