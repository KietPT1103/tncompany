# Employee cleanup implementation plan
> Execute inline using executing-plans.

Goal: display payroll recency, date filters and confirmed bulk employee deletion.
Architecture: optional summary on employee API; aggregate by employee ID and store. One transactional DELETE scoped by store, preserving snapshots. Pure date helpers drive desktop/mobile UI.
Tech Stack: React, TypeScript, PHP/PDO, MySQL; SQLite for database behavior tests.
Spec: ../specs/2026-11-01-employee-cleanup-design.md

## Constraints
Preserve payroll history. No new dependencies. Never label missing payroll dates as never paid. No actual employee data will be deleted during development.

## Review focus
Date boundaries; missing dates versus no history; cross-store IDs; deletion rollback; selection across pagination and filter changes.

## Tasks
- [x] Add failing behavior tests for date filters and SQL aggregation/scoped atomic deletion.
- [x] Add PDO helper and optional API summary, batch DELETE endpoint, typed service.
- [x] Add pure date helpers, filters, desktop/mobile recency and selection with confirmation.
- [x] Run behavior/regression tests, PHP syntax check, production build; inspect diff and record results.

## Verification record
- Date behavior tests and employee-management regressions: 6 passed.
- SQLite aggregation, atomic deletion, rollback and payroll snapshot preservation: passed.
- Employee code regression and PHP syntax checks: passed.
- Component bundle: passed; desktop/mobile fixture checked for recency, date filters and cross-page selection.
- Independent review: corrected stale-store deletion reload; no remaining concrete issues.
- Whole-app build blocked by absent pdfjs-dist/legacy/build/pdf.mjs; broad TypeScript check has unrelated pre-existing errors. Corrected new SelectBox generic typing and rechecked changed production files.
- No live employee records were deleted. Changes are uncommitted for user review.
