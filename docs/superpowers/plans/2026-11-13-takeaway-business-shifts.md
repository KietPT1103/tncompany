# Takeaway Business Shifts Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent configuration tasks and direct integration for the cycle engine. Each task follows test-first implementation and receives review.

**Goal:** Configurable, account-assigned takeaway shifts close a business cycle across midnight and print the final-cycle report.
**Architecture:** Preserve legacy shift types and history. Store configurable count/final number on stores and per-store account assignments in a separate table. A server-owned cycle and separate shift binding table track business membership, immutable shift number/final flags and closing snapshots; existing bill/voucher shift IDs stay authoritative.
**Tech Stack:** PHP/PDO MySQL+SQLite tests, React/TypeScript, existing browser print flow and Edge checks.
**Spec:** `docs/superpowers/specs/2026-11-13-takeaway-business-shifts-design.md` (approved by user).

## Global Constraints

- Account-assigned shifts, 1–24 configured slots, exactly one final slot.
- Cycle spans midnight; first slot opens a new cycle; final closes it atomically.
- No history rewrites; legacy café and unconfigured takeaway behavior retained.
- Closing snapshots survive retry/reprint, and cross-cycle bill transfers are forbidden.
- Changes stay in the provided checkout; no commit/push/deployment is part of this implementation.

## Review Focus

- Concurrent opening/final-close cannot create two open cycles or attach a shift to a closed cycle.
- Final close refuses other open shifts and requires confirmation for unworked slots.
- Transfer source/receiver use cycle membership instead of calendar date only for configured shifts.
- Reprints use persisted snapshots even after history corrections.
- Store changes, missing account assignment, old open sessions and Ca 10+ must not be silently misclassified.

### Task 1: Store configuration

**Owner files:** `public/api/_lib/stores.php`, `src/services/stores.api.ts`, `src/features/stores/StoresPage.tsx`, store tests.
**Interfaces:** `takeawayShiftEnabled: boolean`, `takeawayShiftCount: number`, `takeawayFinalShift: number`; SQL columns use snake_case. Defaults false/1/1. Reject invalid values and policy changes while a cycle/legacy shift is open.

- [x] Add failing PHP configuration and browser UI tests.
- [x] Implement validation/persistence and conditional setup fields.
- [x] Run store tests and review task diff.

### Task 2: Account assignment

**Owner files:** user/auth backend, `src/services/users.api.ts`, `src/types/auth.ts`, account editor/page, account tests; new `_lib/takeaway_assignments.php`.
**Interfaces:** `takeawayShiftAssignments: Record<string,number>` returned in authenticated and managed users. SQL table `user_takeaway_shifts(user_id,store_id,shift_number)`. Helper `takeaway_assignments_read(PDO,string): array`; admin-only writes; validate accessible, configured stores and configured number.

- [x] Add failing assignment validation/auth mapping checks.
- [x] Implement per-store fixed assignments and account editor controls.
- [x] Run account checks and review task diff.

### Task 3: Cycle engine, POS integration and print

**Owner files:** new `_lib/takeaway_shifts.php`, `public/api/pos.php`, shift management/transfers, shift service/day policy, POS page and new cycle report UI, integration/domain/browser tests.
**Interfaces:** bindings table `takeaway_shift_sessions(shift_id,cycle_id,store_id,shift_number,is_final,shift_count,snapshot_json)`; cycles `takeaway_business_cycles(id,store_id,business_date,opened_at,closed_at)`. Shift payload adds `businessCycleId`, `businessDate`, `shiftNumber`, `isFinalShift`, `cycleShiftCount`; legacy `shiftType` remains unchanged. Server computes final summary from shift IDs and stores snapshot at successful close. Client receives report from close response or authenticated reprint endpoint.

- [x] Add failing overnight, assignment forgery, multiple-slot, closing/conflict/replay and cycle-summary tests.
- [x] Implement portable schema, store-serialized open/close, cycle report and correction/transfer constraints.
- [x] Integrate POS and overnight guards, complete bill/voucher reads and dynamic report/reprint UI.
- [x] Run domain/HTTP/browser regression checks, build, and independent whole-change review.

## Execution ledger

- Planning approved scope; user requested implementation. Independent store/account tasks may run concurrently with cycle implementation through the explicit interfaces above.
- Preserve `shift_type=single` for configured takeaway in storage to retain existing enum and calendar report compatibility; use separate `shiftNumber` metadata for all labels and cycle breakdowns.
- Task 1 verified with store PHP migration/configuration/guard tests and 16 browser checks.
- Task 2 verified with SQLite assignment validation/persistence, auth store-scope checks and account editor browser interaction.
- Task 3 verified with overnight domain and extracted real POS endpoint handlers, immutable reprint/retry/ownership/missing-slot guards, cross-cycle transfer membership, dynamic Ca 10 revenue reporting, nine account/print browser checks, existing shift-management browser tests and revenue browser/HTTP regression checks.
- Reviewer found and verified fixes for legacy-opening/configuration races, replacement-account reopening, and configured stores being blocked by legacy username inference.
- Build succeeds. Full-repository tsc still reports errors in existing test typing/import settings, payroll estimates, profit Excel export and rich-text editor. No errors were reported in the modified implementation files.
- Implementation is local. Physical printer output and production deployment have not been verified. Browser-generated closing HTML and saved-snapshot reprint behavior were checked.

