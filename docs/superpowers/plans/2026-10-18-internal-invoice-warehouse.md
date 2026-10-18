# Internal invoice warehouse implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Compact internal invoice entry with an independent shared warehouse and material categories.

**Architecture:** Keep invoices as the source of received quantities. Add a separate internal category catalog and scope-restricted warehouse endpoint; calculate totals from internal invoice lines so edits and deletions cannot duplicate stock. Preserve existing tax behavior.

**Tech Stack:** React 18, TypeScript, Tailwind, PHP, MySQL, existing XLSX utilities.

**Spec:** docs/superpowers/specs/2026-10-18-internal-invoice-warehouse-design.md

## Global constraints
- Internal stock, materials, and categories never access ingredient or equipment inventory.
- Internal entry has no Store input; tax controls retain their existing behavior.
- Twelve rows on new invoices; only fully blank rows may be ignored.
- Shared internal stock includes historical internal invoices and separates different units.
- All internal warehouse/category endpoints require internal_invoices.access.
- Preserve historical invoice metadata and evidence files.

## Review focus
- Simultaneous invoice creation must not produce duplicate generated numbers.
- Switching between tax and internal pages must not share catalogs or alter tax payloads.
- Partially entered rows must report an error instead of being silently discarded.
- The same material in different units must remain separate in warehouse totals.
- Imported and historical internal invoices must appear without creating other warehouse movements.

### Task 1: Internal categories and invoice persistence
**Files:** create public/api/_lib/internal_invoice_warehouse.php and database/internal_invoice_warehouse_patch.sql; modify public/api/invoice-entries.php and database/schema.sql; create scripts/internal-invoice-warehouse-test.php.
**Interfaces:** invoice rows expose optional categoryId/categoryName; internal categories have id and name. Internal numbering uses server-generated UUID-based NB identifiers; existing numbers survive edits.
- [ ] Write a failing focused PHP test for category normalization, generated numbering, and blank versus invalid internal rows; run it and record the expected failure.
- [ ] Add category schema with a unique normalized key and nullable row category reference. Use the existing schema initialization pattern and ship a deployment migration.
- [ ] Persist and read categories transactionally, include category in import deduplication fingerprints, and generate numbers only for internal creations. Preserve numbers on edits.
- [ ] Since store_id is a required VARCHAR without a store foreign key, use an internal-only metadata value for new internal records; preserve old metadata on edits. No store record is created.
- [ ] Keep tax item validation and numbering unchanged. Test category round trips, numbering under concurrent creation, scope permissions, and tax isolation.

### Task 2: Independent warehouse API and service
**Files:** create public/api/internal-invoice-warehouse.php; modify src/services/invoiceEntryService.ts; extend scripts/internal-invoice-warehouse-test.php; create scripts/internal-invoice-service.test.mjs.
**Interfaces:** GET returns categories, paginated grouped stock, and independently searchable material suggestions; POST creates a normalized category. Stock rows contain name, categoryId/categoryName, unit, totalReceived. Suggestions contain name, unit, unitPrice, categoryId/categoryName and choose the most recently saved internal line deterministically.
- [ ] Write failing tests for internal scope restrictions, mixed-unit aggregation, historical uncategorized data, and category normalization under concurrent creation.
- [ ] Implement permission-checked queries joining invoice_entry_items only to invoice_entries with invoice_scope=internal. Aggregate by material name, category, and unit across all internal stores. Add bound search, category, and pagination parameters.
- [ ] Implement idempotent category creation using the normalized unique key. Suggestions query complete history independently of invoice page pagination.
- [ ] Add typed getInternalInvoiceWarehouse, searchInternalInvoiceMaterials, and createInternalInvoiceCategory services; pass category fields in invoice FormData.
- [ ] Verify a create/edit/delete sequence changes totals correctly, repeated reads do not change totals, and tax lines never appear.

### Task 3: Compact invoice form and independent warehouse tab
**Files:** modify src/app/(dashboard)/_components/InvoiceAdminPage.tsx; create src/app/(dashboard)/_components/InternalInvoiceWarehouse.tsx and InternalInvoiceMaterialInput.tsx; create src/lib/internalInvoiceDraft.ts and scripts/internal-invoice-draft.test.mjs.
**Interfaces:** shared draft helpers create twelve internal blank rows and return valid payload rows or line-specific errors. Material input receives a row and onChange callback, searches internal history, and supports category lookup/quick creation.
- [ ] Write failing draft tests for twelve initial rows, blank-row skipping, partially filled rows, negative/nonfinite values, preserving categories, and edit forms with more than twelve rows.
- [ ] Remove internal Store and invoice-number inputs; preserve tax layout. Collapse notes behind a summary and use compact row padding and input heights. Include per-row category and material suggestions with saved unit/price/category autofill.
- [ ] Reuse InventoryDateFilter for internal filters, remove internal Store controls and the invoice number/code list column, and correct table colSpans and descriptions.
- [ ] Add invoice/warehouse tabs. Warehouse shows material, category, unit, cumulative received quantity, search, category filtering, pagination, loading, error/retry, and empty states. Refresh after successful invoice writes.
- [ ] Ensure internal import and export actions never depend on the currently selected Store and remove internal batch Store reassignment controls.
- [ ] Run draft/service tests and inspect compact desktop/mobile layouts, modal scrolling, keyboard suggestions, quick category creation, and tax page behavior.

### Task 4: Import/export and final verification
**Files:** modify src/services/excel.ts and export helpers in InvoiceAdminPage.tsx; extend existing Excel/import tests or create scripts/internal-invoice-excel.test.mjs.
- [ ] Write failing tests for category columns, older workbooks without categories, and mixed-category invoices.
- [ ] Include category names in internal exports and parse optional category columns during imports. Resolve category names through the independent internal catalog; preserve existing import duplicate protection and tax behavior.
- [ ] Run php -l on every changed PHP file and all focused PHP/Node regression tests. Run the existing receipt-product-create regression and a Vite production build to a temporary workspace output directory.
- [ ] Review the diff against every spec requirement and verify migration idempotency. Record checks and any environment limitations. Leave changes reviewable in the current workspace without deployment or production data changes.

## Execution choice
Recommended: native execution in the current workspace. The backend, typed services, form, and import/export share interfaces and are best implemented in sequence. A final independent reviewer should inspect isolation, aggregation, and tax regressions.

## Planning findings
The invoice schema has no foreign key from store_id to stores, so an internal-only metadata value is possible without creating a real store or attaching to another warehouse. Existing APIs silently skip invalid invoice rows; strict validation will be applied only to the internal flow to preserve tax behavior. Current form/list code is shared with tax invoices, making scope guards essential.

## Execution record
- Implemented persistence, internal-only API, compact form, warehouse tab, material suggestions, categories, and Excel category support in the current workspace.
- Ruling: keep changes in the user's current checkout, as requested by the approved execution plan; no branch moves, production migration, or deployment.
- Independent review found two issues, both reproduced and fixed: retaining received quantities when monetary totals round to zero, and advancing the parent timestamp on line-only edits for latest-price suggestions.
- Passed six focused test scripts (PHP validation, isolated API persistence/aggregation, draft validation, service serialization, Excel import, and existing receipt creation) and PHP syntax checks. Production Vite build passed.
- The API integration test uses an isolated SQLite in-memory database, translating MySQL null-safe equality and category upsert syntax. No existing application database or credentials are loaded. Live MySQL concurrency/migration and browser visual checks have not been run.
- Full TypeScript checking remains blocked by pre-existing test setup errors. Excluding test files leaves three diagnostics in unchanged files: inventoryIssuePrint.ts, RichTextEditor.tsx, and accountPermissions.ts; none in the changed feature files.

## Approved import reconciliation extension
- User approved previewing new/existing/changed/ambiguous Excel rows and updating old invoices without adding their quantities twice.
- Fixed category-header detection after dated rows and transferred sheet groups into actual line categories. The supplied sample parses to 11 lines totaling 10,404,000 VND with correct Steel/Tools groups.
- Added a read-only preview endpoint and explicit create/category-only/update choices. Matching ignores sheet position for exact invoice content; positional metadata only suggests a candidate and never authorizes an automatic overwrite.
- Apply rechecks current data, retains evidence and header metadata, rejects stale versions, and records operation results atomically for safe retries. A MySQL advisory lock serializes imports; locking reads precede snapshot reads for correct version checks under REPEATABLE READ.
- Blank incoming categories preserve one-to-one financial row matches; ambiguous material/category relationships require explicit correction instead of guessing.
- Tests cover reimports, category-only updates, replacement quantities, retained attachments, stale versions, retry idempotency, explicit separate purchases, category ambiguity, the actual sample, and query locking order. No real bills or production data were imported or modified during implementation.
- Live MySQL concurrency and browser interaction remain unverified; integration tests use the isolated SQLite harness. Existing production TypeScript diagnostics remain outside changed files.
