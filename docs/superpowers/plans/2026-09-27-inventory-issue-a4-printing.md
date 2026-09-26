# Inventory Issue A4 Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows desktop print helper that automatically routes every completed inventory issue to one configured A4 printer, exposes queue/printer controls, and is downloadable from `/tai-cai-dat-may-in` without changing receipt printing.

**Architecture:** Completing an inventory issue atomically creates a server-side print job. A self-contained .NET 8 WinForms application claims jobs with leases, renders them through the selected Windows printer driver, and manages the queue from a tray UI; the React application shows print status and provides reprint fallback. The installer executable self-installs, registers interactive logon startup, and is distributed through the existing R2 download pattern.

**Tech Stack:** PHP 8.2/PDO/MySQL, React 18/TypeScript/Vite, .NET 8 WinForms/System.Drawing.Printing, PowerShell, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-09-27-inventory-issue-a4-printing-design.md`

## Global Constraints

- Bill printing in `src/app/(dashboard)/pos/page.tsx` remains unchanged and continues to use each workstation's Windows default printer.
- Inventory issue output is A4 portrait and targets a printer selected from Windows-installed printers.
- Queue cancellation never deletes inventory issues or print history and only affects `pending`/`failed` jobs for the authorized store.
- The helper starts automatically after the cashier signs in to Windows, remains available in the system tray, and runs one instance per Windows session.
- Credentials are never logged or stored as plaintext; protect them with Windows DPAPI and restrict the local data directory ACL.
- Windows x64 is the only desktop target for the first release.
- The public download route is exactly `/tai-cai-dat-may-in`.

## Review Focus

- Two helpers claim at the same time: exactly one receives a lease and the other receives no printable job; covered by Task 2 API smoke scenarios.
- Windows accepts a spool request but the completion callback cannot reach the API: mark the job `uncertain` and never automatically duplicate it; covered by Task 4 worker tests.
- A configured printer is removed or renamed: keep the worker paused, show a clear error, and require a new printer selection; covered by Task 4 printer tests and Task 5 UI tests.
- A user clicks **Hủy toàn bộ** while a job is processing: only `pending`/`failed` jobs become `cancelled`; covered by Task 2 domain and API tests.
- Windows starts before networking is ready: the tray application stays alive and reconnects with bounded backoff; covered by Task 4 worker tests and Task 5 startup verification.

## File Structure

- `database/inventory_issue_print_jobs_patch.sql`: production migration for the durable print queue.
- `public/api/_lib/inventory_issue_print_jobs.php`: queue schema compatibility, state rules, claim/lease helpers, and payload mapping.
- `public/api/inventory-issue-print-jobs.php`: authenticated queue API for web and Windows clients.
- `public/api/inventory-issues.php`: create the initial job in the completion transaction and expose latest print status.
- `src/services/inventoryIssuePrintJobService.ts`: typed web queue API.
- `src/app/(dashboard)/product/issues/printStatus.ts`: pure labels/styles/actions for testable UI behavior.
- `src/app/(dashboard)/product/issues/page.tsx`: print status, reprint, and manual browser fallback.
- `agent/windows/InventoryPrintHelper/*`: focused WinForms application files for settings, API, worker, printer, tray UI, setup, and startup.
- `agent/windows/InventoryPrintHelper.Tests/*`: dependency-free console test runner for desktop core behavior.
- `agent/windows/InventoryPrintHelper/publish.ps1`: self-contained win-x64 packaging.
- `public/api/download-inventory-print-helper.php`: signed R2 redirects for EXE/ZIP.
- `src/app/download-inventory-print-helper/page.tsx`: public download instructions.
- `scripts/upload-inventory-print-helper.php`: upload plus checksum verification.

---

### Task 1: Durable Queue Domain and Atomic Job Creation

**Files:**
- Create: `database/inventory_issue_print_jobs_patch.sql`
- Create: `public/api/_lib/inventory_issue_print_jobs.php`
- Create: `scripts/inventory-issue-print-jobs-domain-test.php`
- Modify: `public/api/inventory-issues.php`

**Interfaces:**
- Produces: `inventory_issue_print_jobs_ensure_schema(): void`
- Produces: `inventory_issue_print_jobs_create_initial(PDO $pdo, string $issueId, string $storeId): void`
- Produces: `inventory_issue_print_jobs_latest(string $issueId): ?array`
- Produces: `inventory_issue_print_jobs_can_cancel(string $status): bool`
- Produces: `InventoryIssue.printJob: {id,status,attemptNumber,terminalName,printedAt,lastError}|null`

- [ ] **Step 1: Write the failing domain test**

Create assertions that only `pending` and `failed` can be cancelled; `processing`, `printed`, `cancelled`, and `uncertain` cannot. Assert that public payloads never contain `claim_token`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `php scripts/inventory-issue-print-jobs-domain-test.php`
Expected: FAIL because the queue domain functions do not exist.

- [ ] **Step 3: Add the migration and queue domain helpers**

Define the six statuses from the spec, unique `(issue_id, attempt_number)`, store/status/lease indexes, claim metadata, retry count, timestamps, and a foreign key to `inventory_issues(id)`. Keep schema compatibility in the PHP helper for existing installations.

- [ ] **Step 4: Create the initial job atomically on completion**

Call `inventory_issue_print_jobs_create_initial($pdo, $id, $storeId)` before the existing inventory completion transaction commits. Use attempt `1` plus the unique constraint so a repeated completion request cannot duplicate the initial job, and attach `inventory_issue_print_jobs_latest()` to `inventory_issues_payload()`.

- [ ] **Step 5: Run focused verification**

Run: `php scripts/inventory-issue-print-jobs-domain-test.php`
Expected: PASS.

Run: `php -l public/api/_lib/inventory_issue_print_jobs.php; php -l public/api/inventory-issues.php`
Expected: both report no syntax errors.

- [ ] **Step 6: Commit**

```bash
git add database/inventory_issue_print_jobs_patch.sql public/api/_lib/inventory_issue_print_jobs.php public/api/inventory-issues.php scripts/inventory-issue-print-jobs-domain-test.php
git commit -m "feat: queue inventory issue print jobs"
```

### Task 2: Authenticated Claim, Completion, Retry, and Cancellation API

**Files:**
- Create: `public/api/inventory-issue-print-jobs.php`
- Create: `scripts/inventory-issue-print-jobs-api-smoke.php`
- Modify: `public/api/_lib/inventory_issue_print_jobs.php`

**Interfaces:**
- Consumes: queue schema and payload functions from Task 1.
- Produces: `GET /api/inventory-issue-print-jobs.php?storeId=<id>` returning `{items: PrintJob[]}`.
- Produces: `POST /api/inventory-issue-print-jobs.php` actions `claim`, `printed`, `failed`, `uncertain`, `retry`, `cancel`, and `cancel-all`.
- Produces: `claim` response `{item: PrintJob|null, claimToken?: string}` with issue metadata and item lines needed for A4 rendering.

- [ ] **Step 1: Write the API smoke scenarios**

Cover unauthorized access, store scoping, two claim requests for one job, expired lease reclaim, wrong-token completion, `cancel-all` preserving `processing`/`printed`, retrying `failed`, and marking an accepted-but-unconfirmed job `uncertain`.

- [ ] **Step 2: Run the smoke script against a disposable configured database and verify failure**

Run: `php scripts/inventory-issue-print-jobs-api-smoke.php`
Expected: FAIL because the endpoint does not exist. The script must refuse to run unless its documented `TN_PRINT_TEST_*` variables target a non-production store/database.

- [ ] **Step 3: Implement transactional queue actions**

Use `SELECT ... FOR UPDATE`, a random claim token, a 60-second lease, compare-and-update predicates on status/token, and store authorization through `field_inventory_require_store()`. Limit returned errors to 500 characters and exclude secrets.

- [ ] **Step 4: Run API and syntax verification**

Run: `php -l public/api/inventory-issue-print-jobs.php; php scripts/inventory-issue-print-jobs-domain-test.php`
Expected: syntax PASS and domain PASS.

Run when disposable DB variables are configured: `php scripts/inventory-issue-print-jobs-api-smoke.php`
Expected: all queue scenarios PASS and test rows are removed in `finally`.

- [ ] **Step 5: Commit**

```bash
git add public/api/inventory-issue-print-jobs.php public/api/_lib/inventory_issue_print_jobs.php scripts/inventory-issue-print-jobs-api-smoke.php
git commit -m "feat: add inventory print queue API"
```

### Task 3: Inventory Issue Web Status and Reprint Controls

**Files:**
- Create: `src/app/(dashboard)/product/issues/printStatus.ts`
- Create: `src/app/(dashboard)/product/issues/printStatus.test.ts`
- Create: `src/services/inventoryIssuePrintJobService.ts`
- Modify: `src/services/inventoryIssueService.ts`
- Modify: `src/app/(dashboard)/product/issues/page.tsx`
- Modify: `src/app/(dashboard)/product/issues/inventoryIssuePrint.ts`

**Interfaces:**
- Consumes: `InventoryIssue.printJob` and Task 2 retry action.
- Produces: `requestInventoryIssueReprint(issueId: string, storeId: string): Promise<PrintJob>`.
- Produces: `getPrintStatusPresentation(status): {label,className,canReprint}`.
- Produces: explicit **In lại A4** and **In thủ công** actions.

- [ ] **Step 1: Write failing status presentation tests**

Assert exact Vietnamese labels for `pending`, `processing`, `printed`, `failed`, `cancelled`, and `uncertain`; only terminal error/cancel/uncertain states expose reprint, while browser fallback remains available for completed issues.

- [ ] **Step 2: Run the test to verify failure**

Run: `node --test "src/app/(dashboard)/product/issues/printStatus.test.ts"`
Expected: FAIL because `printStatus.ts` does not exist.

- [ ] **Step 3: Implement types, service, and UI**

Extend `InventoryIssue` with the exact Task 1 payload, add the reprint client, render status beside each completed issue, replace ambiguous **In** copy with **In thủ công**, and reload after a successful A4 reprint request. Do not touch POS receipt printing.

- [ ] **Step 4: Run focused and application verification**

Run: `node --test "src/app/(dashboard)/product/issues/printStatus.test.ts" "src/app/(dashboard)/product/issues/inventoryIssuePrint.test.ts"`
Expected: PASS.

Run: `npm run build`
Expected: Vite client, SSR build, and prerender complete successfully.

- [ ] **Step 5: Commit**

```bash
git add -- src/services/inventoryIssueService.ts src/services/inventoryIssuePrintJobService.ts "src/app/(dashboard)/product/issues"
git commit -m "feat: show inventory issue print status"
```

### Task 4: Windows Helper Core, API Client, and A4 Printing

**Files:**
- Create: `agent/windows/InventoryPrintHelper/InventoryPrintHelper.csproj`
- Create: `agent/windows/InventoryPrintHelper/Models.cs`
- Create: `agent/windows/InventoryPrintHelper/ApiClient.cs`
- Create: `agent/windows/InventoryPrintHelper/PrintJobWorker.cs`
- Create: `agent/windows/InventoryPrintHelper/InventoryIssuePrinter.cs`
- Create: `agent/windows/InventoryPrintHelper/PrintLayout.cs`
- Create: `agent/windows/InventoryPrintHelper/PrinterCatalog.cs`
- Create: `agent/windows/InventoryPrintHelper/AppLog.cs`
- Create: `agent/windows/InventoryPrintHelper.Tests/InventoryPrintHelper.Tests.csproj`
- Create: `agent/windows/InventoryPrintHelper.Tests/Program.cs`

**Interfaces:**
- Consumes: Task 2 queue API.
- Produces: `IPrintJobApi.ClaimAsync/MarkPrintedAsync/MarkFailedAsync/MarkUncertainAsync/ListAsync/RetryAsync/CancelAsync/CancelAllAsync`.
- Produces: `IInventoryIssuePrinter.Print(PrintJob job, string printerName): PrintResult`.
- Produces: `PrintJobWorker.ProcessOnceAsync(CancellationToken): Task<WorkerSnapshot>` and pause/resume state.
- Produces: `PrinterCatalog.GetInstalled(): IReadOnlyList<PrinterInfo>`.

- [ ] **Step 1: Write the failing desktop core tests**

Use fakes to assert sequential claims, bounded reconnect backoff, pause preventing claims, successful spool acknowledgement, printer failure reporting `failed`, callback failure after spool reporting `uncertain`, missing configured printer pausing the worker, and deterministic A4 pagination for long item lists.

- [ ] **Step 2: Run the desktop tests to verify failure**

Run: `dotnet run --project agent/windows/InventoryPrintHelper.Tests/InventoryPrintHelper.Tests.csproj`
Expected: build FAIL because the helper core does not exist.

- [ ] **Step 3: Implement the models, API client, and worker state machine**

Use one polling loop, `HttpClient` timeouts, 1–30 second bounded exponential reconnect delay, a 60-second server lease, and cancellation tokens. Never log request authorization or protected settings.

- [ ] **Step 4: Implement Windows printer discovery and A4 renderer**

Set `PrinterSettings.PrinterName`, validate `IsValid`, select A4 portrait, draw header/meta/table/signatures with Vietnamese-capable system fonts, and paginate repeated table headers without splitting a row.

- [ ] **Step 5: Run desktop core tests**

Run: `dotnet run --project agent/windows/InventoryPrintHelper.Tests/InventoryPrintHelper.Tests.csproj`
Expected: all named tests PASS.

- [ ] **Step 6: Commit**

```bash
git add agent/windows/InventoryPrintHelper agent/windows/InventoryPrintHelper.Tests
git commit -m "feat: add A4 inventory print worker"
```

### Task 5: Tray Management UI, Protected Settings, and Self-Installing Startup

**Files:**
- Create: `agent/windows/InventoryPrintHelper/Program.cs`
- Create: `agent/windows/InventoryPrintHelper/TrayApplicationContext.cs`
- Create: `agent/windows/InventoryPrintHelper/MainForm.cs`
- Create: `agent/windows/InventoryPrintHelper/SetupWizard.cs`
- Create: `agent/windows/InventoryPrintHelper/SettingsStore.cs`
- Create: `agent/windows/InventoryPrintHelper/CredentialStore.cs`
- Create: `agent/windows/InventoryPrintHelper/AppPaths.cs`
- Create: `agent/windows/InventoryPrintHelper/StartupRegistrar.cs`
- Create: `agent/windows/InventoryPrintHelper/SingleInstance.cs`
- Modify: `agent/windows/InventoryPrintHelper.Tests/Program.cs`

**Interfaces:**
- Consumes: worker snapshot, queue actions, and printer catalog from Task 4.
- Produces: setup wizard fields for printer/store/API/login, rescan, API check, and test print.
- Produces: tray commands `Open`, `Pause`, `Resume`, `Test print`, and `Exit`.
- Produces: queue management commands `Retry`, `Cancel`, and confirmed `Cancel all`.
- Produces: `StartupRegistrar.InstallForInteractiveLogon(string executablePath)` and `Uninstall()`.

- [ ] **Step 1: Add failing settings/startup/UI-state tests**

Assert DPAPI round-trip without plaintext password in the settings file, one-instance mutex naming, interactive-logon task XML with restart settings, cancel-all confirmation semantics, removed-printer selection state, and close-to-tray versus explicit exit.

- [ ] **Step 2: Run tests to verify failure**

Run: `dotnet run --project agent/windows/InventoryPrintHelper.Tests/InventoryPrintHelper.Tests.csproj`
Expected: FAIL on missing settings/startup/UI-state implementations.

- [ ] **Step 3: Implement settings, credentials, self-install, and startup**

Install the self-contained executable to `C:\Program Files\TNCompany\InventoryPrintHelper`, store machine data under `C:\ProgramData\TNCompany\InventoryPrintHelper`, apply ACLs for the installing user/SYSTEM/Administrators, and register a Task Scheduler `InteractiveToken` logon task with single-instance and restart-on-failure settings.

- [ ] **Step 4: Implement the WinForms setup wizard, tray, dashboard, printer, and queue views**

Keep UI actions async and disable mutation buttons while requests run. Refresh local printer state immediately and queue state every five seconds while the window is open; closing hides to tray.

- [ ] **Step 5: Run desktop tests and manual dry-run**

Run: `dotnet run --project agent/windows/InventoryPrintHelper.Tests/InventoryPrintHelper.Tests.csproj`
Expected: all tests PASS.

Run: `dotnet run --project agent/windows/InventoryPrintHelper/InventoryPrintHelper.csproj -- --dry-run`
Expected: setup/management UI opens, installed printers are listed, no physical print or production API mutation occurs, and closing hides to tray.

- [ ] **Step 6: Commit**

```bash
git add agent/windows/InventoryPrintHelper agent/windows/InventoryPrintHelper.Tests
git commit -m "feat: add inventory print helper desktop UI"
```

### Task 6: Installer Publishing, R2 Download Endpoint, and Public Page

**Files:**
- Create: `agent/windows/InventoryPrintHelper/publish.ps1`
- Create: `scripts/upload-inventory-print-helper.php`
- Create: `public/api/download-inventory-print-helper.php`
- Create: `src/app/download-inventory-print-helper/page.tsx`
- Create: `src/app/download-inventory-print-helper/downloadConfig.ts`
- Create: `src/app/download-inventory-print-helper/downloadConfig.test.ts`
- Modify: `src/App.jsx`
- Modify: `package.json`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the Task 5 self-installing executable.
- Produces: `artifacts/TN-Company-Inventory-Print-Helper-Setup.exe` and ZIP fallback.
- Produces: `/api/download-inventory-print-helper.php?format=exe|zip`.
- Produces: `/tai-cai-dat-may-in`.

- [ ] **Step 1: Write the failing download configuration test**

Assert the exact public page path, EXE/ZIP endpoint URLs, Windows x64 copy, USB-driver prerequisite, auto-start wording, and SHA-256 metadata shape.

- [ ] **Step 2: Run the test to verify failure**

Run: `node --test src/app/download-inventory-print-helper/downloadConfig.test.ts`
Expected: FAIL because download configuration does not exist.

- [ ] **Step 3: Implement self-contained publishing and upload verification**

Publish `win-x64 --self-contained true /p:PublishSingleFile=true`, copy the executable to the exact Setup filename, create the ZIP, compute SHA-256 files, upload both to `installers/inventory-print-helper/`, download each through a short-lived signed URL, and reject a checksum mismatch.

- [ ] **Step 4: Implement the signed download endpoint and public React page**

Follow the existing R2 configuration helper pattern without exposing credentials. Add the exact `/tai-cai-dat-may-in` route with EXE recommended, ZIP fallback, installation instructions, and checksums.

- [ ] **Step 5: Add CI verification**

Add desktop core tests and PHP syntax/domain tests before the production web build. Do not upload R2 artifacts from CI; artifact publication remains an explicit release action.

- [ ] **Step 6: Run packaging and web verification**

Run: `powershell -ExecutionPolicy Bypass -File agent/windows/InventoryPrintHelper/publish.ps1`
Expected: EXE, ZIP, and SHA-256 files exist under `artifacts/`.

Run: `node --test src/app/download-inventory-print-helper/downloadConfig.test.ts; npm run build`
Expected: test PASS and build completes.

- [ ] **Step 7: Commit**

```bash
git add agent/windows/InventoryPrintHelper/publish.ps1 scripts/upload-inventory-print-helper.php public/api/download-inventory-print-helper.php src/app/download-inventory-print-helper src/App.jsx package.json .github/workflows/deploy.yml
git commit -m "feat: publish inventory print helper installer"
```

### Task 7: Full Verification, Artifact Publication, and Production URL

**Files:**
- Modify if verification finds defects: files owned by Tasks 1–6 only.
- Verify: `artifacts/TN-Company-Inventory-Print-Helper-Setup.exe`
- Verify: `artifacts/tn-company-inventory-print-helper-windows-x64.zip`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: verified R2 artifacts and live `https://tnservice.vn/tai-cai-dat-may-in`.

- [ ] **Step 1: Run the complete local verification suite**

Run: `php scripts/inventory-issue-print-jobs-domain-test.php; php -l public/api/inventory-issues.php; php -l public/api/inventory-issue-print-jobs.php; php -l public/api/download-inventory-print-helper.php`
Expected: all PASS.

Run: `node --test "src/app/(dashboard)/product/issues/printStatus.test.ts" "src/app/(dashboard)/product/issues/inventoryIssuePrint.test.ts" src/app/download-inventory-print-helper/downloadConfig.test.ts`
Expected: all PASS.

Run: `dotnet run --project agent/windows/InventoryPrintHelper.Tests/InventoryPrintHelper.Tests.csproj; npm run build`
Expected: desktop tests and production build PASS.

- [ ] **Step 2: Publish and inspect artifacts**

Run: `powershell -ExecutionPolicy Bypass -File agent/windows/InventoryPrintHelper/publish.ps1`
Expected: artifact names and checksums match Task 6, and the EXE launches in `--dry-run` mode on Windows x64.

- [ ] **Step 3: Upload artifacts to R2 and verify checksums**

Run: `php scripts/upload-inventory-print-helper.php`
Expected: JSON reports both uploaded keys, byte counts, and matching SHA-256 values. This step requires configured R2 credentials and network approval.

- [ ] **Step 4: Deploy through the existing protected production workflow**

Push the reviewed commits to `main`, which triggers `.github/workflows/deploy.yml`; wait for the workflow to pass before reporting a live URL. Do not bypass the workflow or edit production files directly.

- [ ] **Step 5: Verify public behavior**

Run: `curl.exe --fail --location https://tnservice.vn/tai-cai-dat-may-in`
Expected: HTTP 200 page containing `TN Company Inventory Print Helper`.

Run: `curl.exe --fail --head "https://tnservice.vn/api/download-inventory-print-helper.php?format=exe"`
Expected: successful redirect to a signed artifact URL with attachment filename `TN-Company-Inventory-Print-Helper-Setup.exe`.

- [ ] **Step 6: Record final evidence**

Report test/build results, artifact SHA-256, deployment workflow result, live page URL, and the remaining requirement for a physical USB-printer acceptance test if that hardware was unavailable during development.

- [ ] **Step 7: Commit verification-only fixes if any**

If verification required changes, stage only the concrete files edited in Tasks 1–6, inspect `git diff --cached`, then run `git commit -m "fix: complete inventory print helper verification"`. Skip this step when verification produced no code changes.
