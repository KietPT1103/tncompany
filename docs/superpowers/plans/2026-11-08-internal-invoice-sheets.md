# Internal invoice Sheets implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import weekly Sheet bills without duplicate invoices and offer seller history suggestions.

**Architecture:** PHP CSV parser and transactional sync with source identities; authenticated endpoint and CLI worker; React sync panel and seller input.

**Tech Stack:** PHP/PDO/MySQL, React/TypeScript, Google CSV.

**Spec:** docs/superpowers/specs/2026-11-08-internal-invoice-sheets-design.md

## Global constraints

- Five default rows; positive price/quantity; all internal history for sellers.
- Group by date/link, preserve evidence/categories, no silent overwrite of local edits.
- No deletion on source absence; no application credentials in browser.

## Review focus

- Missing values in a bill must block the whole group.
- Link variations must not create duplicates; different dates stay separate.
- Changed source and local edits must not silently overwrite each other.
- Network/registry errors retain invoices and appear in status.
- Tax invoices cannot appear in seller suggestions or be modified by sync.

## Tasks

- [x] Add parser tests for header order, Vietnamese numbers/dates, duplicate links, cross-tab grouping, invalid/incomplete groups and supplier conflicts; run red then implement parser.
- [x] Add isolated persistence tests for repeat import, changed source, manual conflicts, missing/deleted targets and link evidence; run red then implement mapping, endpoint and worker.
- [x] Add seller endpoint and accessible suggestions component; add sync/status panel to internal page only.
- [x] Verify Sheet price column, relevant PHP/Node tests, build and review diff. Document cron activation and any deployment limits.

## Execution ledger

- Existing workspace is the user's active IDE workspace; keep changes here for review. No automatic commits or deployment.
- Price added to live weekly sheet while preserving original bill links; template already contained price/amount headers on re-read and was preserved.
- User confirmed separate expense lines for Phát sinh. Added and verified amount/category persistence.
- Reviewer found Drive folder identity variants and subprecision values causing persistence to exit; fixed with canonicalization and rounded-value validation, covered by parser tests.
- Browser interaction checks pass at 390px and 1440px: seller keyboard selection, automatic/manual sync, row errors and no horizontal overflow. Screenshot inspected.
- Live read-only PHP transport/parser check succeeds: one weekly tab, zero rows ready, no validation errors. Source was concurrently replaced by user with tab `2/11 - 8/11`; read metadata confirms the tab is empty and registry points to it. No further source writes were made.
- Production build passes. Whole-repository TypeScript check reports existing errors in other features/tests; no errors refer to changed files. Deployment and server cron were not run.
