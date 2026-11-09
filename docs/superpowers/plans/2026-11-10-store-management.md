# Store Management Implementation Plan

**Goal:** Group administration links and add dynamic store management with address, take-away classification, active state and soft deletion.
**Architecture:** Existing stores table is the source of truth. PHP validates mutations and scopes reads. StoreContext supplies selectors, account assignments and sales guards.
**Tech Stack:** React, TypeScript, PHP, MySQL; SQLite domain tests.
**Spec:** docs/superpowers/specs/2026-11-10-store-management-design.md

## Global Constraints
No operating model field. Take away is metadata only. Retain existing store IDs and all historical transactions.

## Review Focus
Dynamic store IDs pass old whitelist boundaries; unavailable stores reject transactions; historical reads remain accessible; only admin mutates stores; stale background refreshes cannot override a newer session.

### Task 1: Stores domain/API
- [x] Write and observe failing CRUD, validation, migration, access and soft-deletion tests in scripts/stores-test.php.
- [x] Implement public/api/_lib/stores.php and public/api/stores.php; extend database/schema.sql without replacing existing rows.
- [x] Replace static ID validation in users, daily profit, payroll and catalog; integrate inventory choices and history scope.
- [x] Validate POS and inventory writes against active state; retain historical GET access.
- [x] Run targeted PHP tests and syntax checks.

### Task 2: Dynamic store consumers
- [x] Observe failing dynamic assignment test, then update scripts/store-switch-permissions.test.mjs and src/lib/permissions.ts.
- [x] Add src/services/stores.api.ts and update StoreContext, sidebar, login and account assignments.
- [x] Keep history selection for unavailable stores and block mounting a sales screen for them.
- [x] Keep background refreshes from unmounting an in-progress sale; ignore superseded responses.

### Task 3: Administration UI and verification
- [x] Add src/features/stores/StoresPage.tsx with search/filter, add/edit, address, take-away checkbox, state switch and delete confirmation.
- [x] Group existing links under Administration; add admin-only store route.
- [x] Independent reviewer identified history-selection and inventory-write gaps; both addressed with regression tests.
- [x] Final build and regression checks after review changes.

## Execution record
Working in the user-provided checkout. No commits or deployment requested. User postponed operating models. SQLite tests validate lazy migration and historical preservation. The connected browser host is unavailable, so interactive visual QA cannot run. The isolated headless browser test passes 10 checks covering the real store form, edits, metadata, active toggle, delete confirmation and shared-list refresh.

Validation: production build passes; 8 Node tests pass across store UI, store switching, inventory permissions, usage-report permissions, account permissions and POS stock. PHP store, catalog, POS catalog, auth scope, inventory permissions and invoice persistence/service checks pass. All modified PHP files pass syntax checks; git diff --check passes.

Existing unrelated checks still fail: payroll-estimate-cross-store.test.mjs misses role options (same failure reproduced with tracked HEAD source); warehouse-permissions-test.php lacks inventory_pos_links in its SQLite fixture. Repository-wide TypeScript checking reports errors in unrelated existing files and test configuration. No errors were reported for new store files or modified store consumers.
