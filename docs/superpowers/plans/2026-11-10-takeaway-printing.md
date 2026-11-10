# Takeaway printing implementation plan

> Use superpowers:executing-plans. Execute in this workspace as requested; do not publish or commit unrelated work.

**Goal:** Print receipts and one label per item unit from any checkout device through a Windows laptop.

**Architecture:** Transactional server queue with immutable document snapshots, independent jobs and exclusive claims. Windows Forms helper uses installed Windows printer drivers. Opt-in per takeaway store; cafe remains unchanged.

**Tech Stack:** PHP/PDO, React/TypeScript, .NET 8 Windows Forms.

**Spec:** ../specs/2026-11-10-takeaway-receipt-printing-design.md

## Constraints and review focus
Do not silently round fractional quantities. Never automatically reprint a claimed job after a crash. A spool submission is not proof of physical printing. Enforce assigned store on every API action. Preserve checkout idempotency and queue in the bill transaction. Labels and receipts fail independently; do not claim jobs for a missing printer.

## Tasks
- [x] 1. PHP SQLite queue tests added and observed RED before implementation, now GREEN: snapshots, counts, idempotency, exclusive claim, wrong token/store, fractional warning, independent retry, transaction rollback, stale claims and retired acknowledgements.
- [x] 2. Checkout enqueues authoritative saved bill snapshots in transaction and returns printQueued on first/replayed requests. POS uses server flag; queue UI has bill filter, pagination and independent retry/reprint. Browser fixtures passed.
- [x] 3. Windows helper implements login, store/printer/paper selection, exclusive journal lock, durable crash recovery and queue controls. Worker/layout tests passed; self-contained Windows x64 executable published.
- [x] 4. Independent review findings resolved: expired/retired claims, historical queue visibility, journal ownership, bill-level note and schema migration. PHP syntax checks, stores regression tests, helper tests, UI fixtures, web build and diff check passed. Physical printers not available.

## Execution record
- User approved design and requested execution. Work stays in the requested workspace; no branch or publication changes.
- Full `tsc --noEmit` encounters existing Node test typing/import configuration errors; production Vite build passes. Do not claim repository-wide typecheck is green.
- Ruling: retain existing shared live-order/cart semantics; this feature routes printing and does not create separate carts per device. Document the same-order simultaneous checkout limitation.

## Follow-up: templates, setup once, and downloads
- [x] User requested cafe receipt structure with store details and redesigned 50×30 labels. Added structured rows, table alignment, label badge and fit checks; rendered and inspected PNG previews.
- [x] User requested setup once and automatic Windows startup. Added per-user installer/desktop shortcut/HKCU Run, DPAPI session persistence and tray lifecycle. Regression checks cover first install, unchanged installer, upgrade detection and settings/session roundtrip. Actual Windows sign-in restart remains a manual hardware check.
- [x] Added helper and both tested drivers to existing download page. User supplied `kpos_driver.exe` for bill; label package is tested 4BARCODE_2024.2. Both drivers and new setup/ZIP uploaded to separate R2 keys and downloaded again with matching SHA-256. No website activation or push performed.
- [x] Deployment workflow now builds/tests/uploads the new setup before activating website, using server API R2 configuration; existing cafe and inventory binaries stay separate. New download links match server manifest; web build, helper checks, PHP checks and diff check passed.
- Independent lifecycle/download review found no confirmed important bugs. The reviewer withdrew a suspected DPI issue after checking framework documentation.

## Final pre-push audit
- User authorized GitHub push after regression checks. Fetched origin; five newer commits must be retained by rebasing before push.
- Review found historical pre-opt-in bills had no queue jobs; restored their original browser reprint path and added routing regression checks.
- Cafe/non-takeaway checkout now bypasses takeaway queue DDL and snapshot mapping. An isolated test executes the actual production checkout block and confirms cafe idempotency/no new queue schema plus cart atomic enqueue/idempotency.
- Corrected production helper uploader bootstrap path to `/var/www/tnservice.vn/public/api/_lib/bootstrap.php`, matching deploy-production.sh web root.
- Verified cafe print agent tests, 47 bar-board checks, inventory helper tests, catalog/POS routing and shift workflow regressions, new helper/queue/download tests and production web build. Cafe/inventory helper binaries and service paths remain separate.
